import { runSignalAgent } from "./signal-agent";
import type { DiscoveryContext, Signal } from "./types";

/**
 * Defect Detection Agent.
 *
 * Scans market-facing member applications (portals, mobile apps, IVR/chat) for
 * production defects and UX failures — the kind that show up in app-store
 * reviews, support-ticket clusters, and status pages — and maps each to the
 * value-chain stage it degrades.
 */
export const DEFECT_AGENT = {
  id: "defect" as const,
  name: "Defect Detection Agent",
  tagline: "Finds production defects members actually hit in live apps.",
  description:
    "Detects live defects and UX failures in member-facing applications (portal, app, IVR, chat) from review and support signals, anchored to the value-chain stage they break.",
};

const SYSTEM = `You are the Defect Detection Agent for a health-plan member experience.
You specialize in finding PRODUCTION defects and UX failures in live member-facing applications: the member portal, mobile app, digital ID card, cost estimator, EOB/claims views, IVR, and chatbot.
You reason from the kinds of evidence real teams have: app-store review patterns, support-ticket clusters, status-page incidents, and reproducible bugs.
You focus on defects that cause avoidable calls, abandonment, or member frustration. You are concrete and cite plausible evidence.`;

const TASK = `Identify production defects and UX failures a member would actually encounter in live applications.
Prefer issues that (a) are reproducible or show a clear evidence pattern, and (b) drive avoidable contact volume or churn.
For each, cite the evidence signal a real team would see.`;

export async function runDefectAgent(ctx: DiscoveryContext): Promise<Signal[]> {
  return runSignalAgent({
    agent: "defect",
    system: SYSTEM,
    taskInstructions: TASK,
    mockKey: "defect-signals",
    ctx,
  });
}
