"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ProductAgentMeta } from "@/lib/product/catalog";
import type { Product } from "@/lib/product/types";

export default function ProductAgents() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [agents, setAgents] = useState<ProductAgentMeta[]>([]);
  const [running, setRunning] = useState(false);

  async function load() {
    const [p, a] = await Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch("/api/product-agents").then((r) => r.json()),
    ]);
    setProduct(p.product); setAgents(a.agents ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function toggle(agentId: string) {
    if (!product) return;
    const set = new Set(product.enabledAgents);
    set.has(agentId) ? set.delete(agentId) : set.add(agentId);
    const res = await fetch(`/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabledAgents: [...set] }) });
    const d = await res.json(); setProduct(d.product);
  }
  async function runAll() {
    setRunning(true);
    try { const res = await fetch(`/api/products/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const d = await res.json(); setProduct(d.product); }
    finally { setRunning(false); }
  }

  if (!product) return <main className="container"><div style={{ padding: 40 }}><span className="spinner" /></div></main>;
  const lastRun = new Map((product.lastRun ?? []).map((r) => [r.agentId, r]));
  const signalsByAgent = new Map<string, number>();
  for (const s of product.signals) signalsByAgent.set(s.agentId, (signalsByAgent.get(s.agentId) ?? 0) + 1);

  return (
    <main className="container">
      <div style={{ paddingTop: 24 }}>
        <div className="crumb"><Link href="/">Products</Link> / <Link href={`/product/${id}`}>{product.name}</Link> / Agents</div>
        <div className="section-head" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 24 }}>Agents</h2>
          <span className="muted">Toggle the AI team for this product, then run them</span>
          <span className="spacer" />
          <button className="btn primary" onClick={runAll} disabled={running || product.enabledAgents.length === 0}>
            {running ? <span className="spinner" /> : "▶"} Run enabled ({product.enabledAgents.length})
          </button>
          <Link className="btn" href={`/product/${id}/backlog`}>◧ Backlog</Link>
        </div>
      </div>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="grid cols-2">
          {agents.map((a) => {
            const on = product.enabledAgents.includes(a.id);
            const r = lastRun.get(a.id);
            const count = signalsByAgent.get(a.id) ?? 0;
            return (
              <div key={a.id} className={`card ${on ? "" : ""}`} style={{ borderColor: on ? "var(--brand)" : undefined }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{a.category}</div>
                  </div>
                  <button className={`toggle ${on ? "on" : ""}`} onClick={() => toggle(a.id)} title={on ? "Enabled" : "Disabled"}>
                    <span className="knob" />
                  </button>
                </div>
                <p style={{ color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>{a.blurb}</p>
                {a.future && <div className="cap-future">→ {a.future}</div>}
                {on && (
                  <div style={{ marginTop: 10, fontSize: 12, color: r?.status === "error" ? "var(--crit)" : "var(--ink-faint)" }}>
                    {r ? (r.status === "error" ? `error: ${r.error}` : `${count} signals · ran ${new Date(r.at).toLocaleTimeString()}`) : "not run yet"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link className="btn primary lg" href={`/product/${id}/backlog`}>Generate backlog from signals →</Link>
        </div>
      </section>
    </main>
  );
}
