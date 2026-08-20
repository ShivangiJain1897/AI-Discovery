import { NextResponse } from "next/server";
import { draftBrief } from "@/lib/product/brief";
import { listProducts, newProductId, saveProduct } from "@/lib/product/store";
import { PRODUCT_AGENTS } from "@/lib/product/agents";
import type { CreateProductInput, Product } from "@/lib/product/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/products — list all products. */
export async function GET() {
  return NextResponse.json({ products: await listProducts() });
}

/** POST /api/products — create a product; AI drafts the brief from the one-liner. */
export async function POST(req: Request) {
  let body: CreateProductInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const oneLiner = (body.oneLiner || "").trim();
  if (!oneLiner) return NextResponse.json({ error: "A one-line description is required." }, { status: 400 });
  const name = (body.name || "").trim() || deriveName(oneLiner);

  const brief = { ...(await draftBrief(name, oneLiner)), ...(body.brief || {}) };
  const now = Date.now();
  const product: Product = {
    id: newProductId(),
    name,
    oneLiner,
    brief,
    enabledAgents: Array.isArray(body.enabledAgents) && body.enabledAgents.length
      ? body.enabledAgents
      : PRODUCT_AGENTS.slice(0, 4).map((a) => a.id),
    signals: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveProduct(product);
  return NextResponse.json({ product });
}

function deriveName(oneLiner: string): string {
  const w = oneLiner.trim().split(/\s+/).slice(0, 3).join(" ");
  return w.charAt(0).toUpperCase() + w.slice(1);
}
