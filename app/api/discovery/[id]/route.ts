import { NextResponse } from "next/server";
import { deleteDiscovery, getDiscovery } from "@/lib/discovery/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ discovery: d });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getDiscovery(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteDiscovery(id);
  return NextResponse.json({ ok: true });
}
