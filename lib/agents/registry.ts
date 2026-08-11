import { DOMAIN_AGENT } from "./domain-agent";
import { DEFECT_AGENT } from "./defect-agent";
import { MARKET_AGENT } from "./market-agent";
import { PROCESS_AGENT } from "./process-agent";
import type { AgentId } from "./types";

export interface AgentMeta {
  id: AgentId;
  name: string;
  tagline: string;
  description: string;
  /** Order in the pipeline: domain grounds first, then the parallel three. */
  order: number;
}

export const AGENTS: AgentMeta[] = [
  { ...DOMAIN_AGENT, order: 1 },
  { ...DEFECT_AGENT, order: 2 },
  { ...MARKET_AGENT, order: 2 },
  { ...PROCESS_AGENT, order: 2 },
];

export function getAgent(id: AgentId): AgentMeta | undefined {
  return AGENTS.find((a) => a.id === id);
}
