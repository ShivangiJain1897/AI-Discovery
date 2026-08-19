"use client";

import { useEffect, useState } from "react";

interface PromptRow {
  capabilityId: string;
  name: string;
  icon: string;
  category: string;
  system: string;
  task: string;
  isModified: boolean;
  default: { system: string; task: string };
}

export default function Studio() {
  const [rows, setRows] = useState<PromptRow[]>([]);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [storage, setStorage] = useState<"postgres" | "file">("file");
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const d = await fetch("/api/prompts").then((r) => r.json());
    setRows(d.prompts ?? []);
    setMode(d.mode);
    setStorage(d.storage);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <main className="container">
        <section className="hero" style={{ paddingBottom: 8 }}>
          <div className="eyebrow">⚙ Agent studio</div>
          <h1 style={{ fontSize: 38 }}>See and shape how each agent thinks.</h1>
          <p className="lede">
            Every capability is an agent driven by a system prompt and a task prompt. View them, edit
            them, and they take effect immediately. Reset any prompt to its default at any time.
          </p>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="frompanel" style={{ marginBottom: 16 }}>
            <span>
              Prompt edits are saved to your <strong>{storage === "postgres" ? "database" : "local file store"}</strong>.
              {mode === "demo"
                ? " Note: in demo mode outputs use seed templates, so prompt edits show their effect once a Claude API key is set (live mode)."
                : " Live mode is on — edits change real output."}
            </span>
          </div>

          {rows.map((r) => (
            <PromptCard key={r.capabilityId} row={r} open={openId === r.capabilityId}
              onToggle={() => setOpenId(openId === r.capabilityId ? null : r.capabilityId)} onChanged={load} />
          ))}
        </section>
        <footer className="footer">
          Agent studio · {rows.length} capabilities · storage: {storage}.
        </footer>
      </main>
    </>
  );
}

function PromptCard({ row, open, onToggle, onChanged }: { row: PromptRow; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const [system, setSystem] = useState(row.system);
  const [task, setTask] = useState(row.task);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    setSystem(row.system);
    setTask(row.task);
  }, [row.system, row.task]);

  const dirty = system !== row.system || task !== row.task;

  async function save() {
    setSaving(true);
    setSaved("");
    try {
      await fetch(`/api/prompts/${row.capabilityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, task }),
      });
      setSaved("Saved");
      onChanged();
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(""), 2000);
    }
  }
  async function reset() {
    if (!confirm("Reset this prompt to its default?")) return;
    await fetch(`/api/prompts/${row.capabilityId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="card" style={{ marginBottom: 14, padding: 0, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
          background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 22 }}>{row.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: "var(--ink)" }}>{row.name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{row.category} · agent id: {row.capabilityId}</div>
        </div>
        <span className="spacer" />
        {row.isModified && <span className="otag" style={{ color: "var(--brand)", borderColor: "var(--brand)" }}>customized</span>}
        <span style={{ color: "var(--ink-faint)", fontSize: 18 }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 20px 18px" }}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>System prompt <span className="hint">who the agent is</span></label>
            <textarea className="textarea" style={{ minHeight: 90 }} value={system} onChange={(e) => setSystem(e.target.value)} />
          </div>
          <div className="field">
            <label>Task prompt <span className="hint">what it should produce (sections, tables)</span></label>
            <textarea className="textarea" style={{ minHeight: 120 }} value={task} onChange={(e) => setTask(e.target.value)} />
          </div>
          <div className="runbar" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={save} disabled={!dirty || saving}>
              {saving ? <span className="spinner" /> : "Save prompt"}
            </button>
            <button className="btn ghost" onClick={reset} disabled={!row.isModified}>Reset to default</button>
            {saved && <span style={{ color: "var(--good)", fontSize: 13 }}>✓ {saved}</span>}
            {dirty && !saved && <span style={{ color: "var(--ink-faint)", fontSize: 13 }}>unsaved changes</span>}
          </div>
        </div>
      )}
    </div>
  );
}
