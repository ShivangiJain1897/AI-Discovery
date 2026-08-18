# AI Discovery

Two connected modes for product teams:

- **Discovery** — a copilot. Paste anything (a feature idea, a written requirement, or a raw
  meeting transcript) and pick exactly what you want generated: a PRD, requirements, research,
  analysis, or a business-value case.
- **Intake** — a team tracker with an **AI triage copilot**. Promote a discovered use case into a
  tracked record; the tracker **flags similar/duplicate use cases**, lets you **compare** them, and
  the **Intake Analyst** produces a provisional idea record + **RICE-A score** (with per-factor
  evidence, assumptions, confidence, and improving questions), a risk overlay, and AI-fit — while
  **humans override the score and make the decision** (versioned score history). Persists to a data
  store.
- **Studio** — see and edit the **prompt behind every agent** (each capability's system + task
  prompt). Edits are saved and take effect immediately; reset to default anytime.

**Deploying it for a few people?** See [`DEPLOY.md`](./DEPLOY.md) — Vercel + a hosted Postgres +
an optional shared password, ~15 minutes, no code changes.

It runs out of the box in **demo mode** (illustrative, deterministic outputs, no API key) and
switches to **live outputs powered by Claude** the moment you add an API key. Duplicate detection
works with no key.

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
Any completed session has a **→ Send to intake** button that promotes it into the tracker.

### Intake tracker

A lightweight, team-facing tracker for use cases worth pursuing. Each record captures the **area**
it comes from, **business / technology / data stakeholders**, the **data** involved, the
**platform**, what's **TBD**, a **status**, and a running **team-activity** trail. Two smart bits:

- **Duplicate detection** — as you add a use case, it flags similar existing ones with a match
  score and the shared terms ("looks similar to X, Y, Z"), so two teams don't build the same thing.
- **Compare** — select multiple use cases and see them side by side with an overlap summary.

It **persists to disk** (`.data/intake.json`), so the tracker survives restarts — no database
required for the pilot.

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
  page.tsx                     Discovery composer: paste input, pick capabilities, generate
  session/[id]/page.tsx        Results: output cards + "Send to intake"
  intake/
    page.tsx                   Tracker (list, filter, select-to-compare)
    new/page.tsx               New use case form with live duplicate warning
    [id]/page.tsx              Use case detail: edit, status, team activity, related
    compare/page.tsx           Side-by-side comparison + overlap
  api/
    capabilities/route.ts      Capability catalog + mode
    analyze/route.ts           POST = run capabilities, GET = list sessions
    analyze/[id]/route.ts      GET one session
    intake/route.ts            GET list / POST create (returns similar)
    intake/[id]/route.ts       GET / PATCH (edit + add contribution)
    intake/similar/route.ts    POST draft similarity check (live warning)
    intake/compare/route.ts    POST compare 2-4 use cases
  components/shared.tsx        Top bar + nav + status pill
  globals.css                  Futuristic light design system

lib/
  capabilities/
    types.ts                   AnalyzeInput, CapabilityOutput, AnalyzeSession
    registry.ts                The capability catalog (add one here)
    run.ts                     Per-capability prompts + live/demo runner
    seeds.ts                   Demo-mode templates (input woven in via placeholders)
    analyze.ts                 Runs selected capabilities in parallel
  intake/
    types.ts                   UseCase, statuses, contributions
    store.ts                   File-backed persistence (.data/intake.json)
    similarity.ts              Deterministic cosine similarity + shared terms
  llm/
    provider.ts                LlmProvider interface + auto-selection
    anthropic.ts               Live provider (Claude)
    mock.ts                    Demo provider
  store.ts                     In-memory session store (swap for a DB — see roadmap)

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

## Data store

All persistence goes through one abstraction (`lib/storage/collection.ts`):

- **Local dev:** no setup — data persists to `.data/*.json`.
- **Production:** set `DATABASE_URL` and it uses **Postgres** (tables auto-create; each row a JSONB
  document). This is what makes the app deployable — a cloud host's filesystem is ephemeral.

Collections: `use_cases` (intake), `sessions` (discovery), `prompt_overrides` (Studio edits).

## Notes

- **Stack:** Next.js (App Router) + React + TypeScript, hand-written CSS, optional
  `@anthropic-ai/sdk`, `pg` for Postgres. Storage swappable via `DATABASE_URL`.
- **Auth:** optional shared-password gate via `APP_PASSWORD` (`middleware.ts`); swap for real SSO
  when productionizing.
- **Security:** pinned to a patched Next.js 15.x. `npm audit` may still flag `sharp`/libvips CVEs —
  a transitive **optional** dependency this app doesn't use.
