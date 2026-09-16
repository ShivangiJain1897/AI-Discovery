# Prompt Library

Thirty-one version-controlled prompt templates, one per orchestration stage.

The product is deliberately **not** one enormous prompt. Each file here owns a
single stage, declares its inputs, names the schema it must return, and states
the guardrails it is held to. `app/prompts/loader.py` reads these files,
prepends `_universal.yaml`, and binds the named schema from
`app/domain/contracts.py` — so the contract in the prompt and the contract in
code cannot drift apart.

## Anatomy

```yaml
key:            stable identifier used in code
name:           human-readable name
stage:          context | planning | retrieval | evidence | synthesis |
                analysis | recommendation | artifact | quality
version:        semantic version; bump on any instruction change
purpose:        what this stage is for
inputs:         named inputs with descriptions
output_schema:  the contract class in app/domain/contracts.py
instructions:   the prompt body
guardrails:     the rules this stage is held to
```

## Stages

| # | Prompt | Stage |
|---|--------|-------|
| — | `_universal` | shared preamble, prepended to every prompt |
| 01 | context_normalizer | context |
| 02 | clarification_agent | context |
| 03 | research_planner | planning |
| 04 | source_router | planning |
| 05 | query_generator | retrieval |
| 06 | source_evaluator | retrieval |
| 07 | evidence_extractor | evidence |
| 08 | evidence_deduplicator | evidence |
| 09 | theme_clusterer | synthesis |
| 10 | research_synthesizer | synthesis |
| 11 | gap_detector | synthesis |
| 12 | analysis_router | analysis |
| 13 | general_analysis | analysis |
| 14 | swot_analysis | analysis |
| 15 | jtbd_analysis | analysis |
| 16 | pain_point_analysis | analysis |
| 17 | competitive_analysis | analysis |
| 18 | feature_analysis | analysis |
| 19 | use_case_analysis | analysis |
| 20 | opportunity_analysis | analysis |
| 21 | workflow_analysis | analysis |
| 22 | regulatory_analysis | analysis |
| 23 | technical_analysis | analysis |
| 24 | prioritization | analysis |
| 25 | recommendation_generator | recommendation |
| 26 | prd_generator | artifact |
| 27 | business_case_generator | artifact |
| 28 | use_case_generator | artifact |
| 29 | backlog_generator | artifact |
| 30 | executive_summary_generator | artifact |
| 31 | artifact_critic | quality |

## Editing

Change instructions, bump `version`. The loader checksums each file and records
a `PromptVersion` row, so an artifact can be traced to the exact prompt text
that produced it. The Prompt Library screen renders these files read-only;
editing happens here, in git, under review.
