"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Doc, downloadMarkdown } from "@/app/components/Doc";

/**
 * A discovery, as a conversation.
 *
 * The research and its findings sit at the top. Below them the thread keeps
 * going: ask a question, ask for more research, ask for a document, or ask for
 * a document to be changed — all in the same box. The quick chips are just
 * prefilled messages, so there's one path through the whole thing.
 */

type Confidence = "High" | "Medium" | "Low";
interface Finding { id: string; title: string; detail: string; confidence: Confidence; basis: string }
interface LensResult {
  lensId: string; status: string; summary: string; findings: Finding[];
  gaps: string[]; sources: string[]; error?: string;
}
interface DocSection { heading: string; body?: string; bullets?: string[]; table?: { headers: string[]; rows: string[][] } }
interface GeneratedDoc {
  id: string; documentId: string; title: string; sections: DocSection[];
  instruction?: string; version: number; createdAt: number;
}
interface TurnAction { kind: string; label: string; lensIds?: string[]; docId?: string }
interface Turn { id: string; role: "user" | "assistant"; text: string; action?: TurnAction; createdAt: number }
interface Discovery {
  id: string; idea: string; kind: "product" | "feature";
  context: { industry: string; users: string; problem: string; goal: string };
  lenses: LensResult[];
  summary?: { headline: string; learned: string[]; opportunities: string[]; risks: string[] };
  documents: GeneratedDoc[]; turns: Turn[]; notes: string[]; mode: "live" | "demo";
  createdAt: number; updatedAt: number;
}
interface Meta {
  lenses: { id: string; name: string; icon: string; blurb: string; standard: boolean; web: boolean }[];
  documents: { id: string; name: string; icon: string; blurb: string; prose: string }[];
  mode: "live" | "demo";
}

const SEEDED = new Set(["t_idea", "t_first"]);

