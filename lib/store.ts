import type { DiscoveryRun } from "./agents/types";
import type { AnalyzeSession } from "./capabilities/types";

/**
 * In-memory store for the pilot. Data lives for the lifetime of the server
 * process. This is deliberately simple — swapping in a real database (see the
 * roadmap in README) means replacing this module and nothing else.
 *
 * A module-level singleton survives Next.js hot-reloads via globalThis.
 */
const g = globalThis as unknown as {
  __discoveryRuns?: Map<string, DiscoveryRun>;
  __analyzeSessions?: Map<string, AnalyzeSession>;
};
const runs: Map<string, DiscoveryRun> = g.__discoveryRuns ?? new Map();
g.__discoveryRuns = runs;
const sessions: Map<string, AnalyzeSession> = g.__analyzeSessions ?? new Map();
g.__analyzeSessions = sessions;

// --- Discovery runs (payer value-chain mode) ---
export function saveRun(run: DiscoveryRun): void {
  runs.set(run.id, run);
}
export function getRun(id: string): DiscoveryRun | undefined {
  return runs.get(id);
}
export function listRuns(): DiscoveryRun[] {
  return [...runs.values()].sort((a, b) => b.createdAt - a.createdAt);
}
export function newRunId(): string {
  return "run_" + Math.random().toString(36).slice(2, 10);
}

// --- Analyze sessions (capability composer) ---
export function saveSession(s: AnalyzeSession): void {
  sessions.set(s.id, s);
}
export function getSession(id: string): AnalyzeSession | undefined {
  return sessions.get(id);
}
export function listSessions(): AnalyzeSession[] {
  return [...sessions.values()].sort((a, b) => b.createdAt - a.createdAt);
}
export function newSessionId(): string {
  return "s_" + Math.random().toString(36).slice(2, 10);
}
