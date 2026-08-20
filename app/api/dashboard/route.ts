import { NextResponse } from "next/server";
import { listProducts, listBacklog } from "@/lib/product/store";
import { listSessions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard — cross-product rollup for the PM home. */
export async function GET() {
  const [products, sessions] = await Promise.all([listProducts(), listSessions()]);

  const productCards = await Promise.all(
    products.map(async (p) => {
      const items = await listBacklog(p.id);
      const active = items.filter((i) => i.status !== "dismissed");
      const proposed = active.filter((i) => i.status === "proposed");
      return {
        id: p.id,
        name: p.name,
        oneLiner: p.oneLiner,
        agents: p.enabledAgents.length,
        signals: p.signals.length,
        backlog: {
          total: active.length,
          now: active.filter((i) => i.bucket === "now").length,
          next: active.filter((i) => i.bucket === "next").length,
          proposed: proposed.length,
        },
        // A few items needing triage, for the attention list.
        attention: proposed
          .sort((a, b) => b.priorityScore - a.priorityScore)
          .slice(0, 3)
          .map((i) => ({ id: i.id, title: i.title, bucket: i.bucket, priorityScore: i.priorityScore })),
        updatedAt: p.updatedAt,
      };
    })
  );

  const totals = {
    products: products.length,
    backlogItems: productCards.reduce((s, p) => s + p.backlog.total, 0),
    toPrioritize: productCards.reduce((s, p) => s + p.backlog.proposed, 0),
    signals: productCards.reduce((s, p) => s + p.signals, 0),
    threads: sessions.length,
  };

  // Flatten attention across products (top items to prioritize).
  const attention = productCards
    .flatMap((p) => p.attention.map((a) => ({ ...a, productId: p.id, productName: p.name })))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 6);

  return NextResponse.json({
    totals,
    products: productCards.sort((a, b) => b.updatedAt - a.updatedAt),
    attention,
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo",
  });
}
