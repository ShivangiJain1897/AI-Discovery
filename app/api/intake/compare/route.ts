import { NextResponse } from "next/server";
import { getUseCase } from "@/lib/intake/store";
import { similarityBetween } from "@/lib/intake/similarity";
import type { UseCase } from "@/lib/intake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/intake/compare — compare 2+ use cases.
 * Body: { ids: string[] }
 * Returns the items plus pairwise overlap (similarity score + shared terms).
 */
export async function POST(req: Request) {
  let body: { ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 4) : [];
  if (ids.length < 2) return NextResponse.json({ error: "Pick at least two use cases." }, { status: 400 });

  const items = (await Promise.all(ids.map((id) => getUseCase(id)))).filter(
    (x): x is UseCase => Boolean(x)
  );
  if (items.length < 2) return NextResponse.json({ error: "Use cases not found." }, { status: 404 });

  const pairs: { a: string; b: string; score: number; sharedTerms: string[] }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const { score, sharedTerms } = similarityBetween(items[i], items[j]);
      pairs.push({ a: items[i].id, b: items[j].id, score, sharedTerms });
    }
  }
  return NextResponse.json({ items, pairs });
}
