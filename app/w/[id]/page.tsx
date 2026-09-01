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
interface GeneratedOutput { id: string; kind: "prd" | "backlog"; variant?: "feature" | "product"; title: string; sections: OutputSection[]; createdAt: number }
interface Workflow {
  id: string; input: string; inputType: string; detectedType?: string;
  context: IntakeField[];
  stage: "framing" | "intake" | "findings" | "generate";
  agents: AgentState[]; outputs: GeneratedOutput[]; mode: "live" | "demo";
  createdAt: number; updatedAt: number;
}

const CONTEXT_KEY = "__context__";

const META: Record<string, { name: string; icon: string; why: string }> = {
  user_research: { name: "User Research", icon: "🧑‍🔬", why: "To ground findings in who the users really are and what they're trying to do." },
  process_mining: { name: "Process Mining", icon: "⚙️", why: "To map the real end-to-end process and find where it breaks." },
  defect_detection: { name: "Defect Detection", icon: "🐞", why: "To anticipate the defects and failure states that hurt the experience." },
  market: { name: "Market & Competitive", icon: "📈", why: "To frame the market, competitors, and shifting expectations." },
  regulatory: { name: "Regulatory & Environment", icon: "⚖️", why: "To surface the regulations, PHI/PII, and compliance constraints that apply." },
  business_priority: { name: "Business Priority", icon: "🎯", why: "To connect the work to business goals, value, and effort." },
};
const nameOf = (id: string) => (id === CONTEXT_KEY ? "Business Context" : META[id]?.name ?? id);
const iconOf = (id: string) => (id === CONTEXT_KEY ? "🧭" : META[id]?.icon ?? "✦");
const whyOf = (id: string) =>
  id === CONTEXT_KEY
    ? "Every discovery starts here — the industry, business process, and objective behind the request. It grounds every agent and heads the PRD."
    : META[id]?.why ?? "";

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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState<string | null>(null);

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

  // Optimistic local edits; commit on blur.
  function editContext(fieldId: string, value: string) {
    setWf((prev) => prev ? { ...prev, context: prev.context.map((f) => f.id === fieldId ? { ...f, value, captured: false } : f) } : prev);
  }
  function editAgentField(agentId: string, fieldId: string, value: string) {
    setWf((prev) => prev ? {
      ...prev,
      agents: prev.agents.map((a) => a.agentId !== agentId ? a : {
        ...a, intake: a.intake.map((f) => f.id === fieldId ? { ...f, value, captured: false } : f),
      }),
    } : prev);
  }
  function commit(key: string, fieldId: string, value: string) {
    if (key === CONTEXT_KEY) return patch({ context: [{ id: fieldId, value }] });
    return patch({ agentId: key, fields: [{ id: fieldId, value }] });
  }

  async function runAll() {
    setRunning(true); setError("");
    try {
      const r = await fetch(`/api/workflow/${id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Run failed.");
      setWf(j.workflow); setOpenKey(null);
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

  async function generate(kind: "prd" | "backlog", variant?: "feature" | "product") {
    const key = kind === "prd" ? `prd-${variant}` : "backlog";
    setGenBusy(key); setError("");
    try {
      const r = await fetch(`/api/workflow/${id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, variant }),
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

  const ctx = wf.context ?? [];
  const hasFindings = selected.some((a) => a.findings.length > 0);
  const currentStep: Workflow["stage"] = wf.stage === "framing" ? "intake" : wf.stage;
  const openFields: IntakeField[] =
    openKey === CONTEXT_KEY ? ctx : (wf.agents.find((a) => a.agentId === openKey)?.intake ?? []);

  return (
    <div className="wf-wrap">
      {/* Header */}
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
          {/* Foundation: business context, always first */}
          <div className="foundation">
            <div className="foundation-head">
              <span className="fnd-eyebrow">Start here · Foundation</span>
              <h2>Business context</h2>
              <p className="muted">
                Before the users and the agents: the industry, the business process, and the
                objective behind this. It grounds every agent and heads your PRD.
              </p>
            </div>
            <IntakeRow
              itemKey={CONTEXT_KEY}
              fields={ctx}
              onOpen={() => setOpenKey(CONTEXT_KEY)}
              foundation
            />
          </div>

          <div className="stage-lead mt">
            <h2>What each agent needs</h2>
            <p className="muted">
              Each agent works like a mini-form. We pre-filled what your input already answered —
              open one to review the captured details and complete what&apos;s still needed.
            </p>
          </div>

          <div className="intake-list">
            {selected.map((a) => (
              <IntakeRow key={a.agentId} itemKey={a.agentId} fields={a.intake} onOpen={() => setOpenKey(a.agentId)} />
            ))}
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
          {/* Context recap */}
          {ctx.some((f) => f.value.trim()) && (
            <div className="ctx-recap">
              <div className="ctx-recap-head">
                <span>🧭 Business context</span>
                <button className="fs-reopen" onClick={() => setOpenKey(CONTEXT_KEY)} type="button">edit</button>
              </div>
              <div className="ctx-chips">
                {ctx.filter((f) => f.value.trim()).map((f) => (
                  <span key={f.id} className="ctx-chip"><b>{shortLabel(f.question)}</b> {f.value}</span>
                ))}
              </div>
            </div>
          )}

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
                <button className="fs-reopen" onClick={() => setOpenKey(a.agentId)} type="button" title="Review intake">intake</button>
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
                      <button className={`v-btn yes ${f.verdict === "correct" ? "on" : ""}`}
                        onClick={() => setVerdict(a.agentId, f.id, f.verdict === "correct" ? null : "correct")} type="button">✓ Right</button>
                      <button className={`v-btn no ${f.verdict === "incorrect" ? "on" : ""}`}
                        onClick={() => setVerdict(a.agentId, f.id, f.verdict === "incorrect" ? null : "incorrect")} type="button">✕ Off</button>
                    </div>
                  </div>
                ))}
                {a.findings.length === 0 && <div className="fs-empty">No findings yet.</div>}
              </div>

              <AugmentNote value={a.userNotes ?? ""} onSave={(v) => patch({ agentId: a.agentId, userNotes: v })} />
            </div>
          ))}

          {hasFindings && (
            <div className="generate-bar">
              <div className="gb-lead">
                <strong>Looks right?</strong> Turn the validated findings into a deliverable.
                <span className="muted small block">A Feature PRD is focused; a Product PRD is the fuller document.</span>
              </div>
              <div className="gb-actions">
                <button className="btn-gen" onClick={() => generate("prd", "feature")} disabled={genBusy !== null} type="button">
                  {genBusy === "prd-feature" ? "Generating…" : "Feature PRD"}
                </button>
                <button className="btn-gen" onClick={() => generate("prd", "product")} disabled={genBusy !== null} type="button">
                  {genBusy === "prd-product" ? "Generating…" : "Product PRD"}
                </button>
                <button className="btn-gen alt" onClick={() => generate("backlog")} disabled={genBusy !== null} type="button">
                  {genBusy === "backlog" ? "Generating…" : "Backlog"}
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
                <span className={`doc-kind ${o.kind}`}>{docTag(o)}</span>
                <h3 className="doc-title">{o.title}</h3>
                <button className="doc-dl" onClick={() => downloadDoc(o, wf)} type="button" title="Download as Markdown">↓ Download</button>
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
              <div className="doc-foot muted small">
                Download opens the Markdown so you can add detail in your editor of choice.
              </div>
            </article>
          ))}
        </section>
      )}

      {/* --------------------- Intake drawer (side window) --------------- */}
      {openKey && (
        <IntakeDrawer
          itemKey={openKey}
          fields={openFields}
          onClose={() => setOpenKey(null)}
          onChange={openKey === CONTEXT_KEY
            ? (fid, v) => editContext(fid, v)
            : (fid, v) => editAgentField(openKey, fid, v)}
          onCommit={(fid, v) => commit(openKey, fid, v)}
        />
      )}
    </div>
  );
}

