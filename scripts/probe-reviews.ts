#!/usr/bin/env node
/**
 * Prove the review grounding works against REAL Apple App Store data.
 *
 *   node scripts/probe-reviews.mjs "Aetna Health"
 *   node scripts/probe-reviews.mjs "https://apps.apple.com/us/app/.../id600834530"
 *   node scripts/probe-reviews.mjs 600834530
 *
 * Resolves the app, fetches recent reviews, clusters the negatives into
 * stage-anchored defect signals, and prints them with real citations.
 * No API key required. Requires outbound access to itunes.apple.com.
 */
import { resolveApp, fetchReviews } from "../lib/sources/app-reviews.ts";
import { clusterReviews } from "../lib/sources/review-cluster.ts";

const input = process.argv.slice(2).join(" ").trim() || "Aetna Health";

const app = await resolveApp(input);
if (!app) {
  console.error(`Could not resolve an app for "${input}".`);
  process.exit(1);
}
console.log(`\nResolved: ${app.name}${app.seller ? ` (${app.seller})` : ""} — id ${app.id} [${app.genre}]`);
console.log(app.url ?? "");

const reviews = await fetchReviews(app.id, app.country, 4);
console.log(`\nFetched ${reviews.length} recent reviews.`);
const neg = reviews.filter((r) => r.rating <= 3).length;
console.log(`${neg} are negative (≤3★).\n`);

const { signals } = clusterReviews(reviews, { appName: app.name });
console.log(`Clustered into ${signals.length} grounded defect signals:\n`);
for (const s of signals) {
  console.log(`  [${s.severity.toUpperCase()}] (${s.stageId}) ${s.title}`);
  console.log(`     ${s.detail}`);
  for (const src of s.sources ?? []) {
    console.log(`     ↳ ${src.label} — "${(src.quote ?? "").slice(0, 90)}"`);
    if (src.url) console.log(`       ${src.url}`);
  }
  console.log("");
}
