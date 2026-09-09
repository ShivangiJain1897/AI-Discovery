"use client";

import { useState } from "react";
import type { Catalog, Clarification, Plan, PlanItem } from "./types";

/**
 * Step 10 — the recommended package, shown back to the PM.
 *
 * "I understand the objective as… / Recommended research… / Recommended
 * analysis… / Recommended output…" — accept it, or change any part. The PM
 * never has to understand the agent architecture underneath.
 */
export function PlanCard({
  plan,
  catalog,
  busy,
  onToggle,
  onSetDepth,
  onSetAudience,
  onAnswer,
  onReplan,
  onRun,
  hasRun,
}: {
  plan: Plan;
  catalog: Catalog | null;
  busy: boolean;
  onToggle: (layer: "research" | "analysis" | "outputs", id: string) => void;
  onSetDepth: (id: string) => void;
  onSetAudience: (id: string) => void;
  onAnswer: (id: string, value: string) => void;
  onReplan: () => void;
  onRun: () => void;
  hasRun: boolean;
}) {
  const [open, setOpen] = useState<"research" | "analysis" | "outputs" | null>(null);

  const facts: [string, string][] = [
    ["Decision in service of", plan.decision],
    ["Scope", plan.scope],
    ["Stakeholders", plan.stakeholders],
    ["Evidence already held", plan.existingEvidence],
    ["Output consumer", plan.consumer],
  ];

  const selectedCount = (items: PlanItem[]) => items.filter((i) => i.selected).length;

  return (
    <div className="plan">
      <div className="plan-objective">
        <span className="plan-label">I understand the objective as</span>
        <p className="plan-obj-text">{plan.objective}</p>
      </div>

      <div className="plan-facts">
        {facts
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => (
            <div key={k} className="plan-fact">
              <span className="pf-k">{k}</span>
              <span className="pf-v">{v}</span>
            </div>
          ))}
      </div>

      {plan.assumptions.length > 0 && (
        <div className="plan-assumptions">
          <span className="plan-label">Assumptions I made (say if any are wrong)</span>
          <ul>
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {plan.clarifications.length > 0 && (
        <Clarifications items={plan.clarifications} busy={busy} onAnswer={onAnswer} onReplan={onReplan} />
      )}

      <LayerPicker
        layer="research"
        title="Recommended research"
        hint="what evidence needs to be discovered"
        items={plan.research}
        catalog={catalog}
        open={open === "research"}
        onOpen={() => setOpen(open === "research" ? null : "research")}
        onToggle={onToggle}
      />
      <LayerPicker
        layer="analysis"
        title="Recommended analysis"
        hint="how that evidence gets reasoned over"
        items={plan.analysis}
        catalog={catalog}
        open={open === "analysis"}
        onOpen={() => setOpen(open === "analysis" ? null : "analysis")}
        onToggle={onToggle}
      />
      <LayerPicker
        layer="outputs"
        title="Recommended output"
        hint="what you'll be able to hand someone"
        items={plan.outputs}
        catalog={catalog}
        open={open === "outputs"}
        onOpen={() => setOpen(open === "outputs" ? null : "outputs")}
        onToggle={onToggle}
      />

      <div className="plan-modes">
        <div className="pm-group">
          <span className="plan-label">Depth</span>
          <div className="pm-chips">
            {(catalog?.depths ?? []).map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.blurb}
                className={`mode-chip ${plan.depth === d.id ? "on" : ""}`}
                onClick={() => onSetDepth(d.id)}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <div className="pm-group">
          <span className="plan-label">Audience</span>
          <div className="pm-chips">
            {(catalog?.audiences ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                className={`mode-chip ${plan.audience === a.id ? "on" : ""}`}
                onClick={() => onSetAudience(a.id)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="plan-go">
        <button className="btn-go" onClick={onRun} disabled={busy || selectedCount(plan.research) === 0} type="button">
          {busy
            ? "Running research…"
            : hasRun
              ? `Re-run ${selectedCount(plan.research)} research stream${selectedCount(plan.research) === 1 ? "" : "s"} →`
              : `Run ${selectedCount(plan.research)} research stream${selectedCount(plan.research) === 1 ? "" : "s"} →`}
        </button>
        <span className="plan-go-hint">Streams run in parallel. Analysis and artifacts come after, from the same evidence.</span>
      </div>
    </div>
  );
}

function Clarifications({
  items,
  busy,
  onAnswer,
  onReplan,
}: {
  items: Clarification[];
  busy: boolean;
  onAnswer: (id: string, value: string) => void;
  onReplan: () => void;
}) {
  const anyAnswered = items.some((c) => c.answer.trim());
  return (
    <div className="plan-clarify">
      <span className="plan-label">
        Before I start — {items.length} question{items.length === 1 ? "" : "s"} where the answer would
        change the work
      </span>
      {items.map((c) => (
        <label key={c.id} className="clar">
          <span className="clar-q">{c.question}</span>
          {c.why && <span className="clar-why">Why it matters: {c.why}</span>}
          <textarea
            className="clar-input"
            rows={2}
            placeholder="Answer, or leave blank to proceed on the assumptions above…"
            value={c.answer}
            onChange={(e) => onAnswer(c.id, e.target.value)}
          />
        </label>
      ))}
      <button className="btn-ghost" onClick={onReplan} disabled={busy || !anyAnswered} type="button">
        {busy ? "Re-planning…" : "Update the plan from my answers"}
      </button>
    </div>
  );
}

function LayerPicker({
  layer,
  title,
  hint,
  items,
  catalog,
  open,
  onOpen,
  onToggle,
}: {
  layer: "research" | "analysis" | "outputs";
  title: string;
  hint: string;
  items: PlanItem[];
  catalog: Catalog | null;
  open: boolean;
  onOpen: () => void;
  onToggle: (layer: "research" | "analysis" | "outputs", id: string) => void;
}) {
  const name = (id: string) => lookup(catalog, layer, id)?.name ?? id;
  const chosen = items.filter((i) => i.selected);

  return (
    <div className={`plan-layer ${open ? "open" : ""}`}>
      <div className="pl-head">
        <span className="plan-label">
          {title} <span className="pl-hint">— {hint}</span>
        </span>
        <button className="pl-more" onClick={onOpen} type="button">
          {open ? "Done" : `Change (${chosen.length} of ${catalogCount(catalog, layer)})`}
        </button>
      </div>

      <ul className="pl-chosen">
        {chosen.map((i) => (
          <li key={i.id} className="pl-item">
            <span className={`pl-req ${i.required ? "req" : "opt"}`}>{i.required ? "Required" : "Optional"}</span>
            <span className="pl-name">{name(i.id)}</span>
            {i.why && <span className="pl-why">{i.why}</span>}
          </li>
        ))}
        {chosen.length === 0 && <li className="pl-empty">Nothing selected.</li>}
      </ul>

      {open && <FullPicker layer={layer} items={items} catalog={catalog} onToggle={onToggle} />}
    </div>
  );
}

function FullPicker({
  layer,
  items,
  catalog,
  onToggle,
}: {
  layer: "research" | "analysis" | "outputs";
  items: PlanItem[];
  catalog: Catalog | null;
  onToggle: (layer: "research" | "analysis" | "outputs", id: string) => void;
}) {
  if (!catalog) return null;
  const selected = new Set(items.filter((i) => i.selected).map((i) => i.id));

  if (layer === "research") {
    return (
      <div className="picker">
        {catalog.research.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`pick-card ${selected.has(c.id) ? "on" : ""}`}
            onClick={() => onToggle(layer, c.id)}
            title={c.investigates.join(" · ")}
          >
            <span className="pick-ico">{c.icon}</span>
            <span className="pick-meta">
              <span className="pick-name">
                {c.name}
                {c.live && <span className="live-tag" title="Does live web research">web</span>}
              </span>
              <span className="pick-blurb">{c.blurb}</span>
            </span>
            <span className="pick-check">{selected.has(c.id) ? "✓" : "＋"}</span>
          </button>
        ))}
      </div>
    );
  }

  const families = layer === "analysis" ? catalog.methodFamilies : catalog.outputFamilies;
  const entries: { id: string; name: string; familyId: string; blurb: string; note: string }[] =
    layer === "analysis"
      ? catalog.methods.map((m) => ({ id: m.id, name: m.name, familyId: m.familyId, blurb: m.blurb, note: `Needs: ${m.evidenceNeeded}` }))
      : catalog.outputs.map((o) => ({ id: o.id, name: o.name, familyId: o.familyId, blurb: o.blurb, note: `Best after: ${o.needs}` }));

  return (
    <div className="picker-families">
      {families.map((f) => {
        const list = entries.filter((e) => e.familyId === f.id);
        if (list.length === 0) return null;
        return (
          <div key={f.id} className="pf-block">
            <div className="pf-head">
              <span className="pf-name">{f.name}</span>
              <span className="pf-blurb">{f.blurb}</span>
            </div>
            <div className="pf-chips">
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`pick-chip ${selected.has(e.id) ? "on" : ""}`}
                  onClick={() => onToggle(layer, e.id)}
                  title={`${e.blurb}\n${e.note}`}
                >
                  {selected.has(e.id) ? "✓ " : "＋ "}
                  {e.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function catalogCount(catalog: Catalog | null, layer: "research" | "analysis" | "outputs"): number {
  if (!catalog) return 0;
  return layer === "research" ? catalog.research.length : layer === "analysis" ? catalog.methods.length : catalog.outputs.length;
}

function lookup(catalog: Catalog | null, layer: "research" | "analysis" | "outputs", id: string) {
  if (!catalog) return undefined;
  const list = layer === "research" ? catalog.research : layer === "analysis" ? catalog.methods : catalog.outputs;
  return list.find((x) => x.id === id);
}
