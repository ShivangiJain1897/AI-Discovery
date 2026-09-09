# Setup & Run

## Prerequisites

- **Node.js 20+** and **npm**
- **git**
- No database or API key needed to start

## Install & run

```bash
git clone https://github.com/ShivangiJain1897/AI-Discovery.git
cd AI-Discovery
npm install
npm run dev
```

Open **http://localhost:3000**. (Port taken? `PORT=3001 npm run dev`.)

## Using it

1. **Describe a product or feature** in the box. Say which it is — the PRD comes out differently
   for each.
2. **Leave the research checkboxes alone** unless you want to change something. Four are ticked by
   default; add Compliance or Feasibility if they matter for your idea.
3. **Hit Discover.** It reads the idea, runs every lens in parallel, and pulls the findings
   together. About a minute.
4. **Read what it found** — headline first, then each lens, every finding with a confidence level
   and what it's based on.
5. **Click a document**: Use cases, PRD, Product backlog or Business case. Take as many as you
   want; none of them re-runs the research. Each downloads as Markdown.
6. **Add what you know** in the box near the bottom — your ticket volumes, customer quotes,
   constraints. It feeds every document you make afterwards. Hit **Research again** to fold it into
   the findings too.

## Demo mode vs live

Without an API key you get the full flow, but the findings are clearly labelled as illustrative
patterns rather than research into your idea, and documents come back as the real outline with your
research slotted into it. It's there so you can see how it works — not to be mistaken for output.

For real research:

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

The badge switches to **Live · Claude**, and the market and compliance lenses start searching the
web and citing sources.

### Is it actually live?

The badge only checks a key exists. To be sure Claude is really responding:

```
GET http://localhost:3000/api/health
```

It makes a real call and reports back in plain English.

## Production build

```bash
npm run build
npm run start
```

## Troubleshooting

- **Everything says "demo mode"** — no key, or an invalid one. Check `/api/health`.
- **Discover takes a while** — the lenses run in parallel but they're real model calls, and the
  market lens searches the web first.
- **Discoveries disappeared** — without `DATABASE_URL` they're in `.data/discoveries.json`. See
  [`DEPLOY.md`](./DEPLOY.md) to use Postgres.
- **Node version errors** — upgrade to Node 20+.

See [`README.md`](./README.md) for how it's built and how to change the lenses and documents.
