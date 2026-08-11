"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AGENT_EMOJI, TopBar } from "./components/shared";
import type { AgentId, DiscoveryRun } from "@/lib/agents/types";

interface AgentMeta {
  id: AgentId;
  name: string;
  tagline: string;
  description: string;
  order: number;
}
interface Stage {
  id: string;
  order: number;
  name: string;
  summary: string;
}
interface AgentsResponse {
  agents: AgentMeta[];
  valueChain: { name: string; description: string; stages: Stage[] };
  mode: "live" | "demo";
}

const EXAMPLES = [
  "Medicare Advantage onboarding & retention",
  "Reduce avoidable contact-center calls",
  "Improve CMS Star Ratings member experience",
  "Digital self-service adoption for new members",
];

export default function Dashboard() {
  const router = useRouter();
  const [meta, setMeta] = useState<AgentsResponse | null>(null);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [focus, setFocus] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setMeta).catch(() => {});
    fetch("/api/discovery").then((r) => r.json()).then((d) => setRuns(d.runs ?? [])).catch(() => {});
  }, []);

  async function startRun() {
    setStarting(true);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus }),
      });
      const data = await res.json();
      if (data?.run?.id) router.push(`/discovery/${data.run.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <TopBar mode={meta?.mode} />
      <main className="container">
        <section className="hero">
          <div className="eyebrow">Discovery, reimagined</div>
          <h1>A team of AI agents that discovers where to improve your member experience.</h1>
          <p className="lede">
            Point four specialized agents at your payer&apos;s member value chain. They build domain context,
            detect live production defects, scan the market, and analyze operational processes — then
            synthesize everything into a ranked list of opportunities you can act on.
          </p>
        </section>

        {/* Run bar */}
        <section className="section">
          <div className="card">
            <div className="section-head" style={{ marginBottom: 12 }}>
              <h2>Run a discovery</h2>
              <span className="muted">Domain grounding → parallel agents → synthesized opportunities</span>
            </div>
            <div className="runbar">
              <input
                className="input"
                placeholder="Optional focus, e.g. 'Medicare Advantage onboarding'"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !starting && startRun()}
              />
              <button className="btn primary" onClick={startRun} disabled={starting}>
                {starting ? <span className="spinner" /> : "▶"} {starting ? "Running agents…" : "Run discovery"}
              </button>
            </div>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <span key={ex} className="chip" onClick={() => setFocus(ex)}>
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Agents */}
        <section className="section">
          <div className="section-head">
            <h2>The discovery team</h2>
            <span className="muted">{meta?.agents.length ?? 4} agents working the member value chain</span>
          </div>
          <div className="grid cols-4">
            {(meta?.agents ?? []).map((a) => (
              <div key={a.id} className="card hover agent-card">
                <div className={`agent-icon ${a.id}`}>{AGENT_EMOJI[a.id]}</div>
                <h3>{a.name}</h3>
                <div className="tagline">{a.tagline}</div>
                <p>{a.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Value chain */}
        <section className="section">
          <div className="section-head">
            <h2>{meta?.valueChain.name ?? "Member Value Chain"}</h2>
            <span className="muted">Every signal and opportunity is anchored to a stage</span>
          </div>
          <div className="chain">
            {(meta?.valueChain.stages ?? []).map((s) => (
              <div key={s.id} className="chain-stage">
                <div className="num">{String(s.order).padStart(2, "0")}</div>
                <h4>{s.name}</h4>
                <p>{s.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recent runs */}
        <section className="section">
          <div className="section-head">
            <h2>Recent discoveries</h2>
            <span className="muted">{runs.length} run{runs.length === 1 ? "" : "s"}</span>
          </div>
          {runs.length === 0 ? (
            <div className="empty">No discoveries yet — run one above to see the agents work.</div>
          ) : (
            runs.map((r) => (
              <Link key={r.id} href={`/discovery/${r.id}`}>
                <div className="run-row">
                  <span className={`pill ${r.status}`}>{r.status}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {r.focus || "General member experience improvement"}
                    </div>
                    <div className="rid">{r.id}</div>
                  </div>
                  <div style={{ textAlign: "right", color: "var(--text-faint)", fontSize: 12 }}>
                    <div>
                      {r.opportunities?.length ?? 0} opportunities · {r.signals?.length ?? 0} signals
                    </div>
                    <div>{new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>

        <footer className="footer">
          <div>
            AI Discovery pilot · {meta?.mode === "live" ? "Live agents powered by Claude" : "Demo mode with seed data"} ·
            Built to be extended — see README for the roadmap to production.
          </div>
        </footer>
      </main>
    </>
  );
}
