import { NextResponse } from "next/server";
import { getProduct, saveProduct } from "@/lib/product/store";
import { runInsightAgent } from "@/lib/product/agents";
import type { AgentRunLite, Signal } from "@/lib/product/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/products/:id/run — run the product's enabled agents and store the
 * signals they produce. Body: { agentIds?: string[] } to run a subset.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let agentIds = product.enabledAgents;
  try {
    const body = await req.json();
    if (Array.isArray(body?.agentIds) && body.agentIds.length) {
      agentIds = body.agentIds.filter((a: string) => product.enabledAgents.includes(a));
    }
  } catch {
    /* run all enabled */
  }
  if (agentIds.length === 0) {
    return NextResponse.json({ error: "No agents enabled for this product." }, { status: 400 });
  }

  const runs: AgentRunLite[] = [];
  const collected: Signal[] = [];
  await Promise.all(
    agentIds.map(async (agentId) => {
      try {
        const signals = await runInsightAgent(product, agentId);
        collected.push(...signals);
        runs.push({ agentId, status: "complete", signalCount: signals.length, at: Date.now() });
      } catch (err) {
        runs.push({ agentId, status: "error", signalCount: 0, at: Date.now(), error: err instanceof Error ? err.message : String(err) });
      }
    })
  );

  // Merge: keep signals from agents that weren't run this time.
  const rerun = new Set(agentIds);
  product.signals = [...product.signals.filter((s) => !rerun.has(s.agentId)), ...collected];
  product.lastRun = [...(product.lastRun ?? []).filter((r) => !rerun.has(r.agentId)), ...runs];
  product.updatedAt = Date.now();
  await saveProduct(product);

  return NextResponse.json({ product, runs });
}
