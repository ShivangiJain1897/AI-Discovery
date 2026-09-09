# Setup & Run

Get the Product Intelligence Orchestrator running locally in a couple of minutes.

## Prerequisites

- **Node.js 20+** and **npm** — check with `node -v`
- **git**
- No database and no API key required to start

## 1. Get the code

```bash
git clone https://github.com/ShivangiJain1897/AI-Discovery.git
cd AI-Discovery
```

## 2. Install & run

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

> Port 3000 already in use? Run `PORT=3001 npm run dev` and open that port instead.

## 3. Use it

1. **Type a product question** — a problem, an open question, an idea, a proposed solution, a
   decision between options, a requirement, or a pasted transcript. Or click one of the examples.
2. **Read the plan.** The orchestrator states back the objective and the decision behind it, lists
   the assumptions it made, and recommends research lenses, analysis methods and outputs — each with
   the reason it's there. Change anything you disagree with; every catalog is one click away under
   *Change*.
3. **Answer any clarifying questions** — there will usually be zero or one, and only where the
   answer would change the work. Answering them re-plans the package.
4. **Run the research streams.** They run in parallel; each returns findings graded
   Strong / Moderate / Directional / Hypothesis, plus its evidence, contradictions and gaps.
5. **Synthesize across the streams.** This is the step that finds what no single lens can see — a
   complaint corroborated by behaviour, an opportunity contradicted by willingness to pay, a defect
   cluster explaining low adoption.
6. **Apply the analysis methods**, then **make the decision** (options, trade-offs, recommendation,
   confidence, gaps).
7. **Generate artifacts** — as many as you like. None of them re-runs research.

Anything you type into the box at the bottom is carried into every stream, analysis and artifact
produced afterwards.

## 4. Demo mode vs live

With **no API key** the app is fully navigable: the plan, the stage flow and the document structure
are all real. What it will *not* do is invent findings — every lens reports its evidence as a gap and
says what would fill it. That is deliberate; fabricating a plausible finding is the failure mode this
system exists to prevent.

To run live:

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL=claude-sonnet-5
# optional: ANTHROPIC_WORKSPACE_ID=...   (only needed for an org-level key)
npm run dev
```

The badge flips from **Demo mode** to **Live · Claude**. The outward-facing lenses (market,
competitive, regulatory, ecosystem, trends) also start doing live web research and citing sources.

### Confirm the live path actually works

The badge only checks that a key *exists*. To confirm Claude is really responding:

```
GET http://localhost:3000/api/health
```

It makes a real call and reports `liveCallOk` plus a plain-English verdict. If a key is present but
invalid, this is how you find out — the app otherwise degrades quietly to demo behaviour.

## Build for production

```bash
npm run build
npm run start        # serves the optimized build on http://localhost:3000
```

## Troubleshooting

- **Node version errors** — upgrade to Node 20+.
- **Port conflict** — `PORT=<n> npm run dev`.
- **Everything reports "not run" / "no evidence"** — you're in demo mode, or your key is invalid.
  Check `/api/health`.
- **A run takes a while** — research streams run in parallel but are real model calls; the deeper
  the depth mode, the longer. The thread updates when the batch completes.
- **Sessions disappeared** — with no `DATABASE_URL` they live in `.data/sessions.json`. See
  [`DEPLOY.md`](./DEPLOY.md) for Postgres.

## Where things live

See [`README.md`](./README.md) for the four-layer architecture and
[`docs/TUNING.md`](./docs/TUNING.md) for changing the capabilities, methods, outputs and prompts.
