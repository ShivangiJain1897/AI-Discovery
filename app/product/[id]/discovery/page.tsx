"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Composer from "../../../components/Composer";
import type { AnalyzeSession } from "@/lib/capabilities/types";
import type { Product } from "@/lib/product/types";

export default function ProductDiscovery() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [sessions, setSessions] = useState<AnalyzeSession[]>([]);

  useEffect(() => {
    fetch(`/api/products/${id}`).then((r) => r.json()).then((d) => setProduct(d.product)).catch(() => {});
    fetch(`/api/analyze?product=${id}`).then((r) => r.json()).then((d) => setSessions(Array.isArray(d.sessions) ? d.sessions : [])).catch(() => {});
  }, [id]);

  const context = product ? `${product.name} — ${product.oneLiner}` : undefined;

  return (
    <main className="container">
      <div style={{ paddingTop: 24 }}>
        <div className="crumb"><Link href="/">Products</Link> / <Link href={`/product/${id}`}>{product?.name ?? "Product"}</Link> / Discovery</div>
        <h2 style={{ fontSize: 24 }}>Discovery</h2>
        <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>Chat grounded in this product. Paste a feature, requirement, or transcript and pick what to generate.</p>
      </div>

      <section className="section" style={{ paddingTop: 12 }}>
        <Composer productId={id} productContext={context} />
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ fontSize: 18 }}>Threads</h2><span className="muted">{sessions.length}</span></div>
        {sessions.length === 0 ? (
          <div className="empty">No discovery threads yet for this product.</div>
        ) : (
          sessions.map((s) => (
            <Link key={s.id} href={`/session/${s.id}`}>
              <div className="sess-row">
                <span className={`pill ${s.status}`}>{s.status}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{firstLine(s.input.text)}</div>
                  <div className="rid">{(s.turns?.length ?? 1)} turn{(s.turns?.length ?? 1) === 1 ? "" : "s"} · {s.id}</div>
                </div>
                <div style={{ color: "var(--ink-faint)", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(s.createdAt).toLocaleDateString()}</div>
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Untitled";
  return l.length > 90 ? l.slice(0, 87) + "…" : l;
}
