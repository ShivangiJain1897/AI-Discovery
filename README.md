# AI Product Discovery Platform

A structured discovery workspace for product managers, business analysts,
product leaders, UX researchers and technical PMs.

It turns an ambiguous product question into decision-ready artifacts — and
keeps every conclusion traceable back to the source it came from.

```
Research Question → Research Strategy → Primary + Secondary Research → Evidence
  → Themes → Findings → Analysis → Problems / Opportunities → Use Cases
  → Recommendations → PRD / Business Case / Feature Brief / Backlog / Exec Summary
```

The differentiator is not the prose. It is:

> **Research once → preserve the evidence → analyse it many ways → generate
> multiple product outputs.**

This is not a chatbot. The fundamental object is a **Discovery Project**, not a
message.

---

## What makes it different

**Evidence before conclusions.** The system never jumps from a web search to a
recommendation. It walks `Source → Evidence → Finding → Insight → Analysis →
Recommendation`, and each of those is a distinct, persisted object that carries
references to the one beneath it. A sentence in a generated PRD can be clicked
back to the verbatim excerpt from the source that supports it.

**Research and analysis are separate.** Research answers *"what did we learn?"*.
Analysis answers *"what does this mean?"*. They are separate actions in the UI
and separate modules in the code, sharing one evidence base — which is what
makes "analyse it many ways" real rather than a slogan.

**Sources are not equal.** A four-tier authority model runs through the whole
product. A government dataset outranks a blog summarizing that dataset; a
regulation outranks an article about it. A domain-aware Source Router decides
where research actually happens, so a Medicaid policy question reaches CMS and
a member-experience question reaches Reddit — and neither substitutes for the
other.

**It knows when to say "we don't know."** Every substantive statement carries a
knowledge state: `known`, `likely`, `hypothesis`, `unknown`. A generated PRD
marks sections the discovery did not establish as **Unknown**, **Assumption** or
**Needs Validation** rather than filling them with plausible fiction. Research
coverage is reported with qualitative levels, never an invented completeness
percentage.

**Persona changes the lens, not the evidence.** A VP and a business analyst get
different emphasis, altitude and outputs from an identical evidence base.

---

## Architecture

```
AI-Discovery/
├── prompts/              31 versioned prompt templates + universal preamble
├── apps/
│   ├── api/              Python · FastAPI · SQLAlchemy · Postgres + pgvector
│   │   └── app/
│   │       ├── domain/       enums, inter-agent contracts, API schemas
│   │       ├── db/           ORM models for all 23 entities
│   │       ├── llm/          model provider abstraction (Anthropic + fallback)
│   │       ├── search/       search provider abstraction (Tavily/Brave + fallback)
│   │       ├── prompts/      prompt library loader
│   │       ├── orchestration/ the agent pipeline
│   │       ├── services/     source registry, coverage, safety, ingestion, jobs
│   │       ├── exporters/    DOCX · PDF · XLSX · CSV · Markdown · JSON
│   │       ├── routers/      HTTP API
│   │       └── seed/         sample discovery project
│   └── web/              Next.js 15 · TypeScript · custom design system
└── docs/                 architecture, data model, methodology
```

Every provider — model, search, embeddings, storage — is selected by name in
`app/config.py` and replaceable through environment variables alone.

### The orchestration pipeline

```
Project Context → Clarification → Research Planner → Source Router
  → Search / Retrieval → Evidence Extractor → Evidence Store → Evidence Critic
  → Synthesis Engine → Analysis Agents → Opportunity Engine
  → Artifact Generator → Artifact Critic → Output
```

Agents communicate through typed Pydantic contracts, not free-form
conversation. That is what preserves provenance: a `Finding` carries the
evidence ids it rests on, an `Insight` carries finding ids, a `Recommendation`
carries both. Nothing in the chain can quietly become unsourced.

The user never sees those agent names. They see four actions: **Research**,
**Analyse**, **Find opportunities**, **Generate**.

---

## Quick start

```bash
cp .env.example .env          # optionally add ANTHROPIC_API_KEY + a search key
make install                  # api venv + web dependencies
make db-up                    # Postgres 16 + pgvector via Docker
make migrate                  # create the schema
make seed                     # load the sample discovery project
make dev                      # API on :8000, web on :3000
```

