# The discovery method

The product encodes a method. This is that method, and why each step exists.

---

## The chain

These are distinct objects. Collapsing them into one paragraph is the failure
this product is built to prevent.

| Object | Question it answers | Rests on |
|---|---|---|
| **Source** | What did we consult? | — |
| **Evidence** | What does the source actually say? | Source |
| **Finding** | What pattern holds *across* evidence? | Evidence |
| **Insight** | Why does that pattern matter? | Findings |
| **Implication** | What could it mean for the product? | Insights |
| **Opportunity** | Where could intervention create value? | Findings + insights |
| **Recommendation** | What action does the evidence justify? | All of the above |

A finding is not "Source X says Y". That is evidence. A finding is "six sources
across federal data, academic research and member forums show that cost
estimates are unavailable before the point of care" — a pattern, with its
sources attached.

---

## Source tiers

Sources are not equal, and treating them as equal is how unsupported strategy
gets written.

| Tier | What | Use |
|---|---|---|
| **1 — Primary / Authoritative** | Government, regulators, original datasets, trial registries, academic papers, standards bodies, company filings, official product documentation | Establish facts |
| **2 — Strong Secondary** | Major research organizations, peer-reviewed synthesis, established industry publications, reputable analysts | Support findings with limits stated |
| **3 — Market / User Evidence** | Review platforms, communities, forums, app reviews | Lived experience — the *best* source for how a problem is experienced |
| **4 — General Web** | Blogs, marketing, SEO content, opinion | Orientation, rarely support |

Tier 3 is not a downgrade. For "what do users actually experience", a forum
thread is better evidence than a market report. The point is to route the right
question to the right tier, not to prefer tier 1 for everything.

Two rules follow:

- A summary of a regulation is never tiered as the regulation.
- Vendor content about its own category is tier 4 regardless of formatting.

---

## Evidence strength

Four qualitative labels, each shown with its reasoning:

| Label | Means |
|---|---|
| **Strong** | Authoritative source, corroborated. Safe to build on. |
| **Moderate** | Credible source. Supports a finding with limits stated. |
| **Directional** | Indicative, usually lived experience. Direction, not magnitude. |
| **Anecdotal** | Single or low-authority source. A lead, not a basis. |

**Why not a score?** Averaging authority, relevance, recency, methodology,
sample and corroboration into `0.78` invents precision that does not exist. It
also hides the reasoning, which is the part a product manager actually needs in
order to argue with it. The label is shown with *why*.

**A finding is never stronger than the weakest evidence under it.** That rule is
enforced in code and tested.

---

## Knowledge state

Every substantive statement carries one:

| State | Means |
|---|---|
| **Known** | Directly supported by evidence in this project |
| **Likely** | A reasonable inference from that evidence, stated as inference |
| **Hypothesis** | Plausible but unsupported. Needs validation. |
| **Unknown** | The research did not establish this |

Saying "we don't have enough evidence" accurately is more valuable than
confident, unsupported product strategy. A PRD with eight well-evidenced
sections and fifteen honestly marked gaps is a useful document. A PRD with
twenty-three confident invented sections is a liability.

---

## Population discipline

The single most damaging error in AI-assisted research is quietly widening a
population.

> Evidence about **commercially insured US adults** is not evidence about
> **Medicaid members**.
>
> Evidence about **enterprise buyers** is not evidence about **end users**.

Every evidence item records the population the source actually described. The
extractor is instructed never to widen it, the deduplicator never merges items
whose populations differ, and the artifact critic checks every claim's
population against its evidence.

The seeded sample project demonstrates this deliberately: its finding about
cost-related care avoidance is labelled `likely` rather than `known`, with the
limitation *"Population is US adults, not Medicaid members. Do not
generalize."*

---

## Research coverage

Eight dimensions — market, customer, user, competitor, regulatory, technology,
business, data — each reported as **Not researched / Weak / Moderate / Strong**
with the evidence count and how much of it is authoritative.

**No completeness percentage.** "62% complete" would imply a methodology that
does not exist. "Customer: Weak — 4 items, 0 authoritative" tells a product
manager something they can act on.

Authority beats volume: ten general-web items are weaker coverage than two
federal datasets with corroboration. Enforced in `services/coverage.py` and
tested.

---

## Contradictions

Competing evidence is surfaced with both positions, their evidence, and an
assessment of what might explain the disagreement — different populations,
different years, different methods. Resolution defaults to `unknown` unless the
evidence genuinely settles it.

A clean, false consensus is worse than a visible disagreement. The artifact
critic treats a contradiction that vanished between synthesis and artifact as a
*blocking* issue.

---

## Persona

Persona changes the lens, never the evidence.

| Persona | Emphasis |
|---|---|
| Business Analyst | Workflows, requirements, rules, process gaps, acceptance criteria |
| Product Manager | User problems, VOC, JTBD, opportunities, prioritization, metrics |
| Senior PM | Strategy, competing opportunities, roadmap, investment trade-offs |
| Director / VP | Market change, positioning, portfolio, economics, strategic bets |
| UX / Research | Behaviours, unmet needs, journeys, qualitative evidence, gaps |
| Technical PM | Feasibility, APIs, standards, constraints, integration, build vs buy |

The same research supports every lens. Persona changes which findings lead and
what implications are drawn — it never suppresses a finding because it is
inconvenient for that persona.

---

## Validation plans must be able to disconfirm

Every opportunity carries a validation plan, and the prompt requires it to be
capable of *disconfirming* the hypothesis. A plan that can only confirm it is
not a validation plan — it is a plan to feel better about a decision already
made.

Similarly, every recommendation states `what_would_change_it` as a concrete,
observable condition. "New information" is not an answer. "If member interviews
show cost is not a factor in deferring care" is.

---

## Quality control

The artifact critic runs on every generated version, adversarially, assuming
overstatement exists:

1. Did we answer the original research question?
2. Is every substantive statement supported?
3. Are conclusions stronger than the evidence allows?
4. Were populations generalized?
5. Are older sources presented as current?
6. Were contradictory findings hidden?
7. Were assumptions presented as facts?
8. Do all citations resolve?
9. Is anything duplicated?
10. What is still unknown, and does the artifact say so?

Blocking issues are corrected before a human sees the artifact, and the
critique is stored on the version so the corrections are visible rather than
silent.
