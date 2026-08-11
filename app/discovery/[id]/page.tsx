"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AGENT_EMOJI, AGENT_LABEL, Meter, TopBar } from "../../components/shared";
import type { AgentId, DiscoveryRun, Signal } from "@/lib/agents/types";

interface Stage { id: string; name: string; order: number }
interface Kpi { id: string; name: string }
interface Meta {
  agents: { id: AgentId; name: string }[];
  valueChain: { stages: Stage[] };
  kpis: Kpi[];
  mode: "live" | "demo";
}

export default function DiscoveryDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/discovery/${id}`);
      if (res.status === 404) {
        if (active) setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!active) return;
      setRun(data.run);
      if (data.run?.status === "running" || data.run?.status === "queued") {
        timer = setTimeout(poll, 800);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  const stageName = useMemo(() => {
    const m = new Map((meta?.valueChain.stages ?? []).map((s) => [s.id, s.name]));
    return (sid: string) => m.get(sid) ?? sid;
  }, [meta]);

  if (notFound) {
    return (
      <>
        <TopBar mode={meta?.mode} />
        <main className="container">
          <div className="empty" style={{ marginTop: 40 }}>
            Run not found. <Link href="/" style={{ color: "var(--brand)" }}>Back to dashboard</Link>
          </div>
        </main>
      </>
    );
  }

  const running = !run || run.status === "running" || run.status === "queued";

  return (
    <>
      <TopBar mode={run?.mode ?? meta?.mode} />
      <main className="container">
        <div style={{ paddingTop: 24 }}>
          <div className="crumb">
            <Link href="/">Discovery</Link> / {id}
          </div>
          <div className="section-head" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 26 }}>{run?.focus || "General member experience improvement"}</h2>
            {run && <span className={`pill ${run.status}`}>{run.status}</span>}
            {run?.appTarget && (
              <span className="badge" title="Defect agent grounded in this app's reviews">
                🐞 {run.appTarget}
              </span>
            )}
          </div>
        </div>

        {/* Agent pipeline status */}
        <section className="section">
          <div className="section-head">
            <h2>Agent pipeline</h2>
            <span className="muted">
              {running ? "Agents are working…" : "All agents reported"}
            </span>
          </div>
          {["domain", "defect", "market", "process"].map((aid) => {
            const ar = run?.agentRuns.find((a) => a.agent === aid);
            const count = aid === "domain" ? (run?.brief ? 1 : 0) : ar?.signals.length ?? 0;
            const grounded = ar?.grounding?.kind === "live-reviews";
            return (
              <div key={aid} className={`agent-status ${ar?.status ?? ""}`}>
                {!ar && running ? <span className="spinner" /> : <span className="st-dot" />}
                <span style={{ fontSize: 16 }}>{AGENT_EMOJI[aid as AgentId]}</span>
                <span className="st-name">{meta?.agents.find((a) => a.id === aid)?.name ?? aid}</span>
                {aid === "defect" && ar?.grounding && (
                  <span className="badge" style={{ marginLeft: 8, fontSize: 11 }} title={ar.grounding.detail}>
                    <span className="dot" style={{ background: grounded ? "var(--good)" : "var(--warn)" }} />
                    {grounded ? "Grounded · real reviews" : "Generated"}
                  </span>
                )}
                <span className="spacer" />
                <span className="st-count">
                  {!ar
                    ? running
                      ? "working…"
                      : "—"
                    : ar.status === "error"
                      ? `error: ${ar.error}`
                      : aid === "domain"
                        ? "domain brief ready"
                        : `${count} signal${count === 1 ? "" : "s"}`}
                </span>
              </div>
            );
          })}
          {(() => {
            const g = run?.agentRuns.find((a) => a.agent === "defect")?.grounding;
            return g ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12.5,
                  color: g.kind === "live-reviews" ? "var(--good)" : "var(--text-faint)",
                  paddingLeft: 4,
                }}
              >
                {g.kind === "live-reviews" ? "🔗 " : "ⓘ "}
                {g.detail}
                {g.app?.url && (
                  <>
                    {" "}
                    <a href={g.app.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)" }}>
                      view app ↗
                    </a>
                  </>
                )}
              </div>
            ) : null;
          })()}
        </section>

        {/* Domain brief */}
        {run?.brief && (
          <section className="section">
            <div className="section-head">
              <h2>🧭 Domain brief</h2>
              <span className="muted">Grounds every downstream agent</span>
            </div>
            <div className="card">
              <div className="brief-grid">
                <div>
                  <div className="kv">
                    <div className="k">Summary</div>
                    <div className="v">{run.brief.summary}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Priority KPIs</div>
                    <ul className="list-clean">
                      {run.brief.priorityKpis.map((k, i) => (
                        <li key={i}>
                          <strong style={{ color: "var(--text)" }}>{k.kpi}</strong> — {k.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div>
                  <div className="kv">
                    <div className="k">Focus stages</div>
                    <div className="tags">
                      {run.brief.focusStages.map((s) => (
                        <span key={s} className="tag">{stageName(s)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">Personas</div>
                    <ul className="list-clean">
                      {run.brief.personas.map((p, i) => (
                        <li key={i}>
                          <strong style={{ color: "var(--text)" }}>{p.name}</strong> — {p.motivation}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="kv">
                    <div className="k">Constraints</div>
                    <ul className="list-clean">
                      {run.brief.constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Opportunities */}
        <section className="section">
          <div className="section-head">
            <h2>Ranked opportunities</h2>
            <span className="muted">
              Synthesized across agents · sorted by impact ÷ effort × confidence
            </span>
          </div>
          {!run || run.opportunities.length === 0 ? (
            <div className="empty">{running ? "Synthesizing opportunities…" : "No opportunities produced."}</div>
          ) : (
            run.opportunities.map((o, i) => (
              <div key={o.id} className="opp">
                <div className="opp-head">
                  <div className="rank">{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <h3>{o.title}</h3>
                    <div className="tags">
                      <span className="tag">{stageName(o.stageId)}</span>
                      {o.contributingAgents.map((a) => (
                        <span key={a} className={`tag agent-${a}`}>
                          {AGENT_EMOJI[a]} {AGENT_LABEL[a]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="scorebar">
                  <div className="score">
                    <span className="lbl">Impact</span>
                    <Meter value={o.impact} />
                  </div>
                  <div className="score">
                    <span className="lbl">Effort</span>
                    <Meter value={o.effort} kind="effort" />
                  </div>
                  <div className="score">
                    <span className="lbl">Confidence</span>
                    <span className="val">{Math.round(o.confidence * 100)}%</span>
                  </div>
                  <div className="score">
                    <span className="lbl">Priority score</span>
                    <span className="val" style={{ color: "var(--brand)" }}>{o.priorityScore}</span>
                  </div>
                </div>

                <div className="problem">{o.problem}</div>
                <div className="reco">
                  <strong>Recommended play — </strong>
                  {o.recommendation}
                </div>
                {o.impactedKpis.length > 0 && (
                  <div className="tags">
                    {o.impactedKpis.map((k) => (
                      <span key={k} className="tag">📊 {k}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {/* Raw signals by agent */}
        {run && run.signals.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>Agent signals</h2>
              <span className="muted">{run.signals.length} raw observations · the evidence behind the opportunities</span>
            </div>
            <div className="grid cols-2">
              {(["defect", "market", "process"] as AgentId[]).map((aid) => {
                const sigs = run.signals.filter((s) => s.agent === aid);
                if (sigs.length === 0) return null;
                return (
                  <div key={aid} className="card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{AGENT_EMOJI[aid]}</span>
                      <h3 style={{ fontSize: 15 }}>{meta?.agents.find((a) => a.id === aid)?.name ?? aid}</h3>
                    </div>
                    {sigs.map((s) => (
                      <SignalRow key={s.id} s={s} stageName={stageName} />
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <footer className="footer">
          Run {id} · {run?.mode === "live" ? "Live · Claude" : "Demo mode"} ·{" "}
          <Link href="/" style={{ color: "var(--brand)" }}>New discovery</Link>
        </footer>
      </main>
    </>
  );
}

function SignalRow({ s, stageName }: { s: Signal; stageName: (id: string) => string }) {
  const grounded = s.sources && s.sources.length > 0;
  return (
    <div className="signal">
      <div className="signal-head">
        <span className={`sev ${s.severity}`}>{s.severity}</span>
        <h4>{s.title}</h4>
      </div>
      <p>{s.detail}</p>
      <div className="tags" style={{ marginTop: 6 }}>
        <span className="tag">{stageName(s.stageId)}</span>
        <span className="tag">conf {Math.round(s.confidence * 100)}%</span>
        {grounded && <span className="tag" style={{ color: "var(--good)" }}>✓ {s.sources!.length} real sources</span>}
      </div>
      {grounded ? (
        <div className="sources">
          {s.sources!.map((src, i) => (
            <div key={i} className="source">
              <div className="source-head">
                <span className="source-label">{src.label}</span>
                {src.url && (
                  <a className="source-link" href={src.url} target="_blank" rel="noopener noreferrer">
                    open ↗
                  </a>
                )}
              </div>
              {src.quote && <div className="source-quote">“{src.quote}”</div>}
              {src.meta && <div className="source-meta">{src.meta}</div>}
            </div>
          ))}
        </div>
      ) : (
        s.evidence.length > 0 && (
          <ul className="evidence">
            {s.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
