"use client";

import { useState } from "react";
import type { IdeaRecord, RiceFactor, UseCase } from "@/lib/intake/types";

const DECISIONS = [
  "Approve POC",
  "Recommend full solution",
  "Defer",
  "Merge",
  "Redirect",
  "Stop",
  "Continue in discovery",
];

const RICE_LABELS: { key: keyof IdeaRecord["riceA"]; label: string; hint: string }[] = [
  { key: "reach", label: "Reach", hint: "people/teams" },
  { key: "impact", label: "Impact", hint: "0.25–3" },
  { key: "confidence", label: "Confidence", hint: "0–1" },
  { key: "effort", label: "Effort", hint: "person-months" },
  { key: "aiComplexity", label: "AI Complexity", hint: "1–5" },
];

export default function AnalysisPanel({ uc, name, onChanged }: { uc: UseCase; name: string; onChanged: () => void }) {
  const [running, setRunning] = useState(false);
  const a = uc.analysis;

  async function run() {
    setRunning(true);
    try {
      await fetch(`/api/intake/${uc.id}/analyze`, { method: "POST" });
      onChanged();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card analysis">
      <div className="analysis-head">
        <div>
          <h3>
            ◷ AI Intake Analysis
            <span className="provisional">provisional</span>
          </h3>
          <div className="guardrail">The AI recommends and explains — you decide. Nothing is auto-approved.</div>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={run} disabled={running}>
          {running ? <span className="spinner" /> : a ? "↻ Refresh" : "▶ Run analysis"}
        </button>
      </div>

      {!a ? (
        <div className="empty" style={{ marginTop: 14 }}>
          Run the analyst to get a triage summary, RICE-A score, risk overlay, and missing-info questions.
        </div>
      ) : (
        <div className="analysis-body">
          {/* Score header */}
          <div className="score-header">
            <div className="score-big">
              <div className="score-num">{uc.humanScore ? uc.humanScore.score : a.riceA.score}</div>
              <div className="score-cap">
                RICE-A{uc.humanScore ? " (human)" : ""} · {a.riceA.overallConfidence} confidence
              </div>
            </div>
            <div className="score-formula">
              (Reach × Impact × Confidence) ÷ (Effort × AI-Complexity/2)
              {uc.humanScore && (
                <div style={{ marginTop: 6, color: "var(--ink-faint)" }}>
                  AI score was {a.riceA.score}; overridden by {uc.humanScore.by} — “{uc.humanScore.rationale}”
                </div>
              )}
            </div>
          </div>

          <Field label="Executive summary" text={a.executiveSummary} />

          <div className="two">
            <Field label="Value stream" text={`${a.valueStream.primary}${a.valueStream.secondary ? ` · ${a.valueStream.secondary}` : ""}`} />
            <Field label="AI-fit pattern" text={`${a.aiFit.pattern} — ${a.aiFit.rationale}`} />
          </div>
          <div className="two">
            <Field label="Problem statement" text={a.problemStatement} />
            <Field label="Desired outcome" text={a.desiredOutcome} />
          </div>

          {/* RICE-A table */}
          <div className="asec-label">RICE-A factors <span className="hint">every number carries its evidence, assumption, confidence, and the question that would improve it</span></div>
          <div className="otable-wrap">
            <table className="otable rice">
              <thead>
                <tr>
                  <th>Factor</th><th>Score</th><th>Evidence</th><th>Assumption</th><th>Conf.</th><th>Question to improve it</th>
                </tr>
              </thead>
              <tbody>
                {RICE_LABELS.map(({ key, label, hint }) => {
                  const f = a.riceA[key] as RiceFactor;
                  return (
                    <tr key={key}>
                      <td><strong>{label}</strong><div className="hint">{hint}</div></td>
                      <td><strong>{f.score}</strong></td>
                      <td>{f.evidence}</td>
                      <td>{f.assumption}</td>
                      <td><span className={`conf ${f.confidence}`}>{f.confidence}</span></td>
                      <td>{f.question}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Risk overlay */}
          <div className="two">
            <div>
              <div className="asec-label">Risk overlay</div>
              <span className={`risk ${a.risk.level}`}>{a.risk.level} risk</span>
              <ul className="mini">{a.risk.requiredReviews.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div>
              <div className="asec-label">Missing information</div>
              <ul className="mini">{a.missingInfo.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          </div>

          <div className="two">
            <div>
              <div className="asec-label">Assumptions</div>
              <ul className="mini">
                {a.assumptions.stated.map((x, i) => <li key={"s" + i}>{x} <span className="tagi">stated</span></li>)}
                {a.assumptions.unstated.map((x, i) => <li key={"u" + i}>{x} <span className="tagi warn">unstated</span></li>)}
              </ul>
            </div>
            <div>
              <div className="asec-label">Related work</div>
              {a.related.length ? <ul className="mini">{a.related.map((x, i) => <li key={i}>{x}</li>)}</ul>
                : <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>None detected.</div>}
            </div>
          </div>

          {/* Human guardrails */}
          <HumanControls uc={uc} name={name} onChanged={onChanged} />

          {/* Score history */}
          {uc.scoreHistory && uc.scoreHistory.length > 0 && (
            <div>
              <div className="asec-label">Score history</div>
              {[...uc.scoreHistory].reverse().map((h, i) => (
                <div key={i} className="hist">
                  <span className={`histsrc ${h.source}`}>{h.source}</span>
                  <strong>{h.score}</strong>
                  <span style={{ color: "var(--ink-faint)" }}>{h.stage} · {h.by} · {new Date(h.at).toLocaleString()}</span>
                  {h.note && <span style={{ color: "var(--ink-soft)" }}>— {h.note}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}>
            Generated {new Date(a.generatedAt).toLocaleString()} · {a.mode === "live" ? "Claude" : "demo generator"} · provisional
          </div>
        </div>
      )}
    </div>
  );
}

function HumanControls({ uc, name, onChanged }: { uc: UseCase; name: string; onChanged: () => void }) {
  const [score, setScore] = useState("");
  const [scoreWhy, setScoreWhy] = useState("");
  const [decision, setDecision] = useState(DECISIONS[0]);
  const [decWhy, setDecWhy] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/intake/${uc.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="human-controls">
      <div className="asec-label" style={{ color: "var(--brand)" }}>Human decision (you own this)</div>
      <div className="two">
        <div className="hc-box">
          <label className="composer-label" style={{ marginBottom: 6 }}>Override score</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" style={{ width: 90 }} type="number" step="0.01" placeholder="score" value={score} onChange={(e) => setScore(e.target.value)} />
            <input className="input" placeholder="why (recorded)" value={scoreWhy} onChange={(e) => setScoreWhy(e.target.value)} />
          </div>
          <button className="btn" style={{ marginTop: 8 }} disabled={busy || !score}
            onClick={() => patch({ humanScore: { score: Number(score), by: name || "Anonymous", rationale: scoreWhy } })}>
            Save override
          </button>
        </div>
        <div className="hc-box">
          <label className="composer-label" style={{ marginBottom: 6 }}>Triage / solution decision</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="select" value={decision} onChange={(e) => setDecision(e.target.value)}>
              {DECISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <input className="input" placeholder="rationale (recorded)" value={decWhy} onChange={(e) => setDecWhy(e.target.value)} />
          </div>
          <button className="btn primary" style={{ marginTop: 8 }} disabled={busy}
            onClick={() => patch({ decision: { decision, by: name || "Anonymous", rationale: decWhy } })}>
            Record decision
          </button>
        </div>
      </div>
      {uc.decision && (
        <div className="decision-badge">
          ✔ Decision: <strong>{uc.decision.decision}</strong> — {uc.decision.by}
          {uc.decision.rationale ? ` · “${uc.decision.rationale}”` : ""} · {new Date(uc.decision.at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function Field({ label, text }: { label: string; text: string }) {
  return (
    <div className="afield">
      <div className="asec-label">{label}</div>
      <div className="atext">{text || "—"}</div>
    </div>
  );
}
