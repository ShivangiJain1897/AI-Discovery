import type { DiscoveryRun } from "./agents/types";

/**
 * In-memory store for the pilot. Runs live for the lifetime of the server
 * process. This is deliberately simple — swapping in a real database (see the
 * roadmap in README) means replacing this module and nothing else.
 *
 * A module-level singleton survives Next.js hot-reloads via globalThis.
 */
const g = globalThis as unknown as { __discoveryRuns?: Map<string, DiscoveryRun> };
const runs: Map<string, DiscoveryRun> = g.__discoveryRuns ?? new Map();
g.__discoveryRuns = runs;

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
