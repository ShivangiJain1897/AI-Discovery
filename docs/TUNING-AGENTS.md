# Tuning your agents

A practical guide to shaping how the discovery agents behave.

> **First, a clarification on "fine-tuning."** This app does **not** retrain or
> fine-tune a model. It steers Claude with **prompts and structured
> definitions**. So "tuning an agent" means editing three things: the **persona**
> it reasons with (its system prompt), the **questions** it asks (its intake),
> and — in demo mode — the **findings** it produces. No ML, no training data, no
> GPUs. You edit a file, save, and refresh.

There are two runtime modes, and they tune differently:

| Mode | When | What drives the output |
|---|---|---|
| **Demo** | no `ANTHROPIC_API_KEY` set | deterministic generators in code (you edit the text directly) |
| **Live** | `ANTHROPIC_API_KEY` set | Claude, steered by each agent's **system prompt** + intake |

Tune the **system prompts** for live mode; tune the **demo banks** for the
offline experience. Most teams tune both so the app is consistent either way.

---

## The one file that matters: `lib/workflow/agents.ts`

Every agent is one entry in the `AGENTS` array. Anatomy:

```ts
{
  id: "user_research",              // stable key — don't rename casually
  name: "User Research",            // shown in the UI
  icon: "🧑‍🔬",                     // shown in the UI
  blurb: "Understands the user …",  // one-line description on the picker
  system:                           // ← the PERSONA used in LIVE mode
    "You are a senior user researcher. You deeply understand users: their " +
    "segments, jobs-to-be-done, needs, pains, and behaviors. You are " +
    "evidence-seeking and avoid unfounded claims.",
  questions: [                      // ← the INTAKE form this agent needs
    { id: "users",   question: "Who are the primary users / personas?", required: true },
    { id: "context", question: "What's the domain / context they operate in?", required: true },
    { id: "job",     question: "What outcome or job are they trying to accomplish?", required: true },
    { id: "known_pains", question: "What do we already know about their pain points?", required: false },
  ],
},
```

That's the whole contract. Change these fields and the agent changes everywhere —
the picker, the intake drawer, the live prompt.

---

## Recipe 1 — Change what an agent *asks* (intake questions)

Edit the agent's `questions` array. Each question is:

```ts
{ id: "signals", question: "What telemetry or ticket data do we have?", required: true }
```

- `id` — a short stable key (used to store the answer). Lowercase, no spaces.
- `question` — the exact prompt the user sees in the intake drawer.
- `required: true` — shows the red `*`, counts toward the drawer's progress bar,
  and becomes an **Open Question** in the PRD if left blank.

Add, remove, reorder, or reword freely. This works in **both** modes.

> Tip: the first field whose `id` or question mentions *context / domain /
> market / jurisdiction* is what the demo auto-fills from the input (see Recipe 4).

---

## Recipe 2 — Change how an agent *thinks* (live mode)

Edit the agent's `system` string. This is the persona Claude adopts when it
extracts intake and produces findings. Be specific about role, lens, and
standards. Examples of useful additions:

- **Sharper role:** "You are a B2B SaaS onboarding specialist…"
- **A rubric:** "For every finding, state the user impact and your confidence."
- **Guardrails:** "Never invent metrics. Flag anything you're inferring."
- **Domain:** "You work in US healthcare payer; assume HIPAA applies to member data."

Only affects **live** mode (needs an API key). The exact JSON the agent must
return is appended automatically — you only write the persona.

---

## Recipe 3 — Change the demo *findings* (offline mode)

In `agents.ts`, `demoRun()` holds a `bank` keyed by agent id. Each agent has a
`summary` and a list of `[title, detail]` findings:

```ts
user_research: {
  summary: `Provisional user insights for the described ${ctx} experience …`,
  f: [
    ["Primary job is to get it done without help", `The ${ctx} wants to complete the task self-service; …`],
    ["Trust and clarity drive satisfaction", "Confusing language and opaque status erode trust quickly."],
    // add / edit / remove rows here
  ],
},
```

Edit these strings to change what shows in demo mode. `ctx` is `"member"` in a
healthcare context, else `"user"` (see Recipe 4).

---

## Recipe 4 — Change auto-capture & domain detection

- **What the demo pre-fills** from the input: `demoExtract()` in `agents.ts`.
  Today it fills any "context/domain/market/jurisdiction" field with the detected
  domain, sets `data_types` to PHI in healthcare, and echoes a clip of the input
  into "product/process" fields. Adjust the rules there.
- **How the domain is detected:** `detectDomain()` in `agents.ts` — keyword
  regex that returns a label + a `health` flag. Add industries or keywords:

```ts
if (/logistics|freight|warehouse|supply chain/.test(t))
  return { label: "Logistics / supply chain", health: false };
```

