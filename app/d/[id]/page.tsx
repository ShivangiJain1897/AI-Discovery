"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Doc, downloadMarkdown } from "@/app/components/Doc";

/**
 * The discovery: what we found, and the documents you can get from it.
 *
 * Findings at the top, four buttons for the four documents, documents below.
 * Generating one never re-runs the research.
 */

type Confidence = "High" | "Medium" | "Low";
interface Finding { id: string; title: string; detail: string; confidence: Confidence; basis: string }
interface LensResult {
  lensId: string; status: string; summary: string; findings: Finding[];
  gaps: string[]; sources: string[]; error?: string;
}
interface DocSection { heading: string; body?: string; bullets?: string[]; table?: { headers: string[]; rows: string[][] } }
interface GeneratedDoc { id: string; documentId: string; title: string; sections: DocSection[]; createdAt: number }
interface Discovery {
  id: string; idea: string; kind: "product" | "feature";
  context: { industry: string; users: string; problem: string; goal: string };
  lenses: LensResult[];
  summary?: { headline: string; learned: string[]; opportunities: string[]; risks: string[] };
  documents: GeneratedDoc[]; notes: string[]; mode: "live" | "demo";
  createdAt: number; updatedAt: number;
}
interface Meta {
  lenses: { id: string; name: string; icon: string; blurb: string; standard: boolean; web: boolean }[];
  documents: { id: string; name: string; icon: string; blurb: string }[];
  mode: "live" | "demo";
}

