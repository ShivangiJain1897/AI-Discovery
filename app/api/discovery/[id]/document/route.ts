import { NextResponse } from "next/server";
import { getDocument } from "@/lib/discovery/documents";
import { generateDocument } from "@/lib/discovery/generate";
import { getDiscovery, saveDiscovery } from "@/lib/discovery/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/discovery/:id/document — write a document from the research already
 * gathered. Body: { documentId }. Never re-runs research.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiscovery(id);
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let documentId = "";
  try {
    const b = await req.json();
    documentId = String(b?.documentId ?? "");
  } catch {
    /* validated below */
  }
  if (!getDocument(documentId)) return NextResponse.json({ error: "Unknown document." }, { status: 400 });

  const doc = await generateDocument(d, documentId);
  // Asking again replaces the old version rather than stacking near-duplicates.
  d.documents = [...d.documents.filter((x) => x.documentId !== doc.documentId), doc];
  await saveDiscovery(d);
  return NextResponse.json({ discovery: d, document: doc });
}
