"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusPill, TopBar, useCurrentUser } from "../../components/shared";
import type { SimilarMatch, UseCase } from "@/lib/intake/types";
import { INTAKE_STATUSES } from "@/lib/intake/types";

export default function UseCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [uc, setUc] = useState<UseCase | null>(null);
  const [similar, setSimilar] = useState<SimilarMatch[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<UseCase>>({});
  const [note, setNote] = useState("");
  const [name] = useCurrentUser();

  async function load() {
    const res = await fetch(`/api/intake/${id}`);
    if (res.status === 404) return setNotFound(true);
    const data = await res.json();
    setUc(data.item);
    setDraft(data.item);
    // fetch similar (exclude self)
    fetch("/api/intake/similar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.item.title, problem: data.item.problem, area: data.item.area, tags: data.item.tags, excludeId: id }),
    })
      .then((r) => r.json())
      .then((d) => setSimilar(d.similar ?? []))
      .catch(() => {});
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/intake/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.item) {
      setUc(data.item);
      setDraft(data.item);
    }
  }

  async function saveEdits() {
    await patch({
      title: draft.title,
      problem: draft.problem,
      area: draft.area,
      businessStakeholder: draft.businessStakeholder,
      techStakeholder: draft.techStakeholder,
      dataStakeholder: draft.dataStakeholder,
      dataSources: draft.dataSources,
      platform: draft.platform,
      tbd: draft.tbd,
      tags: draft.tags,
    });
    setEditing(false);
    load();
  }

  async function addNote() {
    if (!note.trim()) return;
    await patch({ addContribution: { author: name || "Anonymous", note } });
    setNote("");
  }

  if (notFound) {
    return (
      <>
        <TopBar />
        <main className="container">
          <div className="empty" style={{ marginTop: 40 }}>
            Use case not found. <Link href="/intake" style={{ color: "var(--brand)" }}>Back to tracker</Link>
          </div>
        </main>
      </>
    );
  }
  if (!uc) {
    return (
      <>
        <TopBar />
        <main className="container"><div style={{ padding: 40 }}><span className="spinner" /></div></main>
      </>
    );
  }

  const setD = (k: keyof UseCase) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <TopBar />
      <main className="container">
        <div style={{ paddingTop: 24 }}>
          <div className="crumb"><Link href="/intake">Intake</Link> / {uc.id}</div>
          <div className="section-head" style={{ alignItems: "center", marginBottom: 8 }}>
            {editing ? (
              <input className="input" style={{ fontSize: 20, fontWeight: 700, maxWidth: 560 }} value={draft.title ?? ""} onChange={setD("title")} />
            ) : (
              <h2 style={{ fontSize: 26 }}>{uc.title}</h2>
            )}
            <StatusPill status={uc.status} />
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <label className="identity" style={{ gap: 6 }}>
              Status:
              <select className="select" value={uc.status} onChange={(e) => patch({ status: e.target.value })}>
                {INTAKE_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            {uc.linkedSessionId && (
              <Link className="btn ghost" href={`/session/${uc.linkedSessionId}`}>↗ View discovery</Link>
            )}
            <span className="spacer" />
            {editing ? (
              <>
                <button className="btn primary" onClick={saveEdits}>Save</button>
                <button className="btn ghost" onClick={() => { setEditing(false); setDraft(uc); }}>Cancel</button>
              </>
            ) : (
              <button className="btn" onClick={() => setEditing(true)}>✎ Edit details</button>
            )}
          </div>
        </div>

        <div className="grid cols-2" style={{ marginTop: 20, alignItems: "start" }}>
          {/* Left: details */}
          <div className="card">
            <div className="composer-label" style={{ marginBottom: 10 }}>Problem statement</div>
            {editing ? (
              <textarea className="textarea" value={draft.problem ?? ""} onChange={setD("problem")} />
            ) : (
              <p style={{ color: "var(--ink-soft)", fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {uc.problem || "—"}
              </p>
            )}

            <div className="meta-grid" style={{ marginTop: 16 }}>
              <Meta label="Area" editing={editing} value={draft.area} onChange={setD("area")} display={uc.area} />
              <Meta label="Platform" editing={editing} value={draft.platform} onChange={setD("platform")} display={uc.platform} />
              <Meta label="Business stakeholder" editing={editing} value={draft.businessStakeholder} onChange={setD("businessStakeholder")} display={uc.businessStakeholder} />
              <Meta label="Technology stakeholder" editing={editing} value={draft.techStakeholder} onChange={setD("techStakeholder")} display={uc.techStakeholder} />
              <Meta label="Data stakeholder" editing={editing} value={draft.dataStakeholder} onChange={setD("dataStakeholder")} display={uc.dataStakeholder} />
              <Meta label="Data" editing={editing} value={draft.dataSources} onChange={setD("dataSources")} display={uc.dataSources} />
            </div>

            <div className="meta-item" style={{ borderBottom: "none" }}>
              <div className="mk">To be determined</div>
              {editing ? (
                <textarea className="textarea" style={{ minHeight: 60 }} value={draft.tbd ?? ""} onChange={setD("tbd")} />
              ) : (
                <div className="mv" style={{ whiteSpace: "pre-wrap" }}>{uc.tbd || "—"}</div>
              )}
            </div>

            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
              Submitted by {uc.submittedBy} · {new Date(uc.createdAt).toLocaleString()}
            </div>
          </div>

          {/* Right: collaboration + similar */}
          <div>
            {similar.length > 0 && (
              <div className="similar-panel" style={{ marginTop: 0, marginBottom: 16 }}>
                <h4>🔎 Related use cases</h4>
                {similar.map((m) => (
                  <div key={m.id} className="similar-item">
                    <span className="match">{Math.round(m.score * 100)}%</span>
                    <Link href={`/intake/${m.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{m.title}</Link>
                    <span className="spacer" />
                    <StatusPill status={m.status} />
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <div className="composer-label" style={{ marginBottom: 10 }}>
                Team activity · {uc.contributions.length} update{uc.contributions.length === 1 ? "" : "s"}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input className="input" placeholder={`Add an update as ${name || "Anonymous"}…`} value={note}
                  onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
                <button className="btn primary" onClick={addNote}>Post</button>
              </div>
              {uc.contributions.length === 0 ? (
                <div style={{ color: "var(--ink-faint)", fontSize: 13 }}>No updates yet.</div>
              ) : (
                [...uc.contributions].reverse().map((c, i) => (
                  <div key={i} className="contrib">
                    <div className="avatar">{(c.author[0] || "?").toUpperCase()}</div>
                    <div>
                      <div className="cmeta">{c.author} · {new Date(c.at).toLocaleString()}</div>
                      <div className="cnote">{c.note}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <footer className="footer">
          <Link href="/intake" style={{ color: "var(--brand)" }}>← Back to tracker</Link>
        </footer>
      </main>
    </>
  );
}

function Meta({
  label,
  display,
  editing,
  value,
  onChange,
}: {
  label: string;
  display?: string;
  editing: boolean;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="meta-item">
      <div className="mk">{label}</div>
      {editing ? (
        <input className="input" value={value ?? ""} onChange={onChange} />
      ) : (
        <div className="mv">{display || "—"}</div>
      )}
    </div>
  );
}
