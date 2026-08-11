/**
 * Deterministic use-case similarity — cosine over token frequency vectors.
 *
 * Works with no API key, so duplicate detection is always on. Title and area are
 * weighted higher (repeated) because they carry the most identity. Returns the
 * shared significant terms so the UI can explain *why* two use cases look alike.
 */
import type { SimilarMatch, UseCase } from "./types";

const STOP = new Set(
  "a an the of to for and or in on at by with from into as is are be we our their this that it its use case using want need should could would like also can may will them they he she his her your you i".split(
    /\s+/
  )
);

export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Build a weighted term-frequency map for a use case (title+area weighted). */
function vector(fields: { title: string; problem: string; area?: string; tags?: string[] }): Map<string, number> {
  const tokens = [
    ...tokenize(fields.title),
    ...tokenize(fields.title), // title x2
    ...tokenize(fields.area || ""),
    ...tokenize(fields.area || ""), // area x2
    ...tokenize((fields.tags || []).join(" ")),
    ...tokenize(fields.problem),
  ];
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  const magA = Math.sqrt([...a.values()].reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt([...b.values()].reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function sharedTerms(a: Map<string, number>, b: Map<string, number>, limit = 6): string[] {
  const shared: string[] = [];
  for (const k of a.keys()) if (b.has(k)) shared.push(k);
  // Rank shared terms by combined frequency.
  return shared
    .sort((x, y) => (b.get(y)! + a.get(y)!) - (b.get(x)! + a.get(x)!))
    .slice(0, limit);
}

export function findSimilar(
  draft: { title: string; problem: string; area?: string; tags?: string[] },
  existing: UseCase[],
  opts: { threshold?: number; limit?: number; excludeId?: string } = {}
): SimilarMatch[] {
  const threshold = opts.threshold ?? 0.18;
  const limit = opts.limit ?? 5;
  const dv = vector(draft);

  const matches: SimilarMatch[] = [];
  for (const uc of existing) {
    if (opts.excludeId && uc.id === opts.excludeId) continue;
    const uv = vector(uc);
    const score = cosine(dv, uv);
    if (score >= threshold) {
      matches.push({
        id: uc.id,
        title: uc.title,
        area: uc.area,
        status: uc.status,
        score: Math.round(score * 100) / 100,
        sharedTerms: sharedTerms(dv, uv),
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Pairwise similarity for the compare view. */
export function similarityBetween(a: UseCase, b: UseCase): { score: number; sharedTerms: string[] } {
  const av = vector(a);
  const bv = vector(b);
  return { score: Math.round(cosine(av, bv) * 100) / 100, sharedTerms: sharedTerms(av, bv, 10) };
}
