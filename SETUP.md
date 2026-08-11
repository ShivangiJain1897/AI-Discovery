# Setup & Run

Get the AI Discovery pilot running on your machine in a couple of minutes.

## Prerequisites

- **Node.js 18+** (20+ recommended) and **npm** — check with `node -v`
- **git**
- No database, no API key required to start (it runs in demo mode + real reviews)

## 1. Get the code

```bash
git clone https://github.com/ShivangiJain1897/AI-Discovery.git
cd AI-Discovery
git checkout claude/ai-discovery-payer-platform-tjx1ri
```

## 2. Install & run

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

> Port 3000 already in use? Run `PORT=3001 npm run dev` and open that port instead.

## 3. Use it

1. **Paste your input** — a feature idea, a written requirement, or a meeting transcript.
   (Or click **Try an example** to prefill one.)
2. (Optional) Set the input type and add **product context**, e.g. `Medicare Advantage member app`.
3. **Choose what to generate** — tick any capabilities: PRD, Detailed Requirements, Market /
   Competitive / Feedback research, Process & Domain Analysis, Defect Foresight, or Business Value
   (quantifiable / qualitative).
4. Click **Generate**.

You'll get one clean output card per capability — with sections, bullets, and tables — plus your
input echoed for reference.

Everything works with **no API key** (demo mode returns strong illustrative templates with your
input woven in). Add a key for live, Claude-generated analysis.

## 4. Prove the "real data" grounding (no UI needed)

Needs normal outbound internet (it calls Apple's public `itunes.apple.com` endpoints):

```bash
npm run reviews:probe -- "Aetna Health"
# also works with an App Store URL or a numeric app id
```

Prints the resolved app, how many real reviews were fetched, and the grounded defect signals
with quoted, linked citations.

Run the offline tests (validate parsing against Apple's real schema + clustering):

```bash
npm run test:grounding
```

## 5. (Optional) Enable live Claude agents

```bash
cp .env.example .env.local
# edit .env.local and set:
#   ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

The badge in the top-right flips from **Demo mode** to **Live · Claude**. The agents now reason
with Claude instead of seed data; the Defect agent still cites real reviews.

You can also override the model: set `ANTHROPIC_MODEL` in `.env.local`.

## Build for production

```bash
npm run build
npm run start        # serves the optimized build on http://localhost:3000
```

## Troubleshooting

- **`itunes.apple.com` blocked / reviews not loading** — some corporate or CI networks block it.
  The Defect agent falls back to clearly-labeled generated examples and says so; the rest of the
  app is unaffected. On a normal network it fetches real data.
- **Node version errors** — upgrade to Node 20+.
- **Port conflict** — use `PORT=<n> npm run dev`.
- **Nothing appears after "Run discovery"** — the run executes server-side and can take a few
  seconds; the page polls and updates when it completes. Check the terminal for errors.

## Where things live

See [`README.md`](./README.md) for the architecture, the agent design, the grounding approach,
and the roadmap to production.
