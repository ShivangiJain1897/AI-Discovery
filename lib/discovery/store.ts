import { getCollection } from "../storage/collection";
import type { Discovery } from "./types";

const col = getCollection<Discovery>("discoveries");

export async function listDiscoveries(): Promise<Discovery[]> {
  return (await col.list()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getDiscovery(id: string): Promise<Discovery | undefined> {
  return col.get(id);
}
export async function saveDiscovery(d: Discovery): Promise<void> {
  d.updatedAt = Date.now();
  await col.put(d);
}
export async function deleteDiscovery(id: string): Promise<void> {
  await col.remove(id);
}
export function newDiscoveryId(): string {
  return "d_" + Math.random().toString(36).slice(2, 9);
}
