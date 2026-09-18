# Architecture

## Shape

A pragmatic modular monolith, not microservices. Two deployable units and a
database; module boundaries inside the API are drawn where a service would
eventually split, so extracting one later is a deployment change rather than a
rewrite.

```
┌──────────────┐        ┌──────────────────────────────────────┐
│  apps/web    │  HTTP  │            apps/api                  │
│  Next.js 15  │ ─────▶ │            FastAPI                   │
│  TypeScript  │        │                                      │
└──────────────┘        │  routers/       HTTP surface         │
                        │  orchestration/ the agent pipeline   │
                        │  services/      routing, coverage,   │
                        │                 safety, ingestion    │
                        │  domain/        contracts + vocab    │
                        │  llm/ search/   provider abstraction │
                        │  exporters/     native documents     │
                        │  db/            ORM                  │
                        └───────────┬──────────────────────────┘
                                    │
                        ┌───────────▼──────────┐   ┌──────────────┐
                        │ Postgres + pgvector  │   │  prompts/    │
                        └──────────────────────┘   │  31 YAML     │
                                                   └──────────────┘
```

## Layers

| Layer | Responsibility | Depends on |
|---|---|---|
| `routers/` | HTTP, validation, job enqueue | orchestration, services, db |
| `orchestration/` | The discovery method | services, llm, prompts, db |
| `services/` | Routing, coverage, safety, ingestion, jobs, refs | db, config |
| `domain/` | Vocabulary and contracts | nothing |
| `llm/`, `search/` | Provider abstraction | config |
| `exporters/` | Native document generation | domain |
| `db/` | Persistence | domain, config |

`domain/` depends on nothing, which is what lets every other layer speak the
same vocabulary without a cycle.

---

## Provider abstraction

Every external dependency is chosen by name in `config.py`:

```python
@property
def effective_llm_provider(self) -> str:
    if self.llm_provider == "anthropic" and not self.anthropic_api_key:
        return "mock"
    return self.llm_provider
```

Call sites never branch on configuration. The fallback is decided once, which
is why the product runs — and the tests pass — with no credentials at all,
without a single `if settings.has_api_key` in the pipeline.

### The deterministic provider

Not a stub. It builds schema-valid output from the project's real data by
applying the same structural rules the prompts describe: grouping evidence,
taking the *weakest* strength under a finding, marking unestablished sections
Unknown. It will not discover a pattern a model would, and it says so — every
result carries a warning and "Not established" where reasoning was required.

That makes it useful for three things: demonstrating the product without keys,
testing pipeline behaviour rather than mocked returns, and catching a stage
that mishandles its inputs at the point of failure rather than silently.

---

## Structured contracts

Stages exchange Pydantic models, not prose:

```
NormalizedContext → ResearchPlanContract → SearchQuerySet → EvidenceExtraction
  → EvidenceCritiqueSet → ThemeSet → SynthesisContract → AnalysisContract
  → OpportunitySet → ArtifactContract → ArtifactCritique
```

Each contract is also the JSON schema handed to the model provider, so the
contract in code and the contract in the prompt cannot drift apart. A prompt
that names a schema which no longer exists fails at *load*, not mid-run — the
loader resolves every `output_schema` against `domain/contracts.py` at import.

Anthropic structured output is obtained with a forced tool call: the schema
becomes a tool definition and the model must use it. On a validation failure
the provider makes exactly one repair attempt, handing the model its own output
and the specific errors.

---

## Data model

23 entities. The relationship spine mirrors the method:

```
Workspace ─▶ Project ─┬─▶ ProjectContext
                      ├─▶ ResearchPlan ──▶ ResearchQuestion
                      ├─▶ ResearchRun ───▶ Source ──▶ Evidence
                      ├─▶ Theme, Finding, Insight, Synthesis
                      ├─▶ Analysis ──▶ Opportunity ──▶ UseCase
                      │                └▶ Recommendation
                      ├─▶ Artifact ──▶ ArtifactVersion ──▶ Citation
                      ├─▶ UploadedDocument
                      └─▶ CoverageSnapshot
PromptTemplate ─▶ PromptVersion       Job       AuditLog       User
```

### Human-readable refs

Every project-scoped row carries a short ref — `E-014`, `F-003`, `O-002`.
That ref is what an artifact cites, what the UI renders as a clickable chip,
and what survives into an exported DOCX. Counters live on the project row and
are allocated under `SELECT … FOR UPDATE`, so two concurrent research runs
cannot mint the same ref.

This is the mechanism behind the whole traceability claim. A sentence in a PRD
says `[E-014]`; that chip opens the evidence; the evidence links to the source;
the exported document carries the same ref and the full reference appendix.

### Why Postgres specifically

- **JSONB** for the many small structured lists (queries, assumptions, sections)
  that would otherwise be a dozen join tables serving no query.
- **pgvector** for semantic evidence retrieval in the copilot.
- **Row-level locking** for ref allocation.
- **`pg_trgm`** for evidence search.

The tests run against real Postgres for exactly these reasons.

---

## Orchestration

