"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { BacklogBucket, BacklogItem, BacklogStatus } from "@/lib/product/types";
import { PRODUCT_AGENTS } from "@/lib/product/catalog";

const BUCKETS: { key: BacklogBucket; label: string; hint: string }[] = [
  { key: "now", label: "Now", hint: "highest priority" },
  { key: "next", label: "Next", hint: "soon" },
  { key: "later", label: "Later", hint: "someday" },
  { key: "icebox", label: "Icebox", hint: "parked" },
];
const STATUSES: BacklogStatus[] = ["proposed", "accepted", "in_progress", "done", "dismissed"];
const AGENT_ICON = new Map(PRODUCT_AGENTS.map((a) => [a.id, a.icon]));

export default function Backlog() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const d = await fetch(`/api/products/${id}/backlog`).then((r) => r.json());
    setItems(Array.isArray(d.items) ? d.items : []); setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function generate() {
    setBusy(true);
    try { const d = await fetch(`/api/products/${id}/backlog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }) }).then((r) => r.json()); setItems(d.items ?? []); }
    finally { setBusy(false); }
  }
  async function addItem() {
    if (!newTitle.trim()) return;
    const d = await fetch(`/api/products/${id}/backlog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", title: newTitle }) }).then((r) => r.json());
    setItems(d.items ?? []); setNewTitle("");
  }
  async function patch(itemId: string, body: Record<string, unknown>) {
    await fetch(`/api/backlog/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function del(itemId: string) {
    await fetch(`/api/backlog/${itemId}`, { method: "DELETE" }); load();
  }

  const byBucket = (b: BacklogBucket) => items.filter((i) => i.bucket === b && i.status !== "dismissed");
  const dismissed = items.filter((i) => i.status === "dismissed");

  return (
    <main className="container">
      <div style={{ paddingTop: 24 }}>
        <div className="crumb"><Link href="/">Products</Link> / <Link href={`/product/${id}`}>Product</Link> / Backlog</div>
        <div className="section-head" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 24 }}>Backlog</h2>
          <span className="muted">AI-prioritized · you curate & own it</span>
          <span className="spacer" />
          <button className="btn primary" onClick={generate} disabled={busy}>{busy ? <span className="spinner" /> : "✦"} Generate from signals</button>
        </div>
        <div className="composer-hint" style={{ marginBottom: 8 }}>Priority = (Impact × Confidence) ÷ Effort. Change Impact/Effort or move an item — your edits stick and won&apos;t be overwritten by re-generation.</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input className="input" placeholder="Add a backlog item…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <button className="btn" onClick={addItem}>＋ Add</button>
        </div>
      </div>

      {!loaded ? <div style={{ padding: 40 }}><span className="spinner" /></div> :
        items.length === 0 ? (
          <div className="empty">No backlog yet. Run agents on this product, then <button className="linklike" onClick={generate}>generate from signals</button>.</div>
        ) : (
          <div className="board">
            {BUCKETS.map((b) => (
              <div key={b.key} className="board-col">
                <div className="board-head"><span className={`bucket ${b.key}`}>{b.label}</span><span className="board-count">{byBucket(b.key).length}</span></div>
                {byBucket(b.key).map((i) => (
                  <BacklogCard key={i.id} item={i} onPatch={patch} onDelete={del} />
                ))}
                {byBucket(b.key).length === 0 && <div className="board-empty">—</div>}
              </div>
            ))}
          </div>
        )}

      {dismissed.length > 0 && (
        <section className="section">
          <div className="section-head"><h2 style={{ fontSize: 16 }}>Dismissed</h2><span className="muted">{dismissed.length}</span></div>
          {dismissed.map((i) => (
            <div key={i.id} className="run-status" style={{ opacity: 0.7 }}>
              <span className="st-dot" /><span style={{ fontSize: 13.5 }}>{i.title}</span><span className="spacer" />
              <button className="btn ghost" onClick={() => patch(i.id, { status: "proposed" })}>Restore</button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function BacklogCard({ item, onPatch, onDelete }: { item: BacklogItem; onPatch: (id: string, body: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  return (
    <div className="bcard">
      <div className="bcard-top">
        <span className="prio" title="Priority score">{item.priorityScore}</span>
        <div className="bcard-title">{item.title}</div>
      </div>
      {item.description && <div className="bcard-desc">{item.description}</div>}
      <div className="bcard-meta">
        {item.agentId && <span className="src">{AGENT_ICON.get(item.agentId) ?? "•"} {item.agentId}</span>}
        {item.source === "manual" && <span className="src">✎ manual</span>}
        <Stepper label="I" value={item.impact} onChange={(v) => onPatch(item.id, { impact: v })} />
        <Stepper label="E" value={item.effort} onChange={(v) => onPatch(item.id, { effort: v })} />
      </div>
      <div className="bcard-controls">
        <select className="mini-select" value={item.bucket} onChange={(e) => onPatch(item.id, { bucket: e.target.value })}>
          {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        <select className="mini-select" value={item.status} onChange={(e) => onPatch(item.id, { status: e.target.value })}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <button className="mini-btn" onClick={() => onDelete(item.id)} title="Delete">🗑</button>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <span className="stepper" title={label === "I" ? "Impact" : "Effort"}>
      <button onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <span>{label}{value}</span>
      <button onClick={() => onChange(Math.min(5, value + 1))}>+</button>
    </span>
  );
}