export default function DiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [d, setD] = useState<Discovery | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showFindings, setShowFindings] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/discovery/${id}`);
      if (!r.ok) throw new Error("Not found.");
      setD((await r.json()).discovery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/meta").then((r) => r.json()).then(setMeta).catch(() => {});
  }, [load]);

  const scrollDown = () =>
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);

  /** Everything the PM does goes through here. */
  async function send(message: string) {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setPending(text);
    setDraft("");
    setError("");
    scrollDown();
    try {
      const r = await fetch(`/api/discovery/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setD(j.discovery);
      scrollDown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setDraft(text);
    } finally {
      setPending(null);
      setSending(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this discovery?")) return;
    await fetch(`/api/discovery/${id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <div className="page"><div className="notice">Loading…</div></div>;
  if (error && !d) return <div className="page"><div className="notice err">{error}</div></div>;
  if (!d) return null;

  const lensMeta = (lid: string) => meta?.lenses.find((l) => l.id === lid);
  const docById = (docId?: string) => d.documents.find((x) => x.id === docId);
  const done = d.lenses.filter((l) => l.status === "done");
  const failed = d.lenses.filter((l) => l.status === "error");
  const thread = (d.turns ?? []).filter((t) => !SEEDED.has(t.id));
  const header = [`# ${d.idea.replace(/\s+/g, " ").trim().slice(0, 120)}`, ""];
  const totalFindings = done.reduce((n, l) => n + l.findings.length, 0);

  return (
    <div className="page chat-page">
      <div className="page-inner">
        <div className="topbar">
          <span className="kind-tag">{d.kind}</span>
          <h1 className="idea">{d.idea}</h1>
          <button className="link-danger" onClick={remove} type="button">Delete</button>
        </div>

        {d.mode === "demo" && (
          <div className="demo-banner">
            <b>Demo mode.</b> Findings are illustrative examples of what each lens looks at — not
            research into your idea, and questions can&apos;t be answered. Add an{" "}
            <code>ANTHROPIC_API_KEY</code> for the real thing.
          </div>
        )}

        {error && <div className="notice err inline">{error}</div>}

        <div className="context-strip">
          {([["Industry", d.context.industry], ["Users", d.context.users], ["Problem", d.context.problem], ["Goal", d.context.goal]] as [string, string][])
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="ctx">
                <span className="ctx-k">{k}</span>
                <span className="ctx-v">{v}</span>
              </div>
            ))}
        </div>

        {d.summary?.headline && (
          <section className="card summary">
            <h2>{d.summary.headline}</h2>
            <div className="sum-cols">
              {d.summary.learned.length > 0 && (
                <div className="sum-col">
                  <h3>What we learned</h3>
                  <ul>{d.summary.learned.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
              {d.summary.opportunities.length > 0 && (
                <div className="sum-col good">
                  <h3>Opportunities</h3>
                  <ul>{d.summary.opportunities.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
              {d.summary.risks.length > 0 && (
                <div className="sum-col warn">
                  <h3>Risks &amp; things to check</h3>
                  <ul>{d.summary.risks.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* the research */}
        <section className="findings">
          <div className="findings-head">
            <h2>What the research found</h2>
            <button className="btn-quiet" onClick={() => setShowFindings((v) => !v)} type="button">
              {showFindings ? "Hide" : `Show (${done.length} lenses, ${totalFindings} findings)`}
            </button>
          </div>

          {showFindings && (
            <>
              {done.map((l) => (
                <div key={l.lensId} className="card lens">
                  <div className="lens-head">
                    <span className="lens-ico">{lensMeta(l.lensId)?.icon ?? "✦"}</span>
                    <h3>{lensMeta(l.lensId)?.name ?? l.lensId}</h3>
                  </div>
                  {l.summary && <p className="lens-sum">{l.summary}</p>}
                  <div className="finds">
                    {l.findings.map((f) => (
                      <div key={f.id} className="find">
                        <div className="find-title">
                          {f.title}
                          <span className={`conf ${f.confidence.toLowerCase()}`}>{f.confidence}</span>
                        </div>
                        <div className="find-detail">{f.detail}</div>
                        {f.basis && <div className="find-basis">Based on: {f.basis}</div>}
                      </div>
                    ))}
                  </div>
                  {l.gaps.length > 0 && (
                    <div className="gaps">
                      <span className="gaps-label">Still to check</span>
                      <ul>{l.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                    </div>
                  )}
                  {l.sources.length > 0 && (
                    <div className="sources">
                      <span className="gaps-label">Sources</span>
                      <ul>{l.sources.map((s, i) => <li key={i}><a href={s} target="_blank" rel="noreferrer noopener">{s}</a></li>)}</ul>
                    </div>
                  )}
                </div>
              ))}

              {failed.map((l) => (
                <div key={l.lensId} className="card lens err">
                  <div className="lens-head">
                    <span className="lens-ico">{lensMeta(l.lensId)?.icon ?? "✦"}</span>
                    <h3>{lensMeta(l.lensId)?.name ?? l.lensId} couldn&apos;t run</h3>
                  </div>
                  <p className="lens-sum">
                    This lens failed, so nothing from it is included. The others are unaffected — ask
                    me to run it again below.
                  </p>
                  <p className="lens-detail">{l.error}</p>
                </div>
              ))}
            </>
          )}
        </section>

        {/* the conversation */}
        <section className="thread">
          {thread.length === 0 && !pending && (
            <div className="thread-hint">
              <b>Keep going.</b> Ask why a finding says what it says, ask for research on something
              that isn&apos;t covered, ask for a document, or tell me something I don&apos;t know
              about your product. Anything you tell me feeds what I write next.
            </div>
          )}

          {thread.map((t) => {
            const doc = docById(t.action?.docId);
            return (
              <div key={t.id} className={`msg ${t.role}`}>
                {t.role === "assistant" && <div className="msg-avatar">◈</div>}
                <div className="msg-body">
                  {t.action?.label && t.role === "assistant" && (
                    <div className={`msg-action ${t.action.kind}`}>{t.action.label}</div>
                  )}
                  <div className="msg-text">{t.text}</div>
                  {doc && (
                    <div className="card document in-thread">
                      <Doc
                        tag={doc.version > 1 ? `${d.kind} · v${doc.version}` : d.kind}
                        title={doc.title}
                        sections={doc.sections}
                        onDownload={() =>
                          downloadMarkdown(doc.title, [...header, `## ${doc.title}`, ""], doc.sections)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pending && (
            <>
              <div className="msg user"><div className="msg-body"><div className="msg-text">{pending}</div></div></div>
              <div className="msg assistant">
                <div className="msg-avatar">◈</div>
                <div className="msg-body"><div className="msg-text thinking">Working on it…</div></div>
              </div>
            </>
          )}
          <div ref={endRef} />
        </section>
      </div>

      {/* the one box */}
      <div className="composer-dock">
        <div className="composer-dock-inner">
          <div className="chips">
            {(meta?.documents ?? []).map((doc) => {
              const made = d.documents.some((x) => x.documentId === doc.id);
              return (
                <button
                  key={doc.id}
                  className={`chip ${made ? "made" : ""}`}
                  onClick={() => send(made ? `Rewrite the ${doc.prose}.` : `Write the ${doc.prose}.`)}
                  disabled={sending}
                  type="button"
                  title={doc.blurb}
                >
                  {doc.icon} {doc.name}{made ? " ↻" : ""}
                </button>
              );
            })}
            {(meta?.lenses ?? [])
              .filter((l) => !d.lenses.some((x) => x.lensId === l.id))
              .map((l) => (
                <button
                  key={l.id}
                  className="chip add"
                  onClick={() => send(`Research the ${l.name.toLowerCase()} angle.`)}
                  disabled={sending}
                  type="button"
                  title={l.blurb}
                >
                  ＋ {l.icon} {l.name}
                </button>
              ))}
          </div>

          <div className="composer-row">
            <textarea
              className="composer-box"
              placeholder="Ask a question, ask for more research, ask for a document, or tell me something I don't know…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              disabled={sending}
            />
            <button className="btn-go sm" onClick={() => send(draft)} disabled={sending || !draft.trim()} type="button">
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
