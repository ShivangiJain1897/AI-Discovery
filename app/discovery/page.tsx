"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Composer from "../components/Composer";
import type { AnalyzeSession } from "@/lib/capabilities/types";

export default function DiscoveryPage() {
  return (
    <Suspense fallback={null}>
      <Discovery />
    </Suspense>
  );
}

function Discovery() {
  const params = useSearchParams();
  const cap = params.get("cap") || "";
  const initial = cap ? cap.split(",").filter(Boolean) : undefined;
  const [sessions, setSessions] = useState<AnalyzeSession[]>([]);

  useEffect(() => {
    fetch("/api/analyze").then((r) => r.json()).then((d) => setSessions(Array.isArray(d.sessions) ? d.sessions : [])).catch(() => {});
  }, []);

  return (
    <main className="container">
      <section className="hero">
        <div className="eyebrow">✦ Discovery</div>
        <h1>Ask anything.</h1>
        <p className="lede">
          Paste a feature idea, a written requirement, or a raw meeting transcript — pick what you
          want and get it as a chat you can follow up on. Working on a specific product?{" "}
          <Link href="/products" style={{ color: "var(--brand)" }}>Open a product</Link> to ground it.
        </p>
      </section>

      <section className="section">
        <Composer initialCapabilities={initial} />
      </section>

      <section className="section">
        <div className="section-head"><h2 style={{ fontSize: 18 }}>Recent discoveries</h2><span className="muted">{sessions.length}</span></div>
        {sessions.length === 0 ? (
          <div className="empty">Nothing yet — ask something above to start your first thread.</div>
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
