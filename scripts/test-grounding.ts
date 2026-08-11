/**
 * Offline tests for the review grounding pipeline.
 *
 * The FIXTURE below matches Apple's real customerreviews RSS JSON schema
 * (nested {label} nodes, content as an array with attributes.type, the leading
 * app-info entry with no im:rating). This lets us validate parsing + clustering
 * without network access. Run: node scripts/test-grounding.ts
 */
import { parseReviewsFeed } from "../lib/sources/app-reviews.ts";
import { clusterReviews } from "../lib/sources/review-cluster.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

// --- Fixture: shaped exactly like Apple's RSS customerreviews JSON ---
const FIXTURE = {
  feed: {
    // Leading entry is the APP itself — no im:rating; parser must drop it.
    entry: [
      {
        "im:name": { label: "Sample Health" },
        "im:image": [{ label: "https://example/icon.png" }],
        id: { label: "https://itunes.apple.com/us/app/id999" },
      },
      {
        author: { name: { label: "Frustrated Member" }, uri: { label: "https://user" } },
        "im:version": { label: "4.2.1" },
        "im:rating": { label: "1" },
        id: { label: "rev-1001" },
        title: { label: "Can't log in after update" },
        content: [
          { label: "After the latest update I can't sign in at all. Password reset does nothing. Had to call.", attributes: { type: "text" } },
          { label: "html version", attributes: { type: "html" } },
        ],
        link: { attributes: { rel: "related", href: "https://itunes.apple.com/us/review?id=rev-1001" } },
        updated: { label: "2026-07-30T10:00:00-07:00" },
      },
      {
        author: { name: { label: "Member B" } },
        "im:version": { label: "4.2.1" },
        "im:rating": { label: "2" },
        id: { label: "rev-1002" },
        title: { label: "Login broken" },
        content: { label: "The app won't let me log in. Keeps saying error. Very frustrating." },
        link: { attributes: { href: "https://itunes.apple.com/us/review?id=rev-1002" } },
        updated: { label: "2026-07-29T08:00:00-07:00" },
      },
      {
        author: { name: { label: "Member C" } },
        "im:rating": { label: "1" },
        id: { label: "rev-1003" },
        title: { label: "Prescriptions never refill" },
        content: { label: "My pharmacy refill request through the app never goes through. Medication delayed." },
        link: { attributes: { href: "https://itunes.apple.com/us/review?id=rev-1003" } },
      },
      {
        author: { name: { label: "Happy Member" } },
        "im:rating": { label: "5" },
        id: { label: "rev-1004" },
        title: { label: "Works great" },
        content: { label: "Love this app, easy to see my ID card." },
      },
      // Malformed entry — must be skipped, not crash.
      { author: { name: { label: "x" } }, id: { label: "rev-x" } },
    ],
  },
};

console.log("\nParsing (Apple RSS shape):");
const reviews = parseReviewsFeed(FIXTURE);
assert(reviews.length === 4, `parsed 4 reviews (dropped app-info + malformed) — got ${reviews.length}`);
const r1 = reviews.find((r) => r.id === "rev-1001");
assert(r1?.rating === 1, "rev-1001 rating parsed as number 1");
assert(r1?.content.includes("can't sign in"), "content picked the 'text' variant from array");
assert(r1?.author === "Frustrated Member", "author name parsed");
assert(r1?.version === "4.2.1", "version parsed");
assert(r1?.url?.includes("review?id=rev-1001"), "review deep link parsed");
assert(reviews.every((r) => r.rating >= 1), "no app-info entry leaked in (all have ratings)");

console.log("\nClustering into grounded signals:");
const { signals, reviewsAnalyzed, negativeReviews } = clusterReviews(reviews, { appName: "Sample Health" });
assert(reviewsAnalyzed === 4, "reviewsAnalyzed = 4");
assert(negativeReviews === 3, "negativeReviews = 3 (the three ≤3★)");
assert(signals.length >= 2, `produced ≥2 signals — got ${signals.length}`);
const login = signals.find((s) => s.stageId === "onboarding");
assert(!!login, "login/account issues anchored to 'onboarding' stage");
assert((login?.sources?.length ?? 0) >= 2, "login signal cites ≥2 real reviews");
assert(login?.sources?.[0]?.url?.includes("review?id"), "signal source carries a real URL");
const pharm = signals.find((s) => s.stageId === "pharmacy");
assert(!!pharm, "pharmacy refill issue anchored to 'pharmacy' stage");
assert(
  signals.every((s) => (s.sources?.length ?? 0) > 0),
  "every signal is grounded (has ≥1 real source)"
);

console.log(`\n${failures === 0 ? "✅ ALL PASSED" : `❌ ${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
