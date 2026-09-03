"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface AgentCard {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  questions: { id: string; question: string; required: boolean }[];
}

const TYPES: { id: string; label: string; hint: string }[] = [
  { id: "auto", label: "Auto-detect", hint: "Let the orchestrator classify it" },
  { id: "problem", label: "Problem", hint: "A pain or gap to solve" },
  { id: "idea", label: "Idea", hint: "A possible thing to build" },
  { id: "solution", label: "Solution", hint: "A proposed approach" },
  { id: "requirement", label: "Requirement", hint: "A user story / spec" },
  { id: "transcript", label: "Transcript", hint: "A call / interview to mine" },
];

const EXAMPLES = [
  "Members can't tell what a visit will cost before they go, so they call support or skip care.",
  "Idea: an AI concierge in the member app that answers benefits questions and books care end-to-end.",
  "Transcript: PM: Walk me through the last claim you filed. Member: I logged in, it said pending for two weeks…",
];

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState("auto");
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents || []);
        setMode(d.mode || "demo");
        // Default: the three always-on lenses; user can add the rest.
        setSelected(new Set(["user_research", "market", "business_priority"]));
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function start() {
    const text = input.trim();
    if (!text) {
      setError("Type a problem, idea, or paste a transcript first.");
      taRef.current?.focus();
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one agent to run.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const agentIds = Array.from(selected);
      // 1) create the workflow
      const cr = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, inputType, agentIds }),
      });
      const cj = await cr.json();
      if (!cr.ok) throw new Error(cj.error || "Could not start discovery.");
      const id = cj.workflow.id;
      // 2) select agents → auto-extract each one's intake (captured vs needed)
      await fetch(`/api/workflow/${id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIds }),
      });
      router.push(`/w/${id}`);
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
            <span className="logo-mark">◈</span> Discovery Studio
          </div>
          <h1 className="entry-title">
            Start with anything.<br />Let the agents do discovery.
          </h1>
          <p className="entry-sub">
            Drop a problem, an idea, a requirement, or a raw transcript. A team of AI agents
            figures out what they need to know, surfaces findings you validate, and turns it
            into a PRD or backlog you own.
          </p>
        </div>

        <div className="composer-card">
          <textarea
            ref={taRef}
            className="composer-input"
            placeholder="e.g. Members can't tell what a visit will cost before they go…"
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
                title={t.hint}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="agent-pick">
            <div className="agent-pick-head">
              <span>Agents on the case</span>
              <span className="muted">{selected.size} selected</span>
            </div>
            <div className="agent-grid">
              {agents.map((a) => {
                const on = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`agent-card ${on ? "on" : ""}`}
                    onClick={() => toggle(a.id)}
                  >
                    <span className="agent-ico">{a.icon}</span>
                    <span className="agent-meta">
                      <span className="agent-name">{a.name}</span>
                      <span className="agent-blurb">{a.blurb}</span>
                    </span>
                    <span className={`agent-check ${on ? "on" : ""}`}>{on ? "✓" : "＋"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div className="composer-error">{error}</div>}

          <div className="composer-actions">
            <span className="mode-note">
              <span className={`badge ${mode}`}>
                <span className="dot" />
                {mode === "live" ? "Live · Claude" : "Demo mode"}
              </span>
            </span>
            <button className="btn-go" onClick={start} disabled={busy} type="button">
              {busy ? "Starting…" : "Run discovery →"}
            </button>
          </div>
        </div>

        <div className="entry-examples">
          <span className="ex-label">Try</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="ex-chip" onClick={() => setInput(ex)} type="button">
              {ex.length > 64 ? ex.slice(0, 61) + "…" : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
