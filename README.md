# AI Discovery

A **product discovery copilot**. Paste anything — a feature idea, a written requirement, or a raw
meeting transcript — then pick exactly what you want generated. No fixed pipeline, no ceremony.

It runs out of the box in **demo mode** (illustrative, deterministic outputs, no API key) and
switches to **live outputs powered by Claude** the moment you add an API key.

> New here? [`SETUP.md`](./SETUP.md) has step-by-step run instructions and troubleshooting.

---

## The idea

Discovery today is slow and scattered across docs, decks, and tools. This reframes it as one
simple loop:

**Paste anything → pick capabilities → get structured outputs.**

You bring the raw material; you choose the lenses. Each capability produces a clean, uniform
output card you can read, copy, and act on.

### Capabilities

| | Capability | What you get |
|---|---|---|
| 📄 | **PRD** | A structured product requirements document |
| ✅ | **Detailed Requirements** | User stories + testable acceptance criteria |
| 🌐 | **Market Research** | Market context, trends, and where the idea fits |
| 📈 | **Competitive Analysis** | Who does this, how — strengths, gaps, differentiation |
| 💬 | **Feedback Analysis** | Themes and sentiment users express about this kind of feature |
| ⚙️ | **Process & Domain Analysis** | Workflows, systems, roles, and domain constraints touched |
| 🐞 | **Defect Foresight** | Common defects & failure modes to anticipate (matures into live production detection) |
| 📊 | **Business Value — Quantifiable** | Value drivers + a metrics estimation template |
| ✨ | **Business Value — Qualitative** | Strategic, experiential, and risk value |

Pick one or many. They run in parallel and each returns a card with sections, bullets, and tables.

### The maturity path (built-in)

Some capabilities show a "→" note describing what they become at maturity — the honest version of
"real":

- **Market / Competitive / Feedback** → agents that *fetch and cite* live sources instead of
  reasoning from the model's knowledge.
- **Defect Foresight** → *connects to the production platform* to detect real, live defects
  instead of anticipating likely ones.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Paste something, choose your capabilities, click **Generate**. Works with **no API key**.

### Enable live outputs (Claude)

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
```

The badge flips from **Demo mode** to **Live · Claude**, and every capability is produced by Claude
from your actual input. Override the model with `ANTHROPIC_MODEL`.

---

## Architecture

```
app/
  page.tsx                     Composer: paste input, pick capabilities, generate
  session/[id]/page.tsx        Results: input echo, pipeline status, output cards
  api/
    capabilities/route.ts      Capability catalog + mode
    analyze/route.ts           POST = run selected capabilities, GET = list sessions
    analyze/[id]/route.ts      GET one session
  components/shared.tsx        Top bar
  globals.css                  Futuristic light design system

lib/
  capabilities/
    types.ts                   AnalyzeInput, CapabilityOutput, AnalyzeSession
    registry.ts                The capability catalog (add one here)
    run.ts                     Per-capability prompts + live/demo runner
    seeds.ts                   Demo-mode templates (input woven in via placeholders)
    analyze.ts                 Runs selected capabilities in parallel
  llm/
    provider.ts                LlmProvider interface + auto-selection
    anthropic.ts               Live provider (Claude)
    mock.ts                    Demo provider
  store.ts                     In-memory store (swap for a DB — see roadmap)

  # Payer value-chain engine (heritage; reusable building blocks)
  domain/member-value-chain.ts Payer member value chain: stages, personas, KPIs
  agents/                      Domain / defect / market / process agents + orchestrator
  sources/                     Real App Store review client + clustering (grounding)
scripts/                       reviews:probe + offline grounding tests
```

**Design choices that make this extensible:**

- **One capability shape.** Every capability returns `{ title, summary, sections[] }`, so a single
  renderer displays all of them and adding a capability is one registry entry + one prompt + one
  seed.
- **One provider interface.** Capabilities never touch the SDK. Live vs. demo is a single swap in
  `getProvider()`.
- **Input woven into demo.** Demo seeds embed your actual pasted text via `{{INPUT}}` placeholders,
  so it feels responsive without pretending to have analyzed the text.

### Heritage: the payer value-chain engine

The earlier build — a four-agent discovery over a payer's **member value chain**, including the
**Defect agent grounded in real App Store reviews** — still lives under `lib/` and is fully
functional:

```bash
npm run reviews:probe -- "Aetna Health"   # real App Store reviews → grounded defects with links
npm run test:grounding                     # offline tests: Apple-schema parsing + clustering
```

These are the building blocks the "maturity path" above grows into (real fetching, real defect
detection).

---

## Roadmap to production

1. **Ground the research capabilities** — give Market/Competitive/Feedback real web retrieval with
   citations (the App Store review grounding under `lib/sources` is the template).
2. **Connect Defect Foresight to production** — telemetry, error tracking, session replay.
3. **Persistence & multi-tenant** — replace `lib/store.ts` with a database; org/workspace scoping.
4. **Human-in-the-loop** — edit/accept/export outputs, push to Jira/Confluence/Docs.
5. **Trust & compliance** — provenance on every claim, PHI handling (HIPAA), audit logs, RBAC.
6. **Streaming** — stream each capability's output as it completes (SSE) instead of polling.

---

## Notes

- **Stack:** Next.js (App Router) + React + TypeScript, hand-written CSS design system, optional
  `@anthropic-ai/sdk`. In-memory store for the pilot.
- **Security:** pinned to a patched Next.js 15.x. `npm audit` may still flag `sharp`/libvips CVEs —
  a transitive **optional** dependency this app doesn't use.
