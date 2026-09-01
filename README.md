# Discovery Studio

A chat-driven, human-in-the-loop **product discovery** workflow. Drop in a problem, an idea, a
requirement, or a raw transcript, and a team of AI agents figures out what they need to know,
surfaces findings you validate, and turns it into a **PRD or backlog you own**.

The whole thing is one loop, born from a single chat box:

**Say anything → agents intake what they need → you validate the findings → generate.**

## The flow

1. **Chat entry.** Type a problem/idea/solution/requirement or paste a transcript. Tag the input
   type or let the **orchestrator auto-detect** it. Pick which agents work the case.
2. **The agent team.** Six lenses, each with its own intake and findings:
   - 🧑‍🔬 **User Research** — who the users are, their jobs, needs, and pains.
   - ⚙️ **Process Mining** — the current process, handoffs, manual steps, bottlenecks.
   - 🐞 **Defect Detection** — current defects and reliability issues in the experience.
   - 📈 **Market & Competitive** — market framing, competitors, shifting expectations.
   - ⚖️ **Regulatory & Environment** — government regulations, PHI, compliance (HIPAA/CMS-aware).
   - 🎯 **Business Priority** — business goals, value, effort, strategic priority.
3. **Per-agent intake.** Each agent needs a few questions answered — almost like a form. The input
   (especially a transcript) **auto-populates** what it can. A **side panel** shows what got
   **captured** vs. what's **still needed**, and prompts you to fill the gaps.
4. **Sectioned findings.** Every agent returns a section of specific findings.
5. **Validate & augment.** Mark each finding **Right** or **Off**, and add "also consider…" notes.
   Your validation shapes what gets generated.
6. **Generate.** Turn the validated findings into a **PRD** or a **prioritized backlog**.

It runs out of the box in **demo mode** (deterministic, illustrative outputs, no API key) and
switches to **live outputs powered by Claude** the moment you add an API key. In healthcare/payer
contexts (member, claim, provider, PHI…) the agents automatically pull in the right domain and
regulatory framing.

> The earlier Intake tracker was split into its own repo (`use-case-tracker`) for a separate team.

**Deploying it for a few people?** See [`DEPLOY.md`](./DEPLOY.md) — Vercel + a hosted Postgres +
an optional shared password, ~15 minutes, no code changes.

> New here? [`SETUP.md`](./SETUP.md) has step-by-step run instructions and troubleshooting.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Type a problem or paste a transcript, pick your agents, click **Run discovery**. Works with **no
API key**.

### Enable live outputs (Claude)

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
```

The badge flips from **Demo mode** to **Live · Claude**, and classification, intake extraction,
findings, and generated documents are all produced by Claude from your actual input. Override the
model with `ANTHROPIC_MODEL`.

---

## Architecture

```
app/
  page.tsx                     Chat entry: input + type + agent picker → create workflow
  w/[id]/page.tsx              Workflow view: stepper (Intake → Findings → Generate),
                               intake side-drawer (captured vs needed), findings with
                               Right/Off validation + augment notes, PRD/backlog output
  components/Shell.tsx         Constant sidebar: New discovery + history + mode badge
  api/
    agents/route.ts            Agent catalog (no system prompts) + mode
    workflow/route.ts          GET list / POST create (classify + suggest agents)
    workflow/[id]/route.ts     GET / PATCH (intake, verdicts, notes, stage) / DELETE
    workflow/[id]/select/route.ts   Set selected agents + auto-extract each one's intake
    workflow/[id]/run/route.ts      Run selected agents → findings
    workflow/[id]/generate/route.ts Generate PRD / backlog from validated findings
  globals.css                  Futuristic light design system

lib/
  workflow/
    types.ts                   Workflow, AgentState, IntakeField, Finding, GeneratedOutput
    agents.ts                  The six agents: intake questions, extractIntake, runAgent
    orchestrator.ts            classifyInput (auto-detect type) + suggestAgents
    generate.ts                PRD / backlog from validated (non-rejected) findings + notes
    store.ts                   Persistence via the storage collection abstraction
  llm/
    provider.ts                LlmProvider interface + auto-selection (live vs demo)
    anthropic.ts               Live provider (Claude)
    mock.ts                    Demo provider (deterministic generators do the work)
  storage/
    collection.ts              Swappable persistence (file store / Postgres)
```

**Design choices that make this extensible:**

- **One workflow object.** Everything a user does — input type, per-agent intake, findings
  verdicts, augment notes, generated outputs — lives on the `Workflow`, so the flow is resumable
  and auditable, and each API call is a small mutation on it.
- **One provider interface.** Agents never touch the SDK. Live vs. demo is a single branch on
  `provider.mode`; demo mode uses deterministic generators so the whole loop works with no key.
- **Add an agent in one place.** A new lens is one entry in `AGENTS` (name, blurb, intake
  questions, system persona) — extraction, running, and the UI pick it up automatically.

---

## Data store

All persistence goes through one abstraction (`lib/storage/collection.ts`):

- **Local dev:** no setup — data persists to `.data/*.json`.
- **Production:** set `DATABASE_URL` and it uses **Postgres** (tables auto-create; each row a JSONB
  document). This is what makes the app deployable — a cloud host's filesystem is ephemeral.

Collection: `workflows` (one document per discovery).

## Roadmap to production

1. **Ground the research agents** — give User Research / Market / Competitive real retrieval with
   citations instead of reasoning from the model's knowledge.
2. **Connect Defect Detection to production** — telemetry, error tracking, session replay for real
   defects instead of anticipated ones.
3. **Streaming** — stream each agent's findings as it completes (SSE) instead of running as a batch.
4. **Export** — push generated PRDs/backlogs to Jira/Confluence/Docs.
5. **Trust & compliance** — provenance on every finding, PHI handling (HIPAA), audit logs, RBAC.

## Notes

- **Stack:** Next.js (App Router) + React + TypeScript, hand-written CSS, optional
  `@anthropic-ai/sdk`, `pg` for Postgres. Storage swappable via `DATABASE_URL`.
- **Auth:** optional shared-password gate via `APP_PASSWORD` (`middleware.ts`); swap for real SSO
  when productionizing.
- **Security:** pinned to a patched Next.js 15.x. `npm audit` may still flag `sharp`/libvips CVEs —
  a transitive **optional** dependency this app doesn't use.
