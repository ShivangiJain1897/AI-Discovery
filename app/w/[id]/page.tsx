"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
interface GeneratedOutput { id: string; kind: "analysis" | "prd" | "backlog"; variant?: "feature" | "product"; title: string; sections: OutputSection[]; createdAt: number }
interface Workflow {
  id: string; input: string; inputType: string; detectedType?: string;
  context: IntakeField[]; notes?: string[];
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
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

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
  const hasRun = selected.some((a) => a.status === "complete" || a.findings.length > 0);

  function scrollDown() {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  }

  async function patch(body: unknown) {
    const r = await fetch(`/api/workflow/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (r.ok) setWf(j.workflow);
    return j.workflow as Workflow;
  }

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
      setWf(j.workflow); setOpenKey(null); scrollDown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  async function generate(kind: "analysis" | "prd" | "backlog", variant?: "feature" | "product") {
    const key = kind === "prd" ? `prd-${variant}` : kind;
    setGenBusy(key); setError("");
    try {
      const r = await fetch(`/api/workflow/${id}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, variant }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Generate failed.");
      setWf(j.workflow); scrollDown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed.");
    } finally {
      setGenBusy(null);
    }
  }

  async function sendNote() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await patch({ note: text });
      setDraft(""); scrollDown();
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this discovery?")) return;
    await fetch(`/api/workflow/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <div className="thread-wrap"><div className="wf-loading">Loading discovery…</div></div>;
  if (error && !wf) return <div className="thread-wrap"><div className="wf-error">{error}</div></div>;
  if (!wf) return null;

  const ctx = wf.context ?? [];
  const notes = wf.notes ?? [];
  const openFields: IntakeField[] =
    openKey === CONTEXT_KEY ? ctx : (wf.agents.find((a) => a.agentId === openKey)?.intake ?? []);
  const industry = ctx.find((f) => f.id === "industry")?.value;

  return (
    <div className="thread-wrap">
      <div className="thread">
        {/* Title row */}
        <div className="thread-top">
          <div className="tt-main">
            <span className="tt-label">Discovery</span>
            {industry && <span className="tt-industry">· {industry}</span>}
          </div>
          <button className="link-danger" onClick={remove} title="Delete discovery">Delete</button>
        </div>

        {error && <div className="wf-error inline">{error}</div>}

        {/* 1 — the user's input */}
        <Msg role="user">
          <span className={`type-tag ${wf.inputType}`}>{wf.inputType}</span>
          <p className="msg-input">{wf.input}</p>
        </Msg>

        {/* 2 — business context */}
        <Msg role="agent" icon="🧭" who="Orchestrator">
          <p className="msg-lead">
            I read this as a <b>{wf.inputType}</b>{industry ? <> in <b>{industry}</b></> : null}. Let&apos;s start
            with the business context — the foundation every agent builds on. Open it to review what I
            captured and fill any gaps.
          </p>
          <IntakeRow itemKey={CONTEXT_KEY} fields={ctx} onOpen={() => setOpenKey(CONTEXT_KEY)} foundation />
        </Msg>

        {/* 3 — the agent team + intake (before/until run) */}
        <Msg role="agent" icon="🤝" who="Orchestrator">
          <p className="msg-lead">
            I&apos;ve brought in {selected.length} agent{selected.length === 1 ? "" : "s"}. Each works like a
            quick form — I pre-filled what your input answered. Review any and {hasRun ? "re-run" : "run"} when ready.
          </p>
          <div className="intake-list">
            {selected.map((a) => (
              <IntakeRow key={a.agentId} itemKey={a.agentId} fields={a.intake} onOpen={() => setOpenKey(a.agentId)} />
            ))}
          </div>
          {!hasRun && (
            <button className="btn-go mt10" onClick={runAll} disabled={running} type="button">
              {running ? "Running agents…" : `Run ${selected.length} agent${selected.length === 1 ? "" : "s"} →`}
            </button>
          )}
        </Msg>

        {/* 4 — findings, one message per agent */}
        {hasRun && selected.map((a) => (
          <Msg key={a.agentId} role="agent" icon={iconOf(a.agentId)} who={nameOf(a.agentId)}>
            {a.summary && <p className="msg-lead">{a.summary}</p>}
            {a.status === "error" && <div className="fs-err">Agent error: {a.error}</div>}
            <div className="fs-findings">
              {a.findings.map((f) => (
                <div key={f.id} className="finding">
                  <div className="finding-body">
                    <div className="finding-title">{f.title}</div>
                    <div className="finding-detail">{f.detail}</div>
                  </div>
                </div>
              ))}
              {a.findings.length === 0 && <div className="fs-empty">No findings yet.</div>}
            </div>
            <div className="msg-tools">
              <button className="fs-reopen" onClick={() => setOpenKey(a.agentId)} type="button">edit intake</button>
            </div>
            <AugmentNote value={a.userNotes ?? ""} onSave={(v) => patch({ agentId: a.agentId, userNotes: v })} />
          </Msg>
        ))}

        {/* interleave: notes and outputs in creation order isn't tracked separately,
            so show notes, then outputs (newest last for a chat feel). */}
        {notes.map((n, i) => (
          <Msg key={`note-${i}`} role="user"><p className="msg-input">{n}</p></Msg>
        ))}

        {[...wf.outputs].reverse().map((o) => (
          <Msg key={o.id} role="agent" icon={kindIcon(o.kind)} who="Generated">
            <article className="doc">
              <div className="doc-head">
                <span className={`doc-kind ${o.kind}`}>{docTag(o)}</span>
                <h3 className="doc-title">{o.title}</h3>
                <button className="doc-dl" onClick={() => downloadDoc(o, wf)} type="button" title="Download as Markdown">↓ Download</button>
              </div>
              {o.sections.map((s, i) => (
                <div key={i} className="doc-section">
                  <h4>{s.heading}</h4>
                  {s.body && <p>{s.body}</p>}
                  {s.bullets && s.bullets.length > 0 && <ul>{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
                </div>
              ))}
            </article>
          </Msg>
        ))}

        <div ref={endRef} />
      </div>

      {/* --------------------------- Composer dock --------------------------- */}
      <div className="dock">
        <div className="dock-inner">
          {hasRun ? (
            <div className="dock-actions">
              <span className="dock-label">Generate:</span>
              <button className="chip-gen analysis" onClick={() => generate("analysis")} disabled={genBusy !== null} type="button">
                {genBusy === "analysis" ? "…" : "Analysis"}
              </button>
              <button className="chip-gen" onClick={() => generate("prd", "feature")} disabled={genBusy !== null} type="button">
                {genBusy === "prd-feature" ? "…" : "Feature PRD"}
              </button>
              <button className="chip-gen" onClick={() => generate("prd", "product")} disabled={genBusy !== null} type="button">
                {genBusy === "prd-product" ? "…" : "Product PRD"}
              </button>
              <button className="chip-gen" onClick={() => generate("backlog")} disabled={genBusy !== null} type="button">
                {genBusy === "backlog" ? "…" : "Backlog"}
              </button>
              <button className="chip-gen ghost" onClick={runAll} disabled={running} type="button" title="Re-run agents with updated intake">
                {running ? "…" : "↻ Re-run"}
              </button>
            </div>
          ) : (
            <div className="dock-actions">
              <span className="dock-label">Fill intake above, then</span>
              <button className="chip-gen analysis" onClick={runAll} disabled={running} type="button">
                {running ? "Running…" : `Run ${selected.length} agents →`}
              </button>
            </div>
          )}
          <div className="dock-input">
            <textarea
              className="dock-textarea"
              placeholder={hasRun ? "Add context or a correction, then generate again…" : "Add anything the agents should know…"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendNote(); }}
              rows={1}
            />
            <button className="dock-send" onClick={sendNote} disabled={sending || !draft.trim()} type="button" title="Add to the discovery">
              {sending ? "…" : "Add"}
            </button>
          </div>
          <p className="dock-hint">
            Added context feeds the next thing you generate. Generate as many deliverables as you like — they stack above.
          </p>
        </div>
      </div>

      {/* --------------------- Intake drawer (side window) --------------- */}
      {openKey && (
        <IntakeDrawer
          itemKey={openKey}
          fields={openFields}
          onClose={() => setOpenKey(null)}
          onChange={openKey === CONTEXT_KEY ? (fid, v) => editContext(fid, v) : (fid, v) => editAgentField(openKey, fid, v)}
          onCommit={(fid, v) => commit(openKey, fid, v)}
        />
      )}
    </div>
  );
}

/* ------------------------------ message ------------------------------- */
function Msg({ role, icon, who, children }: { role: "user" | "agent"; icon?: string; who?: string; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="msg user">
        <div className="msg-bubble user">{children}</div>
      </div>
    );
  }
  return (
    <div className="msg agent">
      <div className="msg-avatar">{icon ?? "✦"}</div>
      <div className="msg-bubble agent">
        {who && <div className="msg-who">{who}</div>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ intake row ------------------------------ */
function IntakeRow({ itemKey, fields, onOpen, foundation }: { itemKey: string; fields: IntakeField[]; onOpen: () => void; foundation?: boolean }) {
  const needed = fields.filter((f) => f.required && !f.value.trim());
  const captured = fields.filter((f) => f.value.trim());
  return (
    <button className={`intake-row ${foundation ? "is-foundation" : ""}`} onClick={onOpen} type="button">
      <span className="ir-ico">{iconOf(itemKey)}</span>
      <span className="ir-main">
        <span className="ir-name">{nameOf(itemKey)}</span>
        <span className="ir-stats">
          <span className="pill captured">{captured.length} captured</span>
          {needed.length > 0 ? <span className="pill needed">{needed.length} still needed</span> : <span className="pill ok">ready</span>}
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
  if (!open) return <button className="add-note" onClick={() => setOpen(true)} type="button">＋ Add things to consider</button>;
  return (
    <div className="augment">
      <textarea className="augment-input" placeholder="Also consider… (context, constraints, corrections the agent missed)"
        value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} rows={2} />
    </div>
  );
}

/* --------------------------- intake drawer ------------------------------ */
function IntakeDrawer({
  itemKey, fields, onClose, onChange, onCommit,
}: {
  itemKey: string; fields: IntakeField[]; onClose: () => void;
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
            <div className="dg-head captured"><span className="dot" /> Captured from your input<span className="dg-count">{captured.length}</span></div>
            {captured.length === 0 && <p className="dg-empty">Nothing captured yet — fill the fields below.</p>}
            {captured.map((f) => <Field key={f.id} field={f} onChange={onChange} onCommit={onCommit} />)}
          </div>
          <div className="drawer-group">
            <div className="dg-head needed"><span className="dot" /> Still needed<span className="dg-count">{needed.length}</span></div>
            {needed.length === 0 && <p className="dg-empty">All set — nothing else needed.</p>}
            {needed.map((f) => <Field key={f.id} field={f} onChange={onChange} onCommit={onCommit} />)}
          </div>
        </div>
        <div className="drawer-foot"><button className="btn-go sm" onClick={onClose} type="button">Done</button></div>
      </aside>
    </>
  );
}

function Field({ field, onChange, onCommit }: {
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
        onChange={(e) => onChange(field.id, e.target.value)} onBlur={(e) => onCommit(field.id, e.target.value)} rows={2} />
    </label>
  );
}

/* ------------------------------- helpers -------------------------------- */
function kindIcon(kind: string): string {
  return kind === "analysis" ? "🔎" : kind === "backlog" ? "🗂️" : "📄";
}
function docTag(o: GeneratedOutput): string {
  if (o.kind === "analysis") return "Analysis";
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
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${o.title.replace(/\s+/g, "-").toLowerCase()}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