Open <http://localhost:3000>.

Full instructions, including running without Docker, are in
[SETUP.md](SETUP.md). Deployment is in [DEPLOY.md](DEPLOY.md).

### Running without credentials

The platform runs with no API keys at all. Each provider falls back to a
deterministic implementation, and the UI says so plainly.

The fallback does **not** invent content. It composes what is actually stored —
real evidence statements, real sources, real refs — and reports "Not
established" everywhere a model would have had to reason. That is the correct
behaviour for a product built on evidence discipline, and it means the test
suite asserts on pipeline behaviour rather than on mocked return values.

Set `ANTHROPIC_API_KEY` and a search key to enable full discovery.

---

## The evidence model

Each evidence item is one atomic, attributable statement:

| Field | Purpose |
|---|---|
| `ref` | `E-014` — what artifacts cite and the UI renders as a clickable chip |
| `statement` | One claim. Not a summary of an article. |
| `excerpt` | Verbatim source text, never paraphrased |
| `evidence_type` | fact · claim · opinion · user_feedback · statistic · observation · **inference** |
| `population` | Exactly who the source described. Never widened. |
| `origin` | `external` or `internal` — internal never enters a public query |
| `strength` | Strong · Moderate · Directional · Anecdotal, **with its reasoning** |
| `corroborated_by` / `contradicted_by` | Independent agreement and conflict |
| `limitations` | Sample, method, funding, age |

Two choices carry most of the weight:

- **`inference` is a distinct evidence type.** Model reasoning is never stored
  as something a source said.
- **Strength is qualitative and carries its reasoning.** Averaging authority,
  recency and corroboration into `0.78` would invent precision that does not
  exist. The label is shown with *why*.

---

## What it can do

| Capability | Where |
|---|---|
| 12 research types, routed by domain, geography and question | Source Router |
| 4-tier source authority model + 46-entry source registry | `services/source_registry.py` |
| Editable research plans — remove questions, rewrite queries, add sources | Research screen |
| Per-question progress during a run, not a fake spinner | Research screen |
| Faceted evidence library with search, tier, type, strength, origin filters | Evidence screen |
| 15 analysis types with a router that recommends only supportable ones | Analysis screen |
| Opportunities with value hypotheses and *disconfirming* validation plans | Opportunities |
| 20 artifact types, each with a fixed section template | Artifacts |
| Artifact critic: catches overstatement, population drift, broken citations | Every generation |
| Artifact versioning with per-section regeneration and change summaries | Artifact detail |
| Native DOCX, PDF, XLSX, CSV, Markdown and JSON export with citations intact | Everywhere |
| Internal document ingestion (PDF/DOCX/XLSX/CSV/JSON/MD/TXT), labelled INTERNAL | Research screen |
| PII/PHI detection before any text reaches a model provider | `services/safety.py` |
| Copilot answering from project evidence only | Every project screen |

---

## Testing

```bash
make test           # backend suite + frontend typecheck and build
make test-api       # 117 backend tests
make lint
```

Tests run against real Postgres rather than an in-memory stand-in, because the
model depends on JSONB, pgvector and row-level locking that SQLite would not
exercise. They assert on the behaviours the product exists to guarantee:
strength follows authority, coverage is honest about gaps, artifacts mark what
they could not establish, and every citation in a generated document resolves.

---

## Documentation

- [SETUP.md](SETUP.md) — local setup, including without Docker
- [DEPLOY.md](DEPLOY.md) — deployment and configuration
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — services, data model, API
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md) — the discovery method the product encodes
- [prompts/README.md](prompts/README.md) — the prompt library

---

## Scope

This is **MVP 1** as specified, with parts of MVP 2 in place: file upload and
internal evidence ingestion, opportunity management, prioritization, business
cases, backlog generation and Excel export all work today.

Not built: authentication beyond the workspace abstraction, real-time
collaboration, third-party integrations, and a prompt-editing UI (prompts are
version-controlled files, edited in git under review — deliberately).

Security and privacy controls exist — PHI detection, workspace separation,
audit logging, retention configuration, redaction — but **this does not make a
deployment HIPAA compliant**, and nothing in this codebase claims it does.
