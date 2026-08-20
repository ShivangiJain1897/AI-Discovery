"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ProductAgentMeta } from "@/lib/product/catalog";

export default function NewProduct() {
  const router = useRouter();
  const [oneLiner, setOneLiner] = useState("");
  const [name, setName] = useState("");
  const [agents, setAgents] = useState<ProductAgentMeta[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(["market", "defects", "feedback", "regulatory"]));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/product-agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
  }, []);

  function toggle(id: string) {
    setEnabled((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create() {
    setError("");
    if (!oneLiner.trim()) return setError("Describe the product in one line.");
    setCreating(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oneLiner, name, enabledAgents: [...enabled] }),
      });
      const data = await res.json();
      if (data?.product?.id) router.push(`/product/${data.product.id}`);
      else setError(data?.error || "Could not create.");
    } catch { setError("Network error."); }
    finally { setCreating(false); }
  }

  return (
    <main className="container">
      <div style={{ paddingTop: 24 }}>
        <div className="crumb"><Link href="/">Products</Link> / New</div>
        <h2 style={{ fontSize: 26, marginBottom: 4 }}>New product</h2>
        <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>Describe it in one line — the AI drafts a full brief you can refine next.</p>
      </div>

      <section className="section">
        <div className="card">
          <div className="field" style={{ marginBottom: 16 }}>
            <label>One-line description *</label>
            <input className="input" value={oneLiner} onChange={(e) => setOneLiner(e.target.value)}
              placeholder="e.g. A Medicare Advantage member app for benefits, claims, and care" autoFocus />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Name <span className="hint">optional — derived if blank</span></label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
          </div>

          <div className="composer-label">Enable agents for this product</div>
          <div className="cap-grid" style={{ marginTop: 10 }}>
            {agents.map((a) => {
              const on = enabled.has(a.id);
              return (
                <button key={a.id} className={`cap ${on ? "on" : ""}`} onClick={() => toggle(a.id)}>
                  <div className="cap-top">
                    <span className="cap-icon">{a.icon}</span>
                    <span className="cap-name">{a.name}</span>
                    <span className="cap-check">{on ? "✓" : ""}</span>
                  </div>
                  <div className="cap-blurb">{a.blurb}</div>
                  {a.future && <div className="cap-future">→ {a.future}</div>}
                </button>
              );
            })}
          </div>

          <div className="runbar">
            <button className="btn primary lg" onClick={create} disabled={creating}>
              {creating ? <span className="spinner" /> : "✦"} {creating ? "Drafting brief…" : "Create product"}
            </button>
            <Link href="/" className="btn ghost">Cancel</Link>
            {error && <span style={{ color: "var(--crit)", fontSize: 13 }}>{error}</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
