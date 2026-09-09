# Product Intelligence Orchestrator

A working tool for Product Managers that moves a real product question through the full chain:

**Problem / Question → Research → Evidence → Analysis → Insight → Decision → Product Artifact**

It is deliberately *not* a research assistant, an analyst, or a document generator. Those are three
different jobs and conflating them is why most "AI for PM" tools produce confident, useless prose.
This app keeps them separate and orchestrates across them.

---

## The four layers

Every request is treated as potentially containing four separable layers. The app never confuses
them — competitive research is Layer 1, a SWOT is Layer 2, "prioritize A over B" is Layer 3, a PRD
is Layer 4.

| Layer | Question it answers | In the code |
| --- | --- | --- |
| **1 · Research** | What evidence needs to be discovered? | `lib/orchestrator/catalog/research.ts`, `research.ts` |
| **2 · Analysis** | What reasoning applies to that evidence? | `lib/orchestrator/catalog/analysis.ts`, `analysis.ts` |
| **3 · Decision** | What recommendation should emerge? | `lib/orchestrator/decision.ts` |
| **4 · Generation** | What artifact moves the org forward? | `lib/orchestrator/catalog/outputs.ts`, `generate.ts` |

### Layer 1 — eleven research capabilities

Run as **parallel evidence streams**. The PM never has to know which applies; the orchestrator
recommends a package and explains why each lens is in it.

| | Lens | Investigates |
| --- | --- | --- |
| A | User & Voice of Customer | Jobs, needs, pains, workarounds, adoption barriers. Distinguishes primary from secondary research; never treats stated preference as behaviour. |
| B | Product Usage & Behaviour | Activation, funnels, retention, churn, drop-off. Validates or contradicts what customers *say*. |
| C | Defect, Quality & Support | Clusters issues and classifies each as defect / usability / missing capability / process / data / training. |
| D | Market & Category | Size, growth, segments. Separates observed evidence, analyst estimates and assumptions. **Live web research.** |
| E | Competitive & Alternatives | Every alternative including manual workarounds and doing nothing — and *why* customers pick each. **Live web research.** |
| F | Buyer & Commercial | Economic buyer, buying criteria, willingness to pay. Treats user ≠ buyer ≠ decision maker. |
| G | Domain & Regulatory | Names the specific instrument, jurisdiction and product consequence. **Live web research.** |
| H | Technology & Feasibility | Architecture, data availability, build-vs-buy; for AI: grounding, hallucination, HITL, latency, cost. |
| I | Operational & Workflow | Current-state flow, handoffs, bottlenecks. Separates a **product** problem from a **process** problem. |
| J | Ecosystem & Integration | Platforms, partners, channels, and what each dependency risks. **Live web research.** |
| K | Trend & Strategic Foresight | Splits current signals from speculative scenarios; every signal carries a "so what, by when". **Live web research.** |

Each stream returns the same six-part contract — key evidence, findings, patterns, contradictions,
gaps, implications — so they can be synthesized rather than concatenated.

### Layer 2 — the analytical method catalog

67 methods across 16 families (problem & root cause, customer, voice of customer, product
performance, quality, market, competitive, strategy, opportunity, prioritization, business &
financial, experimentation, risk, delivery, AI product, foresight).

Every method declares `evidenceNeeded`, and the orchestrator picks against it. **Prioritization is
never chosen by popularity**: RICE requires real reach data; without it the plan proposes ICE or
impact-effort and says why in the plan card.

### Layer 3 — the decision

`Evidence → Insight → Options → Trade-offs → Recommendation → Confidence → Evidence gaps.`

A do-nothing option is always on the table and costed. Confidence is reported honestly — a
Low-confidence "go and find this out first" is a legitimate output, and the app will give you one
rather than manufacture certainty.

### Layer 4 — the artifacts

55 outputs across 15 families: research plans and interview guides, problem statements, personas,
JTBD maps, product strategy, competitor matrices, battlecards, recommendation memos, business cases,
PRDs, backlogs, RICE assessments, roadmaps, experiment briefs, KPI trees, RCAs, launch plans, RACIs,
executive summaries, slide storylines.

**Generating a second format never re-runs research.** Every artifact reads from one session
dossier (`lib/orchestrator/dossier.ts`) — that rule is enforced in code, not just in the prompt.

---

## How it feels to use

You type a product question. You get back:

> **I understand the objective as** …
> **Recommended research** — the lenses, each marked required or optional, each with a reason
> **Recommended analysis** — the methods, matched to the evidence you'll actually have
> **Recommended output** — what you'll be able to hand someone
> **Depth** · **Audience**

