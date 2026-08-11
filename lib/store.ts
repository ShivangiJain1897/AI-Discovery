/**
 * Discovery session store — backed by the shared storage collection, so it
 * persists in Postgres in production and the local file store in dev. Persisting
 * sessions matters for deployment: on a serverless host the POST that creates a
 * session and the GET that reads it can run in different invocations.
 */
import { getCollection } from "./storage/collection";
import type { AnalyzeSession } from "./capabilities/types";

const col = getCollection<AnalyzeSession>("sessions");

export async function saveSession(s: AnalyzeSession): Promise<void> {
  await col.put(s);
}

export async function getSession(id: string): Promise<AnalyzeSession | undefined> {
  return col.get(id);
}

export async function listSessions(): Promise<AnalyzeSession[]> {
  const items = await col.list();
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export function newSessionId(): string {
  return "s_" + Math.random().toString(36).slice(2, 10);
}
