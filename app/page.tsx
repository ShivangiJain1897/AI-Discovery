"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One box. Describe the product or feature, hit Discover.
 *
 * The research checkboxes are pre-ticked with the four that matter for almost
 * any idea — you can ignore them entirely and it works.
 */

interface LensMeta { id: string; name: string; icon: string; blurb: string; standard: boolean; web: boolean }

const EXAMPLES = [
  "A way for members to see what a visit will cost before they book it.",
  "An AI assistant in our support tool that drafts replies from past tickets.",
  "Let customers manage their own subscription changes instead of calling us.",
];

export default function Home() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [kind, setKind] = useState<"feature" | "product">("feature");
  const [lenses, setLenses] = useState<LensMeta[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((d) => {
        setLenses(d.lenses || []);
        setMode(d.mode || "demo");
        setPicked(new Set((d.lenses || []).filter((l: LensMeta) => l.standard).map((l: LensMeta) => l.id)));
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function discover() {
    const text = idea.trim();
    if (!text) {
      setError("Describe the product or feature first.");
      ref.current?.focus();
      return;
    }
    if (picked.size === 0) {
      setError("Pick at least one thing to research.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: text, kind, lenses: [...picked] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      router.push(`/d/${j.discovery.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="entry">
      <div className="entry-inner">
        <div className="entry-hero">
          <h1 className="entry-title">What do you want to discover?</h1>
          <p className="entry-sub">
            Describe a product or a feature. We&apos;ll research it — users, market, bugs, process —
            and then write you a use case doc, a PRD, a backlog or a business case.
          </p>
        </div>

        <div className="composer-card">
          <textarea
            ref={ref}
            className="composer-input"
            placeholder="e.g. A way for members to see what a visit will cost before they book it…"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") discover(); }}
            rows={4}
          />

          <div className="row">
            <span className="row-label">This is a</span>
            <div className="seg">
              <button type="button" className={kind === "feature" ? "on" : ""} onClick={() => setKind("feature")}>Feature</button>
              <button type="button" className={kind === "product" ? "on" : ""} onClick={() => setKind("product")}>Product</button>
            </div>
          </div>

          <div className="row wrap">
            <span className="row-label">Research</span>
            <div className="lens-chips">
              {lenses.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`lens-chip ${picked.has(l.id) ? "on" : ""}`}
                  onClick={() => toggle(l.id)}
                  title={l.blurb}
                >
                  <span className="lc-check">{picked.has(l.id) ? "✓" : "＋"}</span>
                  <span className="lc-ico">{l.icon}</span>
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="composer-error">{error}</div>}

          <div className="composer-actions">
            <span className={`badge ${mode}`}>
              <span className="dot" />
              {mode === "live" ? "Live · Claude" : "Demo mode — example findings only"}
            </span>
            <button className="btn-go" onClick={discover} disabled={busy} type="button">
              {busy ? "Researching…" : "Discover →"}
            </button>
          </div>
          {busy && <p className="busy-note">Running {picked.size} research {picked.size === 1 ? "lens" : "lenses"}. This takes about a minute.</p>}
        </div>

        <div className="entry-examples">
          <span className="ex-label">Try</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="ex-chip" onClick={() => setIdea(ex)} type="button">
              {ex.length > 58 ? ex.slice(0, 55) + "…" : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
