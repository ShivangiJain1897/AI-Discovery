/**
 * The conversation.
 *
 * After the first results land, the PM keeps talking to the discovery. They
 * shouldn't have to say which KIND of thing they want — "why do you think that?",
 * "look into the compliance angle", "make me a PRD", "the backlog is too vague,
 * add acceptance criteria" and "actually, support logged 1,200 calls on this"
 * all go in the same box. This works out which it is and does it.
 */
import { getProvider } from "../llm/provider";
import { DOCUMENTS, getDocument } from "./documents";
import { generateDocument, researchBlock } from "./generate";
import { LENSES, getLens, lensName } from "./lenses";
import { runLens, summarize } from "./run";
import type { Discovery, DocumentId, LensId, Turn, TurnAction } from "./types";

export type Intent =
  | { kind: "answer" }
  | { kind: "research"; lensIds: LensId[] }
  | { kind: "document"; documentId: DocumentId }
  | { kind: "refine"; documentId: DocumentId; instruction: string }
  | { kind: "context" };

const DOC_IDS = DOCUMENTS.map((d) => d.id);

/* ------------------------------ classifying ------------------------------ */

export async function classify(d: Discovery, message: string): Promise<Intent> {
  const provider = await getProvider();
  if (provider.mode === "live") {
    try {
      const live = await classifyLive(d, message);
      if (live) return live;
    } catch {
      /* fall back to keywords */
    }
  }
  return classifyHeuristic(d, message);
}

async function classifyLive(d: Discovery, message: string): Promise<Intent | null> {
  const provider = await getProvider();
  const made = d.documents.map((x) => x.documentId);
  const raw = await provider.generateJson<{
    kind?: string;
    lensIds?: string[];
    documentId?: string;
    instruction?: string;
  }>({
    system: `You work out what a product manager wants, from one message typed into a discovery they already have results for. You only classify — you never answer the message itself.`,
    prompt: `They already have: research from ${d.lenses.map((l) => l.lensId).join(", ") || "nothing"}${
      made.length ? `, and these documents: ${made.join(", ")}` : ", and no documents yet"
    }.

Research lenses available: ${LENSES.map((l) => `${l.id} (${l.blurb})`).join("; ")}
Documents available: ${DOCUMENTS.map((x) => `${x.id} (${x.blurb})`).join("; ")}

THEIR MESSAGE:
"""
${message.slice(0, 2000)}
"""

Which is it?
- "answer" — a question about the idea or what the research found. Also use this for open-ended thinking-out-loud.
- "research" — they want something looked into that isn't covered, or want a lens re-run. Pick the closest lens ids.
- "document" — they want one of the documents produced.
- "refine" — they want an existing document changed. Only if that document already exists.
- "context" — they are TELLING you a fact about their product, users, numbers or constraints, not asking for anything.

Return JSON: { "kind": "...", "lensIds": ["..."], "documentId": "...", "instruction": "what to change, for refine" }
Only include the fields the kind needs. Prefer "answer" when unsure.`,
    maxTokens: 400,
  });

  const kind = String(raw?.kind ?? "").trim();
  if (kind === "research") {
    const ids = (raw?.lensIds ?? []).filter((x) => getLens(x)) as LensId[];
    if (ids.length) return { kind: "research", lensIds: ids };
    return { kind: "answer" };
  }
  if (kind === "document" && DOC_IDS.includes(raw?.documentId as DocumentId)) {
    return { kind: "document", documentId: raw!.documentId as DocumentId };
  }
  if (kind === "refine" && DOC_IDS.includes(raw?.documentId as DocumentId)) {
    const exists = d.documents.some((x) => x.documentId === raw!.documentId);
    if (exists) {
      return { kind: "refine", documentId: raw!.documentId as DocumentId, instruction: String(raw?.instruction ?? message) };
    }
    // Asked to refine something that doesn't exist yet — just make it.
    return { kind: "document", documentId: raw!.documentId as DocumentId };
  }
  if (kind === "context") return { kind: "context" };
  if (kind === "answer") return { kind: "answer" };
  return null;
}

