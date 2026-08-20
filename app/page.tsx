"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/product/types";

export default function ProductsHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d.products) ? d.products : [])).finally(() => setLoaded(true));
  }, []);

  return (
    <main className="container">
      <section className="hero">
        <div className="eyebrow">✦ AI Product Studio</div>
        <h1>Run every product with a team of AI agents.</h1>
        <p className="lede">
          Create a product, configure the agents that work it — market, competitive, defect,
          regulatory, process, knowledge — and let them surface signals that become a prioritized
          backlog you own. Discovery chat is one click away inside each product.
        </p>
        <div style={{ marginTop: 20 }}>
          <Link href="/product/new" className="btn primary lg">＋ New product</Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Your products</h2><span className="muted">{products.length}</span></div>
        {!loaded ? (
          <div style={{ padding: 20 }}><span className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="empty">No products yet — <Link href="/product/new" style={{ color: "var(--brand)" }}>create your first</Link> and the AI will draft its brief.</div>
        ) : (
          <div className="grid cols-2">
            {products.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`}>
                <div className="card hover">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>◱</span>
                    <h3 style={{ fontSize: 17 }}>{p.name}</h3>
                  </div>
                  <p style={{ color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>{p.oneLiner}</p>
                  <div className="tags" style={{ marginTop: 12 }}>
                    <span className="otag">{p.enabledAgents.length} agents</span>
                    <span className="otag">{p.signals.length} signals</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
