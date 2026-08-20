"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/product/types";

export default function ProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d.products) ? d.products : [])).finally(() => setLoaded(true));
  }, []);

  return (
    <main className="container">
      <div style={{ paddingTop: 28 }}>
        <div className="section-head" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 26 }}>Products</h2>
          <span className="muted">{products.length}</span>
          <span className="spacer" />
          <Link href="/product/new" className="btn primary">＋ New product</Link>
        </div>
        <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>
          A product is a workspace with its own AI agents and a prioritized backlog.
        </p>
      </div>

      <section className="section">
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
