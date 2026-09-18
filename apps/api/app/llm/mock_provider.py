"""Deterministic provider.

This is not a stub that returns lorem ipsum. It builds schema-valid output from
the project's real data — the evidence statements actually collected, the
sources actually retrieved, the findings actually synthesized — by applying the
same structural rules the prompts ask a model to apply.

That matters for three reasons: the product is demonstrable without
credentials, the test suite can assert on pipeline behaviour rather than on
mocked return values, and a stage that mishandles its inputs fails here rather
than silently passing on canned output.

It does not attempt to be a model. It will not discover a pattern a model
would. It composes, groups and labels what it was given, and is conservative
about confidence — which is the correct behaviour when no reasoning happened.
"""

from __future__ import annotations

import hashlib
import textwrap
from typing import Any, TypeVar

from pydantic import BaseModel

from app.domain.enums import (
    AnalysisType,
    EvidenceStrength,
    EvidenceType,
    KnowledgeState,
    ResearchDepth,
    ResearchType,
    SourceTier,
    SourceType,
)
from app.llm.base import LLMProvider, LLMResult

T = TypeVar("T", bound=BaseModel)

_NOTE = "Generated without a model provider. Set ANTHROPIC_API_KEY for full synthesis."


def _seed(value: Any) -> int:
    return int(hashlib.sha256(str(value).encode()).hexdigest()[:8], 16)


def _pick(options: list, key: Any):
    return options[_seed(key) % len(options)] if options else None


def _sentence(text: str, limit: int = 220) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else textwrap.shorten(text, limit, placeholder=" …")


