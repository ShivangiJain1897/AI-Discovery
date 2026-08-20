import { NextResponse } from "next/server";
import { getProduct, listBacklog, newBacklogId, saveBacklogItem } from "@/lib/product/store";
import { bucketFor, priorityScore, synthesizeBacklog } from "@/lib/product/backlog";
import type { BacklogItem } from "@/lib/product/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/products/:id/backlog — list this product's backlog. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await listBacklog(id);
  return NextResponse.json({ items: sortItems(items) });
}

/**
 * POST /api/products/:id/backlog
 *  - { action: "generate" } → synthesize new items from current signals
 *  - { action: "add", title, description } → add a manual item
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { action?: string; title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    body = { action: "generate" };
  }

  const existing = await listBacklog(id);

  if (body.action === "add") {
    const title = (body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    const now = Date.now();
    const item: BacklogItem = {
      id: newBacklogId(),
      productId: id,
      title,
      description: (body.description || "").trim(),
      source: "manual",
      impact: 3,
      effort: 3,
      confidence: 0.6,
      priorityScore: priorityScore(3, 3, 0.6),
      bucket: bucketFor(priorityScore(3, 3, 0.6)),
      status: "proposed",
      rank: existing.length,
      humanAdjusted: true,
      createdAt: now,
      updatedAt: now,
    };
    await saveBacklogItem(item);
    return NextResponse.json({ item, items: sortItems([...existing, item]) });
  }

  // Default: generate from signals.
  const created = synthesizeBacklog(product, existing, newBacklogId);
  await Promise.all(created.map(saveBacklogItem));
  return NextResponse.json({ created: created.length, items: sortItems([...existing, ...created]) });
}

function sortItems(items: BacklogItem[]): BacklogItem[] {
  const order = { now: 0, next: 1, later: 2, icebox: 3 };
  return [...items].sort(
    (a, b) => order[a.bucket] - order[b.bucket] || a.rank - b.rank || b.priorityScore - a.priorityScore
  );
}
