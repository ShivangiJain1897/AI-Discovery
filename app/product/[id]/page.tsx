"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ProductTabs from "../../components/ProductTabs";
import type { Product, ProductBrief } from "@/lib/product/types";

const FIELDS: { key: keyof ProductBrief; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "targetUsers", label: "Target users" },
  { key: "valueProp", label: "Value proposition" },
  { key: "platform", label: "Platform" },
  { key: "market", label: "Market" },
  { key: "regulatoryContext", label: "Regulatory context" },
];

export default function ProductOverview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductBrief | null>(null);
  const [running, setRunning] = useState(false);

  async function load() {
    const res = await fetch(`/api/products/${id}`);
    if (res.status === 404) return setNotFound(true);
    const d = await res.json();
    setProduct(d.product);
    setDraft(d.product.brief);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function saveBrief() {
    await fetch(`/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: draft }) });
    setEditing(false); load();
  }
  async function runAgents() {
    setRunning(true);
    try { await fetch(`/api/products/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); await load(); }
    finally { setRunning(false); }
  }
  async function remove() {
    if (!confirm("Delete this product and its backlog?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (notFound) return <main className="container"><div className="empty" style={{ marginTop: 40 }}>Product not found. <Link href="/" style={{ color: "var(--brand)" }}>Back</Link></div></main>;
  if (!product || !draft) return <main className="container"><div style={{ padding: 40 }}><span className="spinner" /></div></main>;

  return (
    <main className="container">
      <div style={{ paddingTop: 24 }}>
        <ProductTabs id={id} name={product.name} />
        <div className="section-head" style={{ alignItems: "center", marginTop: 16 }}>
          <h2 style={{ fontSize: 26 }}>{product.name}</h2>
          <span className="spacer" />
          <button className="btn" onClick={runAgents} disabled={running}>{running ? <span className="spinner" /> : "▶"} Run agents</button>
          <Link className="btn primary" href={`/product/${id}/backlog`}>◧ Backlog</Link>
          <button className="btn ghost" onClick={remove} style={{ color: "var(--crit)" }}>🗑</button>
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 15 }}>{product.oneLiner}</p>
      </div>

      {/* Quick status */}
      <section className="section" style={{ paddingTop: 12 }}>
        <div className="grid cols-3">
          <StatCard label="Enabled agents" value={product.enabledAgents.length} href={`/product/${id}/agents`} cta="Configure" />
          <StatCard label="Signals" value={product.signals.length} href={`/product/${id}/agents`} cta="Run agents" />
          <StatCard label="Discovery" value="chat" href={`/product/${id}/discovery`} cta="Open" />
        </div>
      </section>

      {/* Brief */}
      <section className="section">
        <div className="section-head">
          <h2>Product brief</h2>
          <span className="muted">AI-drafted · refine anytime</span>
          <span className="spacer" />
          {editing ? (
            <><button className="btn primary" onClick={saveBrief}>Save</button><button className="btn ghost" onClick={() => { setEditing(false); setDraft(product.brief); }}>Cancel</button></>
          ) : <button className="btn" onClick={() => setEditing(true)}>✎ Edit</button>}
        </div>
        <div className="card">
          {FIELDS.map((f) => (
            <div className="kv" key={f.key} style={{ marginBottom: 14 }}>
              <div className="k">{f.label}</div>
              {editing ? (
                <textarea className="textarea" style={{ minHeight: 60 }} value={draft[f.key] as string} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
              ) : <div className="v">{(product.brief[f.key] as string) || "—"}</div>}
            </div>
          ))}
          <div className="kv">
            <div className="k">KPIs</div>
            {editing ? (
              <input className="input" value={draft.kpis.join(", ")} onChange={(e) => setDraft({ ...draft, kpis: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            ) : <div className="tags">{product.brief.kpis.map((k) => <span key={k} className="otag">{k}</span>)}</div>}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, href, cta }: { label: string; value: string | number; href: string; cta: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: "4px 0 10px" }}>{value}</div>
      <Link href={href} className="btn ghost" style={{ padding: "6px 12px" }}>{cta} →</Link>
    </div>
  );
}