class MockProvider(LLMProvider):
    name = "mock"

    def complete_structured(
        self,
        *,
        system: str,
        user: str,
        schema: type[T],
        max_tokens: int | None = None,
        fast: bool = False,
        context: dict | None = None,
    ) -> tuple[T, LLMResult]:
        del system, max_tokens, fast
        ctx = context or {}
        builder = getattr(self, f"_build_{schema.__name__}", None)
        payload = builder(ctx, user) if builder else self._build_default(schema, ctx)
        result = LLMResult(
            data=payload,
            provider=self.name,
            model="deterministic",
            warnings=[_NOTE],
        )
        return schema.model_validate(payload), result

    def complete_text(self, *, system: str, user: str, max_tokens: int | None = None) -> str:
        del system, max_tokens
        return (
            "No model provider is configured, so this answer is assembled from stored "
            "project evidence rather than synthesized.\n\n"
            f"Question: {_sentence(user, 400)}"
        )

    # ── generic fallback ─────────────────────────────────────

    def _build_default(self, schema: type[BaseModel], ctx: dict) -> dict:
        """Fill required fields from their declared types.

        Used only for contracts without a dedicated builder, so a new stage
        still round-trips instead of raising.
        """
        out: dict = {}
        for name, field in schema.model_fields.items():
            if not field.is_required():
                continue
            annotation = str(field.annotation)
            if "list" in annotation:
                out[name] = []
            elif "dict" in annotation:
                out[name] = {}
            elif "int" in annotation:
                out[name] = 0
            elif "float" in annotation:
                out[name] = 0.0
            elif "bool" in annotation:
                out[name] = True
            else:
                out[name] = ctx.get(name) or _NOTE
        return out

    # ── context ──────────────────────────────────────────────

    def _build_NormalizedContext(self, ctx: dict, user: str) -> dict:
        question = ctx.get("question") or user
        lowered = question.lower()
        domain, subdomain = self._infer_domain(lowered)
        geography = "United States" if any(
            t in lowered for t in ("medicaid", "medicare", "cms", "hipaa", "fda", "us ")
        ) else None
        return {
            "objective": _sentence(question, 400),
            "decision": "Not stated by the user; confirm before research begins.",
            "domain": domain,
            "subdomain": subdomain,
            "product_type": "Digital product" if "app" in lowered or "experience" in lowered else None,
            "primary_user": self._infer_user(lowered),
            "secondary_users": [],
            "geography": geography,
            "organization_context": None,
            "discovery_stage": "Problem / opportunity discovery",
            "constraints": [],
            "assumptions": [
                {
                    "field": "domain",
                    "value": domain,
                    "rationale": "Inferred from terms in the question.",
                    "confidence": KnowledgeState.LIKELY.value,
                },
                {
                    "field": "discovery_stage",
                    "value": "Problem / opportunity discovery",
                    "rationale": "The question asks what is true, not which option to pick.",
                    "confidence": KnowledgeState.LIKELY.value,
                },
            ],
        }

    @staticmethod
    def _infer_domain(lowered: str) -> tuple[str, str | None]:
        table = [
            (("medicaid",), "Healthcare", "Payer / Medicaid"),
            (("medicare",), "Healthcare", "Payer / Medicare"),
            (("payer", "health plan", "insurance"), "Healthcare", "Payer"),
            (("provider", "hospital", "clinic"), "Healthcare", "Provider"),
            (("clinical", "trial", "car-t", "therapy", "drug"), "Life Sciences", "Clinical"),
            (("bank", "lending", "payments", "fintech"), "Financial Services", None),
            (("api", "sdk", "platform", "infrastructure"), "Technology", "Developer platform"),
            (("retail", "ecommerce", "commerce"), "Retail", None),
        ]
        for terms, domain, sub in table:
            if any(t in lowered for t in terms):
                return domain, sub
        return "Not established", None

    @staticmethod
    def _infer_user(lowered: str) -> str | None:
        for term, user in (
            ("medicaid", "Medicaid member"),
            ("member", "Plan member"),
            ("patient", "Patient"),
            ("developer", "Developer"),
            ("customer", "Customer"),
            ("clinician", "Clinician"),
        ):
            if term in lowered:
                return user
        return None

    def _build_ClarificationSet(self, ctx: dict, user: str) -> dict:
        nc = ctx.get("normalized_context") or {}
        questions = []
        if not nc.get("geography"):
            questions.append(
                {
                    "question": "Which market or geography should this research cover?",
                    "why_it_matters": (
                        "Regulation, market structure and available data differ by market, "
                        "which changes both the sources consulted and the findings."
                    ),
                    "suggested_default": "United States",
                }
            )
        if not nc.get("decision") or "Not stated" in str(nc.get("decision")):
            questions.append(
                {
                    "question": "What decision should this research inform?",
                    "why_it_matters": (
                        "Problem discovery and build-vs-buy need different research types "
                        "and different sources."
                    ),
                    "suggested_default": "Whether a problem worth solving exists",
                }
            )
        return {"questions": questions[:3], "proceed_without_answers": True}

    # ── planning ─────────────────────────────────────────────

    def _build_ResearchPlanContract(self, ctx: dict, user: str) -> dict:
        nc = ctx.get("normalized_context") or {}
        depth = ctx.get("depth") or ResearchDepth.STANDARD.value
        objective = nc.get("objective") or _sentence(user, 300)
        subject = nc.get("primary_user") or nc.get("domain") or "the target user"
        domain = (nc.get("domain") or "").lower()

        specs = [
            (
                f"What problem do {subject}s actually experience, and how often?",
                [ResearchType.PROBLEM_DOMAIN, ResearchType.VOICE_OF_CUSTOMER],
                "Establishes whether an evidenced problem exists before any solution work.",
                "First-hand accounts and measured incidence, with the population stated.",
            ),
            (
                "How is this problem solved today, and where do current approaches fall short?",
                [ResearchType.COMPETITIVE, ResearchType.SOLUTION_VENDOR],
                "Existing workarounds bound what a new solution must beat.",
                "Named solutions, their capabilities, and user-reported shortfalls.",
            ),
            (
                "What does the market and its structure look like?",
                [ResearchType.MARKET],
                "Sizes the opportunity and identifies demand drivers and barriers.",
                "Published market structure, segments and adoption data.",
            ),
            (
                "What behaviours and unmet needs do users show?",
                [ResearchType.USER],
                "Separates what users say they want from what they do.",
                "Behavioural research, journey evidence and usability findings.",
            ),
        ]
        if any(t in domain for t in ("healthcare", "life sciences", "financial")):
            specs.append(
                (
                    "What regulation applies, and what does it require of the product?",
                    [ResearchType.REGULATORY],
                    "In a regulated domain, requirements bound the solution space.",
                    "The regulation and the regulator's own guidance, not commentary.",
                )
            )
        specs.append(
            (
                "What data and technology would a solution require?",
                [ResearchType.DATA, ResearchType.TECHNOLOGY],
                "Determines whether the needed data exists at the required freshness.",
                "Documented APIs, datasets, coverage and refresh frequency.",
            )
        )

        limit = {"quick_scan": 3, "standard": 5, "deep": len(specs)}.get(depth, 5)
        specs = specs[:limit]

        questions = []
        for question, types, why, expected in specs:
            questions.append(
                {
                    "question": question,
                    "research_types": [t.value for t in types],
                    "why": why,
                    "expected_evidence": expected,
                    "answerable_by_secondary": ResearchType.USER not in types,
                    "queries": self._queries_for(question, types, nc),
                }
            )

        research_types = sorted({t for _, types, _, _ in specs for t in types}, key=lambda t: t.value)

        return {
            "objective": objective,
            "decision_supported": nc.get("decision") or "Whether a problem worth solving exists.",
            "depth": depth,
            "research_questions": questions,
            "research_types": [t.value for t in research_types],
            "planned_sources": self._sources_for(nc, research_types),
            "primary_research_needed": [
                {
                    "question": f"Why do {subject}s behave as they do at the moment of decision?",
                    "method": "Semi-structured interviews",
                    "participant_profile": f"8-12 {subject}s who encountered this in the last 90 days",
                    "why_secondary_is_insufficient": (
                        "Published sources describe what happens, not the reasoning behind it."
                    ),
                }
            ],
            "anticipated_gaps": [
                "Internal operational data is not available to secondary research.",
                "Willingness to pay is rarely published and usually needs primary research.",
                "Competitor roadmaps are not observable; only shipped behaviour is.",
            ],
            "out_of_scope": ["Detailed implementation design", "Vendor commercial negotiation"],
            "human_readable_plan": (
                f"Objective: {_sentence(objective, 240)}\n\n"
                f"This plan covers {len(questions)} research questions across "
                f"{len(research_types)} research types, weighted toward authoritative "
                "sources. Primary research is listed separately because the reasoning "
                "behind user behaviour is not reliably available from published sources.\n\n"
                f"{_NOTE}"
            ),
        }

    @staticmethod
    def _queries_for(question: str, types: list[ResearchType], nc: dict) -> list[dict]:
        geo = nc.get("geography") or ""
        user = nc.get("primary_user") or ""
        subject = (nc.get("subdomain") or nc.get("domain") or "").lower()
        stem = question.rstrip("?").lower()
        variants = [
            (f"{subject} {stem} {geo}".strip(), "Policy and industry framing of the question."),
            (f"{user} experience {stem}".strip(), "The words users themselves use."),
            (f"{subject} {stem} statistics data".strip(), "Quantified evidence, where published."),
        ]
        return [
            {
                "query": " ".join(q.split()),
                "research_type": types[0].value,
                "intent": intent,
                "preferred_domains": [],
                "expected_tier": SourceTier.TIER_2_STRONG_SECONDARY.value,
            }
            for q, intent in variants
            if q.strip()
        ]

    @staticmethod
    def _sources_for(nc: dict, types: list[ResearchType]) -> list[dict]:
        domain = (nc.get("domain") or "").lower()
        sub = (nc.get("subdomain") or "").lower()
        planned: list[dict] = []

        if "healthcare" in domain:
            planned += [
                ("Centers for Medicare & Medicaid Services", "https://www.cms.gov",
                 SourceType.GOVERNMENT, SourceTier.TIER_1_AUTHORITATIVE,
                 "Primary source for US federal healthcare program policy and data."),
                ("Data.Medicaid.gov", "https://data.medicaid.gov",
                 SourceType.DATASET, SourceTier.TIER_1_AUTHORITATIVE,
                 "Original Medicaid program datasets."),
                ("Agency for Healthcare Research and Quality", "https://www.ahrq.gov",
                 SourceType.GOVERNMENT, SourceTier.TIER_1_AUTHORITATIVE,
                 "Federal research on healthcare quality and cost."),
                ("PubMed", "https://pubmed.ncbi.nlm.nih.gov",
                 SourceType.ACADEMIC, SourceTier.TIER_1_AUTHORITATIVE,
                 "Peer-reviewed research on the problem domain."),
                ("KFF", "https://www.kff.org",
                 SourceType.RESEARCH_ORGANIZATION, SourceTier.TIER_2_STRONG_SECONDARY,
                 "Established health policy research and survey data."),
            ]
            if "medicaid" in sub or "medicaid" in domain:
                planned.append(
                    ("State Medicaid agency publications", None,
                     SourceType.GOVERNMENT, SourceTier.TIER_1_AUTHORITATIVE,
                     "Medicaid is administered by states; rules and experience vary by state."))
        elif "life sciences" in domain:
            planned += [
                ("ClinicalTrials.gov", "https://clinicaltrials.gov",
                 SourceType.CLINICAL_REGISTRY, SourceTier.TIER_1_AUTHORITATIVE,
                 "Registered trial designs, endpoints and status."),
                ("openFDA", "https://open.fda.gov",
                 SourceType.REGULATOR, SourceTier.TIER_1_AUTHORITATIVE,
                 "Regulatory submissions, approvals and adverse event data."),
                ("PubMed", "https://pubmed.ncbi.nlm.nih.gov",
                 SourceType.ACADEMIC, SourceTier.TIER_1_AUTHORITATIVE,
                 "Published clinical and scientific evidence."),
            ]
        elif "technology" in domain:
            planned += [
                ("Official product documentation", None,
                 SourceType.PRODUCT_DOCUMENTATION, SourceTier.TIER_1_AUTHORITATIVE,
                 "Documented capability and limits, rather than announced intent."),
                ("Standards bodies (W3C, IETF)", None,
                 SourceType.STANDARDS_BODY, SourceTier.TIER_1_AUTHORITATIVE,
                 "Protocol and interoperability requirements."),
                ("GitHub", "https://github.com",
                 SourceType.PRODUCT_DOCUMENTATION, SourceTier.TIER_2_STRONG_SECONDARY,
                 "Implementation reality, maintenance activity and open issues."),
            ]

        if ResearchType.COMPETITIVE in types or ResearchType.SOLUTION_VENDOR in types:
            planned += [
                ("Competitor product documentation and pricing pages", None,
                 SourceType.PRODUCT_DOCUMENTATION, SourceTier.TIER_1_AUTHORITATIVE,
                 "What competitors actually ship, from their own surfaces."),
                ("G2 and Capterra", "https://www.g2.com",
                 SourceType.REVIEW_PLATFORM, SourceTier.TIER_3_MARKET_USER,
                 "User-reported strengths and shortfalls of named products."),
            ]
        if ResearchType.VOICE_OF_CUSTOMER in types:
            planned += [
                ("App Store and Google Play reviews", None,
                 SourceType.APP_STORE, SourceTier.TIER_3_MARKET_USER,
                 "Unprompted user complaints about existing digital experiences."),
                ("Reddit and community forums", "https://www.reddit.com",
                 SourceType.COMMUNITY_FORUM, SourceTier.TIER_3_MARKET_USER,
                 "Lived experience in users' own words."),
            ]

        return [
            {
                "name": name,
                "url": url,
                "source_type": stype.value,
                "tier": tier.value,
                "why": why,
                "research_types": [t.value for t in types[:2]],
            }
            for name, url, stype, tier, why in planned
        ]

    def _build_SearchQuerySet(self, ctx: dict, user: str) -> dict:
        nc = ctx.get("normalized_context") or {}
        question = ctx.get("research_question") or user
        types = [ResearchType(t) for t in ctx.get("research_types", [])] or [ResearchType.MARKET]
        return {"queries": self._queries_for(question, types, nc)}

    def _build_PlannedSourceSet(self, ctx: dict, user: str) -> dict:
        nc = ctx.get("normalized_context") or {}
        types = [ResearchType(t) for t in ctx.get("research_types", [])] or [ResearchType.MARKET]
        return {
            "sources": self._sources_for(nc, types),
            "routing_rationale": "Routed by domain and research type against the source registry.",
        }

    # ── evidence ─────────────────────────────────────────────

    def _build_EvidenceExtraction(self, ctx: dict, user: str) -> dict:
        source = ctx.get("source") or {}
        content = source.get("raw_content") or source.get("snippet") or ""
        question = ctx.get("research_question") or ""
        if not content.strip():
            return {
                "items": [],
                "source_assessment": "No retrievable content; nothing extracted.",
                "not_relevant": True,
            }

        tier = source.get("tier") or SourceTier.TIER_4_GENERAL_WEB.value
        etype = {
            SourceTier.TIER_1_AUTHORITATIVE.value: EvidenceType.FACT,
            SourceTier.TIER_2_STRONG_SECONDARY.value: EvidenceType.CLAIM,
            SourceTier.TIER_3_MARKET_USER.value: EvidenceType.USER_FEEDBACK,
            SourceTier.TIER_4_GENERAL_WEB.value: EvidenceType.CLAIM,
        }.get(tier, EvidenceType.CLAIM)

        sentences = [
            s.strip() for s in content.replace("\n", " ").split(". ") if len(s.strip()) > 60
        ][:6]
        items = []
        for sentence in sentences:
            items.append(
                {
                    "statement": _sentence(sentence, 300),
                    "evidence_type": etype.value,
                    "excerpt": _sentence(sentence, 500),
                    "population": source.get("population"),
                    "geography": source.get("geography"),
                    "period": None,
                    "theme_candidates": [],
                    "relevance": f"Retrieved for: {_sentence(question, 160)}",
                    "limitations": [
                        "Extracted without model-based reading; statement scope not verified."
                    ],
                    "quantities": [],
                }
            )
        return {
            "items": items,
            "source_assessment": (
                f"{source.get('publisher') or 'Source'} at tier {tier}. "
                "Extracted structurally rather than by reading."
            ),
            "not_relevant": not items,
        }

    def _build_EvidenceCritiqueSet(self, ctx: dict, user: str) -> dict:
        items = ctx.get("evidence_items") or []
        by_statement: dict[str, list[str]] = {}
        for item in items:
            key = " ".join(str(item.get("statement", "")).lower().split())[:80]
            by_statement.setdefault(key, []).append(item.get("ref", ""))

        critiques = []
        for item in items:
            ref = item.get("ref", "")
            tier = item.get("tier") or item.get("source_tier") or SourceTier.TIER_4_GENERAL_WEB.value
            key = " ".join(str(item.get("statement", "")).lower().split())[:80]
            siblings = [r for r in by_statement.get(key, []) if r and r != ref]
            strength = {
                SourceTier.TIER_1_AUTHORITATIVE.value: EvidenceStrength.STRONG,
                SourceTier.TIER_2_STRONG_SECONDARY.value: EvidenceStrength.MODERATE,
                SourceTier.TIER_3_MARKET_USER.value: EvidenceStrength.DIRECTIONAL,
                SourceTier.TIER_4_GENERAL_WEB.value: EvidenceStrength.ANECDOTAL,
            }.get(tier, EvidenceStrength.ANECDOTAL)
            if siblings and strength is not EvidenceStrength.STRONG:
                strength = EvidenceStrength.MODERATE
            critiques.append(
                {
                    "evidence_ref": ref,
                    "strength": strength.value,
                    "reasoning": (
                        f"{SourceTier(tier).label} source"
                        + (f", corroborated by {len(siblings)} other item(s)" if siblings else
                           ", no corroborating source in this library")
                        + "."
                    ),
                    "authority_note": SourceTier(tier).label,
                    "recency_note": None,
                    "population_note": None,
                    "corroborated_by": siblings,
                    "contradicted_by": [],
                    "should_discard": False,
                    "discard_reason": None,
                }
            )
        return {"critiques": critiques}

    # ── synthesis ────────────────────────────────────────────

    def _build_ThemeSet(self, ctx: dict, user: str) -> dict:
        items = ctx.get("evidence_items") or []
        buckets: dict[str, list[str]] = {}
        for item in items:
            label = (item.get("theme_candidates") or [None])[0] or item.get(
                "research_type", "general"
            )
            buckets.setdefault(str(label).replace("_", " ").title(), []).append(item.get("ref", ""))

        themes = [
            {
                "name": name,
                "description": f"Evidence grouped under {name.lower()}.",
                "evidence_refs": [r for r in refs if r],
                "prevalence": f"Appears in {len(refs)} evidence item(s).",
            }
            for name, refs in sorted(buckets.items())
            if len([r for r in refs if r]) >= 2
        ]
        singletons = [
            r for name, refs in buckets.items() if len(refs) < 2 for r in refs if r
        ]
        return {"themes": themes, "unclustered_evidence_refs": singletons}

    def _build_SynthesisContract(self, ctx: dict, user: str) -> dict:
        items = ctx.get("evidence_items") or []
        themes = ctx.get("themes") or []
        plan = ctx.get("research_plan") or {}
        sources = {item.get("source_ref") for item in items if item.get("source_ref")}

        findings = []
        for index, theme in enumerate(themes, start=1):
            refs = [r for r in theme.get("evidence_refs", []) if r]
            if not refs:
                continue
            strengths = [
                EvidenceStrength(i["strength"])
                for i in items
                if i.get("ref") in refs and i.get("strength")
            ]
            confidence = self._weakest(strengths)
            findings.append(
                {
                    "title": theme.get("name", f"Theme {index}"),
                    "finding": (
                        f"{len(refs)} evidence items across the library group under "
                        f"{theme.get('name', 'this theme')}. "
                        "Structural grouping only — no cross-source pattern was inferred."
                    ),
                    "evidence_refs": refs,
                    "affected_personas": [],
                    "themes": [theme.get("name", "")],
                    "prevalence": theme.get("prevalence"),
                    "why_it_matters": "Requires a model provider to establish significance.",
                    "confidence": confidence.value,
                    "knowledge_state": KnowledgeState.LIKELY.value,
                    "limitations": [_NOTE],
                }
            )

        return {
            "executive_summary": (
                f"{len(items)} evidence items were collected from {len(sources)} sources and "
                f"grouped into {len(themes)} themes. Cross-source findings, insights and "
                f"contradictions require a model provider. {_NOTE}"
            ),
            "research_objective": plan.get("objective") or _sentence(user, 300),
            "research_approach": plan.get("human_readable_plan", "")[:1200],
            "sources_examined": len(sources),
            "themes": themes,
            "findings": findings,
            "insights": [],
            "contradictions": [],
            "evidence_gaps": [
                {
                    "gap": gap,
                    "why_it_matters": "Identified during planning as unlikely to be established.",
                    "can_secondary_research_close_it": False,
                    "suggested_approach": "Primary research or internal data.",
                }
                for gap in plan.get("anticipated_gaps", [])
            ],
            "emerging_opportunities": [],
            "primary_research_questions": [
                need.get("question", "")
                for need in plan.get("primary_research_needed", [])
                if need.get("question")
            ],
            "next_steps": [
                "Configure a model provider to synthesize cross-source findings.",
                "Review the evidence library and remove off-question items.",
            ],
        }

    @staticmethod
    def _weakest(strengths: list[EvidenceStrength]) -> EvidenceStrength:
        """A finding is never stronger than the weakest evidence under it."""
        order = [
            EvidenceStrength.ANECDOTAL,
            EvidenceStrength.DIRECTIONAL,
            EvidenceStrength.MODERATE,
            EvidenceStrength.STRONG,
        ]
        if not strengths:
            return EvidenceStrength.ANECDOTAL
        return min(strengths, key=order.index)

    def _build_EvidenceGapSet(self, ctx: dict, user: str) -> dict:
        plan = ctx.get("research_plan") or {}
        answered = {f.get("title") for f in (ctx.get("findings") or [])}
        gaps = [
            {
                "gap": f"No finding addresses: {q.get('question')}",
                "why_it_matters": q.get("why", "Planned as necessary to the decision."),
                "can_secondary_research_close_it": bool(q.get("answerable_by_secondary", True)),
                "suggested_approach": q.get("expected_evidence", "Further targeted search."),
            }
            for q in plan.get("research_questions", [])
            if q.get("question") not in answered
        ]
        return {"gaps": gaps[:8]}

    # ── analysis ─────────────────────────────────────────────

    def _build_AnalysisRouting(self, ctx: dict, user: str) -> dict:
        findings = ctx.get("findings") or []
        types_present = {
            i.get("research_type") for i in (ctx.get("evidence_items") or []) if i.get("research_type")
        }
        recommended = []
        if findings:
            recommended.append(
                {
                    "analysis_type": AnalysisType.GENERAL_SYNTHESIS.value,
                    "why": f"{len(findings)} findings are available and not yet analysed.",
                    "priority": 1,
                }
            )
        if ResearchType.VOICE_OF_CUSTOMER.value in types_present or ResearchType.USER.value in types_present:
            recommended.append(
                {
                    "analysis_type": AnalysisType.PAIN_POINT.value,
                    "why": "User and customer evidence is present and suits pain point analysis.",
                    "priority": 2,
                }
            )
        if ResearchType.COMPETITIVE.value in types_present:
            recommended.append(
                {
                    "analysis_type": AnalysisType.COMPETITIVE_GAP.value,
                    "why": "Competitor evidence was collected in this project.",
                    "priority": 2,
                }
            )
        if len(findings) >= 3:
            recommended.append(
                {
                    "analysis_type": AnalysisType.USE_CASE.value,
                    "why": "Enough findings exist to derive candidate use cases.",
                    "priority": 3,
                }
            )
        return {
            "recommended": recommended[:4],
            "reasoning": "Routed by the research types actually present in this evidence base.",
        }

    def _build_AnalysisContract(self, ctx: dict, user: str) -> dict:
        analysis_type = ctx.get("analysis_type") or AnalysisType.GENERAL_SYNTHESIS.value
        findings = ctx.get("findings") or []
        items = ctx.get("evidence_items") or []
        refs = [i.get("ref") for i in items if i.get("ref")][:40]
        label = AnalysisType(analysis_type).label

        builders = {
            AnalysisType.SWOT.value: self._swot_sections,
            AnalysisType.PAIN_POINT.value: self._pain_sections,
            AnalysisType.USE_CASE.value: self._use_case_sections,
            AnalysisType.COMPETITIVE_GAP.value: self._competitive_sections,
        }
        sections = builders.get(analysis_type, self._general_sections)(findings, items)

        return {
            "analysis_type": analysis_type,
            "title": f"{label}",
            "summary": (
                f"{label} over {len(findings)} findings and {len(items)} evidence items. "
                f"{_NOTE}"
            ),
            "sections": sections,
            "evidence_refs": refs,
            "finding_refs": [f.get("ref") for f in findings if f.get("ref")],
            "assumptions": ["Structural analysis only; no interpretation was performed."],
            "unknowns": ["Every interpretive question in this analysis remains open."],
            "confidence": EvidenceStrength.DIRECTIONAL.value,
        }

    @staticmethod
    def _general_sections(findings: list[dict], items: list[dict]) -> list[dict]:
        headings = [
            "What problem is evidenced?",
            "Who experiences it?",
            "What evidence demonstrates it?",
            "What causes or contributes to it?",
            "What are users doing today?",
            "What existing solutions exist?",
            "Where do those solutions appear insufficient?",
            "What has changed?",
            "What domain constraints exist?",
            "What product opportunities emerge?",
            "What assumptions remain?",
            "What should be validated next?",
        ]
        sections = []
        for index, heading in enumerate(headings):
            if index == 2 and findings:
                sections.append(
                    {
                        "heading": heading,
                        "body": "Findings currently in the project:",
                        "points": [f"{f.get('ref', '')} {f.get('title', '')}".strip() for f in findings],
                        "rows": [],
                        "columns": [],
                        "evidence_refs": [r for f in findings for r in f.get("evidence_refs", [])][:20],
                        "knowledge_state": KnowledgeState.KNOWN.value,
                    }
                )
            else:
                sections.append(
                    {
                        "heading": heading,
                        "body": "Not established without a model provider.",
                        "points": [],
                        "rows": [],
                        "columns": [],
                        "evidence_refs": [],
                        "knowledge_state": KnowledgeState.UNKNOWN.value,
                    }
                )
        return sections

    @staticmethod
    def _swot_sections(findings: list[dict], items: list[dict]) -> list[dict]:
        return [
            {
                "heading": heading,
                "body": "Not established without a model provider.",
                "points": [],
                "rows": [],
                "columns": [],
                "evidence_refs": [],
                "knowledge_state": KnowledgeState.UNKNOWN.value,
            }
            for heading in ("Strengths", "Weaknesses", "Opportunities", "Threats")
        ]

    @staticmethod
    def _pain_sections(findings: list[dict], items: list[dict]) -> list[dict]:
        columns = [
            "Pain point", "Affected persona", "Frequency", "Severity",
            "Evidence", "Current workaround", "Root cause", "Product implication",
        ]
        rows = [
            {
                "Pain point": _sentence(i.get("statement", ""), 160),
                "Affected persona": i.get("population") or "Not established",
                "Frequency": "Not established",
                "Severity": "Not established",
                "Evidence": i.get("ref", ""),
                "Current workaround": "Not established",
                "Root cause": "Not established",
                "Product implication": "Requires a model provider.",
            }
            for i in items
            if i.get("evidence_type") in (EvidenceType.USER_FEEDBACK.value, EvidenceType.OBSERVATION.value)
        ][:15]
        return [
            {
                "heading": "Evidenced pain points",
                "body": "Rows are user-feedback and observation evidence, unanalysed.",
                "points": [],
                "rows": rows,
                "columns": columns,
                "evidence_refs": [r["Evidence"] for r in rows],
                "knowledge_state": KnowledgeState.LIKELY.value,
            }
        ]

    @staticmethod
    def _use_case_sections(findings: list[dict], items: list[dict]) -> list[dict]:
        columns = [
            "Use case", "Persona", "Problem", "Current approach", "Desired outcome",
            "Potential capability", "Evidence strength", "User value", "Business value",
            "Complexity", "Dependencies", "Status",
        ]
        rows = [
            {
                "Use case": _sentence(f.get("title", ""), 120),
                "Persona": "Not established",
                "Problem": _sentence(f.get("finding", ""), 160),
                "Current approach": "Not established",
                "Desired outcome": "Not established",
                "Potential capability": "Not established",
                "Evidence strength": f.get("confidence", EvidenceStrength.DIRECTIONAL.value),
                "User value": "Not established",
                "Business value": "Not established",
                "Complexity": "Not established",
                "Dependencies": "Not established",
                "Status": "candidate",
            }
            for f in findings
        ]
        return [
            {
                "heading": "Use case catalog",
                "body": "One candidate per finding. Detail requires a model provider.",
                "points": [],
                "rows": rows,
                "columns": columns,
                "evidence_refs": [r for f in findings for r in f.get("evidence_refs", [])][:20],
                "knowledge_state": KnowledgeState.HYPOTHESIS.value,
            }
        ]

    @staticmethod
    def _competitive_sections(findings: list[dict], items: list[dict]) -> list[dict]:
        competitive = [
            i for i in items if i.get("research_type") == ResearchType.COMPETITIVE.value
        ]
        columns = ["Competitor", "Positioning", "Capabilities", "Pricing", "Evidence"]
        rows = [
            {
                "Competitor": i.get("source_title") or "Not established",
                "Positioning": _sentence(i.get("statement", ""), 160),
                "Capabilities": "Not established",
                "Pricing": "Not published",
                "Evidence": i.get("ref", ""),
            }
            for i in competitive
        ][:12]
        return [
            {
                "heading": "Landscape",
                "body": (
                    f"{len(competitive)} competitive evidence items."
                    if competitive
                    else "No competitive evidence in this project. Run competitive research first."
                ),
                "points": [],
                "rows": rows,
                "columns": columns if rows else [],
                "evidence_refs": [r["Evidence"] for r in rows],
                "knowledge_state": KnowledgeState.LIKELY.value if rows else KnowledgeState.UNKNOWN.value,
            }
        ]

    # ── opportunities, recommendations, use cases ────────────

    def _build_OpportunitySet(self, ctx: dict, user: str) -> dict:
        findings = ctx.get("findings") or []
        opportunities = [
            {
                "title": f.get("title", "Untitled"),
                "problem": _sentence(f.get("finding", ""), 300),
                "user": "Not established",
                "evidence_refs": f.get("evidence_refs", []),
                "finding_refs": [f.get("ref")] if f.get("ref") else [],
                "insight": f.get("why_it_matters", ""),
                "desired_outcome": "Not established without a model provider.",
                "solution_directions": [],
                "value_hypothesis": "Not established without a model provider.",
                "business_value": "Not established.",
                "confidence": f.get("confidence", EvidenceStrength.DIRECTIONAL.value),
                "assumptions": [_NOTE],
                "dependencies": [],
                "risks": [],
                "validation_plan": ["Configure a model provider, then regenerate."],
            }
            for f in findings[:6]
        ]
        return {"opportunities": opportunities}

    def _build_RecommendationSet(self, ctx: dict, user: str) -> dict:
        return {
            "recommendations": [
                {
                    "recommendation": "Configure a model provider before acting on this project.",
                    "why": (
                        "Evidence was collected and grouped, but no cross-source synthesis or "
                        "analysis was performed, so no recommendation is currently supported."
                    ),
                    "evidence_refs": [],
                    "finding_refs": [],
                    "expected_value": "Unblocks synthesis, analysis and artifact generation.",
                    "who_benefits": "The discovery team.",
                    "assumptions": ["An API key is available to the deployment."],
                    "risks": ["Acting on ungrouped evidence risks unsupported conclusions."],
                    "confidence": EvidenceStrength.STRONG.value,
                    "what_would_change_it": "A configured provider.",
                    "next_validation_step": "Set ANTHROPIC_API_KEY and re-run synthesis.",
                }
            ]
        }

    def _build_UseCaseSet(self, ctx: dict, user: str) -> dict:
        findings = ctx.get("findings") or []
        requested = int(ctx.get("count") or 0)
        use_cases = [
            {
                "title": f.get("title", "Untitled"),
                "actor": "Not established",
                "problem": _sentence(f.get("finding", ""), 300),
                "trigger": "Not established",
                "context": "Not established",
                "current_behavior": "Not established",
                "desired_outcome": "Not established",
                "proposed_capability": "Not established",
                "user_value": "Not established",
                "business_value": "Not established",
                "evidence_refs": f.get("evidence_refs", []),
                "evidence_strength": f.get("confidence", EvidenceStrength.DIRECTIONAL.value),
                "dependencies": [],
                "risks": [],
                "complexity": "unknown",
                "success_metric": "Not established",
            }
            for f in findings
        ]
        if requested:
            use_cases = use_cases[:requested]
        return {"use_cases": use_cases, "evidence_supports_count": len(findings)}

    def _build_PrioritizationContract(self, ctx: dict, user: str) -> dict:
        items = ctx.get("items") or []
        method = ctx.get("method") or "value_effort"
        weights = ctx.get("weights") or {}
        scored = []
        for index, item in enumerate(items):
            # Deterministic midpoints, explicitly flagged rather than guessed.
            scores = {k: 3.0 for k in (weights or {"value": 1.0, "effort": 1.0})}
            scored.append(
                {
                    "item_ref": item.get("ref", ""),
                    "title": item.get("title", ""),
                    "scores": scores,
                    "total": 3.0,
                    "rank": index + 1,
                    "assumptions": [
                        "Midpoint used because no evidence supports this dimension.",
                        _NOTE,
                    ],
                }
            )
        return {
            "method": method,
            "weights": weights,
            "items": scored,
            "notes": (
                "Every dimension used a flagged midpoint, so this ranking carries no "
                "information. Configure a model provider to score against evidence."
            ),
        }

    # ── artifacts ────────────────────────────────────────────

    def _build_ArtifactContract(self, ctx: dict, user: str) -> dict:
        from app.services.artifact_templates import section_headings

        artifact_type = ctx.get("artifact_type") or "prd"
        findings = ctx.get("findings") or []
        items = ctx.get("evidence_items") or []
        headings = section_headings(artifact_type)

        sections = []
        for heading in headings:
            if heading == "Evidence" and items:
                sections.append(
                    {
                        "heading": heading,
                        "body": "Evidence currently supporting this project:",
                        "points": [
                            f"[{i.get('ref')}] {_sentence(i.get('statement', ''), 200)}"
                            for i in items[:25]
                        ],
                        "rows": [],
                        "columns": [],
                        "evidence_refs": [i.get("ref") for i in items[:25] if i.get("ref")],
                        "knowledge_state": KnowledgeState.KNOWN.value,
                        "note": None,
                    }
                )
            elif heading in ("Problem Statement", "Problem") and findings:
                sections.append(
                    {
                        "heading": heading,
                        "body": "Derived from the findings currently in the project.",
                        "points": [
                            f"{f.get('title')} [{', '.join(f.get('evidence_refs', []))}]"
                            for f in findings
                        ],
                        "rows": [],
                        "columns": [],
                        "evidence_refs": [r for f in findings for r in f.get("evidence_refs", [])],
                        "knowledge_state": KnowledgeState.LIKELY.value,
                        "note": "Needs Validation",
                    }
                )
            else:
                sections.append(
                    {
                        "heading": heading,
                        "body": "",
                        "points": [],
                        "rows": [],
                        "columns": [],
                        "evidence_refs": [],
                        "knowledge_state": KnowledgeState.UNKNOWN.value,
                        "note": "Unknown",
                    }
                )

        return {
            "title": ctx.get("title") or f"{artifact_type.replace('_', ' ').title()}",
            "summary": (
                "Assembled from stored evidence without model synthesis. Sections marked "
                f"Unknown were not established by the discovery. {_NOTE}"
            ),
            "sections": sections,
            "evidence_refs": [i.get("ref") for i in items if i.get("ref")],
            "open_questions": [
                "Every section marked Unknown remains open.",
                "Configure a model provider and regenerate.",
            ],
        }

    def _build_ArtifactCritique(self, ctx: dict, user: str) -> dict:
        artifact = ctx.get("artifact") or {}
        available = {i.get("ref") for i in (ctx.get("evidence_items") or []) if i.get("ref")}
        issues = []
        broken = []

        for section in artifact.get("sections", []):
            for ref in section.get("evidence_refs", []):
                if ref not in available:
                    broken.append(ref)
                    issues.append(
                        {
                            "check": "citations_preserved",
                            "severity": "blocking",
                            "detail": f"Citation {ref} does not resolve to project evidence.",
                            "section": section.get("heading"),
                            "correction": f"Remove {ref} or restore the evidence it refers to.",
                        }
                    )
            has_claim = bool(section.get("body") or section.get("points"))
            if has_claim and not section.get("evidence_refs") and not section.get("note"):
                issues.append(
                    {
                        "check": "supported_statements",
                        "severity": "warning",
                        "detail": "Section makes statements with no evidence reference.",
                        "section": section.get("heading"),
                        "correction": "Add citations or mark the section as Assumption.",
                    }
                )

        unknown = [
            s.get("heading")
            for s in artifact.get("sections", [])
            if s.get("knowledge_state") == KnowledgeState.UNKNOWN.value
        ]
        return {
            "answered_research_question": False,
            "issues": issues,
            "unsupported_statements": [],
            "overstated_conclusions": [],
            "population_generalizations": [],
            "stale_sources": [],
            "hidden_contradictions": [],
            "assumptions_stated_as_fact": [],
            "citations_preserved": not broken,
            "duplication": [],
            "still_unknown": unknown,
            "passed": not broken,
        }

    # ── copilot ──────────────────────────────────────────────

    def _build_CopilotAnswer(self, ctx: dict, user: str) -> dict:
        items = ctx.get("evidence_items") or []
        question = ctx.get("question") or user
        terms = {w for w in str(question).lower().split() if len(w) > 4}
        matches = [
            i for i in items
            if terms & {w for w in str(i.get("statement", "")).lower().split() if len(w) > 4}
        ][:8]
        if matches:
            answer = (
                f"{len(matches)} evidence item(s) in this project mention terms from your "
                "question. They are listed below without synthesis."
            )
            state = KnowledgeState.LIKELY
        else:
            answer = "No evidence in this project matches that question."
            state = KnowledgeState.UNKNOWN
        return {
            "answer": answer,
            "evidence_refs": [i.get("ref") for i in matches if i.get("ref")],
            "knowledge_state": state.value,
            "caveats": [_NOTE],
            "suggested_actions": ["Configure a model provider for synthesized answers."],
        }
