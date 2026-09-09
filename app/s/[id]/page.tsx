"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Doc, Table, downloadMarkdown } from "@/app/components/Doc";
import { PlanCard } from "./PlanCard";
import type { Catalog, DocSection, ResearchStream, Session } from "./types";

/**
 * The orchestration thread.
 *
 * One continuous conversation: the question, the plan, the parallel evidence
 * streams, the cross-stream synthesis, the applied analyses, the decision, and
 * every artifact generated from that one body of evidence.
 */
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<Session | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [genOutput, setGenOutput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/session/${id}`);
      if (!r.ok) throw new Error("Session not found.");
      const j = await r.json();
      setS(j.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/catalog").then((r) => r.json()).then(setCatalog).catch(() => {});
  }, [load]);

  const scrollDown = () => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 80);

  const post = useCallback(
    async (path: string, body: unknown, label: string) => {
      setBusy(label);
      setError("");
      try {
        const r = await fetch(`/api/session/${id}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Request failed.");
        setS(j.session);
        scrollDown();
        return j;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [id]
  );

  /* ------------------------------ plan edits ----------------------------- */

  const savePlan = useCallback(
    (patch: Record<string, unknown>) => post("/plan", patch, "plan"),
    [post]
  );

  function toggle(layer: "research" | "analysis" | "outputs", itemId: string) {
    if (!s) return;
    const items = s.plan[layer];
    const next = items.some((i) => i.id === itemId && i.selected)
      ? items.filter((i) => i.selected && i.id !== itemId).map((i) => i.id)
      : [...items.filter((i) => i.selected).map((i) => i.id), itemId];
    // Optimistic so the picker feels instant; the response is authoritative.
    setS({
      ...s,
      plan: {
        ...s.plan,
        [layer]: items.some((i) => i.id === itemId)
          ? items.map((i) => (i.id === itemId ? { ...i, selected: !i.selected } : i))
          : [...items, { id: itemId, required: false, why: "Added by you.", selected: true }],
      },
    });
    savePlan({ [layer]: next });
  }

  function answer(qid: string, value: string) {
    if (!s) return;
    setS({
      ...s,
      plan: {
        ...s.plan,
        clarifications: s.plan.clarifications.map((c) => (c.id === qid ? { ...c, answer: value } : c)),
      },
    });
  }

  function commitAnswers(replan: boolean) {
    if (!s) return Promise.resolve(null);
    return savePlan({
      answers: s.plan.clarifications.map((c) => ({ id: c.id, answer: c.answer })),
      replan,
    });
  }

  /** Persist any typed answers BEFORE running, so the streams get them. */
  async function runResearch() {
    await commitAnswers(false);
    await post("/research", {}, "research");
  }

  /* ------------------------------- derived ------------------------------- */

  const selectedStreams = useMemo(() => (s ? s.streams.filter((x) => x.selected) : []), [s]);
  const doneStreams = useMemo(() => selectedStreams.filter((x) => x.status === "complete"), [selectedStreams]);
  const hasResearch = doneStreams.length > 0;
  const capMeta = useCallback(
    (cid: string) => catalog?.research.find((c) => c.id === cid),
    [catalog]
  );

  if (loading) return <div className="thread-wrap"><div className="wf-loading">Loading session…</div></div>;
  if (error && !s) return <div className="thread-wrap"><div className="wf-error">{error}</div></div>;
  if (!s) return null;

  const plan = s.plan;
  const chosenOutputs = plan.outputs.filter((o) => o.selected);

  async function remove() {
    if (!confirm("Delete this session?")) return;
    await fetch(`/api/session/${id}`, { method: "DELETE" });
    router.push("/");
  }

  async function addNote() {
    const text = draft.trim();
    if (!text || !s) return;
    setBusy("note");
    try {
      const r = await fetch(`/api/session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: text }),
      });
      const j = await r.json();
      if (r.ok) setS(j.session);
      setDraft("");
      scrollDown();
    } finally {
      setBusy(null);
    }
  }

  const docHeader = (title: string) => [
    `# ${title}`,
    "",
    `> Objective: ${plan.objective}`,
    `> Decision: ${plan.decision}`,
    `> Source ${s.inputType}: ${s.input.replace(/\s+/g, " ").trim().slice(0, 400)}`,
  ];

  return (
    <div className="thread-wrap">
      <div className="thread">
        <div className="thread-top">
          <div className="tt-main">
            <span className="tt-label">Session</span>
            <span className={`type-tag ${s.inputType}`}>{s.inputType}</span>
            <span className="tt-stage">{stageLabel(s.stage)}</span>
          </div>
          <button className="link-danger" onClick={remove} type="button">Delete</button>
        </div>

        {error && <div className="wf-error inline">{error}</div>}

        {/* the question */}
        <Msg role="user">
          <p className="msg-input">{s.input}</p>
        </Msg>

        {/* Layer 0 — the plan */}
        <Msg role="agent" icon="◈" who="Orchestrator">
          <PlanCard
            plan={plan}
            catalog={catalog}
            busy={busy === "plan" || busy === "research"}
            hasRun={hasResearch}
            onToggle={toggle}
            onSetDepth={(d) => { setS({ ...s, plan: { ...plan, depth: d } }); savePlan({ depth: d }); }}
            onSetAudience={(a) => { setS({ ...s, plan: { ...plan, audience: a } }); savePlan({ audience: a }); }}
            onAnswer={answer}
            onReplan={() => commitAnswers(true)}
            onRun={runResearch}
          />
        </Msg>

        {/* Layer 1 — evidence streams */}
        {selectedStreams
          .filter((x) => x.status === "complete" || x.status === "error")
          .map((stream) => (
            <Msg
              key={stream.capabilityId}
              role="agent"
              icon={capMeta(stream.capabilityId)?.icon ?? "✦"}
              who={capMeta(stream.capabilityId)?.name ?? stream.capabilityId}
            >
              <StreamView stream={stream} />
            </Msg>
          ))}

        {/* Steps 5–6 — cross-stream synthesis */}
        {s.synthesis && (
          <Msg role="agent" icon="🧠" who="Synthesis — across the streams">
            <SynthesisView syn={s.synthesis} nameOf={(cid) => capMeta(cid)?.name ?? cid} />
          </Msg>
        )}

        {/* Layer 2 — applied analyses */}
        {s.analyses.map((a) => (
          <Msg key={a.id} role="agent" icon="📐" who={`Analysis — ${a.family}`}>
            <Doc
              tag={a.method}
              title={a.name}
              sections={a.sections}
              onDownload={() => downloadMarkdown(a.name, docHeader(a.name), a.sections as DocSection[])}
            />
          </Msg>
        ))}

        {/* Layer 3 — the decision */}
        {s.decision && (
          <Msg role="agent" icon="⚖️" who="Decision">
            <DecisionView d={s.decision} onDownload={() => downloadMarkdown("decision-brief", docHeader("Decision brief"), decisionSections(s.decision!))} />
          </Msg>
        )}

        {/* PM context added along the way */}
        {s.notes.map((n, i) => (
          <Msg key={`note-${i}`} role="user"><p className="msg-input">{n}</p></Msg>
        ))}

        {/* Layer 4 — artifacts */}
        {s.artifacts.map((art) => (
          <Msg key={art.id} role="agent" icon="📄" who={`Artifact — ${art.family}`}>
            <Doc
              tag={art.family}
              title={art.title}
              subtitle={`${depthName(catalog, art.depth)} · for ${audienceName(catalog, art.audience)}`}
              sections={art.sections}
              onDownload={() => downloadMarkdown(art.title, docHeader(art.title), art.sections as DocSection[])}
            />
          </Msg>
        ))}

        <div ref={endRef} />
      </div>

      {/* ------------------------------ the dock ---------------------------- */}
      <div className="dock">
        <div className="dock-inner">
          <div className="stages">
            <Stage
              n="1"
              name="Research"
              hint={hasResearch ? `${doneStreams.length} stream${doneStreams.length === 1 ? "" : "s"} complete` : `${selectedStreams.length} selected`}
              done={hasResearch}
            >
              <button className="chip-gen" onClick={runResearch} disabled={busy !== null} type="button">
                {busy === "research" ? "Running…" : hasResearch ? "↻ Re-run streams" : "Run streams"}
              </button>
              <button
                className="chip-gen primary"
                onClick={() => post("/synthesis", {}, "synthesis")}
                disabled={busy !== null || !hasResearch}
                type="button"
                title="Find what is only visible across the streams"
              >
                {busy === "synthesis" ? "Synthesizing…" : s.synthesis ? "↻ Re-synthesize" : "Synthesize across streams"}
              </button>
            </Stage>

            <Stage n="2" name="Analysis" hint={`${plan.analysis.filter((m) => m.selected).length} method(s) selected`} done={s.analyses.length > 0}>
              <button
                className="chip-gen primary"
                onClick={() => post("/analysis", {}, "analysis")}
                disabled={busy !== null || !hasResearch || plan.analysis.filter((m) => m.selected).length === 0}
                type="button"
              >
                {busy === "analysis" ? "Analyzing…" : "Apply selected methods"}
              </button>
              <span className="stage-note">Change the methods in the plan above.</span>
            </Stage>

            <Stage n="3" name="Decision" hint={s.decision ? `Confidence: ${s.decision.confidence}` : "not yet made"} done={Boolean(s.decision)}>
              <button
                className="chip-gen primary"
                onClick={() => post("/decision", {}, "decision")}
                disabled={busy !== null || !hasResearch}
                type="button"
              >
                {busy === "decision" ? "Deciding…" : s.decision ? "↻ Re-run decision" : "Options → recommendation"}
              </button>
            </Stage>

            <Stage n="4" name="Generate" hint={`${s.artifacts.length} artifact(s)`} done={s.artifacts.length > 0}>
              <div className="gen-row">
                <select
                  className="gen-select"
                  value={genOutput || chosenOutputs[0]?.id || ""}
                  onChange={(e) => setGenOutput(e.target.value)}
                >
                  {chosenOutputs.length > 0 && (
                    <optgroup label="Recommended for this question">
                      {chosenOutputs.map((o) => (
                        <option key={o.id} value={o.id}>{catalog?.outputs.find((x) => x.id === o.id)?.name ?? o.id}</option>
                      ))}
                    </optgroup>
                  )}
                  {(catalog?.outputFamilies ?? []).map((f) => (
                    <optgroup key={f.id} label={f.name}>
                      {(catalog?.outputs ?? []).filter((o) => o.familyId === f.id).map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  className="chip-gen primary"
                  onClick={() => post("/generate", { outputId: genOutput || chosenOutputs[0]?.id }, "generate")}
                  disabled={busy !== null || (!genOutput && chosenOutputs.length === 0)}
                  type="button"
                >
                  {busy === "generate" ? "Writing…" : "Generate"}
                </button>
              </div>
              <span className="stage-note">Generate as many as you like — none of them re-runs research.</span>
            </Stage>
          </div>

          <div className="dock-input">
            <textarea
              className="dock-textarea"
              placeholder="Add evidence, a correction, or context the orchestrator should carry forward…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addNote(); }}
              rows={1}
            />
            <button className="dock-send" onClick={addNote} disabled={busy !== null || !draft.trim()} type="button">
              {busy === "note" ? "…" : "Add"}
            </button>
          </div>
          <p className="dock-hint">
            Anything you add here feeds every stream, analysis and artifact produced afterwards.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- pieces --------------------------------- */

function Msg({ role, icon, who, children }: { role: "user" | "agent"; icon?: string; who?: string; children: React.ReactNode }) {
  if (role === "user") {
    return <div className="msg user"><div className="msg-bubble user">{children}</div></div>;
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

function Stage({ n, name, hint, done, children }: { n: string; name: string; hint: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`stage-block ${done ? "done" : ""}`}>
      <div className="stage-title">
        <span className="stage-num">{n}</span> {name}
        <span className="stage-hint">{hint}</span>
      </div>
      <div className="stage-body">{children}</div>
    </div>
  );
}

function StreamView({ stream }: { stream: ResearchStream }) {
  if (stream.status === "error") {
    return <div className="fs-err">This stream failed: {stream.error}</div>;
  }
  const lists: [string, string[]][] = [
    ["Patterns", stream.patterns],
    ["Contradictions", stream.contradictions],
    ["Evidence gaps", stream.gaps],
    ["Implications", stream.implications],
  ];
  return (
    <>
      {stream.summary && <p className="msg-lead">{stream.summary}</p>}

      {stream.findings.length > 0 && (
        <div className="fs-findings">
          {stream.findings.map((f) => (
            <div key={f.id} className="finding">
              <div className="finding-title">
                {f.title}
                <span className={`ev-badge ${f.strength.toLowerCase()}`}>{f.strength}</span>
              </div>
              <div className="finding-detail">{f.detail}</div>
            </div>
          ))}
        </div>
      )}

      {stream.evidence.length > 0 && (
        <details className="ev-details">
          <summary>Evidence ({stream.evidence.length}) — typed and graded</summary>
          <Table
            table={{
              headers: ["Statement", "Type", "Strength", "Source"],
              rows: stream.evidence.map((e) => [e.statement, e.type, e.strength, e.source ?? "—"]),
            }}
          />
        </details>
      )}

      {lists.filter(([, v]) => v.length > 0).map(([label, values]) => (
        <div key={label} className={`stream-list ${label.toLowerCase().replace(/\s/g, "-")}`}>
          <span className="sl-label">{label}</span>
          <ul>{values.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </div>
      ))}

      {stream.sources.length > 0 && (
        <div className="stream-sources">
          <span className="sl-label">Sources</span>
          <ul>
            {stream.sources.map((u, i) => (
              <li key={i}><a href={u} target="_blank" rel="noreferrer noopener">{u}</a></li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function SynthesisView({ syn, nameOf }: { syn: NonNullable<Session["synthesis"]>; nameOf: (id: string) => string }) {
  return (
    <>
      <p className="msg-lead headline">{syn.headline}</p>

      {syn.themes.length > 0 && (
        <div className="syn-themes">
          {syn.themes.map((t, i) => (
            <div key={i} className="syn-theme">
              <div className="finding-title">
                {t.title}
                <span className={`ev-badge ${t.strength.toLowerCase()}`}>{t.strength}</span>
              </div>
              <div className="finding-detail">{t.body}</div>
              {t.supportedBy.length > 0 && (
                <div className="syn-from">across {t.supportedBy.map(nameOf).join(" · ")}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {syn.triangulation.length > 0 && (
        <section className="syn-block">
          <h4>Triangulation <span className="method-tag">cross-source</span></h4>
          <Table
            table={{
              headers: ["Claim", "Streams that bear on it", "Agreement", "Strength"],
              rows: syn.triangulation.map((t) => [t.insight, t.sources.map(nameOf).join(", "), t.agreement, t.strength]),
            }}
          />
        </section>
      )}

      {syn.insights.length > 0 && (
        <section className="syn-block">
          <h4>Insights and their so-what <span className="method-tag">evidence → implication</span></h4>
          <Table
            table={{
              headers: ["What we learned", "So what", "Implication", "Confidence"],
              rows: syn.insights.map((i) => [i.insight, i.soWhat, i.implication, i.confidence]),
            }}
          />
        </section>
      )}

      {syn.opportunities.length > 0 && (
        <section className="syn-block">
          <h4>Opportunities <span className="method-tag">How-Might-We</span></h4>
          <Table
            table={{
              headers: ["Opportunity", "How might we…", "User value", "Business value", "Evidence"],
              rows: syn.opportunities.map((o) => [o.title, o.hmw, o.userValue, o.businessValue, o.evidence]),
            }}
          />
        </section>
      )}

      {syn.contradictions.length > 0 && (
        <div className="stream-list contradictions">
          <span className="sl-label">Contradictions in the evidence</span>
          <ul>{syn.contradictions.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {syn.gaps.length > 0 && (
        <div className="stream-list evidence-gaps">
          <span className="sl-label">What we still do not know</span>
          <ul>{syn.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}
    </>
  );
}

function DecisionView({ d, onDownload }: { d: NonNullable<Session["decision"]>; onDownload: () => void }) {
  return (
    <article className="doc decision">
      <div className="doc-head">
        <span className="doc-kind">Decision</span>
        <h3 className="doc-title">Recommendation</h3>
        <span className={`conf-badge ${d.confidence.toLowerCase()}`}>Confidence: {d.confidence}</span>
        <button className="doc-dl" onClick={onDownload} type="button">↓ Markdown</button>
      </div>

      <div className="doc-section">
        <h4>Recommendation</h4>
        <p className="rec-text">{d.recommendation}</p>
        {d.rationale && <p>{d.rationale}</p>}
      </div>

      {d.evidence.length > 0 && (
        <div className="doc-section">
          <h4>What we know</h4>
          <ul>{d.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {d.insight && (
        <div className="doc-section">
          <h4>What it means</h4>
          <p>{d.insight}</p>
        </div>
      )}
      {d.options.length > 0 && (
        <div className="doc-section">
          <h4>Options and trade-offs <span className="method-tag">decision matrix</span></h4>
          <Table
            table={{
              headers: ["Option", "What it is", "Benefits", "Costs", "Risks", "Effort"],
              rows: d.options.map((o) => [o.name, o.description, o.benefits, o.costs, o.risks, o.effort]),
            }}
          />
        </div>
      )}
      {d.gaps.length > 0 && (
        <div className="doc-section">
          <h4>Validate next</h4>
          <ul>{d.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}
      {d.nextSteps.length > 0 && (
        <div className="doc-section">
          <h4>Next steps</h4>
          <ul>{d.nextSteps.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </article>
  );
}

/* ------------------------------- helpers -------------------------------- */

function decisionSections(d: NonNullable<Session["decision"]>): DocSection[] {
  const out: DocSection[] = [
    { heading: "Recommendation", body: `${d.recommendation}${d.rationale ? `\n\n${d.rationale}` : ""}` },
    { heading: "Confidence", body: d.confidence },
  ];
  if (d.evidence.length) out.push({ heading: "What we know", bullets: d.evidence });
  if (d.insight) out.push({ heading: "What it means", body: d.insight });
  if (d.options.length) {
    out.push({
      heading: "Options and trade-offs",
      method: "Decision matrix",
      table: {
        headers: ["Option", "What it is", "Benefits", "Costs", "Risks", "Effort"],
        rows: d.options.map((o) => [o.name, o.description, o.benefits, o.costs, o.risks, o.effort]),
      },
    });
  }
  if (d.gaps.length) out.push({ heading: "Validate next", bullets: d.gaps });
  if (d.nextSteps.length) out.push({ heading: "Next steps", bullets: d.nextSteps });
  return out;
}

function stageLabel(stage: string): string {
  return (
    { plan: "Planning", research: "Research", synthesis: "Synthesis", analysis: "Analysis", decision: "Decision", generate: "Artifacts" }[
      stage
    ] ?? stage
  );
}
function depthName(c: Catalog | null, id: string): string {
  return c?.depths.find((d) => d.id === id)?.name ?? id;
}
function audienceName(c: Catalog | null, id: string): string {
  return c?.audiences.find((a) => a.id === id)?.name ?? id;
}
