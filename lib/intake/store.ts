/**
 * Intake use-case store — backed by the shared storage collection, so it uses
 * Postgres in production (DATABASE_URL) and the local file store in dev.
 */
import { getCollection } from "../storage/collection";
import type { UseCase } from "./types";

const col = getCollection<UseCase>("use_cases");

export async function listUseCases(): Promise<UseCase[]> {
  const items = await col.list();
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getUseCase(id: string): Promise<UseCase | undefined> {
  return col.get(id);
}

export async function saveUseCase(uc: UseCase): Promise<void> {
  await col.put(uc);
}

export async function deleteUseCase(id: string): Promise<void> {
  await col.remove(id);
}

export function newUseCaseId(): string {
  return "uc_" + Math.random().toString(36).slice(2, 9);
}
