import Anthropic from "@anthropic-ai/sdk";
import {
  EmptyOutputError,
  TruncatedOutputError,
  extractJson,
  type GenerateJsonParams,
  type LlmProvider,
} from "./provider";

/**
 * Live provider backed by Claude. Used automatically when ANTHROPIC_API_KEY
 * is present in the environment.
 */
export class AnthropicProvider implements LlmProvider {
  readonly mode = "live" as const;
  readonly label: string;
  private client: Anthropic;
  private model: string;

  constructor() {
    // An org-level (unscoped) key needs the workspace id sent as a header.
    // Set ANTHROPIC_WORKSPACE_ID to use such a key; a workspace-scoped key
    // works without it.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
    });
    this.model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    this.label = `Claude (${this.model})`;
  }

  /**
   * Ask Claude for JSON.
   *
   * The failure this guards against: a response that hits `max_tokens` is cut
   * off mid-JSON, and a response whose whole budget went elsewhere arrives with
   * no text at all. Both used to surface as "No JSON found in model output",
   * which named the symptom and hid the cause. Now we read `stop_reason`, retry
   * a truncated call once with real headroom, salvage what we can, and if it
   * still fails, say exactly what happened.
   */
  async generateJson<T = unknown>(params: GenerateJsonParams): Promise<T> {
    const budget = params.maxTokens ?? 4096;

    const first = await this.attempt<T>(params, budget);
    if (first.ok) return first.value;

    // Truncated or empty: the model needed more room than it had. Give it real
    // headroom rather than failing the whole lens over a token ceiling.
    if (first.retryable) {
      const second = await this.attempt<T>(params, Math.min(Math.max(budget * 2, 4096), 16000));
      if (second.ok) return second.value;
      throw new Error(`${second.reason} (retried with a larger budget and it still didn't fit)`);
    }
    throw new Error(first.reason);
  }

  /** One call. Returns the parsed value, or why it couldn't be parsed. */
  private async attempt<T>(
    params: GenerateJsonParams,
    maxTokens: number
  ): Promise<{ ok: true; value: T } | { ok: false; reason: string; retryable: boolean }> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system:
        params.system +
        "\n\nRespond with a single valid JSON value and nothing else. No preamble, no explanation, no markdown fences. Keep individual string values concise so the whole JSON value fits comfortably within the token limit — a complete, shorter answer is far better than a longer one that gets cut off.",
      messages: [{ role: "user", content: params.prompt }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const truncated = msg.stop_reason === "max_tokens";

    if (!text) {
      const kinds = [...new Set(msg.content.map((b) => b.type))];
      return {
        ok: false,
        retryable: true,
        reason: truncated
          ? `The model used its entire ${maxTokens}-token budget without producing an answer.`
          : `The model returned no text (stop_reason: ${msg.stop_reason ?? "unknown"}${
              kinds.length ? `, content: ${kinds.join(", ")}` : ", no content"
            }).`,
      };
    }

    try {
      return { ok: true, value: extractJson<T>(text) };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        // A cut-off response is worth retrying; genuinely non-JSON prose is not.
        retryable: truncated || err instanceof TruncatedOutputError || err instanceof EmptyOutputError,
        reason: truncated
          ? `The model's answer was cut off at the ${maxTokens}-token limit.`
          : `Couldn't read the model's answer as JSON: ${detail} Output began: ${JSON.stringify(text.slice(0, 200))}`,
      };
    }
  }

  /**
   * Live web research via Claude's server-side web_search tool. Returns a
   * plain-text digest (with whatever sources the model cites), or "" on any
   * failure so callers can degrade gracefully.
   */
  async research(query: string): Promise<string> {
    try {
      // The web_search server tool isn't in older SDK types; pass it through.
      const req = {
        model: this.model,
        max_tokens: 1500,
        system:
          "You are a research assistant. Use web search to find current, factual information. " +
          "Reply with a concise digest of the key findings as short bullet points, each ending with its source (site or URL). Do not fabricate.",
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: query }],
      } as unknown as Anthropic.MessageCreateParamsNonStreaming;

      const msg = await this.client.messages.create(req);
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text;
    } catch {
      return "";
    }
  }
}
