# AI Discovery — Payer Member Value Chain

Reimagining **product discovery** for payer (health-insurance) organizations with a team of
specialized AI agents. Point the agents at a value chain — we start with the **member value
chain** — and they discover *where to improve*, then rank the opportunities.

This repo is a **runnable pilot**. It works out of the box in **demo mode** (rich, deterministic
seed data, no API key needed) and switches to **live agents powered by Claude** the moment you
add an API key.

---

## The idea

A payer has multiple value chains (member, provider, claims, …). Within the **member value
chain**, discovery today is slow, siloed, and opinion-driven. This platform reframes it as the
output of four agents that each look at the same value chain through a different lens:

| Agent | Lens | What it produces |
|---|---|---|
| 🧭 **Domain Context Agent** | Learns the payer's member value chain | A **domain brief**: personas, priority KPIs, regulatory constraints, highest-leverage stages. Grounds every other agent. |
| 🐞 **Defect Detection Agent** | Live production defects members hit | Stage-anchored **defect signals** with severity + evidence (review clusters, ticket patterns, reproducible bugs). |
| 📈 **Market Analysis Agent** | Competitive & market landscape | **Market-gap signals** — where the plan is behind, with benchmarks. |
| ⚙️ **Process Analysis Agent** | Operational processes & workflows | **Process-friction signals** — manual handoffs, swivel-chair, automation candidates. |

An **orchestrator** runs the domain agent first (its brief grounds the others), then the three
signal agents in parallel, then **synthesizes** all signals into a ranked list of
**opportunities**. Everything is anchored to a value-chain **stage**, so convergence is visible:
when defect + market + process all point at the same stage, that's a top-priority discovery.

```
                    ┌───────────────────────┐
   focus  ─────────▶│  Domain Context Agent  │──── domain brief ───┐
                    └───────────────────────┘                     │  (grounds the rest)
                                                                   ▼
        ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
        │  Defect Agent    │   │  Market Agent    │   │  Process Agent   │   (run in parallel)
        └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
                 └──────────── signals ──┴──────────── signals ─┘
                                         ▼
                             ┌───────────────────────┐
                             │      Orchestrator      │  cluster by stage,
                             │     (synthesizer)      │  score impact ÷ effort × confidence
                             └───────────┬───────────┘
                                         ▼
                              Ranked Opportunities
```

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the app, type an optional focus (e.g. *"Medicare Advantage onboarding"*), and click
**Run discovery**. You'll watch the agents report in, see the domain brief, and get a ranked
list of opportunities with the evidence behind each.

### Enable live agents (Claude)

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
```

With a key present, the same code path calls **Claude** instead of returning seed data — the
UI badge flips from **Demo mode** to **Live · Claude**. No other change required.

---

## Architecture

```
app/
  page.tsx                     Dashboard: agents, value chain, run form, recent runs
  discovery/[id]/page.tsx      Run workspace: brief, agent pipeline, ranked opportunities, signals
  api/
    agents/route.ts            Agent registry + domain model
    discovery/route.ts         POST = start+run a discovery, GET = list runs
    discovery/[id]/route.ts    GET one run
  components/shared.tsx        Top bar, meters, agent icons
  globals.css                  Design system

lib/
  domain/member-value-chain.ts Domain model: 10 stages, personas, KPIs, known friction
  llm/
    provider.ts                LlmProvider interface + auto-selection + JSON extraction
    anthropic.ts               Live provider (Claude)
    mock.ts                    Demo provider (deterministic payer seed data)
  agents/
    types.ts                   Signal, Opportunity, DiscoveryRun, DomainBrief
    domain-agent.ts            🧭 grounds the run
    defect-agent.ts            🐞 signal agent
    market-agent.ts            📈 signal agent
    process-agent.ts           ⚙️ signal agent
    signal-agent.ts            Shared runner for the three signal agents
    orchestrator.ts            Pipeline + deterministic, explainable synthesizer
    registry.ts                Agent metadata for the UI
  store.ts                     In-memory run store (swap for a DB — see roadmap)
```

**Design choices that make this extensible:**

- **One provider interface.** Agents never touch the SDK directly. Live vs. demo is a single
  swap in `getProvider()`. Adding a new model or provider is one file.
- **Agents are uniform.** Every agent takes a `DiscoveryContext` and emits `Signal[]`. Adding a
  fifth lens (e.g. a *Voice-of-Member* agent over CAHPS/NPS verbatims) means one new file + one
  registry entry.
- **Everything anchors to a stage.** Signals and opportunities carry a `stageId`, which is what
  lets the synthesizer detect cross-agent convergence and keeps output actionable.
- **Synthesis is deterministic and explainable.** `synthesize()` clusters by stage and scores
  `impact ÷ effort × confidence`, boosting cross-agent convergence. It runs identically in demo
  and live mode, so the ranking is auditable rather than a black box.

---

## What's required to make this real (roadmap)

The pilot proves the shape. To take it to production for a payer:

**1. Feed the agents real evidence (biggest lever).**
- Defect agent → app-store review APIs, Zendesk/Salesforce ticket clusters, status-page
  incidents, RUM/error telemetry, session-replay signals.
- Market agent → competitor teardown feeds, analyst notes, CMS Star/CAHPS data, transparency
  machine-readable files, web research (grounded retrieval).
- Process agent → SOP/Confluence ingestion, process-mining exports, agent-desktop telemetry,
  call-driver taxonomies.
- Domain agent → the plan's actual product taxonomy, benefit configs, and KPI definitions.
- Do this with **retrieval + tool-use**: give each agent tools (search, fetch, query the
  warehouse) rather than free-form generation, so signals cite real sources.

**2. Persistence & multi-tenant.** Replace `lib/store.ts` with Postgres (runs, signals,
opportunities, briefs) + object storage for evidence. Add org/workspace scoping.

**3. Human-in-the-loop.** Let PMs accept / dismiss / merge opportunities, add votes, attach to a
backlog (Jira/Azure DevOps), and feed decisions back as training signal for prioritization.

**4. Trust & compliance.** PHI handling (HIPAA), evidence provenance on every signal,
audit logs, and guardrails so market/web research never leaks member data. Role-based access.

**5. Streaming & scale.** Stream agent progress (SSE) instead of polling; run agents as durable
background jobs (queue) so long live runs survive; cache domain briefs per focus.

**6. Evaluation.** A labeled set of known member issues to measure agent precision/recall, plus
a rubric for opportunity quality — so the discovery gets measurably better over time.

**7. Beyond the member value chain.** The domain model is one file. Add provider, claims, and
payment-integrity value chains as sibling models; the agent framework is unchanged.

---

## Notes

- **Stack:** Next.js (App Router) + React + TypeScript, hand-written CSS design system, optional
  `@anthropic-ai/sdk`. No database — in-memory for the pilot.
- **Security:** pinned to a patched Next.js 15.x. `npm audit` may still flag `sharp`/libvips CVEs
  — a transitive **optional** dependency for image optimization that this app does not use.
- **Model:** live mode defaults to a current Claude model; override with `ANTHROPIC_MODEL`.