/* ------------------------------ intake row ------------------------------ */
function IntakeRow({
  itemKey, fields, onOpen, foundation,
}: { itemKey: string; fields: IntakeField[]; onOpen: () => void; foundation?: boolean }) {
  const needed = fields.filter((f) => f.required && !f.value.trim());
  const captured = fields.filter((f) => f.value.trim());
  return (
    <button className={`intake-row ${foundation ? "is-foundation" : ""}`} onClick={onOpen} type="button">
      <span className="ir-ico">{iconOf(itemKey)}</span>
      <span className="ir-main">
        <span className="ir-name">{nameOf(itemKey)}</span>
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
      <textarea className="augment-input"
        placeholder="Also consider… (context, constraints, corrections the agents missed)"
        value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} rows={2} />
    </div>
  );
}

/* --------------------------- intake drawer ------------------------------ */
function IntakeDrawer({
  itemKey, fields, onClose, onChange, onCommit,
}: {
  itemKey: string;
  fields: IntakeField[];
  onClose: () => void;
  onChange: (fieldId: string, value: string) => void;
  onCommit: (fieldId: string, value: string) => void;
}) {
  const captured = fields.filter((f) => f.value.trim());
  const needed = fields.filter((f) => !f.value.trim());
  const requiredTotal = fields.filter((f) => f.required).length;
  const requiredDone = fields.filter((f) => f.required && f.value.trim()).length;
  const pct = requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 100;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={nameOf(itemKey)}>
        <div className="drawer-head">
          <span className="dh-ico">{iconOf(itemKey)}</span>
          <span className="dh-titlewrap">
            <span className="dh-title">{nameOf(itemKey)}</span>
            <span className="dh-sub">Intake</span>
          </span>
          <button className="dh-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Explainer + progress */}
        <div className="drawer-intro">
          <p className="di-why">{whyOf(itemKey)}</p>
          <div className="di-progress">
            <div className="di-bar"><span style={{ width: `${pct}%` }} /></div>
            <span className="di-count">{requiredDone}/{requiredTotal} required answered</span>
          </div>
          <p className="di-legend">
            <span className="lg captured">Captured</span> was auto-filled from your input — edit if it&apos;s off.
            <span className="lg needed">Needed</span> is what to add. Changes save automatically.
          </p>
        </div>

        <div className="drawer-body">
          <div className="drawer-group">
            <div className="dg-head captured">
              <span className="dot" /> Captured from your input
              <span className="dg-count">{captured.length}</span>
            </div>
            {captured.length === 0 && <p className="dg-empty">Nothing captured yet — fill the fields below.</p>}
            {captured.map((f) => <Field key={f.id} field={f} onChange={onChange} onCommit={onCommit} />)}
          </div>

          <div className="drawer-group">
            <div className="dg-head needed">
              <span className="dot" /> Still needed
              <span className="dg-count">{needed.length}</span>
            </div>
            {needed.length === 0 && <p className="dg-empty">All set — nothing else needed.</p>}
            {needed.map((f) => <Field key={f.id} field={f} onChange={onChange} onCommit={onCommit} />)}
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
  field, onChange, onCommit,
}: {
  field: IntakeField;
  onChange: (fieldId: string, value: string) => void;
  onCommit: (fieldId: string, value: string) => void;
}) {
  return (
    <label className={`ifield ${field.captured ? "was-captured" : ""}`}>
      <span className="ifield-q">
        {field.question}
        {field.required && <span className="req">*</span>}
        {field.captured && <span className="auto-tag">auto</span>}
      </span>
      <textarea className="ifield-input" value={field.value} placeholder="Type your answer…"
        onChange={(e) => onChange(field.id, e.target.value)}
        onBlur={(e) => onCommit(field.id, e.target.value)} rows={2} />
    </label>
  );
}

/* ------------------------------- helpers -------------------------------- */
function shortLabel(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("industry")) return "Industry";
  if (q.includes("process")) return "Process";
  if (q.includes("objective")) return "Objective";
  if (q.includes("coming from")) return "Source";
  if (q.includes("stakeholder")) return "Stakeholders";
  return question.replace(/\?.*$/, "").slice(0, 18);
}

function docTag(o: GeneratedOutput): string {
  if (o.kind === "backlog") return "Backlog";
  return o.variant === "product" ? "Product PRD" : "Feature PRD";
}

function downloadDoc(o: GeneratedOutput, w: Workflow) {
  const lines: string[] = [`# ${o.title}`, ""];
  lines.push(`> Source ${w.inputType}: ${w.input.replace(/\s+/g, " ").trim()}`, "");
  for (const s of o.sections) {
    lines.push(`## ${s.heading}`, "");
    if (s.body) lines.push(s.body, "");
    if (s.bullets) { for (const b of s.bullets) lines.push(`- ${b}`); lines.push(""); }
  }
  lines.push("", "---", "_Generated with Discovery Studio — edit and expand as needed._");
  const md = lines.join("\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${o.title.replace(/\s+/g, "-").toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
