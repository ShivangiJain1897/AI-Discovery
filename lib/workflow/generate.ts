/**
 * Generators — turn the VALIDATED findings into a deliverable.
 * Only findings the user didn't mark "incorrect" are used, plus their notes
 * and the business-context foundation.
 *
 *   kind "prd" + variant "feature"  → a focused, single-feature PRD
 *   kind "prd" + variant "product"  → a fuller, whole-product PRD
 *   kind "backlog"                  → a prioritized backlog
 */
import { getProvider } from "../llm/provider";
import { getAgent } from "./agents";
import type { GeneratedOutput, PrdVariant, Workflow } from "./types";

interface Section { heading: string; body?: string; bullets?: string[] }

/** Collect the validated findings + notes as readable context. */
function validatedContext(w: Workflow): { blocks: string[]; perAgent: { id: string; name: string; bullets: string[]; notes?: string }[] } {
  const blocks: string[] = [];
  const perAgent: { id: string; name: string; bullets: string[]; notes?: string }[] = [];
  for (const a of w.agents) {
    if (!a.selected || a.status !== "complete") continue;
    const kept = a.findings.filter((f) => f.verdict !== "incorrect");
    if (kept.length === 0 && !a.userNotes) continue;
    const name = getAgent(a.agentId)?.name ?? a.agentId;
    const bullets = kept.map((f) => `${f.title}: ${f.detail}`);
    if (a.userNotes) bullets.push(`(Team note) ${a.userNotes}`);
    perAgent.push({ id: a.agentId, name, bullets: kept.map((f) => f.title), notes: a.userNotes });
    blocks.push(`## ${name}\n${bullets.map((b) => `- ${b}`).join("\n")}`);
  }
  return { blocks, perAgent };
}

/** Pull one agent's kept findings (title + detail) for richer sections. */
function agentDetail(w: Workflow, agentId: string): { title: string; detail: string }[] {
  const a = w.agents.find((x) => x.agentId === agentId);
  if (!a || a.status !== "complete") return [];
  return a.findings.filter((f) => f.verdict !== "incorrect").map((f) => ({ title: f.title, detail: f.detail }));
}

function contextMap(w: Workflow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of w.context ?? []) if (f.value.trim()) out[f.id] = f.value.trim();
  return out;
}

function contextSection(w: Workflow): Section | null {
  const c = contextMap(w);
  const bullets: string[] = [];
  if (c.industry) bullets.push(`Industry / domain: ${c.industry}`);
  if (c.business_process) bullets.push(`Business process: ${c.business_process}`);
  if (c.objective) bullets.push(`Objective: ${c.objective}`);
  if (c.source) bullets.push(`Origin: ${c.source}`);
  if (c.stakeholders) bullets.push(`Stakeholders: ${c.stakeholders}`);
  return bullets.length ? { heading: "Business Context", bullets } : null;
}

