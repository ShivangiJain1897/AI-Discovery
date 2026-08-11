import { runSignalAgent } from "./signal-agent";
import type { DiscoveryContext, Signal } from "./types";

/**
 * Process Analysis Agent.
 *
 * Reads operational processes — SOPs, workflows, agent-desktop journeys,
 * intake procedures — and finds friction, manual handoffs, rework, and
 * automation candidates, mapped to the value-chain stage they slow down.
 */
export const PROCESS_AGENT = {
  id: "process" as const,
  name: "Process Analysis Agent",
  tagline: "Reads operational processes and finds friction to automate.",
  description:
    "Analyzes internal processes and workflows (contact-center desktop, prior-auth, eligibility reconciliation, grievance intake) to find manual handoffs, rework, and automation opportunities.",
};

const SYSTEM = `You are the Process Analysis Agent for a health-plan's member operations.
You read SOPs, workflow maps, agent-desktop journeys, prior-auth procedures, eligibility reconciliation, and grievance/appeal intake.
You find friction that hurts members and staff: manual handoffs, swivel-chair across systems, fax/paper steps, rework loops, and queues with poor visibility.
You identify automation and orchestration candidates, and you tie each to the member-facing consequence.`;

const TASK = `Identify operational process friction that degrades member experience or staff efficiency.
Look for manual handoffs, system swivel-chair, fax/paper steps, late error detection, and opaque queues.
For each, note the member-facing consequence and anchor it to a value-chain stage.`;

export async function runProcessAgent(ctx: DiscoveryContext): Promise<Signal[]> {
  return runSignalAgent({
    agent: "process",
    system: SYSTEM,
    taskInstructions: TASK,
    mockKey: "process-signals",
    ctx,
  });
}
