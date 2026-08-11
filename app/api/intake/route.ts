import { NextResponse } from "next/server";
import { listUseCases, newUseCaseId, saveUseCase } from "@/lib/intake/store";
import { findSimilar } from "@/lib/intake/similarity";
import type { CreateUseCaseInput, UseCase } from "@/lib/intake/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/intake — list all use cases. */
export async function GET() {
  const items = await listUseCases();
  return NextResponse.json({ items });
}

/** POST /api/intake — create a use case; returns it plus similar existing ones. */
export async function POST(req: Request) {
  let body: CreateUseCaseInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const problem = (body.problem || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const existing = await listUseCases();
  const similar = findSimilar({ title, problem, area: body.area, tags: body.tags }, existing);

  const now = Date.now();
  const uc: UseCase = {
    id: newUseCaseId(),
    title,
    problem,
    area: (body.area || "").trim() || "Unassigned",
    status: "new",
    submittedBy: (body.submittedBy || "").trim() || "Anonymous",
    businessStakeholder: clean(body.businessStakeholder),
    techStakeholder: clean(body.techStakeholder),
    dataStakeholder: clean(body.dataStakeholder),
    dataSources: clean(body.dataSources),
    platform: clean(body.platform),
    tbd: clean(body.tbd),
    tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10) : [],
    linkedSessionId: clean(body.linkedSessionId),
    contributions: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveUseCase(uc);
  return NextResponse.json({ item: uc, similar });
}

function clean(v?: string): string | undefined {
  const s = (v || "").trim();
  return s || undefined;
}
