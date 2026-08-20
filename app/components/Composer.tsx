"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CapabilityMeta, InputType } from "@/lib/capabilities/types";

interface CapResponse {
  capabilities: CapabilityMeta[];
  categoryOrder: CapabilityMeta["category"][];
  mode: "live" | "demo";
}

const INPUT_TYPES: { id: InputType; label: string }[] = [
  { id: "auto", label: "Auto-detect" },
  { id: "feature", label: "Feature idea" },
  { id: "requirement", label: "Requirement" },
  { id: "transcript", label: "Transcript" },
];

/** The Discovery composer — paste input, pick capabilities, start a thread.
 * When productId is set, the thread is scoped to that product. */
export default function Composer({ productId, productContext }: { productId?: string; productContext?: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<CapResponse | null>(null);
  const [text, setText] = useState("");
  const [inputType, setInputType] = useState<InputType>("auto");
  const [selected, setSelected] = useState<Set<string>>(new Set(["prd"]));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/capabilities").then((r) => r.json()).then(setMeta).catch(() => {});
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map<string, CapabilityMeta[]>();
    for (const c of meta?.capabilities ?? []) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [meta]);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function run() {
    setError("");
    if (!text.trim()) return setError("Paste a feature idea, requirement, or transcript first.");
    if (selected.size === 0) return setError("Pick at least one thing to generate.");
    setRunning(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, inputType, productContext, capabilityIds: [...selected], productId }),
      });
      const data = await res.json();
      if (data?.session?.id) router.push(`/session/${data.session.id}`);
      else setError(data?.error || "Something went wrong.");
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card composer">
      <div className="composer-label">① Paste your input</div>
      <textarea
        className="textarea"
        placeholder="Paste a feature idea, a requirement, or a meeting transcript…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ marginTop: 12 }}>
        <div className="segmented">
          {INPUT_TYPES.map((t) => (
            <button key={t.id} className={inputType === t.id ? "on" : ""} onClick={() => setInputType(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="composer-label" style={{ marginTop: 22 }}>② Choose what to generate</div>
      {(meta?.categoryOrder ?? []).map((cat) => (
        <div key={cat} className="cap-cat">
          <div className="cap-cat-title">{cat}</div>
          <div className="cap-grid">
            {(byCategory.get(cat) ?? []).map((c) => {
              const on = selected.has(c.id);
              return (
                <button key={c.id} className={`cap ${on ? "on" : ""}`} onClick={() => toggle(c.id)}>
                  <div className="cap-top">
                    <span className="cap-icon">{c.icon}</span>
                    <span className="cap-name">{c.name}</span>
                    <span className="cap-check">{on ? "✓" : ""}</span>
                  </div>
                  <div className="cap-blurb">{c.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="runbar">
        <button className="btn primary lg" onClick={run} disabled={running}>
          {running ? <span className="spinner" /> : "✦"} {running ? "Generating…" : "Generate"}
        </button>
        <span className="selcount">{selected.size} selected</span>
        {error && <span style={{ color: "var(--crit)", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}
