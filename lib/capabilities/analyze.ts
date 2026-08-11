import { getProvider } from "../llm/provider";
import { runCapability } from "./run";
import type { AnalyzeSession, CapabilityRun } from "./types";

/**
 * Runs all selected capabilities for a session, in parallel. Each capability
 * is independent, so one failing doesn't sink the others.
 */
export async function runAnalysis(
  session: AnalyzeSession,
  onProgress?: (s: AnalyzeSession) => void
): Promise<AnalyzeSession> {
  const provider = await getProvider();
  session.mode = provider.mode;
  session.status = "running";
  onProgress?.(session);

  const runs = await Promise.all(
    session.capabilityIds.map((id) => runOne(id, session))
  );
  session.runs = runs;
  session.status = runs.some((r) => r.status === "complete") ? "complete" : "error";
  session.finishedAt = Date.now();
  onProgress?.(session);
  return session;
}

async function runOne(capabilityId: string, session: AnalyzeSession): Promise<CapabilityRun> {
  const startedAt = Date.now();
  try {
    const output = await runCapability(capabilityId, session.input);
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