/** Keyword routing, for demo mode and when the live classifier fails. */
export function classifyHeuristic(d: Discovery, message: string): Intent {
  const t = message.toLowerCase();

  const docHit = DOCUMENTS.find((doc) => {
    const words: Record<DocumentId, RegExp> = {
      use_cases: /use case|user story|user stories|scenario/,
      prd: /\bprd\b|spec|requirement/,
      backlog: /backlog|epic|stories|sprint/,
      business_case: /business case|roi|cost|investment|budget/,
    };
    return words[doc.id].test(t);
  });

  const wantsChange = /\b(refine|revise|redo|rewrite|change|update|improve|expand|shorten|add|remove|more detail|too (vague|long|short|generic))\b/.test(t);

  if (docHit) {
    const exists = d.documents.some((x) => x.documentId === docHit.id);
    if (exists && wantsChange) return { kind: "refine", documentId: docHit.id, instruction: message };
    return { kind: "document", documentId: docHit.id };
  }

  if (/\b(research|look into|dig into|investigate|find out|check|explore)\b/.test(t)) {
    const hits = LENSES.filter((l) => {
      const words: Record<LensId, RegExp> = {
        user_research: /user|customer|persona|need|pain/,
        market: /market|competit|rival|alternative|pricing|category/,
        bugs: /bug|defect|support|complaint|issue|error/,
        process: /process|workflow|operation|handoff|manual/,
        compliance: /complian|regulat|legal|privacy|security|risk|gdpr|hipaa/,
        feasibility: /feasib|technical|build|data|integrat|effort|engineer/,
      };
      return words[l.id].test(t);
    }).map((l) => l.id);
    if (hits.length) return { kind: "research", lensIds: hits };
  }

  // Left over: is this a question, a request, or the PM telling us something?
  // A plain declarative sentence that asks for nothing is context worth keeping.
  const isQuestion =
    t.includes("?") ||
    /^(why|what|how|who|when|where|which|is|are|do|does|did|can|could|should|would|will|tell me)\b/.test(t.trim());
  const isRequest =
    /\b(write|make|create|generate|produce|draft|show|give|add|remove|update|revise|rewrite|change|expand|shorten|research|look into|investigate|explore|explain|summari[sz]e|compare|please|can you)\b/.test(t);
  if (!isQuestion && !isRequest) return { kind: "context" };

  return { kind: "answer" };
}

/* ------------------------------- executing ------------------------------- */

export interface ChatResult {
  discovery: Discovery;
  turns: Turn[];
}

/** Run one turn of the conversation, mutating and returning the discovery. */
export async function handleMessage(d: Discovery, message: string): Promise<ChatResult> {
  const userTurn = turn("user", message);
  d.turns.push(userTurn);

  const intent = await classify(d, message);
  let reply: Turn;

  switch (intent.kind) {
    case "research":
      reply = await doResearch(d, intent.lensIds);
      break;
    case "document":
      reply = await doDocument(d, intent.documentId);
      break;
    case "refine":
      reply = await doRefine(d, intent.documentId, intent.instruction);
      break;
    case "context":
      reply = doContext(d, message);
      break;
    default:
      reply = await doAnswer(d, message);
  }

  d.turns.push(reply);
  return { discovery: d, turns: [userTurn, reply] };
}

function turn(role: "user" | "assistant", text: string, action?: TurnAction): Turn {
  return {
    id: `t_${Math.random().toString(36).slice(2, 9)}`,
    role,
    text,
    action,
    createdAt: Date.now(),
  };
}

