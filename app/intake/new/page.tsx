"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StatusPill, TopBar, useCurrentUser } from "../../components/shared";
import type { SimilarMatch } from "@/lib/intake/types";

export default function NewUseCasePage() {
  return (
    <Suspense fallback={null}>
      <NewUseCaseForm />
    </Suspense>
  );
}

function NewUseCaseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session") || "";
  const [name] = useCurrentUser();

  const [f, setF] = useState({
    title: "",
    problem: "",
    area: "",
    businessStakeholder: "",
    techStakeholder: "",
    dataStakeholder: "",
    dataSources: "",
    platform: "",
    tbd: "",
    tags: "",
  });
  const [similar, setSimilar] = useState<SimilarMatch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // Prefill from a Discovery session, if provided.
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/analyze/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        const s = d.session;
        if (!s) return;
        setF((p) => ({
          ...p,
          title: p.title || firstLine(s.input.text),
          problem: p.problem || s.input.text,
          area: p.area || s.input.productContext || "",
        }));
      })
      .catch(() => {});
  }, [sessionId]);

  // Debounced live similarity check.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const checkSimilar = useCallback((title: string, problem: string, area: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!title.trim() && !problem.trim()) return setSimilar([]);
      fetch("/api/intake/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, problem, area }),
      })
        .then((r) => r.json())
        .then((d) => setSimilar(d.similar ?? []))
        .catch(() => {});
    }, 450);
  }, []);
  useEffect(() => {
    checkSimilar(f.title, f.problem, f.area);
  }, [f.title, f.problem, f.area, checkSimilar]);

  async function submit() {
    setError("");
    if (!f.title.trim()) return setError("Give the use case a title.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
          submittedBy: name || "Anonymous",
          linkedSessionId: sessionId || undefined,
        }),
      });
      const data = await res.json();
      if (data?.item?.id) router.push(`/intake/${data.item.id}`);
      else setError(data?.error || "Could not save.");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="container">
        <div style={{ paddingTop: 24 }}>
          <div className="crumb">
            <Link href="/intake">Intake</Link> / New use case
          </div>
          <h2 style={{ fontSize: 26, marginBottom: 4 }}>New use case</h2>
          {sessionId && (
            <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>Prefilled from discovery session {sessionId}.</p>
          )}
        </div>

        <section className="section">
          <div className="card">
            <div className="form-grid">
              <div className="field full">
                <label>Title *</label>
                <input className="input" value={f.title} onChange={set("title")} placeholder="Short, recognizable name" />
              </div>
              <div className="field full">
                <label>Problem statement / description</label>
                <textarea className="textarea" style={{ minHeight: 110 }} value={f.problem} onChange={set("problem")}
                  placeholder="What's the use case? What problem does it solve?" />
              </div>
              <div className="field">
                <label>Area <span className="hint">where it's coming from</span></label>
                <input className="input" value={f.area} onChange={set("area")} placeholder="e.g. Member Services, Enrollment, Claims" />
              </div>
              <div className="field">
                <label>Platform <span className="hint">system / app involved</span></label>
                <input className="input" value={f.platform} onChange={set("platform")} placeholder="e.g. Member portal, mobile app" />
              </div>
              <div className="field">
                <label>Business stakeholder</label>
                <input className="input" value={f.businessStakeholder} onChange={set("businessStakeholder")} placeholder="Name / team" />
              </div>
              <div className="field">
                <label>Technology stakeholder</label>
                <input className="input" value={f.techStakeholder} onChange={set("techStakeholder")} placeholder="Name / team" />
              </div>
              <div className="field">
                <label>Data stakeholder</label>
                <input className="input" value={f.dataStakeholder} onChange={set("dataStakeholder")} placeholder="Name / team" />
              </div>
              <div className="field">
                <label>Data <span className="hint">sources / datasets involved</span></label>
                <input className="input" value={f.dataSources} onChange={set("dataSources")} placeholder="e.g. Claims, eligibility, CRM" />
              </div>
              <div className="field full">
                <label>To be determined <span className="hint">open questions / unknowns</span></label>
                <textarea className="textarea" style={{ minHeight: 70 }} value={f.tbd} onChange={set("tbd")} placeholder="What still needs to be figured out?" />
              </div>
              <div className="field full">
                <label>Tags <span className="hint">comma-separated</span></label>
                <input className="input" value={f.tags} onChange={set("tags")} placeholder="e.g. ai, self-service, retention" />
              </div>
            </div>

            {similar.length > 0 && (
              <div className="similar-panel">
                <h4>⚠ Looks similar to {similar.length} existing use case{similar.length === 1 ? "" : "s"} — check before adding a duplicate:</h4>
                {similar.map((m) => (
                  <SimilarRow key={m.id} m={m} />
                ))}
              </div>
            )}

            <div className="runbar">
              <button className="btn primary lg" onClick={submit} disabled={submitting}>
                {submitting ? <span className="spinner" /> : "＋"} {submitting ? "Saving…" : "Add to intake"}
              </button>
              <Link href="/intake" className="btn ghost">Cancel</Link>
              {error && <span style={{ color: "var(--crit)", fontSize: 13 }}>{error}</span>}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function SimilarRow({ m }: { m: SimilarMatch }) {
  return (
    <div className="similar-item">
      <span className="match">{Math.round(m.score * 100)}% match</span>
      <Link href={`/intake/${m.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{m.title}</Link>
      <StatusPill status={m.status} />
      <span className="spacer" />
      <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {m.sharedTerms.slice(0, 4).map((t) => (
          <span key={t} className="shared-term">{t}</span>
        ))}
      </span>
    </div>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "";
  return l.length > 90 ? l.slice(0, 87) + "…" : l;
}
