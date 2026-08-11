/**
 * Editable prompt overrides.
 *
 * Defaults live in prompts.ts. When someone edits a prompt in the Studio, we
 * save an override here (persisted via the storage collection — Postgres in prod,
 * file in dev). The effective prompt used at run time is (override ?? default),
 * so a Reset simply deletes the override.
 */
import { getCollection, type Doc } from "../storage/collection";
import { DEFAULT_PROMPTS, type PromptDef } from "./prompts";

interface PromptOverride extends Doc {
  id: string; // capability id
  system: string;
  task: string;
  updatedAt: number;
}

const col = getCollection<PromptOverride>("prompt_overrides");

export interface EffectivePrompt extends PromptDef {
  capabilityId: string;
  isModified: boolean;
  default: PromptDef;
}

export async function getEffectivePrompt(capabilityId: string): Promise<PromptDef> {
  const def = DEFAULT_PROMPTS[capabilityId];
  const override = await col.get(capabilityId);
  if (!def) throw new Error(`No prompt for capability: ${capabilityId}`);
  return {
    system: override?.system ?? def.system,
    task: override?.task ?? def.task,
  };
}

export async function listPrompts(): Promise<EffectivePrompt[]> {
  const overrides = new Map((await col.list()).map((o) => [o.id, o]));
  return Object.entries(DEFAULT_PROMPTS).map(([capabilityId, def]) => {
    const o = overrides.get(capabilityId);
    return {
      capabilityId,
      system: o?.system ?? def.system,
      task: o?.task ?? def.task,
      isModified: Boolean(o),
      default: def,
    };
  });
}

export async function saveOverride(capabilityId: string, system: string, task: string): Promise<void> {
  if (!DEFAULT_PROMPTS[capabilityId]) throw new Error(`Unknown capability: ${capabilityId}`);
  await col.put({ id: capabilityId, system, task, updatedAt: Date.now() });
}

export async function resetOverride(capabilityId: string): Promise<void> {
  await col.remove(capabilityId);
}
