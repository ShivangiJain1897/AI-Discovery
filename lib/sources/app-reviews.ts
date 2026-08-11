/**
 * Real member-app review source, backed by Apple's PUBLIC endpoints.
 *
 * No API key. No scraping. These are the same endpoints the App Store itself
 * uses, and they return real, timestamped member reviews:
 *
 *   - Resolve an app:   https://itunes.apple.com/search?term=<q>&entity=software
 *                       https://itunes.apple.com/lookup?id=<id>
 *   - Fetch reviews:    https://itunes.apple.com/<cc>/rss/customerreviews/id=<id>/sortBy=mostRecent/page=<n>/json
 *
 * This is the thing that turns the Defect agent from "plausible" into "real":
 * every signal it produces can cite an actual review with a working link.
 *
 * NOTE: some sandboxed/CI environments block itunes.apple.com egress. Callers
 * must handle fetch failure gracefully (the Defect agent falls back to demo
 * data and flags that it could not reach live reviews).
 */

export interface AppRef {
  id: string;
  name: string;
  seller?: string;
  genre?: string;
  url?: string;
  country: string;
}

export interface Review {
  id: string;
  title: string;
  content: string;
  rating: number; // 1..5
  author: string;
  version?: string;
  url?: string;
  updated?: string;
}

const UA = "AI-Discovery/0.1 (+https://github.com/ShivangiJain1897/AI-Discovery)";
const DEFAULT_TIMEOUT_MS = 9000;

async function getJson(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${hostOf(url)}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function label(node: unknown): string {
  if (node && typeof node === "object" && "label" in node) {
    const l = (node as { label?: unknown }).label;
    return typeof l === "string" ? l : "";
  }
  return typeof node === "string" ? node : "";
}

/**
 * Resolve any of: a numeric app id, an App Store URL, or a search term into a
 * concrete App Store app. Returns null if nothing is found.
 */
export async function resolveApp(input: string, country = "us"): Promise<AppRef | null> {
  const raw = input.trim();
  if (!raw) return null;

  // 1) App Store URL — extract the /id<digits> segment.
  const urlId = raw.match(/\/id(\d{4,})/);
  const numeric = urlId?.[1] ?? (/^\d{4,}$/.test(raw) ? raw : null);

  if (numeric) {
    const data = (await getJson(
      `https://itunes.apple.com/lookup?id=${encodeURIComponent(numeric)}&country=${country}`
    )) as { results?: RawApp[] };
    const app = data.results?.[0];
    if (app) return toAppRef(app, country);
    // Fall through to search using the raw string if lookup missed.
  }

  // 2) Search term.
  const data = (await getJson(
    `https://itunes.apple.com/search?term=${encodeURIComponent(raw)}&entity=software&limit=5&country=${country}`
  )) as { results?: RawApp[] };
  const results = data.results ?? [];
  if (results.length === 0) return null;
  // Prefer a Medical/Health/Business app when several match (payer apps live there).
  const preferred =
    results.find((r) => /medical|health|business/i.test(r.primaryGenreName ?? "")) ?? results[0];
  return toAppRef(preferred, country);
}

interface RawApp {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  primaryGenreName?: string;
  trackViewUrl?: string;
}

function toAppRef(app: RawApp, country: string): AppRef {
  return {
    id: String(app.trackId ?? ""),
    name: app.trackName ?? "Unknown app",
    seller: app.artistName,
    genre: app.primaryGenreName,
    url: app.trackViewUrl,
    country,
  };
}

/**
 * Fetch recent customer reviews for an app id. Pages are ~50 reviews each;
 * Apple exposes up to 10 pages via RSS. Failures on individual pages are
 * tolerated so a partial fetch still returns useful data.
 */
export async function fetchReviews(
  appId: string,
  country = "us",
  maxPages = 4
): Promise<Review[]> {
  const pages = Math.max(1, Math.min(10, maxPages));
  const out: Review[] = [];
  const seen = new Set<string>();

  for (let p = 1; p <= pages; p++) {
    let data: unknown;
    try {
      data = await getJson(
        `https://itunes.apple.com/${country}/rss/customerreviews/id=${appId}/sortBy=mostRecent/page=${p}/json`
      );
    } catch (err) {
      // First page failing is fatal (nothing to work with); later pages optional.
      if (p === 1) throw err;
      break;
    }
    // The first entry on page 1 is the app itself (no rating) — parser drops it.
    let added = 0;
    for (const r of parseReviewsFeed(data)) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        out.push(r);
        added++;
      }
    }
    if (added === 0 && p > 1) break; // no more reviews
  }
  return out;
}

/**
 * Parse one page of the Apple customer-reviews RSS JSON into Review objects.
 * Exported so the exact (nested, quirky) Apple shape can be tested offline.
 */
export function parseReviewsFeed(data: unknown): Review[] {
  return extractEntries(data)
    .map(parseReview)
    .filter((r): r is Review => r !== null);
}

function extractEntries(data: unknown): unknown[] {
  const feed = (data as { feed?: { entry?: unknown } })?.feed;
  const entry = feed?.entry;
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

function parseReview(e: unknown): Review | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const ratingLabel = label(o["im:rating"]);
  if (!ratingLabel) return null; // app-info entry or malformed — skip
  const rating = parseInt(ratingLabel, 10);
  if (!Number.isFinite(rating)) return null;

  const content = pickContent(o["content"]);
  const title = label(o["title"]);
  if (!content && !title) return null;

  const author =
    label((o["author"] as Record<string, unknown> | undefined)?.["name"]) || "App Store member";
  const linkHref =
    ((o["link"] as { attributes?: { href?: string } } | undefined)?.attributes?.href) || undefined;

  return {
    id: label(o["id"]) || `${title}-${author}`.slice(0, 64),
    title,
    content,
    rating,
    author,
    version: label(o["im:version"]) || undefined,
    url: linkHref,
    updated: label(o["updated"]) || undefined,
  };
}

/** content can be an object {label} or an array of {label, attributes.type}. */
function pickContent(node: unknown): string {
  if (Array.isArray(node)) {
    const text = node.find(
      (n) => (n as { attributes?: { type?: string } })?.attributes?.type === "text"
    );
    return label(text ?? node[0]);
  }
  return label(node);
}
