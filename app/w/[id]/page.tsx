"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ------------------------------- types ---------------------------------- */
type Verdict = "correct" | "incorrect" | null;
interface IntakeField { id: string; question: string; value: string; captured: boolean; required: boolean }
interface Finding { id: string; title: string; detail: string; verdict: Verdict }
interface AgentState {
  agentId: string; selected: boolean; intake: IntakeField[];
  status: "pending" | "intake" | "running" | "complete" | "error";
  summary?: string; findings: Finding[]; userNotes?: string; error?: string;
}
interface OutputSection { heading: string; body?: string; bullets?: string[] }
interface GeneratedOutput { id: string; kind: "prd" | "backlog"; title: string; sections: OutputSection[]; createdAt: number }
interface Workflow {
  id: string; input: string; inputType: string; detectedType?: string;
  stage: "framing" | "intake" | "findings" | "generate";
  agents: AgentState[]; outputs: GeneratedOutput[]; mode: "live" | "demo";
  createdAt: number; updatedAt: number;
}

const META: Record<string, { name: string; icon: string }> = {
  user_research: { name: "User Research", icon: "🧑‍🔬" },
  process_mining: { name: "Process Mining", icon: "⚙️" },
  defect_detection: { name: "Defect Detection", icon: "🐞" },
  market: { name: "Market & Competitive", icon: "📈" },
  regulatory: { name: "Regulatory & Environment", icon: "⚖️" },
  business_priority: { name: "Business Priority", icon: "🎯" },
};
const nameOf = (id: string) => META[id]?.name ?? id;
const iconOf = (id: string) => META[id]?.icon ?? "✦";

const STEPS: { id: Workflow["stage"]; label: string }[] = [
  { id: "intake", label: "Intake" },
  { id: "findings", label: "Findings" },
  { id: "generate", label: "Generate" },
];