export default function DiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Discovery | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/discovery/${id}`);
      if (!r.ok) throw new Error("Not found.");
      setD((await r.json()).discovery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/meta").then((r) => r.json()).then(setMeta).catch(() => {});
  }, [load]);

  const lensMeta = (lid: string) => meta?.lenses.find((l) => l.id === lid);

  async function makeDocument(documentId: string) {
    setBusy(documentId);
    setError("");
    try {
      const r = await fetch(`/api/discovery/${id}/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not write the document.");
      setD(j.discovery);
      setTimeout(() => document.getElementById(`doc-${documentId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write the document.");
    } finally {
      setBusy(null);
    }
  }

  async function rerun() {
    setBusy("rerun");
    setError("");
    try {
      const r = await fetch(`/api/discovery/${id}/rerun`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not re-run.");
      setD(j.discovery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not re-run.");
    } finally {
      setBusy(null);
    }
  }

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    setBusy("note");
    try {
      const r = await fetch(`/api/discovery/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: text }),
      });
      const j = await r.json();
      if (r.ok) setD(j.discovery);
      setNote("");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this discovery?")) return;
    await fetch(`/api/discovery/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <div className="page"><div className="notice">Loading…</div></div>;
  if (error && !d) return <div className="page"><div className="notice err">{error}</div></div>;
  if (!d) return null;

  const done = d.lenses.filter((l) => l.status === "done");
  const header = [`# ${d.idea.replace(/\s+/g, " ").trim().slice(0, 120)}`, ""];

  return (
    <div className="page">
      <div className="page-inner">
        <div className="topbar">
          <span className="kind-tag">{d.kind}</span>
          <h1 className="idea">{d.idea}</h1>
          <button className="link-danger" onClick={remove} type="button">Delete</button>
        </div>

        {d.mode === "demo" && (
          <div className="demo-banner">
            <b>Demo mode.</b> These are illustrative examples of what each lens looks at — not
            research into your idea. Add an <code>ANTHROPIC_API_KEY</code> for real findings.
          </div>
        )}

        {error && <div className="notice err inline">{error}</div>}

        {/* What we understood */}
        <div className="context-strip">
          {([["Industry", d.context.industry], ["Users", d.context.users], ["Problem", d.context.problem], ["Goal", d.context.goal]] as [string, string][])
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="ctx">
                <span className="ctx-k">{k}</span>
                <span className="ctx-v">{v}</span>
              </div>
            ))}
        </div>

        {/* The answer, up front */}
        {d.summary?.headline && (
          <section className="card summary">
            <h2>{d.summary.headline}</h2>
            <div className="sum-cols">
              {d.summary.learned.length > 0 && (
                <div className="sum-col">
                  <h3>What we learned</h3>
                  <ul>{d.summary.learned.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
              {d.summary.opportunities.length > 0 && (
                <div className="sum-col good">
                  <h3>Opportunities</h3>
                  <ul>{d.summary.opportunities.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
              {d.summary.risks.length > 0 && (
                <div className="sum-col warn">
                  <h3>Risks &amp; things to check</h3>
                  <ul>{d.summary.risks.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* What you can get out — the point of the page */}
        <section className="card docs-bar">
          <div className="docs-head">
            <h2>Turn this into a document</h2>
            <span className="muted">Written from the research above. Making one never re-runs the research.</span>
          </div>
          <div className="doc-buttons">
            {(meta?.documents ?? []).map((doc) => {
              const made = d.documents.some((x) => x.documentId === doc.id);
              return (
                <button
                  key={doc.id}
                  className={`doc-btn ${made ? "made" : ""}`}
                  onClick={() => makeDocument(doc.id)}
                  disabled={busy !== null}
                  type="button"
                >
                  <span className="db-ico">{doc.icon}</span>
                  <span className="db-name">{busy === doc.id ? "Writing…" : doc.name}</span>
                  <span className="db-blurb">{made ? "Made — click to rewrite" : doc.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* The research */}
        <section className="findings">
          <div className="findings-head">
            <h2>What the research found</h2>
            <button className="btn-quiet" onClick={rerun} disabled={busy !== null} type="button">
              {busy === "rerun" ? "Researching…" : "↻ Research again"}
            </button>
          </div>

          {done.map((l) => (
            <div key={l.lensId} className="card lens">
              <div className="lens-head">
                <span className="lens-ico">{lensMeta(l.lensId)?.icon ?? "✦"}</span>
                <h3>{lensMeta(l.lensId)?.name ?? l.lensId}</h3>
              </div>
              {l.summary && <p className="lens-sum">{l.summary}</p>}
              <div className="finds">
                {l.findings.map((f) => (
                  <div key={f.id} className="find">
                    <div className="find-title">
                      {f.title}
                      <span className={`conf ${f.confidence.toLowerCase()}`}>{f.confidence}</span>
                    </div>
                    <div className="find-detail">{f.detail}</div>
                    {f.basis && <div className="find-basis">Based on: {f.basis}</div>}
                  </div>
                ))}
              </div>
              {l.gaps.length > 0 && (
                <div className="gaps">
                  <span className="gaps-label">Still to check</span>
                  <ul>{l.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
              )}
              {l.sources.length > 0 && (
                <div className="sources">
                  <span className="gaps-label">Sources</span>
                  <ul>{l.sources.map((s, i) => <li key={i}><a href={s} target="_blank" rel="noreferrer noopener">{s}</a></li>)}</ul>
                </div>
              )}
            </div>
          ))}

          {d.lenses.filter((l) => l.status === "error").map((l) => (
            <div key={l.lensId} className="card lens err">
              <div className="lens-head">
                <span className="lens-ico">{lensMeta(l.lensId)?.icon ?? "✦"}</span>
                <h3>{lensMeta(l.lensId)?.name ?? l.lensId} couldn&apos;t run</h3>
              </div>
              <p className="lens-sum">
                This lens failed, so nothing from it is included below. The other lenses are
                unaffected — <b>Research again</b> re-runs them all.
              </p>
              <p className="lens-detail">{l.error}</p>
            </div>
          ))}
        </section>

        {/* Anything the PM knows that the research doesn't */}
        <section className="card add-note">
          <h2>Know something the research doesn&apos;t?</h2>
          <p className="muted">
            Add it here — real numbers, customer quotes, constraints. It feeds every document you
            make from now on. Use <b>Research again</b> to fold it into the findings too.
          </p>
          {d.notes.length > 0 && (
            <ul className="note-list">{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          )}
          <div className="note-row">
            <textarea
              className="note-input"
              placeholder="e.g. Support logged 1,200 calls about this last quarter."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); }}
              rows={2}
            />
            <button className="btn-go sm" onClick={addNote} disabled={busy !== null || !note.trim()} type="button">
              {busy === "note" ? "…" : "Add"}
            </button>
          </div>
        </section>

        {/* The documents */}
        {d.documents.map((doc) => (
          <section key={doc.id} id={`doc-${doc.documentId}`} className="card document">
            <Doc
              tag={d.kind}
              title={doc.title}
              sections={doc.sections}
              onDownload={() => downloadMarkdown(doc.title, [...header, `## ${doc.title}`, ""], doc.sections)}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
