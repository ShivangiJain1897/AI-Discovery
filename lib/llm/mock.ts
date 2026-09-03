import type { GenerateJsonParams, LlmProvider } from "./provider";

/**
 * Demo provider. In demo mode the workflow uses deterministic generators
 * directly (each agent branches on provider.mode), so generateJson is not
 * expected to be called. If it is, we surface a clear message rather than
 * fabricate output.
 */
export class MockProvider implements LlmProvider {
  readonly mode = "demo" as const;
  readonly label = "Demo mode";

  async generateJson<T = unknown>(_params: GenerateJsonParams): Promise<T> {
    throw new Error("Demo mode: deterministic generators should be used; set ANTHROPIC_API_KEY for live generation.");
  }
}
