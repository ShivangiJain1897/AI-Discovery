import { getProvider } from "../llm/provider";
import { runCapability } from "./run";
import type { AnalyzeInput, CapabilityRun, ChatTurn } from "./types";

/**
 * Runs one conversational turn: the selected capabilities against the user's
 * message, with the prior conversation as context so follow-ups build on
 * earlier work. Each capability is independent — one failing doesn't sink the
 * others.
 */
export async function runTurn(
  input: AnalyzeInput,
  capabilityIds: string[]
): Promise<CapabilityRun[]> {
  return Promise.all(capabilityIds.map((id) => runOne(id, input)));
}

async function runOne(capabilityId: string, input: AnalyzeInput): Promise<CapabilityRun> {
  const startedAt = Date.now();
  try {
    const output = await runCapability(capabilityId, input);
    return { capabilityId, status: "complete", output, startedAt, finishedAt: Date.now() };
  } catch (err) {
    return {
      capabilityId,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      finishedAt: Date.now(),
    };
  }
}

/** Resolve the active mode without running anything. */
export async function currentMode(): Promise<"live" | "demo"> {
  return (await getProvider()).mode;
}

/**
 * Compact, readable summary of the thread so far, fed to the next turn as
 * context. Keeps follow-ups grounded without resending everything verbatim.
 */
export function buildHistory(turns: ChatTurn[]): string {
  const parts: string[] = [];
  for (const t of turns) {
    parts.push(`User: ${t.userText.slice(0, 500)}`);
    for (const r of t.runs) {
      if (r.output) parts.push(`Assistant (${r.capabilityId}): ${r.output.title} — ${r.output.summary}`);
    }
  }
  return parts.join("\n").slice(0, 6000);
}
