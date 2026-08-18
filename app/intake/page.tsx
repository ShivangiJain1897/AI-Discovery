"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusPill, TopBar, useCurrentUser } from "../components/shared";
import type { UseCase } from "@/lib/intake/types";
import { INTAKE_STATUSES } from "@/lib/intake/types";

export default function IntakeTracker() {
  const router = useRouter();
  const [items, setItems] = useState<UseCase[]>([]);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [name, setName] = useCurrentUser();
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/intake").then((r) => r.json()).then((d) => setItems(Array.isArray(d.items) ? d.items : [])).catch(() => {});
    fetch("/api/capabilities").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
  }, []);

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.status === filter)),
    [items, filter]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <TopBar mode={mode} />
      <main className="container">
        <section className="hero" style={{ paddingBottom: 8 }}>
          <div className="eyebrow">◷ Intake tracker</div>
          <h1 style={{ fontSize: 38 }}>Every use case, tracked in one place.</h1>
          <p className="lede">
            Capture use cases from discovery or the field — with stakeholders, data, and platform —
            and let the tracker flag overlaps so two teams don&apos;t build the same thing twice.
          </p>
        </section>

        <section className="section">
          <div className="toolbar">
            <Link href="/intake/new" className="btn primary">+ New use case</Link>
            <button
              className="btn"
              disabled={selected.size < 2}
              onClick={() => router.push(`/intake/compare?ids=${[...selected].join(",")}`)}
            >
              ⇄ Compare{selected.size >= 2 ? ` (${selected.size})` : ""}
            </button>
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {INTAKE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <span className="spacer" />
            <label className="identity">
              You:
              <input placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>

          {shown.length === 0 ? (
            <div className="empty">
              No use cases yet. <Link href="/intake/new" style={{ color: "var(--brand)" }}>Add the first one</Link>,
              or send one over from a Discovery session.
            </div>
          ) : (
            <div className="tracker">
              <table className="tt">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Use case</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Stakeholders (B / T / D)</th>
                    <th>Platform</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((uc) => (
                    <tr key={uc.id} className="clickable" onClick={() => router.push(`/intake/${uc.id}`)}>
                      <td onClick={(e) => { e.stopPropagation(); toggle(uc.id); }}>
                        <span className={`checkcell ${selected.has(uc.id) ? "on" : ""}`}>
                          {selected.has(uc.id) ? "✓" : ""}
                        </span>
                      </td>
                      <td>
                        <div className="tt-title">{uc.title}</div>
                        <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                          by {uc.submittedBy}
                          {uc.contributions.length > 0 ? ` · ${uc.contributions.length} update${uc.contributions.length === 1 ? "" : "s"}` : ""}
                          {uc.linkedSessionId ? " · from discovery" : ""}
                        </div>
                      </td>
                      <td>{uc.area}</td>
                      <td><StatusPill status={uc.status} /></td>
                      <td>{shortStake(uc)}</td>
                      <td>{uc.platform || "—"}</td>
                      <td style={{ whiteSpace: "nowrap", color: "var(--ink-faint)", fontSize: 12 }}>
                        {new Date(uc.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="footer">
          Intake tracker · persists to disk (.data/intake.json) · {items.length} use case{items.length === 1 ? "" : "s"}.
        </footer>
      </main>
    </>
  );
}

function shortStake(uc: UseCase): string {
  const b = uc.businessStakeholder ? initials(uc.businessStakeholder) : "—";
  const t = uc.techStakeholder ? initials(uc.techStakeholder) : "—";
  const d = uc.dataStakeholder ? initials(uc.dataStakeholder) : "—";
  return `${b} / ${t} / ${d}`;
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}
