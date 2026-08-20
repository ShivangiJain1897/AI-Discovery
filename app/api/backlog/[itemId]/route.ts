import { NextResponse } from "next/server";
import { deleteBacklogItem, getBacklogItem, saveBacklogItem } from "@/lib/product/store";
import { priorityScore } from "@/lib/product/backlog";
import type { BacklogBucket, BacklogItem, BacklogStatus } from "@/lib/product/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKETS = new Set<BacklogBucket>(["now", "next", "later", "icebox"]);
const STATUSES = new Set<BacklogStatus>(["proposed", "accepted", "in_progress", "done", "dismissed"]);

/** PATCH /api/backlog/:itemId — PM curation: score, bucket, status, rank, text. */
export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const item = await getBacklogItem(itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Partial<BacklogItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (typeof body.title === "string") item.title = body.title;
  if (typeof body.description === "string") item.description = body.description;
  if (isScore(body.impact)) item.impact = body.impact;
  if (isScore(body.effort)) item.effort = body.effort;
  if (typeof body.confidence === "number") item.confidence = clamp01(body.confidence);
  if (body.bucket && BUCKETS.has(body.bucket)) item.bucket = body.bucket;
  if (body.status && STATUSES.has(body.status)) item.status = body.status;
  if (typeof body.rank === "number") item.rank = body.rank;

  // Any score change re-derives priority; mark human-adjusted so re-gen won't clobber.
  item.priorityScore = priorityScore(item.impact, item.effort, item.confidence);
  item.humanAdjusted = true;
  item.updatedAt = Date.now();
  await saveBacklogItem(item);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const item = await getBacklogItem(itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteBacklogItem(itemId);
  return NextResponse.json({ ok: true });
}

function isScore(n: unknown): n is 1 | 2 | 3 | 4 | 5 {
  return typeof n === "number" && n >= 1 && n <= 5;
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
