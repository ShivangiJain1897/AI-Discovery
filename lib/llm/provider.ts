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

/** Extract the first balanced JSON object/array from a string. */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();
  // Fast path: whole string is JSON.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }
  // Strip markdown fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim()) as T;
  }
  // Find first { ... } or [ ... ] block.
  const start = trimmed.search(/[{[]/);
  if (start >= 0) {
    const open = trimmed[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === open) depth++;
      else if (trimmed[i] === close) {
        depth--;
        if (depth === 0) {
          return JSON.parse(trimmed.slice(start, i + 1)) as T;
        }
      }
    }
  }
  throw new Error("No JSON found in model output");
}