/** Answer a question from what the research actually found. */
async function doAnswer(d: Discovery, message: string): Promise<Turn> {
  const provider = await getProvider();
  if (provider.mode !== "live") {
    return turn(
      "assistant",
      "I can't answer questions in demo mode — there's no model behind it. Add an ANTHROPIC_API_KEY and the discovery will be able to answer from its research.",
      { kind: "answer", label: "Couldn't answer — demo mode" }
    );
  }

  const history = d.turns
    .slice(-8)
    .map((t) => `${t.role === "user" ? "PM" : "You"}: ${t.text.slice(0, 600)}`)
    .join("\n");

  try {
    const raw = await provider.generateJson<{ answer?: string }>({
      system: `You are helping a product manager think about a product idea you have already researched.

Answer from the research you're given. Be direct and specific.

- If the research covers it, answer and say which lens it came from.
- If it doesn't, say so plainly and name which research would settle it, so they can ask for it. Do not fill the gap with plausible-sounding invention.
- Never make up numbers, quotes, competitors or metrics.
- If they're challenging a finding, engage with it honestly. If they're right, say so.
- Keep it short. A few sentences unless the question genuinely needs more.`,
      prompt: `${researchBlock(d)}

RECENT CONVERSATION:
${history || "(none)"}

THE PM ASKS:
"""
${message.slice(0, 2000)}
"""

Return JSON: { "answer": "your reply, in plain prose" }`,
      maxTokens: 1600,
    });
    const answer = String(raw?.answer ?? "").trim();
    if (answer) return turn("assistant", answer, { kind: "answer", label: "Answered from the research" });
  } catch (err) {
    return turn(
      "assistant",
      `I couldn't answer that: ${err instanceof Error ? err.message : String(err)}`,
      { kind: "answer", label: "Couldn't answer" }
    );
  }
  return turn("assistant", "I couldn't produce an answer to that — try rephrasing?", {
    kind: "answer",
    label: "Couldn't answer",
  });
}

/** Run more research and fold it into the findings. */
async function doResearch(d: Discovery, lensIds: LensId[]): Promise<Turn> {
  const results = await Promise.all(
    lensIds.map(async (id) => {
      try {
        const r = await runLens(id, d.idea, d.kind, d.context, d.notes);
        return { lensId: id, status: "done" as const, ...r };
      } catch (err) {
        return {
          lensId: id,
          status: "error" as const,
          summary: "",
          findings: [],
          gaps: [],
          sources: [],
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  // Replace an existing lens's results, or add it.
  for (const r of results) {
    const i = d.lenses.findIndex((l) => l.lensId === r.lensId);
    if (i >= 0) d.lenses[i] = r;
    else d.lenses.push(r);
  }

  d.summary = await summarize(d.idea, d.kind, d.context, d.lenses, d.notes);

  const names = lensIds.map(lensName).join(" and ");
  const found = results.reduce((n, r) => n + r.findings.length, 0);
  const failed = results.filter((r) => r.status === "error");
  const text = failed.length
    ? `Ran ${names}, but ${failed.map((f) => lensName(f.lensId)).join(" and ")} failed: ${failed[0].error}`
    : `Ran ${names} — ${found} finding${found === 1 ? "" : "s"}, added to the research above. The summary has been updated.`;

  return turn("assistant", text, { kind: "research", label: `Researched ${names}`, lensIds });
}

/** Write a document from the research already gathered. */
async function doDocument(d: Discovery, documentId: DocumentId): Promise<Turn> {
  const doc = await generateDocument(d, documentId);
  d.documents.push(doc);
  const def = getDocument(documentId);
  const prose = def?.prose ?? documentId;
  return turn("assistant", `Here's the ${prose}, written from the research above.`, {
    kind: "document",
    label: `Wrote the ${prose}`,
    docId: doc.id,
  });
}

/** Rewrite an existing document with the PM's instruction applied. */
async function doRefine(d: Discovery, documentId: DocumentId, instruction: string): Promise<Turn> {
  const previous = [...d.documents].reverse().find((x) => x.documentId === documentId);
  const doc = await generateDocument(d, documentId, { instruction, previous });
  d.documents.push(doc);
  const prose = getDocument(documentId)?.prose ?? documentId;
  return turn("assistant", `Updated the ${prose} — version ${doc.version}.`, {
    kind: "refine",
    label: `Revised the ${prose}`,
    docId: doc.id,
  });
}

/** The PM supplied a fact. Keep it; it feeds everything generated afterwards. */
function doContext(d: Discovery, message: string): Turn {
  d.notes.push(message.trim());
  return turn(
    "assistant",
    "Noted — I'll use that in everything I write from here. Say \"research again\" if you want it folded into the findings too.",
    { kind: "context", label: "Added your context" }
  );
}
