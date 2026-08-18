import { NextResponse } from "next/server";
import { deleteUseCase, getUseCase, saveUseCase } from "@/lib/intake/store";
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

/** DELETE /api/intake/:id */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getUseCase(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteUseCase(id);
  return NextResponse.json({ ok: true });
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

  // Guardrail: a human can override the AI score (with a recorded rationale).
  const hs = (body as { humanScore?: { score?: number; by?: string; rationale?: string } }).humanScore;
  if (hs && typeof hs.score === "number") {
    item.humanScore = {
      score: hs.score,
      by: (hs.by || "Anonymous").trim(),
      rationale: (hs.rationale || "").trim(),
      at: Date.now(),
    };
    item.scoreHistory = [
      ...(item.scoreHistory ?? []),
      { at: Date.now(), stage: "Human override", score: hs.score, source: "human", by: item.humanScore.by, note: item.humanScore.rationale },
    ];
  }

  // Guardrail: humans make the triage/solution decision.
  const dec = (body as { decision?: { decision?: string; by?: string; rationale?: string } }).decision;
  if (dec && (dec.decision || "").trim()) {
    item.decision = {
      decision: dec.decision!.trim(),
      by: (dec.by || "Anonymous").trim(),
      rationale: (dec.rationale || "").trim(),
      at: Date.now(),
    };
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
