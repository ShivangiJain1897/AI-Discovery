"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PinButton } from "../../components/shared";
import type { AnalyzeSession, CapabilityMeta, CapabilityOutput, ChatTurn, OutputSection } from "@/lib/capabilities/types";

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [session, setSession] = useState<AnalyzeSession | null>(null);
  const [caps, setCaps] = useState<CapabilityMeta[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then((d) => setCaps(d.capabilities ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/analyze/${id}`);
      if (res.status === 404) return active && setNotFound(true);
      const data = await res.json();
      if (!active) return;
      setSession(data.session);
      if (data.session?.status === "running" || data.session?.status === "queued") timer = setTimeout(poll, 700);
    }
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [id]);

  const turns: ChatTurn[] = useMemo(() => {
    if (!session) return [];
    if (session.turns && session.turns.length) return session.turns;
    // Legacy single-shot session → synthesize one turn.
    if (session.runs && session.runs.length)
      return [{ id: "t1", userText: session.input.text, capabilityIds: session.capabilityIds ?? [], runs: session.runs, createdAt: session.createdAt }];
    return [];
  }, [session]);

  const capMap = useMemo(() => new Map(caps.map((c) => [c.id, c])), [caps]);
  const running = session?.status === "running" || session?.status === "queued";

  // Default follow-up capabilities to the last turn's selection.
  useEffect(() => {
    if (selected.size === 0 && turns.length) setSelected(new Set(turns[turns.length - 1].capabilityIds));
  }, [turns, selected.size]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, running]);

  function toggle(cid: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });
  }

  async function send() {
    if (!text.trim() || selected.size === 0 || sending || running) return;
    setSending(true);
    const msg = text;
    setText("");
    try {
      await fetch(`/api/analyze/${id}/message`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg, capabilityIds: [...selected] }),
      });
      // refetch
      const d = await fetch(`/api/analyze/${id}`).then((r) => r.json());
      setSession(d.session);
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <main className="container">
        <div className="empty" style={{ marginTop: 40 }}>
          Thread not found. <Link href="/" style={{ color: "var(--brand)" }}>New discovery</Link>
        </div>
      </main>
    );
  }

  const title = turns[0]?.userText || session?.input.text || "Discovery";

  return (
    <div className="thread">
      <div className="thread-head container">
        <div className="crumb"><Link href="/">Discovery</Link> / {id}</div>
        <div className="thread-title">
          <h2>{firstLine(title)}</h2>
          <span className="spacer" />
          {session && <PinButton pin={{ id: `session:${id}`, kind: "session", label: firstLine(title), href: `/session/${id}` }} />}
          {session?.linkedUseCaseId ? (
            <Link href={`/intake/${session.linkedUseCaseId}`} className="btn primary">↩ Back to use case</Link>
          ) : (
            <Link href={`/intake/new?session=${id}`} className="btn primary">→ Send to intake</Link>
          )}
        </div>
      </div>

      <div className="thread-scroll">
        <div className="container">
          {turns.map((t) => (
            <div key={t.id} className="turn">
              {/* user message */}
              <div className="msg user">
                <div className="avatar you">You</div>
                <div className="bubble">
                  <div className="msg-text">{t.userText}</div>
                  <div className="msg-caps">
                    {t.capabilityIds.map((cid) => (
                      <span key={cid} className="capchip">{capMap.get(cid)?.icon} {capMap.get(cid)?.name ?? cid}</span>
                    ))}
                  </div>
                </div>
              </div>
              {/* assistant outputs */}
              <div className="msg bot">
                <div className="avatar bot">◈</div>
                <div className="bot-outputs">
                  {t.runs.filter((r) => r.status === "complete" && r.output).map((r) => (
                    <OutputCard key={r.capabilityId} output={r.output!} icon={capMap.get(r.capabilityId)?.icon ?? "✦"} />
                  ))}
                  {t.runs.filter((r) => r.status === "error").map((r) => (
                    <div key={r.capabilityId} className="onote" style={{ margin: 0 }}>⚠ {capMap.get(r.capabilityId)?.name ?? r.capabilityId} failed: {r.error}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {running && (
            <div className="msg bot">
              <div className="avatar bot">◈</div>
              <div className="bot-outputs"><div className="thinking"><span className="spinner" /> Working through the selected capabilities…</div></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Follow-up composer */}
      <div className="thread-composer">
        <div className="container">
          {showPicker && (
            <div className="picker-pop">
              {caps.map((c) => (
                <button key={c.id} className={`picker-chip ${selected.has(c.id) ? "on" : ""}`} onClick={() => toggle(c.id)}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="composer-row">
            <button className="btn" onClick={() => setShowPicker((v) => !v)} title="Choose capabilities">
              ⚙ {selected.size}
            </button>
            <textarea
              className="chat-input"
              placeholder={turns.length ? "Follow up — e.g. 'now do a competitive analysis on this'…" : "Ask for anything…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
            />
            <button className="btn primary send" onClick={send} disabled={sending || running || !text.trim() || selected.size === 0}>
              {sending || running ? <span className="spinner" /> : "↑"}
            </button>
          </div>
          <div className="composer-hint">
            {[...selected].map((cid) => capMap.get(cid)?.name).filter(Boolean).join(" · ") || "Pick at least one capability (⚙)"}
            {"  ·  Enter to send, Shift+Enter for a new line"}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutputCard({ output, icon }: { output: CapabilityOutput; icon: string }) {
  return (
    <div className="output">
      <div className="output-head">
        <div className="output-icon">{icon}</div>
        <div><h3>{output.title}</h3><div className="summary">{output.summary}</div></div>
      </div>
      <div className="output-body">{output.sections.map((s, i) => <Section key={i} section={s} />)}</div>
      {output.note && <div className="onote">💡 {output.note}</div>}
      {output.tags && output.tags.length > 0 && (
        <div className="otags">{output.tags.map((t) => <span key={t} className="otag">{t}</span>)}</div>
      )}
    </div>
  );
}

function Section({ section }: { section: OutputSection }) {
  return (
    <div className="osec">
      <h4>{section.heading}</h4>
      {section.body && <p>{section.body}</p>}
      {section.bullets && section.bullets.length > 0 && (
        <ul>{section.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      )}
      {section.table && (
        <div className="otable-wrap">
          <table className="otable">
            <thead><tr>{section.table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>{section.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function firstLine(text: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Discovery";
  return l.length > 90 ? l.slice(0, 87) + "…" : l;
}
