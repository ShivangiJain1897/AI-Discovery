# Tuning the orchestrator

Everything the orchestrator can do lives in four catalog files plus one shared prompt. Adding or
changing a capability, a method or an output is a data edit — the planner, the API and the UI all
read from the catalogs, so nothing else needs to change.

```
lib/orchestrator/
  universal.ts             The evidence discipline EVERY prompt inherits
  catalog/research.ts      Layer 1 — the 11 research capabilities
  catalog/analysis.ts      Layer 2 — 67 methods in 16 families
  catalog/outputs.ts       Layer 4 — 55 outputs in 15 families
  catalog/depth.ts         Depth modes and audiences
```

---

## Raise the bar for everything at once

`lib/orchestrator/universal.ts` holds two prompts:

- `EVIDENCE_DISCIPLINE` — prepended to every specialist, the synthesizer, the analyst, the decider
  and every generator. This is where fact/inference/assumption/gap/contradiction, the strength
  scale, the no-fabrication rule, the triangulation rule and the banned-generic-phrases list live.
- `GENERATOR_DISCIPLINE` — extra framing for anything producing a finished document.

Edit these to change the standard the whole app is held to. A change here is felt everywhere, so
prefer it over patching an individual prompt when the problem is systemic (e.g. output feels
generic, or claims are drifting past their evidence).

---

## Tune a research lens

`lib/orchestrator/catalog/research.ts`. Each capability owns:

| Field | Effect |
| --- | --- |
| `system` | The persona and method rules. **This is where the quality of the lens lives.** |
| `investigates` | Shown to the PM; also the demo-mode gap list. |
| `sources` | Shown to the PM so they know what evidence to supply. |
| `research: true` | Runs live web search before answering (see `researchQuery` in `research.ts`). |
| `triggers` | Regex that makes this lens likely relevant in demo/fallback planning. |

**Writing a good `system`.** The pattern that works: state the lens, list what it investigates, then
give *method rules that are falsifiable*. Compare:

- Weak: "Be specific and avoid generic statements."
- Strong: "CLUSTER similar issues rather than listing them. Classify each cluster as exactly one of:
  isolated defect, systemic defect, usability problem, missing functionality, process problem, data
  problem, or training problem. Misclassifying a usability problem as a bug sends the team to the
  wrong fix."

The second constrains the output shape and explains the cost of getting it wrong. Every lens in the
catalog is written that way; match it.

**Adding a lens.** Add the id to `ResearchId` in `types.ts`, then append the entry. The planner, the
`/api/catalog` route, the plan-card picker and the session page pick it up automatically.

---

## Tune an analysis method

`lib/orchestrator/catalog/analysis.ts`.

- `evidenceNeeded` is not decoration — the planner reads it when recommending, and the analysis
  prompt tells the model to say so and produce only what the method can honestly yield when that
  evidence is absent. Be strict here: it is what stops the app producing a confident RICE table
  built on invented reach numbers.
- `ask` is the exact section and table spec. Where it's absent the family's `defaultAsk` applies —
  so the long tail of methods stays usable without 67 bespoke templates.

Write `ask` as an explicit list of sections and table headers. The best ones also encode the trap
the method usually falls into, e.g. the SWOT entry ends with: *"A SWOT that stops at four lists has
done no work — the TOWS section is the point."*

**Adding a method.** Append to `ANALYSIS_METHODS` with an existing `familyId`, or add a family to
`METHOD_FAMILIES` first.

---

## Tune an output

`lib/orchestrator/catalog/outputs.ts`.

- `needs` (`evidence` / `synthesis` / `decision`) drives the readiness note injected at generation
  time — an artifact requested before its prerequisite exists is still produced, but the document
  says what it is missing instead of pretending.
- `ask` works the same as for methods.

**Adding an output.** Append to `OUTPUTS` with an existing `familyId`. It appears in the plan card
picker and in the Generate dropdown immediately.

---

## Depth and audience

`lib/orchestrator/catalog/depth.ts`. Each depth carries a `directive` (injected into every
generation prompt), a token `budget`, and a `findings` range that controls how much each research
stream returns. Each audience carries a `directive` only.

Depth is about rigour, not length — the `deep` directive says so explicitly, because otherwise
models pad.

---

## Tune the planner

`lib/orchestrator/plan.ts`.

- `PLANNER_SYSTEM` — the rules for what package to recommend and when to ask a clarifying question.
  Tighten here if the plan over-recommends (it should pick what the *question* needs, not everything
  available) or asks too many questions (zero or one is normal).
- `heuristicPlan()` — the deterministic fallback used in demo mode and whenever the live plan call
  fails. It follows the same rules with keywords. Worth updating when you add a lens or a method so
  the offline path stays sensible.

---

## Check the live path

The **Live · Claude** badge only proves a key exists. `GET /api/health` makes a real call and tells
you whether it actually works — use it before concluding a prompt change did nothing.

## Iterating

1. Change one prompt at a time.
2. Re-run the same question and diff the output.
3. Watch specifically for: invented numbers, generic sentences that would survive a find-and-replace
   of the product name, and confidence that outruns the evidence. Those three are the failure modes
   worth optimising against; everything else is style.