```
Context Normalizer → Clarification Agent → Research Planner → Source Router
  → Query Generator → Search → Source Evaluator → Evidence Extractor
  → Evidence Deduplicator/Critic → Theme Clusterer → Synthesizer → Gap Detector
  → Analysis Router → Analysis Agents → Opportunity Engine
  → Recommendation Generator → Artifact Generator → Artifact Critic
```

`orchestration/agents.py` runs every stage identically: render a prompt from
the library, screen it for identifiers, send it to the provider, validate the
response against its contract. Because that lives in one place, PHI screening,
audit logging and provider metrics apply uniformly.

**The user sees four actions**: Research, Analyse, Find opportunities,
Generate. The 31 agents are an implementation detail, not a menu.

### Evidence critique runs across the library

Corroboration is a property of the *set*, so the critic runs over the whole
evidence library rather than per source. It distinguishes two sources
independently observing the same thing (corroboration — preserved, raises
confidence) from two sources republishing one study (duplication — collapsed to
the primary). It never merges items whose population, geography or period
differ; that is the generalization error the platform exists to prevent.

### The artifact critic is a real gate

Every generated version is reviewed before storage: unresolvable citations are
removed, sections asserting fact with no evidence are downgraded to hypothesis,
and the critique is persisted on the version so a reader can see what was
caught. `_apply_critique` in `orchestration/artifacts.py`.

---

## Source routing

`services/source_registry.py` holds 46 registered sources, each declaring its
tier, type, the domains it serves and the research types it can answer.
Routing combines domain, research type and geography — tier dominates, so an
authoritative source that matches the domain outranks a general-web source that
matches the query more closely.

Retrieved sources not in the registry are classified by host rules
(`.gov` → tier 1, review platforms → tier 3, `medium.com` → tier 4). Registry
domains are matched longest-first so `pubmed.ncbi.nlm.nih.gov` is not shadowed
by `nih.gov`.

Adding a source is a data change here, not a code change in the router.

---

## API

```
POST   /projects                              GET /projects  GET /projects/{id}
PATCH  /projects/{id}/context                 GET /projects/{id}/coverage

POST   /projects/{id}/research/plan           GET /projects/{id}/research/plan
PATCH  /projects/{id}/research/plan/{plan_id}
POST   /projects/{id}/research/run            GET /projects/{id}/research/runs
PATCH  /projects/{id}/research/questions/{qid}

GET    /projects/{id}/evidence                GET /projects/{id}/evidence/{ref}
POST   /projects/{id}/evidence/import         GET /projects/{id}/sources
GET    /projects/{id}/evidence-export

POST   /projects/{id}/synthesis               GET /projects/{id}/findings
GET    /projects/{id}/research-report

GET    /projects/{id}/analysis/recommended    POST /projects/{id}/analysis
GET    /projects/{id}/analysis/{ref}          GET  /projects/{id}/analysis/{ref}/export

POST   /projects/{id}/opportunities           GET   /projects/{id}/opportunities
PATCH  /projects/{id}/opportunities/{ref}     POST  /projects/{id}/prioritize
POST   /projects/{id}/use-cases               POST  /projects/{id}/recommendations

GET    /projects/{id}/artifacts/types         POST /projects/{id}/artifacts
GET    /projects/{id}/artifacts/{ref}         GET  /projects/{id}/artifacts/{ref}/versions
POST   /projects/{id}/artifacts/{ref}/regenerate
POST   /projects/{id}/artifacts/{ref}/export

POST   /projects/{id}/uploads                 POST /projects/{id}/copilot
GET    /prompts                               GET  /jobs/{job_id}   GET /health
```

Anything that can take more than a few seconds returns a `Job` immediately and
runs in the background. The web client polls with `waitForJob`.

---

## Exports

Artifacts, analyses, research reports and the evidence library are normalized
into one `Document` model, so a new format is written once rather than once per
artifact type.

Six renderers produce **native** documents — a real OOXML package via
python-docx, a real workbook via openpyxl, a real PDF via reportlab — not an
HTML screenshot. Headings, tables, citations, links and source metadata all
survive, including a full reference appendix with excerpt, publisher, date and
tier for every cited item.

---

## Frontend

Next.js App Router, client components against a typed API client
(`lib/api.ts`). No component library: a hand-written design system in
`app/globals.css` using CSS custom properties with light and dark themes.

Colour is semantic rather than decorative — tier, strength and knowledge state
each own a hue, so an evidence base can be judged at a glance without reading a
legend. IBM Plex Sans for the interface, Serif for document bodies, Mono for
refs.

Two structural ideas carry the UX:

**The navigation is the method.** The project sidebar renders the discovery
pipeline as a connected chain with live counts, so the state of a project and
its next step are readable from the rail.

**The chip is the product.** `EvidenceChip` renders any ref anywhere as a
clickable element that opens the evidence, its excerpt, its population, its
strength reasoning and a link to the original source. It is provided through
context, so a chip nested six components deep needs no prop drilling — which is
what makes citation-everywhere practical rather than aspirational.
