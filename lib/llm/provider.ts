/**
 * LLM provider abstraction.
 *
 * The whole platform talks to LLMs through this one interface. That lets us:
 *  - run live with Claude when an ANTHROPIC_API_KEY is present, and
 *  - run in a fully-usable DEMO MODE with deterministic seed data when it isn't.
 *
 * Agents ask the provider to produce a JSON object matching a described shape.
 * The provider guarantees a parsed object back (or throws), so agents never deal
 * with raw text.
 */

export interface GenerateJsonParams {
  /** System prompt establishing the agent's role and constraints. */
  system: string;
  /** The task / user prompt. */
  prompt: string;
  /**
   * A key used by the mock provider to look up deterministic seed output.
   * In live mode it is ignored.
   */
  mockKey?: string;
  /** Max tokens for the response. */
  maxTokens?: number;
}

export interface LlmProvider {
  readonly mode: "live" | "demo";
  readonly label: string;
  generateJson<T = unknown>(params: GenerateJsonParams): Promise<T>;
  /**
   * Optional live web research. Returns a plain-text digest of findings with
   * sources, or "" if unavailable. Only the live provider implements it;
   * callers must treat it as best-effort (wrap in try/catch).
   */
  research?(query: string): Promise<string>;
}

let cached: LlmProvider | null = null;

/**
 * Returns the active provider. Live if ANTHROPIC_API_KEY is set, else demo.
 * Import is dynamic so the Anthropic SDK is only loaded when actually needed.
 */
export async function getProvider(): Promise<LlmProvider> {
  if (cached) return cached;
  if (process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = await import("./anthropic");
    cached = new AnthropicProvider();
  } else {
    const { MockProvider } = await import("./mock");
    cached = new MockProvider();
  }
  return cached;
}

/**
 * Pull a JSON value out of model output.
 *
 * Handles the normal cases (bare JSON, a prose preamble, markdown fences) and
 * then one that used to be fatal: a response CUT OFF mid-JSON because the model
 * hit its token limit. A truncated object never balances its braces, so the old
 * code reported "No JSON found" — indistinguishable from the model returning
 * nothing at all. Now we repair what arrived and keep the complete parts.
 */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) throw new EmptyOutputError();

  // Whole string is JSON.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* keep going */
  }

  // Markdown fence.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      /* keep going — the fence may itself be truncated */
    }
  }

  // First balanced { … } or [ … ], ignoring braces inside strings.
  const start = trimmed.search(/[{[]/);
  if (start < 0) throw new Error("No JSON found in model output");

  const balanced = findBalanced(trimmed, start);
  if (balanced) {
    try {
      return JSON.parse(balanced) as T;
    } catch {
      /* malformed even though balanced — fall through to repair */
    }
  }

  // Nothing balanced: the response was cut off. Salvage the complete parts.
  const repaired = repairTruncated(trimmed.slice(start));
  if (repaired) {
    try {
      return JSON.parse(repaired) as T;
    } catch {
      /* give up below */
    }
  }
  throw new TruncatedOutputError();
}

/** Thrown when the model returned no text at all. */
export class EmptyOutputError extends Error {
  constructor() {
    super("The model returned no text. This usually means the whole token budget was consumed before any answer was written.");
    this.name = "EmptyOutputError";
  }
}

/** Thrown when the output was cut off mid-JSON and could not be salvaged. */
export class TruncatedOutputError extends Error {
  constructor() {
    super("The model's JSON was cut off before it finished and could not be repaired.");
    this.name = "TruncatedOutputError";
  }
}

/** The first balanced JSON value starting at `from`, or null if never closed. */
function findBalanced(text: string, from: number): string | null {
  const open = text[from];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

/**
 * Close a JSON value that was cut off mid-flight.
 *
 * Walks the text tracking string state and a stack of open containers, noting
 * for each container where its last COMPLETE member ended. On truncation we cut
 * back to one of those boundaries and close what's still open.
 *
 * The subtlety is which boundary. A half-written element of a list is dropped
 * whole — a finding with a title but no detail is noise. A half-written value in
 * the root object just loses that field, keeping the ones already finished. So a
 * response cut off during its fifth finding still yields the first four.
 *
 * Returns null when not one member finished — there is nothing worth keeping,
 * and the caller should retry rather than salvage.
 */
export function repairTruncated(text: string): string | null {
  interface Frame { closer: string; isArray: boolean; lastMemberEnd: number }
  const stack: Frame[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      stack.push({ closer: c === "{" ? "}" : "]", isArray: c === "[", lastMemberEnd: -1 });
    } else if (c === "}" || c === "]") {
      stack.pop();
      // A whole value just finished, so its parent has one more complete member.
      const parent = stack[stack.length - 1];
      if (parent) parent.lastMemberEnd = i + 1;
    } else if (c === ",") {
      const top = stack[stack.length - 1];
      if (top) top.lastMemberEnd = i;
    }
  }

  if (stack.length === 0) return null; // it wasn't truncated

  // Drop a partial list element entirely; otherwise keep the finished fields.
  const parentOfInnermost = stack[stack.length - 2];
  const dropInnermost = stack.length >= 2 && parentOfInnermost.isArray;
  const keep = dropInnermost ? stack.slice(0, -1) : stack;
  const cutAt = keep[keep.length - 1].lastMemberEnd;
  if (cutAt <= 0) return null; // nothing finished — not worth salvaging

  const body = text.slice(0, cutAt).replace(/[,\s]+$/, "");
  if (!body.trim()) return null;
  return body + keep.map((f) => f.closer).reverse().join("");
}
