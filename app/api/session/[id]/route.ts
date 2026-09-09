import { NextResponse } from "next/server";
import { deleteSession, getSession, saveSession } from "@/lib/orchestrator/store";
import type { Stage } from "@/lib/orchestrator/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ session: s });
}

/**
 * PATCH /api/session/:id — small in-session updates:
 *   { note }                      add context that feeds everything generated after
 *   { stage }                     move the view
 *   { capabilityId, userNotes }   attach the PM's own evidence to one lens
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let b: { note?: string; stage?: Stage; capabilityId?: string; userNotes?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (typeof b.note === "string" && b.note.trim()) s.notes = [...s.notes, b.note.trim()];
  if (b.stage) s.stage = b.stage;
  if (b.capabilityId && typeof b.userNotes === "string") {
    const stream = s.streams.find((x) => x.capabilityId === b.capabilityId);
    if (stream) stream.userNotes = b.userNotes;
  }

  await saveSession(s);
  return NextResponse.json({ session: s });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getSession(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
