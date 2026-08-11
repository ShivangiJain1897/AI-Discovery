/**
 * Deterministic clustering of real reviews into stage-anchored defect signals.
 *
 * This runs when there is no LLM key: it still produces GROUNDED signals,
 * because every signal cites the actual reviews that formed it. The mapping is
 * explainable (keyword rules → value-chain stage), so a skeptic can see exactly
 * why a review landed where it did.
 *
 * When an LLM key is present, the Defect agent uses Claude to cluster instead,
 * but attaches the same real review sources — so citations are never fabricated.
 */
import type { EvidenceSource, Severity, Signal } from "../agents/types";
import type { Review } from "./app-reviews";

interface Rule {
  stageId: string;
  theme: string;
  kpis: string[];
  /** Case-insensitive matchers against title + content. */
  patterns: RegExp[];
}

// Order matters: the first rule that matches a review wins.
const RULES: Rule[] = [
  {
    stageId: "onboarding",
    theme: "Account setup & login",
    kpis: ["digital-adoption", "call-deflection"],
    patterns: [
      /\b(log ?in|login|log ?on|sign ?in|sign ?on|password|reset|register|registration|create (an? )?account|activate|face ?id|touch ?id|verif)/i,
      /\b(id ?card|member ?id|id ?number|digital card)\b/i,
    ],
  },
  {
    stageId: "pharmacy",
    theme: "Pharmacy & prescriptions",
    kpis: ["csat", "star-rating"],
    patterns: [/\b(prescription|pharmacy|refill|medication|\bdrug\b|formulary|\brx\b|mail ?order)/i],
  },
  {
    stageId: "claims-eob",
    theme: "Claims & EOB",
    kpis: ["grievance-rate", "csat"],
    patterns: [/\b(claim|eob|explanation of benefits|reimburs|denied|denial|statement|\bbill(ed|ing)?\b)/i],
  },
  {
    stageId: "care-um",
    theme: "Authorizations & referrals",
    kpis: ["star-rating", "grievance-rate"],
    patterns: [/\b(prior ?auth|authorization|pre.?auth|referral|approval)/i],
  },
  {
    stageId: "benefits",
    theme: "Benefits, coverage & finding care",
    kpis: ["call-deflection", "csat"],
    patterns: [
      /\b(coverage|benefit|deductible|copay|co-?pay|covered|cost estimate|estimate|find (a )?(doctor|provider)|provider directory|in.?network|out.?of.?network)/i,
    ],
  },
  {
    stageId: "member-services",
    theme: "Getting help (call / chat)",
    kpis: ["fcr", "aht", "nps"],
    patterns: [
      /\b(call|phone|hold|wait(ing)?|representative|customer service|support|chat ?bot|\bagent\b|hung up|transfer)/i,
    ],
  },
  {
    // App-quality defects (crashes/errors) — anchored to the digital front door.
    stageId: "member-services",
    theme: "App reliability (crashes & errors)",
    kpis: ["digital-adoption", "call-deflection"],
    patterns: [
      /\b(crash|freeze|frozen|bug|error|glitch|won'?t (load|open|work)|doesn'?t (load|open|work)|stopped working|not working|blank (screen|page)|spinning|keeps? closing|force closes?|update broke)/i,
    ],
  },
];

const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];

export interface ClusterResult {
  signals: Signal[];
  reviewsAnalyzed: number;
  negativeReviews: number;
}

/**
 * Turn reviews into up to `maxSignals` defect signals.
 * Only reviews rating <= 3 are treated as defect candidates.
 */
export function clusterReviews(
  reviews: Review[],
  opts: { maxSignals?: number; appName?: string } = {}
): ClusterResult {
  const maxSignals = opts.maxSignals ?? 6;
  const negatives = reviews.filter((r) => r.rating <= 3);

  const groups = new Map<string, { rule: Rule; reviews: Review[] }>();
  for (const r of negatives) {
    const rule = matchRule(r);
    if (!rule) continue;
    const key = `${rule.stageId}::${rule.theme}`;
    const g = groups.get(key) ?? { rule, reviews: [] };
    g.reviews.push(r);
    groups.set(key, g);
  }

  const signals: Signal[] = [];
  let i = 0;
  const ordered = [...groups.values()].sort((a, b) => b.reviews.length - a.reviews.length);
  for (const g of ordered) {
    if (signals.length >= maxSignals) break;
    if (g.reviews.length < 1) continue;
    signals.push(toSignal(g.rule, g.reviews, i++, opts.appName));
  }

  return { signals, reviewsAnalyzed: reviews.length, negativeReviews: negatives.length };
}

function matchRule(r: Review): Rule | null {
  const hay = `${r.title} ${r.content}`;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule;
  }
  return null;
}

function toSignal(rule: Rule, reviews: Review[], index: number, appName?: string): Signal {
  const sorted = [...reviews].sort((a, b) => a.rating - b.rating);
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const count = reviews.length;

  // Severity from volume + how angry (lower avg rating = worse).
  let sevIdx = 0;
  if (count >= 2) sevIdx = 1;
  if (count >= 4 || avgRating <= 1.5) sevIdx = 2;
  if (count >= 7 && avgRating <= 2) sevIdx = 3;
  const severity = SEVERITY_ORDER[sevIdx];

  const confidence = clamp01(0.45 + Math.min(count, 8) * 0.06);
  const sources: EvidenceSource[] = sorted.slice(0, 4).map((r) => ({
    label: `App Store review · ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}${
      r.version ? ` · v${r.version}` : ""
    }`,
    quote: truncate(r.content || r.title, 240),
    url: r.url,
    meta: `${r.author}${r.updated ? ` · ${r.updated.slice(0, 10)}` : ""}`,
  }));

  const app = appName ? ` in ${appName}` : "";
  return {
    id: `defect-${index + 1}`,
    agent: "defect",
    stageId: rule.stageId,
    title: `${rule.theme}: ${count} member${count === 1 ? "" : "s"} report problems`,
    detail: `${count} recent negative review${count === 1 ? "" : "s"}${app} cluster around "${rule.theme.toLowerCase()}" (avg ${avgRating.toFixed(
      1
    )}★). ${leadQuoteSentence(sorted[0])}`,
    severity,
    evidence: sorted.slice(0, 4).map((r) => `★${r.rating} "${truncate(r.title || r.content, 80)}"`),
    sources,
    confidence,
    impactedKpis: rule.kpis,
  };
}

function leadQuoteSentence(r?: Review): string {
  if (!r) return "";
  return `Representative: "${truncate(r.content || r.title, 160)}"`;
}

function truncate(s: string, n: number): string {
  const clean = (s || "").replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n - 1) + "…" : clean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}
