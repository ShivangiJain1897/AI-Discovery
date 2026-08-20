"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AttentionItem { id: string; title: string; bucket: string; priorityScore: number; productId: string; productName: string }
interface ProductCard {
  id: string; name: string; oneLiner: string; agents: number; signals: number;
  backlog: { total: number; now: number; next: number; proposed: number };
}
interface Dash {
  totals: { products: number; backlogItems: number; toPrioritize: number; signals: number; threads: number };
  products: ProductCard[];
  attention: AttentionItem[];
}

const TEMPLATES = [
  { cap: "prd", icon: "📄", name: "PRD", blurb: "Draft a product requirements doc" },
  { cap: "requirements", icon: "✅", name: "Requirements", blurb: "User stories + acceptance criteria" },
  { cap: "value_quant", icon: "📊", name: "Value realization", blurb: "Quantify business value" },
  { cap: "market", icon: "🌐", name: "Market scan", blurb: "Market landscape & trends" },
  { cap: "competitive", icon: "📈", name: "Competitive analysis", blurb: "Compare & differentiate" },
  { cap: "value_quant,value_qual", icon: "💼", name: "Business case", blurb: "Quant + qualitative value" },
];

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setD).catch(() => {});
  }, []);

  const t = d?.totals;
  return (
    <main className="container">
      <section className="hero" style={{ paddingBottom: 10 }}>
        <div className="eyebrow">✦ AI Product Studio</div>
        <h1 style={{ fontSize: 38 }}>Your product day, at a glance.</h1>
        <p className="lede">Everything you&apos;re running — products, backlog, and what needs prioritizing — in one place.</p>
      </section>

      {/* Stat tiles */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="tiles">
          <Tile label="Products" value={t?.products} href="/products" accent="brand" />
          <Tile label="Backlog items" value={t?.backlogItems} href="/products" accent="brand2" />
          <Tile label="To prioritize" value={t?.toPrioritize} href="/products" accent="warn" highlight />
          <Tile label="Signals" value={t?.signals} href="/products" accent="accent" />
          <Tile label="Discoveries" value={t?.threads} href="/discovery" accent="brand" />
        </div>
      </section>

      <div className="grid cols-2" style={{ alignItems: "start", marginTop: 4 }}>
        {/* Needs attention */}
        <section className="section">
          <div className="section-head"><h2 style={{ fontSize: 18 }}>Needs your attention</h2><span className="muted">{d?.attention.length ?? 0}</span></div>
          {!d ? <div style={{ padding: 16 }}><span className="spinner" /></div> :
            d.attention.length === 0 ? (
              <div className="empty">Nothing to triage — run agents on a product and generate a backlog.</div>
            ) : (
              <div className="card" style={{ padding: 8 }}>
                {d.attention.map((a) => (
                  <Link key={a.id} href={`/product/${a.productId}/backlog`} className="attn-row">
                    <span className="prio">{a.priorityScore}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="attn-title">{a.title}</div>
                      <div className="attn-sub">{a.productName} · proposed · {a.bucket}</div>
                    </div>
                    <span className="attn-cta">Prioritize →</span>
                  </Link>
                ))}
              </div>
            )}
        </section>

        {/* Your products */}
        <section className="section">
          <div className="section-head">
            <h2 style={{ fontSize: 18 }}>Your products</h2><span className="muted">{d?.products.length ?? 0}</span>
            <span className="spacer" />
            <Link href="/product/new" className="btn primary" style={{ padding: "7px 14px" }}>＋ New product</Link>
          </div>
          {!d ? <div style={{ padding: 16 }}><span className="spinner" /></div> :
            d.products.length === 0 ? (
              <div className="empty">No products yet — <Link href="/product/new" style={{ color: "var(--brand)" }}>create your first</Link>.</div>
            ) : (
              d.products.map((p) => (
                <Link key={p.id} href={`/product/${p.id}`}>
                  <div className="prod-row" title={p.oneLiner}>
                    <span style={{ fontSize: 20 }}>◱</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 650, fontSize: 14.5 }}>{p.name}</div>
                      <div className="prod-stats">
                        <span title="Backlog"><b>{p.backlog.total}</b> backlog</span>
                        <span className="now" title="In Now"><b>{p.backlog.now}</b> now</span>
                        <span title="To prioritize"><b>{p.backlog.proposed}</b> to triage</span>
                      </div>
                    </div>
                    <span className="attn-cta">Open →</span>
                  </div>
                </Link>
              ))
            )}
        </section>
      </div>

      {/* Quick-start templates */}
      <section className="section">
        <div className="section-head"><h2 style={{ fontSize: 18 }}>Quick start</h2><span className="muted">jump into Discovery with a template</span></div>
        <div className="tmpl-grid">
          {TEMPLATES.map((t) => (
            <Link key={t.name} href={`/discovery?cap=${t.cap}`} className="tmpl">
              <span className="tmpl-icon">{t.icon}</span>
              <div>
                <div className="tmpl-name">{t.name}</div>
                <div className="tmpl-blurb">{t.blurb}</div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>More templates coming — value realization, roadmap, release notes, and your own.</div>
      </section>
    </main>
  );
}

function Tile({ label, value, href, accent, highlight }: { label: string; value?: number; href: string; accent: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`tile ${highlight ? "hl" : ""}`}>
      <div className={`tile-val a-${accent}`}>{value ?? "—"}</div>
      <div className="tile-label">{label}</div>
    </Link>
  );
}
