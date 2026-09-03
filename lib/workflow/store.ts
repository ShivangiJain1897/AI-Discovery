import { getCollection } from "../storage/collection";
import type { Workflow } from "./types";

const col = getCollection<Workflow>("workflows");

export async function listWorkflows(): Promise<Workflow[]> {
  return (await col.list()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getWorkflow(id: string): Promise<Workflow | undefined> {
  return col.get(id);
}
export async function saveWorkflow(w: Workflow): Promise<void> {
  w.updatedAt = Date.now();
  await col.put(w);
}
export async function deleteWorkflow(id: string): Promise<void> {
  await col.remove(id);
}
export function newWorkflowId(): string {
  return "wf_" + Math.random().toString(36).slice(2, 9);
}
