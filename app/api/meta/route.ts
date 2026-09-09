import { NextResponse } from "next/server";
import { DOCUMENTS } from "@/lib/discovery/documents";
import { LENSES } from "@/lib/discovery/lenses";

export const runtime = "nodejs";

/** GET /api/meta — the lenses, the documents, and whether we're live. */
export async function GET() {
  return NextResponse.json({
    lenses: LENSES.map(({ id, name, icon, blurb, standard, web }) => ({
      id, name, icon, blurb, standard, web: Boolean(web),
    })),
    documents: DOCUMENTS.map(({ id, name, icon, blurb }) => ({ id, name, icon, blurb })),
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