The `health` flag drives HIPAA/CMS framing in the Regulatory agent and the
"member" vs "user" wording throughout.

---

## Recipe 5 — Tune which agents get *suggested*

`lib/workflow/orchestrator.ts` → `suggestAgents()` decides the default
selection on the entry screen. It always includes User Research, Market, and
Business Priority, then adds others by keyword:

```ts
if (/process|workflow|handoff|manual|operation|intake|approval|queue/.test(t))
  set.add("process_mining");
if (/payer|member|health|insur|claim|medicare|patient|clinical|pharmacy|bank|payment|pii|phi|regulat|complian/.test(t))
  set.add("regulatory");
```

Change the always-on set or the keyword triggers here. (The user can still
toggle any agent on the entry screen — this only sets the default.)

Input-type detection lives in the same file (`classifyInput` / `demoClassify`)
if you want to tune how problem/idea/solution/requirement/transcript is guessed.

---

## Recipe 6 — Tune the business-context foundation

The "Business context" step (industry, process, objective, origin,
stakeholders) is defined in `orchestrator.ts` → `CONTEXT_QUESTIONS`, extracted
by `extractContext()` (live) / `demoContext()` (offline). Add or reword the
foundation questions there; they show for **every** discovery and head every PRD.

---

## Recipe 7 — Tune the generated deliverables

`lib/workflow/generate.ts` controls the Analysis, Feature PRD, Product PRD, and
Backlog:

- **Live output:** the `live()` function has one `ask` string per deliverable —
  edit the section lists and instructions there.
- **Demo output:** `demo()`, `demoAnalysis()`, and the helpers (`metricsFor`,
  `openQuestions`, …) build the offline documents. Edit those to change section
  structure or wording.

Only findings the user didn't mark off-base, plus their notes and the business
context, feed generation — see `validatedContext()`.

---

## Recipe 8 — Add a brand-new agent

Four edits:

1. **`lib/workflow/types.ts`** — add the id to the `AgentId` union:
   ```ts
   export type AgentId = "user_research" | … | "pricing";
   ```
2. **`lib/workflow/agents.ts`** — add its entry to `AGENTS` (name, icon, blurb,
   system, questions), and add a `pricing: { summary, f: [...] }` block to the
   `demoRun` bank.
3. **`lib/workflow/orchestrator.ts`** — optionally add it to `suggestAgents`.
4. **`app/w/[id]/page.tsx`** — add it to the `META` map (name, icon, `why`
   sentence for the intake drawer). The entry screen reads agents from the API,
   so it picks the new one up automatically.

That's it — intake extraction, running, findings, and generation all flow
through the same code and will include the new agent.

---

## Recipe 9 — Go live & pick a model

Tuning system prompts only takes effect in **live** mode:

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY=sk-ant-...
# optional: ANTHROPIC_MODEL=claude-sonnet-5   (the default)
```

Restart `npm run dev` after changing env vars. The badge flips to **Live ·
Claude**. Model selection lives in `lib/llm/anthropic.ts`.

---

## The tuning loop

1. Edit the file (agents / orchestrator / generate).
2. Save — `npm run dev` hot-reloads.
3. Click **＋ New discovery** and run a fresh one (old discoveries keep their
   already-generated content).
4. For a fast backend-only check without the UI:

   ```bash
   curl -s -X POST http://localhost:3000/api/workflow \
     -H "Content-Type: application/json" \
     -d '{"input":"your test input","inputType":"auto","agentIds":["user_research"]}'
   ```

## Cheat sheet — where everything lives

| Want to tune… | File | What to edit |
|---|---|---|
| Agent name / icon / blurb | `lib/workflow/agents.ts` | `AGENTS[].name/icon/blurb` |
| Intake questions | `lib/workflow/agents.ts` | `AGENTS[].questions` |
| Agent persona (live) | `lib/workflow/agents.ts` | `AGENTS[].system` |
| Demo findings | `lib/workflow/agents.ts` | `demoRun()` bank |
| Auto-capture / domain | `lib/workflow/agents.ts` | `demoExtract()`, `detectDomain()` |
| Which agents are suggested | `lib/workflow/orchestrator.ts` | `suggestAgents()` |
| Input-type detection | `lib/workflow/orchestrator.ts` | `classifyInput()` / `demoClassify()` |
| Business-context questions | `lib/workflow/orchestrator.ts` | `CONTEXT_QUESTIONS` |
| Generated deliverables | `lib/workflow/generate.ts` | `live()` asks, `demo()` / `demoAnalysis()` |
| UI labels for a new agent | `app/w/[id]/page.tsx` | `META` map |
| Model / live vs demo | `lib/llm/anthropic.ts`, `.env.local` | `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY` |
