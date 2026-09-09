# AI Discovery

Describe a product or a feature. AI researches it, then writes you the document you need.

```
   your idea  →  research  →  what we found  →  a document
                     ↑                              ↓
                     └───────  keep talking  ───────┘
```

One input box to start. After that it's a conversation.

---

## What it does

**1. You describe an idea** — a product or a feature, in plain words. One box.

**2. It researches it.** Four lenses run at once, by default (the other two are one click away, or
just ask for them later):

| Lens | Looks at |
| --- | --- |
| 🗣️ **User research** | Who it's for, the job they're doing, what hurts today, what would stop them adopting it |
| 🌐 **Market & competitive** | The category, real competitors, and the manual workarounds people use instead *(searches the web)* |
| 🐞 **Bugs & support** | What breaks, what drives support contacts, and whether each issue is a defect or a usability problem |
| 🔄 **Process mining** | How the work gets done today, where it stalls, and whether the fix is product or process |

Two more are one click away when they matter: **⚖️ Compliance & risk** *(searches the web)* and
**🛠️ Feasibility** (data availability, integrations, effort, AI risk).

**3. You see what it found** — a headline, what we learned, opportunities, risks. Then each lens's
findings, every one carrying a confidence level and what it's based on.

**4. You pick a document:**

| | Document | What you get |
| --- | --- | --- |
| 📋 | **Use cases** | Who does what, when, and what happens |
| 📄 | **PRD** | The spec a team could build from — shaped differently for a product vs a feature |
| 🗂️ | **Product backlog** | Epics and stories with acceptance criteria, in priority order |
| 💷 | **Business case** | Costs, value drivers, assumptions and a recommendation |

Take all four if you want. **Generating a document never re-runs the research** — they all come
from the same findings. Every document downloads as Markdown.

**5. Then keep going.** The discovery doesn't end when the documents appear. One box at the bottom
takes whatever you want to say, and works out what you meant:

| You type | What happens |
| --- | --- |
| "Why do you think the spreadsheet is the real competitor?" | Answers from the research, naming the lens it came from — or says the research doesn't cover it and which lens would |
| "Look into the compliance angle" | Runs that lens, folds it into the findings, updates the summary |
| "Give me the backlog" | Writes it from the research already gathered |
| "The PRD is too vague — add acceptance criteria" | Rewrites that document with the change applied, keeping everything you didn't complain about. Versioned, so you can see what changed |
| "Support logged 1,200 calls about this last quarter" | Keeps it, and uses it in everything written from then on |

You never pick which kind of thing you're doing — the chips above the box are just prefilled
messages, so there's one path through the whole app.

## Two things that keep it honest

**Nothing is invented.** No made-up market sizes, competitor features, prices or ROI percentages.
Where the research can't establish something, it says so and tells you what would settle it. The
business case in particular will tell you what the numbers would have to be rather than making them
up — an invented business case is worse than none.

**Everything is graded.** Each finding carries High / Medium / Low confidence and a "based on" line.
A Low-confidence finding that says "this is a general pattern, not evidence about your idea" is more
useful than a confident one that isn't true.

## Add what you know

The research doesn't have your support ticket volumes or your customer quotes. Just tell it — say
"support logged 1,200 calls about this last quarter" and it keeps that, and uses it in everything
written from then on. Ask it to research a lens again and it folds your context into the findings too.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Works with **no API key** in demo mode: you'll see the real flow, but the findings are clearly
labelled illustrative patterns rather than research into your idea, and documents come back as an
outline with your research slotted into it. For real research:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL (default claude-sonnet-5)
# optional: ANTHROPIC_WORKSPACE_ID  — only for an org-level key
```

`GET /api/health` makes a real call to Claude and tells you whether the live path actually works —
the badge only checks that a key exists.

## How it's built

```
app/
  page.tsx                              The box
  d/[id]/page.tsx                       Findings + the four document buttons
  components/Shell.tsx                  Sidebar
  components/Doc.tsx                    Document rendering + Markdown download
  api/
    meta/route.ts                       Lenses, documents, live-or-demo
    discovery/route.ts                  POST: read the idea, run every lens, summarize — one call
    discovery/[id]/route.ts             GET / PATCH (add context) / DELETE
    discovery/[id]/chat/route.ts        One message — question, research, document or revision
    health/route.ts                     Truthful live-path check

lib/
  discovery/
    types.ts        The whole model — one Discovery object
    lenses.ts       The six lenses and how each one thinks
    documents.ts    The four documents and their section outlines
    run.ts          Read the idea → run the lenses in parallel → summarize
    chat.ts         Route a message: question, research, document, revision or context
    generate.ts     Findings → a document (and revisions of one)
    store.ts
  llm/              Claude when there's a key, honest fallback when there isn't
  storage/          Postgres when DATABASE_URL is set, a JSON file otherwise
```

**Design notes**

- **One object, one call.** Hitting Discover runs everything — reading the idea, all the lenses in
  parallel, and the summary — and stores it as a single `Discovery`. There's no plan to approve and
  no stages to drive.
- **One box, one path.** Everything after that goes through `chat.ts`, including the quick chips —
  they just send prefilled messages. So there is exactly one route through the app to maintain, and
  the thread is always a complete record of what happened.
- **Documents read findings, never research.** `generate.ts` has no path to a research call, so
  "asking for a second document doesn't redo the work" is true by construction.
- **Lenses and documents are data.** Adding either is one entry in `lenses.ts` or `documents.ts`;
  the API and UI pick it up. Document headings are structured, so the same outline drives both the
  live prompt and the demo skeleton — they can't drift apart.
- **Failure is honest.** No API key, or a failed call, produces the document's real outline with
  your findings slotted in and a note saying it wasn't written — never a convincing fake.

## Reading the model's output

Everything the model returns is JSON, and the code that reads it (`lib/llm/provider.ts`) has to cope
with a response that got **cut off at the token limit** — a truncated object never balances its
braces, so a naive parser reports "no JSON found" and loses the whole lens. Instead the provider
checks `stop_reason`, retries once with real headroom, and salvages what completed: a response cut
off during its fifth finding still yields the first four. A partly-written list item is dropped
whole; a partly-written root object keeps the fields that finished. When nothing finished it fails
loudly rather than returning half an answer.

`npm test` covers that behaviour.

## Storage

`DATABASE_URL` set → Postgres (`aid_discoveries`, JSONB). Otherwise `.data/discoveries.json`.

## Changing it

- **How a lens thinks** → its `system` in `lib/discovery/lenses.ts`.
- **What's in a document** → its `outline` and `guidance` in `lib/discovery/documents.ts`.
- **Add a lens or a document** → one entry in the same files (plus its id in `types.ts`).

## Next

1. Stream findings in as each lens finishes, instead of waiting for all of them.
2. Connect real sources — Jira, Zendesk, your analytics — so bugs and behaviour run on your data.
3. Let a discovery build on an earlier one for the same product.
