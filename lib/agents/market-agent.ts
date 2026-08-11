import { runSignalAgent } from "./signal-agent";
import type { DiscoveryContext, Signal } from "./types";

/**
 * Market Analysis Agent.
 *
 * Scans the competitive and market landscape — what leading payers and
 * healthtech entrants are shipping, how member expectations are shifting, and
 * where regulation is raising the bar — and turns it into stage-anchored gaps
 * and benchmarks.
 */
export const MARKET_AGENT = {
  id: "market" as const,
  name: "Market Analysis Agent",
  tagline: "Reads the market and feeds competitive gaps back in.",
  description:
    "Analyzes competitor moves, member expectations, and regulatory shifts to surface where the plan is behind the market — anchored to the value-chain stage the gap affects.",
};

const SYSTEM = `You are the Market Analysis Agent for a health-insurance payer.
You track what leading national and regional payers, and healthtech entrants, are shipping for members; how consumer expectations set by everyday apps are reshaping member expectations; and how regulation (price transparency, Stars, appeals timeliness) raises the bar.
You translate market movement into concrete competitive gaps for THIS plan, anchored to the member value chain.
You are grounded and avoid hype; you name the benchmark and the gap.`;

const TASK = `Identify where the plan is likely behind the market or where member expectations have shifted.
For each, name the market benchmark or competitor move and the resulting gap, anchored to a value-chain stage.
Favor gaps that are strategically material to retention, Stars, or digital adoption.`;

export async function runMarketAgent(ctx: DiscoveryContext): Promise<Signal[]> {
  return runSignalAgent({
    agent: "market",
    system: SYSTEM,
    taskInstructions: TASK,
    mockKey: "market-signals",
    ctx,
  });
}
