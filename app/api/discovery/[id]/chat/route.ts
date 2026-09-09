import { NextResponse } from "next/server";
import { handleMessage } from "@/lib/discovery/chat";
import { getDiscovery, saveDiscovery } from "@/lib/discovery/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/discovery/:id/chat — one message, whatever it is.
 *
 * The router works out whether it's a question, a request for more research, a
 * document, a revision, or the PM supplying a fact, and does that.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let message = "";
  try {
    const b = await req.json();
    message = String(b?.message ?? "").trim();
  } catch {
    /* validated below */
  }
  if (!message) return NextResponse.json({ error: "Type a message first." }, { status: 400 });

  // Older discoveries predate the conversation; give them one to land in.
  if (!Array.isArray(d.turns)) d.turns = [];

  const { discovery, turns } = await handleMessage(d, message);
  await saveDiscovery(discovery);
  return NextResponse.json({ discovery, turns });
}
