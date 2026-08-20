/**
 * Backlog synthesizer — turns agent signals into a prioritized backlog.
 *
 * Each signal becomes a candidate backlog item, scored on Impact / Effort /
 * Confidence and bucketed into Now / Next / Later / Icebox. Scoring is
 * deterministic and explainable so the ranking is auditable — the AI proposes,
 * the PM curates and owns the final order (items a human has adjusted are never
 * clobbered by a re-generation).
 */
import type { BacklogBucket, BacklogItem, Product, Severity, Signal } from "./types";

const IMPACT: Record<Severity, 1 | 2 | 3 | 4 | 5> = { low: 2, medium: 3, high: 4, critical: 5 };

/** Heavier delivery/compliance work costs more; market/feedback is lighter to trial. */
function effortFor(agentId: string): 1 | 2 | 3 | 4 | 5 {
  if (agentId === "knowledge" || agentId === "process" || agentId === "regulatory") return 4;
  if (agentId === "defects") return 2;
  return 3;
}
function confidenceFor(agentId: string): number {
  if (agentId === "market" || agentId === "knowledge") return 0.5;
  if (agentId === "defects" || agentId === "feedback") return 0.65;
  return 0.6;
}

export function priorityScore(impact: number, effort: number, confidence: number): number {
  return Math.round(((impact * confidence) / Math.max(1, effort)) * 100) / 100;
}

export function bucketFor(score: number): BacklogBucket {
  if (score >= 1.2) return "now";
  if (score >= 0.85) return "next";
  if (score >= 0.55) return "later";
  return "icebox";
}

/**
 * Generate backlog items from the product's current signals, skipping signals
 * that already produced an item. Returns only the NEW items.
 */
export function synthesizeBacklog(
  product: Product,
  existing: BacklogItem[],
  newId: () => string
): BacklogItem[] {
  const seenSignalKeys = new Set(existing.map((i) => i.signalId).filter(Boolean));
  const items: BacklogItem[] = [];
  let rankBase = existing.length;

  for (const s of product.signals) {
    const key = signalKey(s);
    if (seenSignalKeys.has(key)) continue;
    seenSignalKeys.add(key);
    const impact = IMPACT[s.severity];
    const effort = effortFor(s.agentId);
    const confidence = confidenceFor(s.agentId);
    const score = priorityScore(impact, effort, confidence);
    const now = Date.now();
    items.push({
      id: newId(),
      productId: product.id,
      title: s.title,
      description: s.detail,
      source: "agent",
      agentId: s.agentId,
      signalId: key,
      impact,
      effort,
      confidence,
      priorityScore: score,
      bucket: bucketFor(score),
      status: "proposed",
      rank: rankBase++,
      createdAt: now,
      updatedAt: now,
    });
  }
  return items;
}

/** Stable-ish key so re-runs of the same agent don't duplicate the same signal. */
function signalKey(s: Signal): string {
  return `${s.agentId}:${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}`;
}

export function recompute(item: BacklogItem): BacklogItem {
  const score = priorityScore(item.impact, item.effort, item.confidence);
  return { ...item, priorityScore: score };
}
