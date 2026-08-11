"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "./components/shared";
import type { AnalyzeSession, CapabilityMeta, InputType } from "@/lib/capabilities/types";

interface CapResponse {
  capabilities: CapabilityMeta[];
  categoryOrder: CapabilityMeta["category"][];
  mode: "live" | "demo";
}

const INPUT_TYPES: { id: InputType; label: string }[] = [
  { id: "auto", label: "Auto-detect" },
  { id: "feature", label: "Feature idea" },
  { id: "requirement", label: "Requirement" },
  { id: "transcript", label: "Transcript" },
];

const EXAMPLE = `Members keep calling because they can't find their digital ID card in the app after enrolling. We want a "Where's my ID card?" experience that surfaces the card instantly on first login and lets them add it to their phone wallet.`;

export default function Composer() {
  const router = useRouter();
  const [meta, setMeta] = useState<CapResponse | null>(null);
  const [sessions, setSessions] = useState<AnalyzeSession[]>([]);
  const [text, setText] = useState("");
  const [inputType, setInputType] = useState<InputType>("auto");
  const [productContext, setProductContext] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(["prd"]));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then(setMeta).catch(() => {});
    fetch("/api/analyze").then((r) => r.json()).then((d) => setSessions(d.sessions ?? [])).catch(() => {});
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map<string, CapabilityMeta[]>();
    for (const c of meta?.capabilities ?? []) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [meta]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function run() {
    setError("");
    if (!text.trim()) {
      setError("Paste a feature idea, requirement, or transcript first.");
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one thing to generate.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          inputType,
          productContext,
          capabilityIds: [...selected],
        }),
      });
      const data = await res.json();
      if (data?.session?.id) router.push(`/session/${data.session.id}`);
      else setError(data?.error || "Something went wrong.");
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <TopBar mode={meta?.mode} />
      <main className="container">
        <section className="hero">
          <div className="eyebrow">✦ Product discovery copilot</div>
          <h1>Paste anything. Choose what you need. Get it in seconds.</h1>
          <p className="lede">
            Drop in a feature idea, a written requirement, or a raw meeting transcript — then pick the
            outputs you want: a PRD, detailed requirements, market and competitive research, process &amp;
            domain analysis, defect foresight, or a business-value case.
          </p>
        </section>

        {/* Composer */}
        <section className="section">
          <div className="card composer">
            <div className="composer-label">① Paste your input</div>
            <textarea
              className="textarea"
              placeholder="Paste a feature idea, a requirement, or a meeting transcript…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <div className="segmented">
                {INPUT_TYPES.map((t) => (
                  <button key={t.id} className={inputType === t.id ? "on" : ""} onClick={() => setInputType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                className="input"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="Optional product context, e.g. 'Medicare Advantage member app'"
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
              />
              <button className="btn ghost" onClick={() => { setText(EXAMPLE); setInputType("requirement"); }}>
                Try an example
              </button>
            </div>

            {/* Capability picker */}
            <div className="composer-label" style={{ marginTop: 22 }}>② Choose what to generate</div>
            {(meta?.categoryOrder ?? []).map((cat) => (
              <div key={cat} className="cap-cat">
                <div className="cap-cat-title">{cat}</div>
                <div className="cap-grid">
                  {(byCategory.get(cat) ?? []).map((c) => {
                    const on = selected.has(c.id);
                    return (
                      <button key={c.id} className={`cap ${on ? "on" : ""}`} onClick={() => toggle(c.id)}>
                        <div className="cap-top">
                          <span className="cap-icon">{c.icon}</span>
                          <span className="cap-name">{c.name}</span>
                          <span className="cap-check">{on ? "✓" : ""}</span>
                        </div>
                        <div className="cap-blurb">{c.blurb}</div>
                        {c.future && <div className="cap-future">→ {c.future}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="runbar">
              <button className="btn primary lg" onClick={run} disabled={running}>
                {running ? <span className="spinner" /> : "✦"} {running ? "Generating…" : "Generate"}
              </button>
              <span className="selcount">
                {selected.size} selected{selected.size ? ` · ${[...selected].length} output card${selected.size === 1 ? "" : "s"}` : ""}
              </span>
              {error && <span style={{ color: "var(--crit)", fontSize: 13 }}>{error}</span>}
            </div>
          </div>
        </section>

        {/* Recent */}
        <section className="section">
          <div className="section-head">
            <h2>Recent</h2>
            <span className="muted">{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="empty">Nothing yet — paste something above and generate your first outputs.</div>
          ) : (
            sessions.map((s) => (
              <Link key={s.id} href={`/session/${s.id}`}>
                <div className="sess-row">
                  <span className={`pill ${s.status}`}>{s.status}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {firstLine(s.input.text)}
                    </div>
                    <div className="rid">{s.capabilityIds.length} capabilities · {s.id}</div>
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>

        <footer className="footer">
          AI Discovery · {meta?.mode === "live" ? "Live outputs powered by Claude" : "Demo mode — illustrative outputs; add an API key for live analysis"}.
        </footer>
      </main>
    </>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Untitled";
  return l.length > 90 ? l.slice(0, 87) + "…" : l;
}