Accept it, or change any part — every catalog is a click away. Clarifying questions appear only
where a different answer would change the work (usually zero or one), and answering them re-plans
the package. Then research runs, synthesis runs across the streams, analyses apply, a decision gets
made, and artifacts come out — all in one thread, all from the same evidence.

## Evidence discipline

The single rule that makes the output trustworthy, in `lib/orchestrator/universal.ts` and inherited
by every prompt in the app:

- Every statement is classified as **fact / inference / assumption / gap / contradiction**.
- Every finding carries a strength: **Strong / Moderate / Directional / Hypothesis**.
- Nothing is invented — no market numbers, quotes, competitor capabilities, prices or metrics. Where
  evidence is missing, the app says so and names what would provide it.
- Claims are **triangulated** across streams; contradictions are surfaced, never resolved by
  silently preferring the convenient lens.
- The orchestrator **challenges** the PM's framing rather than validating it.

This is why **demo mode does not fabricate findings**. With no API key the app shows the real plan,
runs the real structure, and reports every lens as an evidence gap — because inventing a plausible
finding is the worst failure this system can have.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Works with **no API key** (demo mode). For live research and generation:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL (default claude-sonnet-5)
# optional: ANTHROPIC_WORKSPACE_ID for an org-level key
```

`GET /api/health` makes a real call to Claude and tells you truthfully whether the live path works —
the badge only checks that a key exists.

## Structure

```
app/
  page.tsx                          One box: the product question
  s/[id]/page.tsx                   The orchestration thread
  s/[id]/PlanCard.tsx               "I understand the objective as…" + the three pickers
  components/Doc.tsx                Section rendering + Markdown download
  api/
    catalog/route.ts                All four catalogs + depth/audience + mode
    session/route.ts                POST: classify → plan.  GET: history
    session/[id]/route.ts           GET / PATCH (notes, per-lens evidence) / DELETE
    session/[id]/plan/route.ts      Reshape the package; answer clarifications; re-plan
    session/[id]/research/route.ts  Run the streams in parallel
    session/[id]/synthesis/route.ts Synthesize ACROSS the streams
    session/[id]/analysis/route.ts  Apply analysis methods to existing evidence
    session/[id]/decision/route.ts  Options → recommendation → confidence
    session/[id]/generate/route.ts  Artifact from the dossier
    health/route.ts                 Truthful live-path diagnostic

lib/
  orchestrator/
    types.ts          The session model
    universal.ts      Evidence discipline inherited by every prompt
    plan.ts           Steps 1-4 + 10: read the question, recommend the package
    research.ts       Layer 1: parallel evidence streams
    synthesis.ts      Steps 5-6: cross-stream relationships → insights → opportunities
    analysis.ts       Layer 2: apply one method
    decision.ts       Layer 3: the call
    generate.ts       Layer 4: the artifact
    dossier.ts        The one source of accumulated evidence
    catalog/
      research.ts     11 capabilities
      analysis.ts     67 methods in 16 families
      outputs.ts      55 outputs in 15 families
      depth.ts        5 depth modes, 9 audiences
  llm/                Provider abstraction (Claude live, demo fallback)
  storage/            Postgres when DATABASE_URL is set, JSON file otherwise
```

## Design decisions

- **The four layers are separate types, not one blob.** A research capability, an analysis method
  and an output are different things with different requirements, and the code says so.
- **One dossier, many artifacts.** `dossier.ts` is the only input to analysis, decision and
  generation, which is what makes "never re-research for a second format" true rather than aspirational.
- **Catalogs are data.** Adding a lens, a method or an output is one entry in a catalog file — the
  planner, the API and the UI all pick it up. See [`docs/TUNING.md`](./docs/TUNING.md).
- **The plan is editable and explains itself.** Every recommended item carries the reason it's
  there; the PM can add anything from the full catalog, and items they add are labelled as theirs.
- **Failure degrades honestly.** Every live call has a fallback that reports what is missing rather
  than one that invents a substitute.

## Storage

`DATABASE_URL` set → Postgres (`aid_sessions`, JSONB). Otherwise `.data/sessions.json`.
Switching backends is config, not code.

## Where this could go next

1. **Stream results as they complete** (SSE) instead of awaiting the whole parallel batch.
2. **Connect real evidence sources** — Jira, Zendesk, Amplitude, the data warehouse — so Layers B
   and C run on actual data instead of reporting gaps.
3. **Persist evidence across sessions** so a second question about the same product starts warm.
4. **Close the loop**: record which recommendations were taken and what happened.
