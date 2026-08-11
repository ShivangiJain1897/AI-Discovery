/**
 * File-backed store for intake use cases.
 *
 * Unlike the in-memory session store, intake is a team tracker — it must survive
 * server restarts. This persists to `.data/intake.json` (git-ignored), which
 * needs zero setup. It's the first concrete step toward the "real database"
 * roadmap item; swapping in Postgres later means replacing only this module.
 *
 * Writes are best-effort: if the filesystem isn't writable, the store still
 * works in-memory for the process lifetime.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { UseCase } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "intake.json");

const g = globalThis as unknown as {
  __intake?: Map<string, UseCase>;
  __intakeLoaded?: boolean;
};
const items: Map<string, UseCase> = g.__intake ?? new Map();
g.__intake = items;

async function ensureLoaded(): Promise<void> {
  if (g.__intakeLoaded) return;
  g.__intakeLoaded = true;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const arr = JSON.parse(raw) as UseCase[];
    for (const uc of arr) items.set(uc.id, uc);
  } catch {
    // No file yet — start empty.
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify([...items.values()], null, 2), "utf8");
  } catch {
    // Non-fatal: keep working in-memory.
  }
}

export async function listUseCases(): Promise<UseCase[]> {
  await ensureLoaded();
  return [...items.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getUseCase(id: string): Promise<UseCase | undefined> {
  await ensureLoaded();
  return items.get(id);
}

export async function saveUseCase(uc: UseCase): Promise<void> {
  await ensureLoaded();
  items.set(uc.id, uc);
  await persist();
}

export async function deleteUseCase(id: string): Promise<void> {
  await ensureLoaded();
  items.delete(id);
  await persist();
}

export function newUseCaseId(): string {
  return "uc_" + Math.random().toString(36).slice(2, 9);
}
