"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The front door. One box.
 *
 * The PM should not have to know that eleven research capabilities, ninety
 * analysis methods and sixty output types exist, let alone orchestrate them.
 * They describe the product question; the orchestrator works out the package
 * and shows it back for approval on the next screen.
 */

const TYPES = [
  { id: "auto", label: "Auto-detect" },
  { id: "problem", label: "Problem" },
  { id: "question", label: "Question" },
  { id: "idea", label: "Idea" },
  { id: "solution", label: "Solution" },
  { id: "decision", label: "Decision" },
  { id: "requirement", label: "Requirement" },
  { id: "transcript", label: "Transcript" },
  { id: "data", label: "Data" },
];

const EXAMPLES = [
  "Understand why onboarding conversion is dropping.",
  "Should we build an AI concierge in the member app, or fix the cost-estimate flow first?",
  "Members can't tell what a visit will cost before they go, so they call support or skip care.",
  "Leadership wants a business case for opening the platform to third-party integrations.",
];

const LAYERS = [
  { n: "1", name: "Research", text: "Eleven lenses — users, behaviour, defects, market, competitors, buyers, regulation, feasibility, operations, ecosystem, trends. Run in parallel." },
  { n: "2", name: "Analysis", text: "The right method for the evidence you actually have — root cause, JTBD, funnel, five forces, RICE only when reach data exists." },
  { n: "3", name: "Decision", text: "Evidence → insight → options → trade-offs → recommendation, with an honest confidence and the gaps named." },
  { n: "4", name: "Generation", text: "PRD, backlog, roadmap, business case, exec summary — any number of artifacts from one body of evidence." },
];

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState("auto");
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setMode(d.mode || "demo"))
      .catch(() => {});
  }, []);

  async function start() {
    const text = input.trim();
    if (!text) {
      setError("Describe the product question first.");
      taRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, inputType }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not start.");
      router.push(`/s/${j.session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="entry">
      <div className="entry-inner">
        <div className="entry-hero">
          <div className="eyebrow">
            <span className="logo-mark">◈</span> Product Intelligence Orchestrator
          </div>
          <h1 className="entry-title">
            Ask a product question.<br />Get an evidence-based decision.
          </h1>
          <p className="entry-sub">
            Not a research assistant and not a document generator. Describe the problem, question or
            decision in front of you — the orchestrator works out what research is needed, what
            analysis to apply, what the evidence actually supports, and which artifact moves things
            forward.
          </p>
        </div>

        <div className="composer-card">
          <textarea
            ref={taRef}
            className="composer-input"
            placeholder="e.g. Understand why onboarding conversion is dropping…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") start();
            }}
            rows={5}
          />

          <div className="type-row">
            <span className="type-label">This is a</span>
            {TYPES.map((t) => (
              <button
                key={t.id}
                className={`type-chip ${inputType === t.id ? "on" : ""}`}
                onClick={() => setInputType(t.id)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <div className="composer-error">{error}</div>}

          <div className="composer-actions">
            <span className="mode-note">
              <span className={`badge ${mode}`}>
                <span className="dot" />
                {mode === "live" ? "Live · Claude" : "Demo mode"}
              </span>
              <span className="muted">
                {mode === "live"
                  ? "Research runs live, with web search on the outward-facing lenses."
                  : "No API key — the orchestrator will show its plan and report evidence gaps rather than invent findings."}
              </span>
            </span>
            <button className="btn-go" onClick={start} disabled={busy} type="button">
              {busy ? "Reading the question…" : "Start →"}
            </button>
          </div>
        </div>

        <div className="entry-examples">
          <span className="ex-label">Try</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="ex-chip" onClick={() => setInput(ex)} type="button">
              {ex.length > 62 ? ex.slice(0, 59) + "…" : ex}
            </button>
          ))}
        </div>

        <div className="layer-strip">
          {LAYERS.map((l) => (
            <div key={l.n} className="layer-card">
              <span className="layer-n">{l.n}</span>
              <span className="layer-name">{l.name}</span>
              <span className="layer-text">{l.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