function contextText(w: Workflow): string {
  const c = contextMap(w);
  return Object.entries(c).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

export async function generate(
  w: Workflow,
  kind: "prd" | "backlog",
  variant: PrdVariant = "feature"
): Promise<GeneratedOutput> {
  const provider = await getProvider();
  const { blocks } = validatedContext(w);
  let sections: Section[];

  if (provider.mode === "live") {
    try {
      sections = await live(w, kind, variant, blocks.join("\n\n"));
    } catch {
      sections = demo(w, kind, variant);
    }
  } else {
    sections = demo(w, kind, variant);
  }

  const isProduct = kind === "prd" && variant === "product";
  const title =
    kind === "backlog"
      ? "Prioritized backlog"
      : isProduct
        ? "Product PRD"
        : "Feature PRD";

  return {
    id: `${kind}_${Math.random().toString(36).slice(2, 7)}`,
    kind,
    variant: kind === "prd" ? variant : undefined,
    title,
    sections,
    createdAt: Date.now(),
  };
}

async function live(w: Workflow, kind: "prd" | "backlog", variant: PrdVariant, context: string): Promise<Section[]> {
  const provider = await getProvider();
  const shape = `Return JSON { "sections": [ { "heading": string, "body": string, "bullets": string[] } ] }.`;
  let ask: string;
  if (kind === "backlog") {
    ask = "Produce a prioritized product backlog: sections grouped as Now / Next / Later, each with bullet items derived from the findings. Add a short 'How this was prioritized' note.";
  } else if (variant === "product") {
    ask =
      "Write a DETAILED, whole-PRODUCT PRD. Include these sections in order: Executive Summary; Business Context & Objectives; Target Users & Personas; Problem Statement; Market & Competitive Landscape; Product Vision & Strategy; Scope (In / Out); Key Features & Epics; Functional Requirements; Regulatory, Privacy & Compliance; Success Metrics & KPIs; Rollout & GTM; Risks, Dependencies & Assumptions; Milestones; Open Questions. Be specific and ground every section in the business context and validated findings.";
  } else {
    ask =
      "Write a detailed, single-FEATURE PRD. Include these sections in order: Overview; Business Context; Problem & Users; Goals & Non-Goals; User Stories & Acceptance Criteria; Functional Requirements; Edge Cases & Error States; Regulatory & Compliance; Dependencies & Risks; Success Metrics; Rollout Plan; Open Questions. Be concrete and ground it in the findings.";
  }
  const raw = await provider.generateJson<{ sections?: Section[] }>({
    system: "You are a senior product manager turning validated discovery findings into a polished, detailed deliverable a team can act on.",
    prompt: `ORIGINAL INPUT (${w.inputType}):\n"""\n${w.input.slice(0, 3000)}\n"""\n\nBUSINESS CONTEXT:\n${contextText(w) || "(none captured)"}\n\nVALIDATED FINDINGS:\n${context || "(none)"}\n\n${ask}\n\n${shape}`,
    maxTokens: 3600,
  });
  const s = Array.isArray(raw?.sections) ? raw.sections : [];
  return s.length ? s.map(norm) : demo(w, kind, variant);
}

function norm(s: Section): Section {
  return {
    heading: String(s.heading || "Section"),
    body: s.body ? String(s.body) : undefined,
    bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
  };
}

/* ------------------------------ demo (offline) --------------------------- */

function demo(w: Workflow, kind: "prd" | "backlog", variant: PrdVariant): Section[] {
  const { perAgent } = validatedContext(w);
  const clip = w.input.trim().replace(/\s+/g, " ").slice(0, 300);
  const c = contextMap(w);
  const ctxSec = contextSection(w);

  if (kind === "backlog") {
    const now: string[] = [];
    const next: string[] = [];
    const later: string[] = [];
    perAgent.forEach((a, ai) => {
      a.bullets.forEach((t, i) => {
        const line = `[${a.name}] ${t}`;
        // Simple, explainable bucketing: business-priority + first items = Now.
        if (a.id === "business_priority" || (ai < 2 && i === 0)) now.push(line);
        else if (i === 0) next.push(line);
        else later.push(line);
      });
    });
    const secs: Section[] = [
      { heading: "How this was prioritized", body: "Grouped from your validated findings — business-priority signals and the top finding per lens go first. Refine order and add estimates in your tracker." },
    ];
    if (ctxSec) secs.unshift(ctxSec);
    secs.push({ heading: "Now", bullets: now.length ? now : ["(nothing yet)"] });
    secs.push({ heading: "Next", bullets: next.length ? next : ["(nothing yet)"] });
    secs.push({ heading: "Later", bullets: later.length ? later : ["(nothing yet)"] });
    return secs;
  }

  const objective = c.objective || `Improve the outcome behind: “${clip}”`;
  const persona = agentDetail(w, "user_research");
  const market = agentDetail(w, "market");
  const process = agentDetail(w, "process_mining");
  const defects = agentDetail(w, "defect_detection");
  const reg = agentDetail(w, "regulatory");
  const biz = agentDetail(w, "business_priority");

  const userStories = persona.slice(0, 3).map(
    (p) => `As a ${c.industry?.toLowerCase().includes("health") ? "member" : "user"}, I want ${lower(p.title)} — so that ${p.detail.replace(/\.$/, "").toLowerCase()}. (AC: the flow supports this end-to-end and is verified with real users.)`
  );

  if (variant === "product") {
    const sections: Section[] = [
      { heading: "Executive Summary", body: `A ${c.industry || "software"} product addressing: “${clip}”. ${objective}` },
    ];
    if (ctxSec) sections.push(ctxSec);
    sections.push({ heading: "Target Users & Personas", bullets: bulletsOr(persona, ["Primary user segment to be validated with research"]) });
    sections.push({ heading: "Problem Statement", body: `Derived from your ${w.inputType}: “${clip}”. The underlying objective is to ${lower(objective)}` });
    sections.push({ heading: "Market & Competitive Landscape", bullets: bulletsOr(market, ["Competitive scan pending"]) });
    sections.push({ heading: "Product Vision & Strategy", bullets: ["Win on a clear, resolution-first experience", "Sequence toward the highest-value, lowest-effort wins first", biz[0] ? `Strategic tie-in: ${biz[0].title}` : "Tie to a core business KPI"] });
    sections.push({ heading: "Scope — In / Out", bullets: ["In: the core happy path the findings point to", "In: the top validated pains", "Out (v1): edge segments and nice-to-haves — revisit after launch"] });
    sections.push({ heading: "Key Features & Epics", bullets: epicsFrom(perAgent) });
    sections.push({ heading: "Functional Requirements", bullets: ["End-to-end support for the primary journey", "Clear status, error recovery, and next-step guidance", ...defects.slice(0, 2).map((d) => `Prevent: ${d.title}`)] });
    sections.push({ heading: "Regulatory, Privacy & Compliance", bullets: bulletsOr(reg, ["Confirm data-handling and accessibility obligations"]) });
    sections.push({ heading: "Success Metrics & KPIs", bullets: metricsFor(c) });
    sections.push({ heading: "Rollout & GTM", bullets: ["Phased rollout behind a flag; pilot cohort first", "Instrument the funnel before scaling", "Enablement for support and stakeholders"] });
    sections.push({ heading: "Risks, Dependencies & Assumptions", bullets: ["Findings are provisional until validated with real data", ...process.slice(0, 1).map((p) => `Process dependency: ${p.title}`), "Assumes access to the systems the journey touches"] });
    sections.push({ heading: "Milestones", bullets: ["M1: Validate findings & scope", "M2: MVP of the core journey", "M3: Pilot + instrumentation", "M4: GA + iterate"] });
    sections.push({ heading: "Open Questions", bullets: openQuestions(w) });
    return sections;
  }

  // Feature PRD
  const sections: Section[] = [
    { heading: "Overview", body: `A focused feature addressing: “${clip}”. ${objective}` },
  ];
  if (ctxSec) sections.push(ctxSec);
  sections.push({ heading: "Problem & Users", body: `Derived from your ${w.inputType}. Primary users and their pains:`, bullets: bulletsOr(persona, ["Users to be validated with research"]) });
  sections.push({ heading: "Goals & Non-Goals", bullets: ["Goal: resolve the core problem for the primary user", "Goal: reduce effort and avoidable support contacts", "Non-goal (v1): adjacent workflows and edge segments"] });
  sections.push({ heading: "User Stories & Acceptance Criteria", bullets: userStories.length ? userStories : ["As a user, I want the core task to work end-to-end, so that I don't need support. (AC: happy path verified.)"] });
  sections.push({ heading: "Functional Requirements", bullets: ["Support the primary happy path end-to-end", "Show clear status and a next step at every stage", ...defects.slice(0, 2).map((d) => `Guard against: ${d.title}`)] });
  sections.push({ heading: "Edge Cases & Error States", bullets: bulletsOr(defects, ["Enumerate failure modes and recovery paths"]) });
  sections.push({ heading: "Regulatory & Compliance", bullets: bulletsOr(reg, ["Confirm any data / accessibility obligations"]) });
  sections.push({ heading: "Dependencies & Risks", bullets: [...process.slice(0, 2).map((p) => `Process: ${p.title}`), "Findings are provisional until validated"] });
  sections.push({ heading: "Success Metrics", bullets: metricsFor(c) });
  sections.push({ heading: "Rollout Plan", bullets: ["Ship behind a flag to a pilot cohort", "Instrument key events before scaling"] });
  sections.push({ heading: "Open Questions", bullets: openQuestions(w) });
  return sections;
}

function lower(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function bulletsOr(items: { title: string; detail: string }[], fallback: string[]): string[] {
  return items.length ? items.map((i) => `${i.title} — ${i.detail}`) : fallback;
}
function epicsFrom(perAgent: { name: string; bullets: string[] }[]): string[] {
  const out: string[] = [];
  for (const a of perAgent) if (a.bullets[0]) out.push(`${a.bullets[0]} (from ${a.name})`);
  return out.length ? out : ["Epics to be derived from validated findings"];
}
function metricsFor(c: Record<string, string>): string[] {
  const health = (c.industry || "").toLowerCase().includes("health");
  return [
    "Adoption / task-completion rate",
    "Reduction in avoidable support contacts",
    health ? "Member satisfaction (CSAT, CAHPS/Stars)" : "Satisfaction (CSAT / NPS)",
    "Time-to-resolution for the target journey",
  ];
}
function openQuestions(w: Workflow): string[] {
  const q: string[] = [];
  const missing = (w.context ?? []).filter((f) => f.required && !f.value.trim());
  for (const m of missing) q.push(`Business context: ${m.question}`);
  for (const a of w.agents) {
    if (!a.selected) continue;
    for (const f of a.intake) if (f.required && !f.value.trim()) q.push(`${getAgent(a.agentId)?.name}: ${f.question}`);
  }
  return q.length ? q.slice(0, 8) : ["No open questions flagged — validate findings with real data before build."];
}
