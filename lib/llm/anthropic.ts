import Anthropic from "@anthropic-ai/sdk";
import { extractJson, type GenerateJsonParams, type LlmProvider } from "./provider";

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
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
    this.label = `Claude (${this.model})`;
  }

  async generateJson<T = unknown>(params: GenerateJsonParams): Promise<T> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 2048,
      system:
        params.system +
        "\n\nRespond with a single valid JSON value and nothing else. Do not wrap it in prose or markdown fences.",
      messages: [{ role: "user", content: params.prompt }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return extractJson<T>(text);
  }
}
