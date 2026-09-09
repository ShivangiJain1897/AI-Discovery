import { NextResponse } from "next/server";
import { deleteDiscovery, getDiscovery, saveDiscovery } from "@/lib/discovery/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ discovery: d });
}

/** PATCH — add context. It feeds every document generated afterwards. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let b: { note?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof b.note === "string" && b.note.trim()) d.notes = [...d.notes, b.note.trim()];

  await saveDiscovery(d);
  return NextResponse.json({ discovery: d });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getDiscovery(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteDiscovery(id);
  return NextResponse.json({ ok: true });
}
