import { getProvider } from "../llm/provider";
import { runSignalAgent } from "./signal-agent";
import { runGroundedDefectAgent } from "./defect-grounded";
import { resolveApp, fetchReviews } from "../sources/app-reviews";
import { clusterReviews } from "../sources/review-cluster";
import type { DiscoveryContext, Grounding, Signal } from "./types";

/**
 * Defect Detection Agent.
 *
 * When a member app is targeted, this agent grounds itself in REAL App Store
 * reviews: it resolves the app, fetches recent reviews, and clusters the
 * negatives into stage-anchored defect signals — each citing actual reviews.
 * Clustering uses Claude when a key is present, otherwise a deterministic
 * keyword mapping. Either way the citations are real.
 *
 * If no app is targeted, or live reviews can't be reached, it falls back to
 * generated/seed signals and says so via the returned grounding.
 */
export const DEFECT_AGENT = {
  id: "defect" as const,
  name: "Defect Detection Agent",
  tagline: "Finds production defects members actually hit in live apps.",
  description:
    "Grounds in real App Store reviews of the member app: clusters real member complaints into stage-anchored defects, each with a clickable source. Falls back to generated signals if no app is targeted.",
};

const SYSTEM = `You are the Defect Detection Agent for a health-plan member experience.
You specialize in finding PRODUCTION defects and UX failures in live member-facing applications: the member portal, mobile app, digital ID card, cost estimator, EOB/claims views, IVR, and chatbot.
You reason from evidence real teams have: app-store review patterns, support-ticket clusters, status-page incidents, and reproducible bugs.
You focus on defects that cause avoidable calls, abandonment, or member frustration.`;

const TASK = `Identify production defects and UX failures a member would actually encounter in live applications.
Prefer issues that are reproducible or show a clear evidence pattern and drive avoidable contact volume or churn.`;

export interface DefectResult {
  signals: Signal[];
  grounding: Grounding;
}

export async function runDefectAgent(ctx: DiscoveryContext): Promise<DefectResult> {
  const target = ctx.appTarget?.trim();
  if (target) {
    const grounded = await tryGrounded(ctx, target);
    if (grounded) return grounded;
  }

  // Fallback: generated/seed signals (not grounded in live data).
  const signals = await runSignalAgent({
    agent: "defect",
    system: SYSTEM,
    taskInstructions: TASK,
    mockKey: "defect-signals",
    ctx,
  });
  return {
    signals,
    grounding: {
      kind: "generated",
      detail: target
        ? `Could not reach live reviews for "${target}"; showing generated example defects.`
        : "No member app targeted; showing generated example defects. Add an app to ground in real reviews.",
    },
  };
}

async function tryGrounded(ctx: DiscoveryContext, target: string): Promise<DefectResult | null> {
  try {
    const app = await resolveApp(target);
    if (!app?.id) return null;

    const reviews = await fetchReviews(app.id, app.country, 4);
    if (reviews.length === 0) return null;

    const provider = await getProvider();
    let signals: Signal[] = [];

    if (provider.mode === "live") {
      try {
        signals = await runGroundedDefectAgent(ctx, reviews, app.name);
      } catch {
        // LLM clustering failed — fall back to deterministic clustering.
        signals = [];
      }
    }
    if (signals.length === 0) {
      signals = clusterReviews(reviews, { appName: app.name }).signals;
    }
    if (signals.length === 0) return null;

    return {
      signals,
      grounding: {
        kind: "live-reviews",
        detail: `Grounded in ${reviews.length} real App Store reviews of ${app.name}${
          app.seller ? ` (${app.seller})` : ""
        }.`,
        app: { id: app.id, name: app.name, url: app.url, reviewsAnalyzed: reviews.length },
      },
    };
  } catch {
    return null;
  }
}
