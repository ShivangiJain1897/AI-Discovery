"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { StatusPill, TopBar } from "../../components/shared";
import type { UseCase } from "@/lib/intake/types";

interface Pair { a: string; b: string; score: number; sharedTerms: string[] }

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const params = useSearchParams();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const [items, setItems] = useState<UseCase[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ids.length < 2) {
      setError("Pick at least two use cases from the tracker to compare.");
      return;
    }
    fetch("/api/intake/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setItems(d.items ?? []);
          setPairs(d.pairs ?? []);
        }
      })
      .catch(() => setError("Could not load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("ids")]);

  const titleOf = (id: string) => items.find((i) => i.id === id)?.title ?? id;

  return (
    <>
      <TopBar />
      <main className="container">
        <div style={{ paddingTop: 24 }}>
          <div className="crumb"><Link href="/intake">Intake</Link> / Compare</div>
          <h2 style={{ fontSize: 26 }}>Compare use cases</h2>
        </div>

        {error ? (
          <div className="empty" style={{ marginTop: 20 }}>{error}</div>
        ) : (
          <section className="section">
            {/* Overlap summary */}
            {pairs.length > 0 && (
              <div className="overlap">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Overlap</div>
                {pairs.map((p, i) => (
                  <div key={i} style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                    <strong>{Math.round(p.score * 100)}%</strong> — “{titleOf(p.a)}” vs “{titleOf(p.b)}”
                    {p.sharedTerms.length > 0 && (
                      <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap", marginLeft: 8 }}>
                        {p.sharedTerms.slice(0, 6).map((t) => (
                          <span key={t} className="shared-term">{t}</span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Side-by-side */}
            <div className="compare-grid">
              {items.map((uc) => (
                <div key={uc.id} className="compare-col">
                  <div className="cc-head">
                    <Link href={`/intake/${uc.id}`} style={{ fontWeight: 700, fontSize: 15 }}>{uc.title}</Link>
                    <div style={{ marginTop: 6 }}><StatusPill status={uc.status} /></div>
                  </div>
                  <Row k="Area" v={uc.area} />
                  <Row k="Problem" v={uc.problem} />
                  <Row k="Platform" v={uc.platform} />
                  <Row k="Business" v={uc.businessStakeholder} />
                  <Row k="Technology" v={uc.techStakeholder} />
                  <Row k="Data owner" v={uc.dataStakeholder} />
                  <Row k="Data" v={uc.dataSources} />
                  <Row k="TBD" v={uc.tbd} />
                  <Row k="Submitted by" v={uc.submittedBy} />
                </div>
              ))}
            </div>
          </section>
        )}
        <footer className="footer">
          <Link href="/intake" style={{ color: "var(--brand)" }}>← Back to tracker</Link>
        </footer>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="compare-row">
      <div className="crk">{k}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{v || "—"}</div>
    </div>
  );
}