/* ================================ page ================================== */
export default function WorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState<"prd" | "backlog" | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/workflow/${id}`);
      if (!r.ok) throw new Error("Workflow not found.");
      const j = await r.json();
      setWf(j.workflow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => (wf ? wf.agents.filter((a) => a.selected) : []), [wf]);

  async function patch(body: unknown) {
    const r = await fetch(`/api/workflow/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (r.ok) setWf(j.workflow);
    return j.workflow as Workflow;
  }

  async function saveField(agentId: string, fieldId: string, value: string) {
    setWf((prev) => prev ? {
      ...prev,
      agents: prev.agents.map((a) => a.agentId !== agentId ? a : {
        ...a, intake: a.intake.map((f) => f.id === fieldId ? { ...f, value, captured: false } : f),
      }),
    } : prev);
  }
  async function commitField(agentId: string, fieldId: string, value: string) {
    await patch({ agentId, fields: [{ id: fieldId, value }] });
  }

  async function runAll() {
    setRunning(true);
    setError("");
    try {
      const r = await fetch(`/api/workflow/${id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Run failed.");
      setWf(j.workflow);
      setOpenAgent(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function setVerdict(agentId: string, findingId: string, verdict: Verdict) {
    setWf((prev) => prev ? {
      ...prev,
      agents: prev.agents.map((a) => a.agentId !== agentId ? a : {
        ...a, findings: a.findings.map((f) => f.id === findingId ? { ...f, verdict } : f),
      }),
    } : prev);
    await patch({ agentId, findingId, verdict });
  }

  async function generate(kind: "prd" | "backlog") {
    setGenBusy(kind);
    setError("");
    try {
      const r = await fetch(`/api/workflow/${id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Generate failed.");
      setWf(j.workflow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed.");
    } finally {
      setGenBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this discovery?")) return;
    await fetch(`/api/workflow/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <div className="wf-wrap"><div className="wf-loading">Loading discovery…</div></div>;
  if (error && !wf) return <div className="wf-wrap"><div className="wf-error">{error}</div></div>;
  if (!wf) return null;

  const hasFindings = selected.some((a) => a.findings.length > 0);
  const currentStep: Workflow["stage"] = wf.stage === "framing" ? "intake" : wf.stage;
  const openState = openAgent ? wf.agents.find((a) => a.agentId === openAgent) : null;

  return (
    <div className="wf-wrap">
      {/* Header: the original input */}
      <div className="wf-head">
        <div className="wf-head-main">
          <div className="wf-kicker">
            <span className={`type-tag ${wf.inputType}`}>{wf.inputType}</span>
            {wf.detectedType && wf.detectedType !== wf.inputType && (
              <span className="muted">· detected {wf.detectedType}</span>
            )}
          </div>
          <p className="wf-input">{wf.input}</p>
        </div>
        <button className="link-danger" onClick={remove} title="Delete discovery">Delete</button>
      </div>

      {/* Stepper */}
      <div className="stepper">
        {STEPS.map((s, i) => {
          const active = currentStep === s.id;
          const done = STEPS.findIndex((x) => x.id === currentStep) > i;
          return (
            <div key={s.id} className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}>
              <span className="step-dot">{done ? "✓" : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      {error && <div className="wf-error inline">{error}</div>}

      {/* ---------------------------- INTAKE ---------------------------- */}
      {currentStep === "intake" && (
        <section className="wf-stage">
          <div className="stage-lead">
            <h2>What each agent needs</h2>
            <p className="muted">
              We pre-filled what your input already answered. Open each agent to review captured
              details and fill what&apos;s still needed, then run the team.
            </p>
          </div>

          <div className="intake-list">
            {selected.map((a) => {
              const needed = a.intake.filter((f) => f.required && !f.value.trim());
              const captured = a.intake.filter((f) => f.value.trim());
              return (
                <button key={a.agentId} className="intake-row" onClick={() => setOpenAgent(a.agentId)} type="button">
                  <span className="ir-ico">{iconOf(a.agentId)}</span>
                  <span className="ir-main">
                    <span className="ir-name">{nameOf(a.agentId)}</span>
                    <span className="ir-stats">
                      <span className="pill captured">{captured.length} captured</span>
                      {needed.length > 0
                        ? <span className="pill needed">{needed.length} still needed</span>
                        : <span className="pill ok">ready</span>}
                    </span>
                  </span>
                  <span className="ir-go">Review →</span>
                </button>
              );
            })}
          </div>

          <div className="stage-actions">
            <button className="btn-go" onClick={runAll} disabled={running} type="button">
              {running ? "Running agents…" : `Run ${selected.length} agent${selected.length === 1 ? "" : "s"} →`}
            </button>
            <span className="muted small">
              You can run now and fill gaps later — findings improve as you add detail.
            </span>
          </div>
        </section>
      )}

      {/* --------------------------- FINDINGS --------------------------- */}
      {(currentStep === "findings" || currentStep === "generate") && (
        <section className="wf-stage">
          <div className="stage-lead">
            <h2>Findings</h2>
            <p className="muted">
              Mark each finding as right or off-base, and add anything the agents should also
              consider. Your validation shapes what gets generated.
            </p>
          </div>

          {selected.map((a) => (
            <div key={a.agentId} className={`finding-section ${a.status}`}>
              <div className="fs-head">
                <span className="fs-ico">{iconOf(a.agentId)}</span>
                <span className="fs-title">
                  <span className="fs-name">{nameOf(a.agentId)}</span>
                  {a.summary && <span className="fs-summary">{a.summary}</span>}
                </span>
                <button className="fs-reopen" onClick={() => setOpenAgent(a.agentId)} type="button" title="Review intake">
                  intake
                </button>
              </div>

              {a.status === "error" && <div className="fs-err">Agent error: {a.error}</div>}

              <div className="fs-findings">
                {a.findings.map((f) => (
                  <div key={f.id} className={`finding v-${f.verdict ?? "none"}`}>
                    <div className="finding-body">
                      <div className="finding-title">{f.title}</div>
                      <div className="finding-detail">{f.detail}</div>
                    </div>
                    <div className="verdicts">
                      <button
                        className={`v-btn yes ${f.verdict === "correct" ? "on" : ""}`}
                        onClick={() => setVerdict(a.agentId, f.id, f.verdict === "correct" ? null : "correct")}
                        type="button"
                      >✓ Right</button>
                      <button
                        className={`v-btn no ${f.verdict === "incorrect" ? "on" : ""}`}
                        onClick={() => setVerdict(a.agentId, f.id, f.verdict === "incorrect" ? null : "incorrect")}
                        type="button"
                      >✕ Off</button>
                    </div>
                  </div>
                ))}
                {a.findings.length === 0 && <div className="fs-empty">No findings yet.</div>}
              </div>

              <AugmentNote
                value={a.userNotes ?? ""}
                onSave={(v) => patch({ agentId: a.agentId, userNotes: v })}
              />
            </div>
          ))}

          {/* Generate bar */}
          {hasFindings && (
            <div className="generate-bar">
              <div className="gb-lead">
                <strong>Looks right?</strong> Turn the validated findings into a deliverable.
              </div>
              <div className="gb-actions">
                <button className="btn-gen" onClick={() => generate("prd")} disabled={genBusy !== null} type="button">
                  {genBusy === "prd" ? "Generating…" : "Generate PRD"}
                </button>
                <button className="btn-gen alt" onClick={() => generate("backlog")} disabled={genBusy !== null} type="button">
                  {genBusy === "backlog" ? "Generating…" : "Generate Backlog"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* --------------------------- OUTPUTS ---------------------------- */}
      {wf.outputs.length > 0 && (
        <section className="wf-stage outputs">
          <div className="stage-lead"><h2>Generated</h2></div>
          {wf.outputs.map((o) => (
            <article key={o.id} className="doc">
              <div className="doc-head">
                <span className={`doc-kind ${o.kind}`}>{o.kind === "prd" ? "PRD" : "Backlog"}</span>
                <h3 className="doc-title">{o.title}</h3>
              </div>
              {o.sections.map((s, i) => (
                <div key={i} className="doc-section">
                  <h4>{s.heading}</h4>
                  {s.body && <p>{s.body}</p>}
                  {s.bullets && s.bullets.length > 0 && (
                    <ul>{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                  )}
                </div>
              ))}
            </article>
          ))}
        </section>
      )}

      {/* --------------------- Intake drawer (side window) --------------- */}
      {openState && (
        <IntakeDrawer
          agent={openState}
          onClose={() => setOpenAgent(null)}
          onChange={saveField}
          onCommit={commitField}
        />
      )}
    </div>
  );
}

/* ---------------------------- augment note ------------------------------ */
function AugmentNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(Boolean(value));
  useEffect(() => { setV(value); }, [value]);
  if (!open) {
    return <button className="add-note" onClick={() => setOpen(true)} type="button">＋ Add things to consider</button>;
  }
  return (
    <div className="augment">
      <textarea
        className="augment-input"
        placeholder="Also consider… (context, constraints, corrections the agents missed)"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(v)}
        rows={2}
      />
    </div>
  );
}

/* --------------------------- intake drawer ------------------------------ */
function IntakeDrawer({
  agent, onClose, onChange, onCommit,
}: {
  agent: AgentState;
  onClose: () => void;
  onChange: (agentId: string, fieldId: string, value: string) => void;
  onCommit: (agentId: string, fieldId: string, value: string) => void;
}) {
  const captured = agent.intake.filter((f) => f.value.trim());
  const needed = agent.intake.filter((f) => !f.value.trim());
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <span className="dh-ico">{iconOf(agent.agentId)}</span>
          <span className="dh-title">{nameOf(agent.agentId)}</span>
          <button className="dh-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-group">
            <div className="dg-head captured">
              <span className="dot" /> Captured from your input
              <span className="dg-count">{captured.length}</span>
            </div>
            {captured.length === 0 && <p className="dg-empty">Nothing captured yet — fill the fields below.</p>}
            {captured.map((f) => (
              <Field key={f.id} agentId={agent.agentId} field={f} onChange={onChange} onCommit={onCommit} />
            ))}
          </div>

          <div className="drawer-group">
            <div className="dg-head needed">
              <span className="dot" /> Still needed
              <span className="dg-count">{needed.length}</span>
            </div>
            {needed.length === 0 && <p className="dg-empty">All set — nothing else needed.</p>}
            {needed.map((f) => (
              <Field key={f.id} agentId={agent.agentId} field={f} onChange={onChange} onCommit={onCommit} />
            ))}
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn-go sm" onClick={onClose} type="button">Done</button>
        </div>
      </aside>
    </>
  );
}

function Field({
  agentId, field, onChange, onCommit,
}: {
  agentId: string;
  field: IntakeField;
  onChange: (agentId: string, fieldId: string, value: string) => void;
  onCommit: (agentId: string, fieldId: string, value: string) => void;
}) {
  return (
    <label className={`ifield ${field.captured ? "was-captured" : ""}`}>
      <span className="ifield-q">
        {field.question}
        {field.required && <span className="req">*</span>}
      </span>
      <textarea
        className="ifield-input"
        value={field.value}
        placeholder="Type your answer…"
        onChange={(e) => onChange(agentId, field.id, e.target.value)}
        onBlur={(e) => onCommit(agentId, field.id, e.target.value)}
        rows={2}
      />
    </label>
  );
}
