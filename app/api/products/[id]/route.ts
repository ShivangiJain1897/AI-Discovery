import { NextResponse } from "next/server";
import { deleteProduct, getProduct, saveProduct } from "@/lib/product/store";
import { PRODUCT_AGENTS } from "@/lib/product/agents";
import type { Product } from "@/lib/product/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_AGENTS = new Set(PRODUCT_AGENTS.map((a) => a.id));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

/** PATCH /api/products/:id — update name, brief, or enabledAgents. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Partial<Product>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof body.name === "string") product.name = body.name.trim() || product.name;
  if (typeof body.oneLiner === "string") product.oneLiner = body.oneLiner.trim();
  if (body.brief && typeof body.brief === "object") {
    product.brief = {
      ...product.brief,
      ...body.brief,
      kpis: Array.isArray(body.brief.kpis) ? body.brief.kpis.map(String) : product.brief.kpis,
    };
  }
  if (Array.isArray(body.enabledAgents)) {
    product.enabledAgents = body.enabledAgents.filter((a) => VALID_AGENTS.has(a));
  }
  product.updatedAt = Date.now();
  await saveProduct(product);
  return NextResponse.json({ product });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteProduct(id);
  return NextResponse.json({ ok: true });
}
