import { getCollection } from "../storage/collection";
import type { Session } from "./types";

const col = getCollection<Session>("sessions");

export async function listSessions(): Promise<Session[]> {
  return (await col.list()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getSession(id: string): Promise<Session | undefined> {
  return col.get(id);
}
export async function saveSession(s: Session): Promise<void> {
  s.updatedAt = Date.now();
  await col.put(s);
}
export async function deleteSession(id: string): Promise<void> {
  await col.remove(id);
}
export function newSessionId(): string {
  return "s_" + Math.random().toString(36).slice(2, 9);
}
