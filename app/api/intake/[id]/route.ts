import { NextResponse } from "next/server";
import { getUseCase, saveUseCase } from "@/lib/intake/store";
import type { Contribution, IntakeStatus, UseCase } from "@/lib/intake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intake/:id */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getUseCase(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

/**
 * PATCH /api/intake/:id — update fields and/or append a contribution.
 * Body: partial UseCase fields, plus optional { addContribution: {author, note} }.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getUseCase(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Partial<UseCase> & { addContribution?: { author?: string; note?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const editable: (keyof UseCase)[] = [
    "title",
    "problem",
    "area",
    "status",
    "businessStakeholder",
    "techStakeholder",
    "dataStakeholder",
    "dataSources",
    "platform",
    "tbd",
    "tags",
  ];
  for (const key of editable) {
    if (key in body && body[key] !== undefined) {
      // @ts-expect-error controlled assignment across a known key set
      item[key] = body[key];
    }
  }
  if (body.status && !isStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (body.addContribution && (body.addContribution.note || "").trim()) {
    const c: Contribution = {
      author: (body.addContribution.author || "Anonymous").trim(),
      note: body.addContribution.note!.trim(),
      at: Date.now(),
    };
    item.contributions = [...item.contributions, c];
  }

  item.updatedAt = Date.now();
  await saveUseCase(item);
  return NextResponse.json({ item });
}

function isStatus(s: string): s is IntakeStatus {
  return [
    "new",
    "in_discovery",
    "in_review",
    "approved",
    "in_progress",
    "on_hold",
    "done",
    "declined",
  ].includes(s);
}
