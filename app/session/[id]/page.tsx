"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PinButton } from "../../components/shared";
import type { AnalyzeSession, CapabilityMeta, CapabilityOutput, OutputSection } from "@/lib/capabilities/types";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [session, setSession] = useState<AnalyzeSession | null>(null);
  const [caps, setCaps] = useState<CapabilityMeta[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then((d) => setCaps(d.capabilities ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/analyze/${id}`);
      if (res.status === 404) {
        if (active) setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!active) return;
      setSession(data.session);
      if (data.session?.status === "running" || data.session?.status === "queued") {
        timer = setTimeout(poll, 700);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  const capMap = new Map(caps.map((c) => [c.id, c]));
  const running = !session || session.status === "running" || session.status === "queued";

  if (notFound) {
    return (
      <main className="container">
        <div className="empty" style={{ marginTop: 40 }}>
          Session not found. <Link href="/" style={{ color: "var(--brand)" }}>Back to composer</Link>
        </div>
      </main>
    );
  }

  return (
      <main className="container">
        <div style={{ paddingTop: 24 }}>
          <div className="crumb">
            <Link href="/">Composer</Link> / {id}
          </div>
          <div className="section-head" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 24 }}>{firstLine(session?.input.text)}</h2>
            {session && <span className={`pill ${session.status}`}>{session.status}</span>}
            {session?.input.inputType && session.input.inputType !== "auto" && (
              <span className="badge">{session.input.inputType}</span>
            )}
            <span className="spacer" />
            {session && (
              <PinButton pin={{ id: `session:${id}`, kind: "session", label: firstLine(session.input.text), href: `/session/${id}` }} />
            )}
            {session?.linkedUseCaseId ? (
              <Link href={`/intake/${session.linkedUseCaseId}`} className="btn primary">↩ Back to use case</Link>
            ) : (
              session?.status === "complete" && (
                <Link href={`/intake/new?session=${id}`} className="btn primary">→ Send to intake</Link>
              )
            )}
          </div>
        </div>

        {/* Input echo */}
        {session && (
          <section className="section" style={{ paddingTop: 8 }}>
            <div className="composer-label">Input{session.input.productContext ? ` · ${session.input.productContext}` : ""}</div>
            <div className="input-echo">{session.input.text}</div>
          </section>
        )}

        {/* Pipeline status */}
        <section className="section" style={{ paddingTop: 8 }}>
          {(session?.capabilityIds ?? []).map((cid) => {
            const cap = capMap.get(cid);
            const run = session?.runs.find((r) => r.capabilityId === cid);
            return (
              <div key={cid} className={`run-status ${run?.status ?? ""}`}>
                {!run && running ? <span className="spinner" /> : <span className="st-dot" />}
                <span style={{ fontSize: 16 }}>{cap?.icon ?? "•"}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{cap?.name ?? cid}</span>
                <span className="spacer" />
                <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  {!run ? (running ? "working…" : "—") : run.status === "error" ? `error: ${run.error}` : "ready"}
                </span>
              </div>
            );
          })}
        </section>

        {/* Outputs */}
        <section className="section" style={{ paddingTop: 8 }}>
          {(session?.runs ?? [])
            .filter((r) => r.status === "complete" && r.output)
            .map((r) => (
              <OutputCard key={r.capabilityId} output={r.output!} icon={capMap.get(r.capabilityId)?.icon ?? "✦"} />
            ))}
          {running && (
            <div className="empty">Generating your outputs…</div>
          )}
        </section>

        <footer className="footer">
          Session {id} · {session?.mode === "live" ? "Live · Claude" : "Demo mode"} ·{" "}
          <Link href="/" style={{ color: "var(--brand)" }}>New session</Link>
        </footer>
      </main>
  );
}

function OutputCard({ output, icon }: { output: CapabilityOutput; icon: string }) {
  return (
    <div className="output">
      <div className="output-head">
        <div className="output-icon">{icon}</div>
        <div>
          <h3>{output.title}</h3>
          <div className="summary">{output.summary}</div>
        </div>
      </div>
      <div className="output-body">
        {output.sections.map((s, i) => (
          <Section key={i} section={s} />
        ))}
      </div>
      {output.note && <div className="onote">💡 {output.note}</div>}
      {output.tags && output.tags.length > 0 && (
        <div className="otags">
          {output.tags.map((t) => (
            <span key={t} className="otag">{t}</span>
          ))}
        </div>
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
        <ul>
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {section.table && (
        <div className="otable-wrap">
          <table className="otable">
            <thead>
              <tr>
                {section.table.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function firstLine(text?: string): string {
  const l = (text || "").trim().split(/\r?\n/)[0] || "Session";
  return l.length > 90 ? l.slice(0, 87) + "…" : l;
}
