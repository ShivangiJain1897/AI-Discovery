"""The sample discovery project: Medicaid cost transparency.

This seeds a complete project — context, plan, sources, evidence, themes,
findings, insights, an analysis, opportunities and use cases — so the product
can be explored end to end without running research or holding credentials.

A note on honesty. Every evidence item below carries a SEED_NOTICE limitation
and is marked as illustrative. The sources named are real organizations with
real URLs, but the specific statements were NOT retrieved from them. Seeding
invented statistics attributed to real bodies would be precisely the failure
this product exists to prevent, so the statements are qualitative, the
`quantities` field is left empty throughout, and nothing here should be cited
as a finding about Medicaid. Run real research to get real evidence.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Analysis,
    Evidence,
    Finding,
    Insight,
    Opportunity,
    Project,
    ProjectContext,
    ResearchPlan,
    ResearchQuestion,
    Source,
    Synthesis,
    Theme,
    UseCase,
    Workspace,
)
from app.domain.enums import (
    AnalysisType,
    EvidenceOrigin,
    EvidenceStrength,
    EvidenceType,
    KnowledgeState,
    OpportunityStatus,
    Persona,
    ProjectStatus,
    ResearchDepth,
    ResearchType,
    SourceTier,
    SourceType,
)
from app.services import coverage, refs

SEED_NOTICE = (
    "Illustrative seed data — this statement was not retrieved from the cited source. "
    "Run research to collect real evidence."
)

QUESTION = (
    "We are considering improving cost transparency for Medicaid members. "
    "Research the problem and identify potential product opportunities."
)

# ── sources ──────────────────────────────────────────────────
# (title, url, publisher, type, tier, published, research_type)
SOURCES = [
    ("Medicaid program information and beneficiary resources", "https://www.medicaid.gov",
     "Centers for Medicare & Medicaid Services", SourceType.GOVERNMENT,
     SourceTier.TIER_1_AUTHORITATIVE, date(2024, 9, 1), ResearchType.REGULATORY),
    ("Medicaid enrollment and spending datasets", "https://data.medicaid.gov",
     "Centers for Medicare & Medicaid Services", SourceType.DATASET,
     SourceTier.TIER_1_AUTHORITATIVE, date(2024, 6, 15), ResearchType.DATA),
    ("Research on healthcare cost, access and patient experience", "https://www.ahrq.gov",
     "Agency for Healthcare Research and Quality", SourceType.GOVERNMENT,
     SourceTier.TIER_1_AUTHORITATIVE, date(2023, 11, 20), ResearchType.PROBLEM_DOMAIN),
    ("Health policy research and consumer survey programme", "https://www.kff.org",
     "KFF", SourceType.RESEARCH_ORGANIZATION,
     SourceTier.TIER_2_STRONG_SECONDARY, date(2024, 4, 10), ResearchType.PROBLEM_DOMAIN),
    ("Peer-reviewed literature on cost-related care avoidance",
     "https://pubmed.ncbi.nlm.nih.gov", "PubMed / NLM", SourceType.ACADEMIC,
     SourceTier.TIER_1_AUTHORITATIVE, date(2023, 7, 5), ResearchType.USER),
    ("Member discussion of coverage and billing experiences",
     "https://www.reddit.com/r/Medicaid", "Reddit", SourceType.COMMUNITY_FORUM,
     SourceTier.TIER_3_MARKET_USER, date(2024, 8, 2), ResearchType.VOICE_OF_CUSTOMER),
    ("Member app reviews for state Medicaid managed care plans",
     "https://play.google.com", "Google Play", SourceType.APP_STORE,
     SourceTier.TIER_3_MARKET_USER, date(2024, 7, 18), ResearchType.VOICE_OF_CUSTOMER),
    ("Payer member portal capability documentation", None,
     "Competitor product documentation", SourceType.PRODUCT_DOCUMENTATION,
     SourceTier.TIER_1_AUTHORITATIVE, date(2024, 5, 30), ResearchType.COMPETITIVE),
    ("FHIR patient access and provider directory specifications",
     "https://www.hl7.org/fhir/", "HL7 International", SourceType.STANDARDS_BODY,
     SourceTier.TIER_1_AUTHORITATIVE, date(2024, 1, 12), ResearchType.TECHNOLOGY),
    ("State Medicaid agency member handbook guidance", None,
     "State Medicaid agencies", SourceType.GOVERNMENT,
     SourceTier.TIER_1_AUTHORITATIVE, date(2024, 3, 22), ResearchType.REGULATORY),
]

# ── evidence ─────────────────────────────────────────────────
# (source_index, statement, evidence_type, excerpt, population, theme, relevance)
EVIDENCE = [
    (0, "Medicaid cost-sharing rules are set within federal limits but vary by state and by "
        "eligibility group, so what a member owes is not uniform across the programme.",
     EvidenceType.FACT,
     "Cost sharing in Medicaid operates within federal maximums, with states retaining "
     "discretion over amounts and exemptions by population.",
     "US Medicaid programmes", "Cost rules vary by state",
     "Establishes that a single national cost answer does not exist, which constrains any "
     "product promising one."),
    (0, "Certain groups and service categories are exempt from Medicaid cost sharing under "
        "federal rules.",
     EvidenceType.FACT,
     "Federal rules exempt specified populations and services from cost-sharing obligations.",
     "US Medicaid beneficiaries", "Cost rules vary by state",
     "Any estimate shown to a member must apply exemption logic or it will be wrong for a "
     "large share of members."),
    (1, "Programme datasets report enrollment and expenditure at aggregate level rather than "
        "at the level of what an individual member will owe for a specific service.",
     EvidenceType.OBSERVATION,
     "Published datasets are organized around programme-level enrollment and spending.",
     "US Medicaid programmes", "Data does not reach the member",
     "Directly relevant to feasibility: the authoritative public data does not answer the "
     "member's question."),
    (2, "Patients report difficulty determining what care will cost before receiving it.",
     EvidenceType.CLAIM,
     "Research on patient experience identifies advance cost information as a recurring "
     "difficulty across insurance types.",
     "US patients across insurance types", "Cost is unknowable before care",
     "Establishes the problem is not Medicaid-specific, which affects how differentiated a "
     "solution would be."),
    (2, "Where cost information is available it is often presented in benefit terminology "
        "rather than in the amount a person will be asked to pay.",
     EvidenceType.OBSERVATION,
     "Coverage documents describe benefits and cost-sharing structures rather than expected "
     "out-of-pocket amounts for a specific encounter.",
     "US insured patients", "Cost is unknowable before care",
     "Suggests the gap may be presentation, not only data availability."),
    (3, "Survey research reports that adults describe delaying or skipping care because of "
        "cost concerns.",
     EvidenceType.STATISTIC,
     "Consumer survey programmes track self-reported cost-related delays in seeking care.",
     "US adults", "Cost uncertainty changes behaviour",
     "Connects the information problem to a health outcome, which is what makes this worth "
     "investment. Note the population is US adults, not Medicaid members specifically."),
    (4, "Peer-reviewed studies associate cost-related concern with reduced care-seeking, "
        "though causal direction and magnitude vary by study design and population.",
     EvidenceType.CLAIM,
     "The literature reports associations between cost concern and care avoidance, with "
     "heterogeneity across populations and methods.",
     "Varies by study", "Cost uncertainty changes behaviour",
     "Supports the mechanism while bounding how strongly causation can be claimed."),
    (5, "Members describe receiving bills after a visit that they did not expect to receive "
        "at all, given their coverage.",
     EvidenceType.USER_FEEDBACK,
     "Forum posts recount unexpected bills following visits members believed were fully "
     "covered.",
     "Self-selected forum participants", "Unexpected bills after care",
     "First-hand account of the moment the problem is experienced. Self-selected sample."),
    (5, "Members describe calling the plan or the provider to try to establish cost in "
        "advance, and receiving inconsistent answers.",
     EvidenceType.USER_FEEDBACK,
     "Posts describe phoning both plan and provider and being given different information.",
     "Self-selected forum participants", "Members fall back on phone calls",
     "Identifies the current workaround and its failure mode — the strongest signal in a "
     "discovery of this kind."),
    (6, "App reviews for member portals frequently concern billing and coverage questions "
        "rather than the app's core features.",
     EvidenceType.USER_FEEDBACK,
     "Review text centres on billing confusion and inability to find coverage answers.",
     "App reviewers", "Unexpected bills after care",
     "Indicates existing digital products are not resolving the question."),
    (6, "Reviewers describe abandoning the portal and calling member services instead.",
     EvidenceType.USER_FEEDBACK,
     "Reviews describe giving up on the app and phoning support.",
     "App reviewers", "Members fall back on phone calls",
     "Quantifiable operational cost: every abandonment becomes a call."),
    (7, "Payer member portals commonly provide claims history and benefit summaries; "
        "prospective cost estimation for a planned service is less commonly offered.",
     EvidenceType.OBSERVATION,
     "Documented portal capability centres on retrospective claims and benefit description.",
     "Payer member portals reviewed", "Existing tools are retrospective",
     "Defines the competitive gap: the market solves 'what happened', not 'what will this "
     "cost me'."),
    (7, "Where estimation tools exist they are more commonly documented for commercial "
        "plans than for Medicaid managed care products.",
     EvidenceType.OBSERVATION,
     "Estimator capability appears in commercial product documentation more often than in "
     "Medicaid managed care documentation.",
     "Payer product documentation", "Existing tools are retrospective",
     "Suggests whitespace — but the reason for it must be established before treating it as "
     "an opportunity."),
    (8, "Interoperability standards define resources for patient access to coverage and "
        "provider directory information.",
     EvidenceType.FACT,
     "The standard specifies resources covering coverage, benefits and provider directories.",
     "Implementers of the standard", "A data path may exist",
     "Establishes a technical route to the underlying data, independent of any one vendor."),
    (8, "Standards define the exchange format; they do not guarantee that a given plan has "
        "populated the fields an estimate would require.",
     EvidenceType.OBSERVATION,
     "Specification conformance concerns structure rather than data completeness.",
     "Implementers of the standard", "A data path may exist",
     "The critical caveat: a standard is not the same as available data."),
    (9, "Member handbooks describe cost-sharing obligations in policy language and by "
        "service category.",
     EvidenceType.OBSERVATION,
     "Handbook content is organized by benefit category and stated in programme terms.",
     "State Medicaid members", "Cost is unknowable before care",
     "The information technically exists but not in a form usable at the point of decision."),
]

THEMES = [
    ("Cost is unknowable before care",
     "Members cannot establish what a service will cost them in advance, although the "
     "governing rules are published."),
    ("Unexpected bills after care",
     "The problem becomes visible to the member after the encounter, when a bill arrives."),
    ("Members fall back on phone calls",
     "The current workaround is phoning the plan or provider, and it produces inconsistent "
     "answers."),
    ("Existing tools are retrospective",
     "Member portals answer what already happened rather than what a planned service will "
     "cost."),
    ("Cost rules vary by state",
     "Cost-sharing rules and exemptions differ by state and eligibility group."),
    ("Data does not reach the member",
     "Authoritative programme data is aggregate; member-level prospective cost is not "
     "published."),
    ("A data path may exist",
     "Interoperability standards define a route to coverage data, with completeness "
     "unproven."),
    ("Cost uncertainty changes behaviour",
     "Cost concern is associated with delaying or avoiding care."),
]


def seed_project(session: Session, *, workspace_slug: str = "default") -> Project:
    """Create the sample project. Idempotent: replaces any existing copy."""
    workspace = session.execute(
        select(Workspace).where(Workspace.slug == workspace_slug)
    ).scalar_one_or_none()
    if workspace is None:
        workspace = Workspace(name="Default Workspace", slug=workspace_slug)
        session.add(workspace)
        session.flush()

    existing = session.execute(
        select(Project).where(
            Project.workspace_id == workspace.id, Project.question == QUESTION
        )
    ).scalar_one_or_none()
    if existing is not None:
        session.delete(existing)
        session.flush()

    project = Project(
        workspace_id=workspace.id,
        title="Medicaid cost transparency for members",
        question=QUESTION,
        status=ProjectStatus.ACTIVE,
        persona=Persona.PRODUCT_MANAGER,
        ref_counters={},
    )
    session.add(project)
    session.flush()

    _context(session, project)
    plan = _plan(session, project)
    sources = _sources(session, project)
    evidence_by_theme, themes = _evidence_and_themes(session, project, sources)
    _synthesis(session, project, evidence_by_theme, themes)
    _analysis(session, project, evidence_by_theme)
    _opportunities_and_use_cases(session, project, evidence_by_theme)

    report = coverage.assess(session, project.id)
    coverage.persist(session, project.id, report)

    plan.approved = True
    session.flush()
    session.refresh(project)
    return project


def _context(session: Session, project: Project) -> None:
    session.add(
        ProjectContext(
            project_id=project.id,
            objective=(
                "Understand why Medicaid members cannot establish what care will cost them "
                "before receiving it, and identify product opportunities to address it."
            ),
            decision=(
                "Whether to invest in a member-facing cost transparency experience, and if "
                "so, which problem to solve first."
            ),
            domain="Healthcare",
            subdomain="Payer / Medicaid",
            product_type="Member-facing digital experience",
            primary_user="Medicaid member",
            secondary_users=["Customer service representative", "State Medicaid agency"],
            geography="United States",
            organization_context="Medicaid managed care organization",
            discovery_stage="Problem / opportunity discovery",
            constraints=[
                "Cost-sharing rules vary by state and eligibility group.",
                "Member-level prospective cost data may not exist in usable form.",
                "Any member-facing estimate carries regulatory and trust risk if wrong.",
            ],
            assumptions=[
                {
                    "field": "geography",
                    "value": "United States",
                    "rationale": "Medicaid is a US programme.",
                    "confidence": KnowledgeState.KNOWN.value,
                },
                {
                    "field": "product_type",
                    "value": "Member-facing digital experience",
                    "rationale": "The question concerns what members can see and do.",
                    "confidence": KnowledgeState.LIKELY.value,
                },
                {
                    "field": "discovery_stage",
                    "value": "Problem / opportunity discovery",
                    "rationale": "The question asks what is true, not which option to choose.",
                    "confidence": KnowledgeState.LIKELY.value,
                },
            ],
        )
    )
    session.flush()


def _plan(session: Session, project: Project) -> ResearchPlan:
    plan = ResearchPlan(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "research_plan"),
        version=1,
        objective=(
            "Establish whether Medicaid members experience an evidenced problem determining "
            "cost before care, what causes it, and where a product could intervene."
        ),
        decision_supported="Whether to invest in a member-facing cost transparency experience.",
        depth=ResearchDepth.STANDARD,
        research_types=[
            ResearchType.PROBLEM_DOMAIN.value, ResearchType.VOICE_OF_CUSTOMER.value,
            ResearchType.USER.value, ResearchType.COMPETITIVE.value,
            ResearchType.REGULATORY.value, ResearchType.DATA.value,
            ResearchType.TECHNOLOGY.value,
        ],
        planned_sources=[
            {"name": "Centers for Medicare & Medicaid Services", "url": "https://www.cms.gov",
             "source_type": SourceType.GOVERNMENT.value,
             "tier": SourceTier.TIER_1_AUTHORITATIVE.value,
             "why": "Federal cost-sharing rules and price transparency policy."},
            {"name": "Data.Medicaid.gov", "url": "https://data.medicaid.gov",
             "source_type": SourceType.DATASET.value,
             "tier": SourceTier.TIER_1_AUTHORITATIVE.value,
             "why": "What programme data actually exists and at what grain."},
            {"name": "AHRQ", "url": "https://www.ahrq.gov",
             "source_type": SourceType.GOVERNMENT.value,
             "tier": SourceTier.TIER_1_AUTHORITATIVE.value,
             "why": "Federal research on cost and patient experience."},
            {"name": "KFF", "url": "https://www.kff.org",
             "source_type": SourceType.RESEARCH_ORGANIZATION.value,
             "tier": SourceTier.TIER_2_STRONG_SECONDARY.value,
             "why": "Consumer survey evidence on cost-related behaviour."},
            {"name": "Reddit r/Medicaid", "url": "https://www.reddit.com/r/Medicaid",
             "source_type": SourceType.COMMUNITY_FORUM.value,
             "tier": SourceTier.TIER_3_MARKET_USER.value,
             "why": "Members describing the problem in their own words."},
            {"name": "Competitor member portals", "url": None,
             "source_type": SourceType.PRODUCT_DOCUMENTATION.value,
             "tier": SourceTier.TIER_1_AUTHORITATIVE.value,
             "why": "What the market actually ships today."},
            {"name": "HL7 FHIR", "url": "https://www.hl7.org/fhir/",
             "source_type": SourceType.STANDARDS_BODY.value,
             "tier": SourceTier.TIER_1_AUTHORITATIVE.value,
             "why": "Whether a standards-based data path to coverage data exists."},
        ],
        primary_research_needed=[
            {
                "question": "What do members do at the moment they decide whether to seek care?",
                "method": "Semi-structured interviews",
                "participant_profile": "10-12 Medicaid members who sought care in the last 90 days",
                "why_secondary_is_insufficient":
                    "Published sources describe outcomes, not the reasoning at the decision point.",
            },
            {
                "question": "What do members actually ask when they call member services?",
                "method": "Call transcript analysis",
                "participant_profile": "Internal contact centre records",
                "why_secondary_is_insufficient":
                    "This is internal operational data and is not publicly available.",
            },
        ],
        anticipated_gaps=[
            "Member-level prospective cost data is unlikely to be publicly available.",
            "Contact centre volume attributable to cost questions is internal data.",
            "Competitor roadmaps are not observable; only shipped behaviour is.",
        ],
        out_of_scope=["Provider-side billing workflow", "Claims adjudication redesign"],
        human_readable_plan=(
            "This plan establishes whether an evidenced problem exists before considering any "
            "solution. It combines federal policy and programme data (what the rules are and "
            "what data exists), academic and survey research (whether cost uncertainty changes "
            "behaviour), member community and app review evidence (how the problem is actually "
            "experienced), competitor product surfaces (what the market ships today), and "
            "interoperability standards (whether a data path exists).\n\n"
            "Two questions are marked for primary research because published sources describe "
            "what happens, not why members act as they do at the decision point."
        ),
    )
    session.add(plan)
    session.flush()

    questions = [
        ("What cost information can a Medicaid member obtain before receiving care?",
         [ResearchType.PROBLEM_DOMAIN, ResearchType.REGULATORY],
         "Establishes whether the problem is availability, presentation, or both.",
         "Policy describing what must be disclosed, and member accounts of what is obtainable."),
        ("How do members experience the problem, in their own words?",
         [ResearchType.VOICE_OF_CUSTOMER],
         "Distinguishes the felt problem from the industry framing of it.",
         "First-hand accounts naming the moment and the consequence."),
        ("Does cost uncertainty change care-seeking behaviour?",
         [ResearchType.USER, ResearchType.PROBLEM_DOMAIN],
         "Determines whether this is an inconvenience or a health outcome issue.",
         "Survey or peer-reviewed evidence linking cost concern to care avoidance."),
        ("What do existing member portals provide today?",
         [ResearchType.COMPETITIVE],
         "Bounds what a new solution must beat.",
         "Documented capability from vendors' own surfaces, plus user reports."),
        ("What cost-sharing rules apply, and how do they vary?",
         [ResearchType.REGULATORY],
         "Rules constrain what any estimate can legitimately say.",
         "Federal rules and state-level variation, from the regulator."),
        ("Does the data required for a prospective estimate exist?",
         [ResearchType.DATA, ResearchType.TECHNOLOGY],
         "Determines feasibility before any solution is designed.",
         "Dataset grain, standards coverage, and evidence about field completeness."),
    ]
    question_refs = refs.allocate(session, project.id, "research_question", len(questions))
    for position, ((text, types, why, expected), ref) in enumerate(
        zip(questions, question_refs, strict=True)
    ):
        session.add(
            ResearchQuestion(
                plan_id=plan.id,
                project_id=project.id,
                ref=ref,
                position=position,
                question=text,
                why=why,
                research_types=[t.value for t in types],
                expected_evidence=expected,
                answerable_by_secondary=ResearchType.USER not in types,
                queries=[],
                status="complete",
            )
        )
    session.flush()
    return plan


def _sources(session: Session, project: Project) -> list[Source]:
    created: list[Source] = []
    source_refs = refs.allocate(session, project.id, "source", len(SOURCES))
    for (title, url, publisher, stype, tier, published, rtype), ref in zip(
        SOURCES, source_refs, strict=True
    ):
        source = Source(
            project_id=project.id,
            ref=ref,
            title=title,
            url=url,
            publisher=publisher,
            source_type=stype,
            tier=tier,
            origin=EvidenceOrigin.EXTERNAL,
            publication_date=published,
            date_accessed=date.today(),
            geography="United States",
            research_types=[rtype.value],
            assessment=SEED_NOTICE,
            relevance_score=0.9,
        )
        session.add(source)
        created.append(source)
    session.flush()
    return created


def _evidence_and_themes(
    session: Session, project: Project, sources: list[Source]
) -> tuple[dict[str, list[str]], list[Theme]]:
    theme_refs = refs.allocate(session, project.id, "theme", len(THEMES))
    themes: list[Theme] = []
    theme_by_name: dict[str, Theme] = {}
    for (name, description), ref in zip(THEMES, theme_refs, strict=True):
        theme = Theme(
            project_id=project.id, ref=ref, name=name, description=description, evidence_refs=[]
        )
        session.add(theme)
        themes.append(theme)
        theme_by_name[name] = theme
    session.flush()

    by_theme: dict[str, list[str]] = {name: [] for name, _ in THEMES}
    evidence_refs = refs.allocate(session, project.id, "evidence", len(EVIDENCE))

    for (source_index, statement, etype, excerpt, population, theme_name, relevance), ref in zip(
        EVIDENCE, evidence_refs, strict=True
    ):
        source = sources[source_index]
        theme = theme_by_name[theme_name]
        strength = {
            SourceTier.TIER_1_AUTHORITATIVE: EvidenceStrength.STRONG,
            SourceTier.TIER_2_STRONG_SECONDARY: EvidenceStrength.MODERATE,
            SourceTier.TIER_3_MARKET_USER: EvidenceStrength.DIRECTIONAL,
            SourceTier.TIER_4_GENERAL_WEB: EvidenceStrength.ANECDOTAL,
        }[SourceTier(source.tier)]
        if etype in (EvidenceType.OPINION, EvidenceType.INFERENCE):
            strength = EvidenceStrength.ANECDOTAL

        session.add(
            Evidence(
                project_id=project.id,
                source_id=source.id,
                ref=ref,
                research_type=ResearchType(source.research_types[0]),
                statement=statement,
                excerpt=excerpt,
                evidence_type=etype,
                origin=EvidenceOrigin.EXTERNAL,
                population=population,
                geography="United States",
                theme_id=theme.id,
                tags=[theme_name],
                relevance=relevance,
                # Deliberately empty: no invented figures attributed to real bodies.
                quantities=[],
                limitations=[SEED_NOTICE],
                strength=strength,
                strength_reasoning=(
                    f"{SourceTier(source.tier).label} source. {SEED_NOTICE}"
                ),
                notes=SEED_NOTICE,
            )
        )
        by_theme[theme_name].append(ref)

    for name, theme in theme_by_name.items():
        theme.evidence_refs = by_theme[name]
        theme.prevalence = f"Appears in {len(by_theme[name])} evidence item(s)."
    session.flush()
    return by_theme, themes


def _synthesis(
    session: Session, project: Project, by_theme: dict[str, list[str]], themes: list[Theme]
) -> Synthesis:
    synthesis = Synthesis(
        project_id=project.id,
        ref=refs.allocate_one(session, project.id, "synthesis"),
        version=1,
        executive_summary=(
            "Medicaid members cannot establish what care will cost them before they receive "
            "it, even though the rules governing what they owe are published. The information "
            "exists in policy form and in programme data, but not at the grain or in the "
            "language a member needs at the point of decision. Members fall back on phoning "
            "the plan or provider and report receiving inconsistent answers. Existing member "
            "portals answer what already happened rather than what a planned service will "
            "cost.\n\n"
            "The link from cost uncertainty to delayed or avoided care is supported, but the "
            "strongest survey evidence covers US adults generally rather than Medicaid members "
            "specifically — the finding should not be stated as established for this "
            "population without further research.\n\n"
            "This is illustrative seed data. Run research to collect real evidence."
        ),
        research_objective=(
            "Understand why Medicaid members cannot establish care costs in advance, and "
            "where a product could intervene."
        ),
        research_approach=(
            "Federal policy and programme data, federal and academic research on patient "
            "cost experience, consumer survey research, member community and app review "
            "evidence, competitor product documentation, and interoperability standards."
        ),
        sources_examined=len(SOURCES),
        evidence_examined=len(EVIDENCE),
        contradictions=[
            {
                "topic": "Whether the required cost information exists",
                "position_a": "The governing rules and cost-sharing obligations are published "
                              "and publicly available.",
                "evidence_refs_a": by_theme["Cost rules vary by state"],
                "position_b": "Members consistently report being unable to determine what "
                              "they will owe before care.",
                "evidence_refs_b": by_theme["Cost is unknowable before care"]
                                   + by_theme["Members fall back on phone calls"],
                "assessment": "These are not in conflict. The rules are published at policy "
                              "grain; the member needs an amount for a specific planned "
                              "service. The gap is between the grain of what exists and the "
                              "grain of what is needed — which is a product problem, not an "
                              "information availability problem.",
                "resolution": KnowledgeState.LIKELY.value,
            }
        ],
        evidence_gaps=[
            {
                "gap": "No evidence establishes cost-related care avoidance specifically among "
                       "Medicaid members, as distinct from US adults generally.",
                "why_it_matters": "The business case rests on this link holding for this "
                                  "population. Generalizing from the broader adult population "
                                  "would be exactly the error this platform guards against.",
                "can_secondary_research_close_it": True,
                "suggested_approach": "Targeted search of peer-reviewed literature and state "
                                      "Medicaid research for Medicaid-specific studies.",
            },
            {
                "gap": "Contact centre volume attributable to cost questions is not established.",
                "why_it_matters": "This is the most direct route to sizing the operational "
                                  "value of a solution.",
                "can_secondary_research_close_it": False,
                "suggested_approach": "Internal contact centre data; upload call records or "
                                      "ticket exports as internal evidence.",
            },
            {
                "gap": "Whether plans have populated the data fields a prospective estimate "
                       "would require is unknown.",
                "why_it_matters": "Feasibility depends on it. A standard defining a field is "
                                  "not evidence the field is populated.",
                "can_secondary_research_close_it": False,
                "suggested_approach": "Technical spike against the plan's own API.",
            },
            {
                "gap": "Why Medicaid managed care products appear less likely to offer "
                       "estimation tools is not established.",
                "why_it_matters": "Whitespace that exists because the problem is hard or "
                                  "regulated is not the same as an unserved opportunity.",
                "can_secondary_research_close_it": True,
                "suggested_approach": "Regulatory research on estimate disclosure obligations "
                                      "for Medicaid managed care.",
            },
        ],
        emerging_opportunities=[
            "Answer 'what will this cost me' for a planned service, rather than describing "
            "benefits.",
            "Make the exemption case explicit, so members who owe nothing are told so clearly.",
            "Equip member services representatives with the same answer the member sees, so "
            "the phone channel stops contradicting the digital one.",
        ],
        primary_research_questions=[
            "What do members do at the moment they decide whether to seek care?",
            "What do members actually ask when they call member services?",
            "Would a member trust an estimate, and what would make them stop trusting it?",
        ],
        next_steps=[
            "Run targeted research to close the Medicaid-specific behaviour gap.",
            "Upload contact centre exports as internal evidence.",
            "Run a technical spike on data availability before committing to an estimator.",
        ],
    )
    session.add(synthesis)
    session.flush()

    findings_spec = [
        ("Members cannot determine what a planned service will cost them",
         "Across federal research, member community accounts and app reviews, members report "
         "being unable to establish an expected out-of-pocket amount before receiving care. "
         "The governing rules are published, but at policy grain rather than as an amount for "
         "a specific service.",
         by_theme["Cost is unknowable before care"] + by_theme["Unexpected bills after care"],
         EvidenceStrength.MODERATE, KnowledgeState.KNOWN,
         "This is the problem to solve. It is an information-presentation and data-grain "
         "problem, not an absence of rules.",
         ["Community and app review evidence is self-selected.",
          "Federal research covers patients broadly, not Medicaid members specifically."]),
        ("The current workaround is a phone call that produces inconsistent answers",
         "Members describe phoning the plan and the provider to establish cost, and receiving "
         "different answers from each. The workaround exists, is effortful, and does not "
         "reliably work.",
         by_theme["Members fall back on phone calls"],
         EvidenceStrength.DIRECTIONAL, KnowledgeState.LIKELY,
         "A costly workaround that fails is the strongest signal that a job is unmet. It also "
         "means the value is measurable in contact volume.",
         ["Rests on self-selected community and review evidence only.",
          "No internal contact centre data has been supplied to corroborate it."]),
        ("Existing member portals answer what happened, not what will happen",
         "Documented portal capability centres on claims history and benefit summaries. "
         "Prospective estimation for a planned service is less commonly documented, and "
         "appears more often in commercial than Medicaid managed care products.",
         by_theme["Existing tools are retrospective"],
         EvidenceStrength.STRONG, KnowledgeState.KNOWN,
         "Defines the competitive gap and suggests where differentiation is available — "
         "subject to establishing why the gap exists.",
         ["Based on documented capability; undocumented features may exist.",
          "Absence of documentation is not proof of absence of capability."]),
        ("Cost-sharing rules vary by state and eligibility group",
         "Federal rules set maximums and exemptions, with state discretion within them. What a "
         "member owes depends on their state, their eligibility group and the service.",
         by_theme["Cost rules vary by state"],
         EvidenceStrength.STRONG, KnowledgeState.KNOWN,
         "Any estimate must apply state and exemption logic, or it will be confidently wrong "
         "for a large share of members — which is worse than showing nothing.",
         ["Variation across all states was not enumerated in this research."]),
        ("Cost uncertainty is associated with delayed or avoided care",
         "Survey and peer-reviewed research report associations between cost concern and "
         "reduced care-seeking. Study designs and populations vary, and the strongest survey "
         "evidence covers US adults rather than Medicaid members specifically.",
         by_theme["Cost uncertainty changes behaviour"],
         EvidenceStrength.MODERATE, KnowledgeState.LIKELY,
         "This is what elevates the problem from inconvenience to health outcome — and it is "
         "the finding most at risk of being overstated.",
         ["Population is US adults, not Medicaid members. Do not generalize.",
          "Association, not established causation."]),
        ("A standards-based data path may exist, but completeness is unproven",
         "Interoperability standards define resources covering coverage and provider directory "
         "information. Conformance concerns structure, not whether a given plan has populated "
         "the fields an estimate would require.",
         by_theme["A data path may exist"] + by_theme["Data does not reach the member"],
         EvidenceStrength.STRONG, KnowledgeState.KNOWN,
         "Feasibility is open. The route exists on paper; whether the data is there is the "
         "single most important unknown before committing.",
         ["No evidence was collected on actual field population in any specific plan."]),
    ]

    finding_refs = refs.allocate(session, project.id, "finding", len(findings_spec))
    for (title, text, evidence_refs, confidence, state, why, limits), ref in zip(
        findings_spec, finding_refs, strict=True
    ):
        session.add(
            Finding(
                project_id=project.id,
                synthesis_id=synthesis.id,
                ref=ref,
                title=title,
                finding=text,
                evidence_refs=evidence_refs,
                affected_personas=["Medicaid member"],
                themes=[],
                prevalence=f"Supported by {len(evidence_refs)} evidence item(s).",
                why_it_matters=why,
                confidence=confidence,
                knowledge_state=state,
                limitations=limits,
            )
        )
    session.flush()

    findings = sorted(project.findings, key=lambda f: f.ref)
    insights_spec = [
        ("The gap is grain, not availability",
         "The information members need exists, but at the wrong grain. Policy describes "
         "categories; members need an amount for one planned service.",
         [findings[0].ref, findings[3].ref],
         "It reframes the problem from 'obtain missing data' to 'resolve published rules "
         "against a specific member and service'.",
         "The product is a resolution engine plus a presentation layer, not a data "
         "acquisition project — a materially different investment.",
         EvidenceStrength.MODERATE),
        ("The phone channel is the incumbent, and it is failing",
         "Members already have a way to ask what something costs. It is effortful, and it "
         "returns inconsistent answers.",
         [findings[1].ref],
         "The competitor is not another portal; it is a phone call. That sets both the bar "
         "and the measurement.",
         "Success is measurable as deflected calls and as consistency between channels — not "
         "as portal engagement.",
         EvidenceStrength.DIRECTIONAL),
        ("A wrong estimate is worse than no estimate",
         "Given state and exemption variation, an estimate that is confidently wrong would "
         "damage trust at the exact moment the member is deciding whether to seek care.",
         [findings[3].ref, findings[5].ref],
         "It sets the product's failure mode. The design question is how to be useful when "
         "certainty is unavailable.",
         "Argues for showing ranges, exemption status and confidence rather than a single "
         "number — and for treating 'we cannot tell you yet' as a designed state.",
         EvidenceStrength.MODERATE),
    ]
    insight_refs = refs.allocate(session, project.id, "insight", len(insights_spec))
    for (title, text, finding_refs_, why, implication, confidence), ref in zip(
        insights_spec, insight_refs, strict=True
    ):
        session.add(
            Insight(
                project_id=project.id,
                synthesis_id=synthesis.id,
                ref=ref,
                title=title,
                insight=text,
                finding_refs=finding_refs_,
                why_it_matters=why,
                product_implication=implication,
                confidence=confidence,
                knowledge_state=KnowledgeState.LIKELY,
            )
        )
    session.flush()
    return synthesis


def _analysis(session: Session, project: Project, by_theme: dict[str, list[str]]) -> None:
    findings = sorted(project.findings, key=lambda f: f.ref)
    all_refs = [r for refs_ in by_theme.values() for r in refs_]

    session.add(
        Analysis(
            project_id=project.id,
            ref=refs.allocate_one(session, project.id, "analysis"),
            analysis_type=AnalysisType.PAIN_POINT,
            title="Pain Point Analysis",
            summary=(
                "Four evidenced pain points, ranked by evidence strength. Frequency and "
                "severity are marked Not established because no evidence in this project "
                "quantifies them."
            ),
            sections=[
                {
                    "heading": "Evidenced pain points",
                    "body": "",
                    "points": [],
                    "columns": ["Pain point", "Affected persona", "Frequency", "Severity",
                                "Evidence", "Current workaround", "Root cause",
                                "Product implication"],
                    "rows": [
                        {
                            "Pain point": "I cannot tell what this visit will cost me before I go",
                            "Affected persona": "Medicaid member",
                            "Frequency": "Not established",
                            "Severity": "Not established",
                            "Evidence": ", ".join(by_theme["Cost is unknowable before care"]),
                            "Current workaround": "Phone the plan or the provider",
                            "Root cause": "Published rules are at policy grain, not per-service",
                            "Product implication": "Resolve rules against member and service",
                        },
                        {
                            "Pain point": "I got a bill I did not expect at all",
                            "Affected persona": "Medicaid member",
                            "Frequency": "Not established",
                            "Severity": "Not established",
                            "Evidence": ", ".join(by_theme["Unexpected bills after care"]),
                            "Current workaround": "Call member services after the fact",
                            "Root cause": "Not established — needs primary research",
                            "Product implication": "Set expectation before the encounter",
                        },
                        {
                            "Pain point": "I called and got two different answers",
                            "Affected persona": "Medicaid member",
                            "Frequency": "Not established",
                            "Severity": "Not established",
                            "Evidence": ", ".join(by_theme["Members fall back on phone calls"]),
                            "Current workaround": "Call again, or give up",
                            "Root cause": "Plan and provider resolve cost differently",
                            "Product implication": "One answer across both channels",
                        },
                        {
                            "Pain point": "The portal tells me what already happened",
                            "Affected persona": "Medicaid member",
                            "Frequency": "Not established",
                            "Severity": "Not established",
                            "Evidence": ", ".join(by_theme["Existing tools are retrospective"]),
                            "Current workaround": "Do not use the portal for this",
                            "Root cause": "Portals are built around claims, not planning",
                            "Product implication": "Prospective, not retrospective, framing",
                        },
                    ],
                    "evidence_refs": all_refs,
                    "knowledge_state": KnowledgeState.KNOWN.value,
                },
                {
                    "heading": "What this analysis cannot tell you",
                    "body": (
                        "No evidence in this project quantifies how often any of these occur, "
                        "or what they cost the member or the organization. Frequency and "
                        "severity are therefore marked Not established rather than scored. "
                        "Closing that gap requires internal contact centre data."
                    ),
                    "points": [],
                    "columns": [],
                    "rows": [],
                    "evidence_refs": [],
                    "knowledge_state": KnowledgeState.UNKNOWN.value,
                },
            ],
            evidence_refs=all_refs,
            finding_refs=[f.ref for f in findings[:3]],
            assumptions=[
                "Community and app review accounts are representative of the wider member "
                "population — unverified.",
            ],
            unknowns=[
                "Frequency and severity of every pain point listed.",
                "Whether members who do not post online experience these the same way.",
            ],
            confidence=EvidenceStrength.MODERATE,
            persona=Persona.PRODUCT_MANAGER,
        )
    )
    session.flush()


def _opportunities_and_use_cases(
    session: Session, project: Project, by_theme: dict[str, list[str]]
) -> None:
    findings = sorted(project.findings, key=lambda f: f.ref)

    opportunities_spec = [
        ("Answer 'what will this cost me' for a planned service",
         "Members cannot establish an expected out-of-pocket amount before care.",
         "Medicaid member",
         by_theme["Cost is unknowable before care"] + by_theme["Existing tools are retrospective"],
         [findings[0].ref, findings[2].ref],
         "The rules exist but at the wrong grain; resolving them per member and service is a "
         "product problem, not a data acquisition problem.",
         "A member can see what a planned service will cost them, with the basis shown.",
         ["Resolve published rules against member eligibility and service code",
          "Show exemption status prominently where the member owes nothing",
          "Show a range with its basis where a precise amount cannot be determined",
          "Route to a representative with the same answer when the system cannot resolve it"],
         "If members can see an expected amount before care, they will be less likely to "
         "defer a needed visit out of cost uncertainty — because the uncertainty, not the "
         "amount, is what the evidence describes.",
         "Mechanism: fewer cost-driven deferrals and fewer inbound cost calls. Magnitude not "
         "established.",
         EvidenceStrength.MODERATE,
         ["That the required data fields are populated in this plan's systems",
          "That members trust an estimate enough to act on it",
          "That cost uncertainty, rather than the cost itself, is the barrier"],
         ["Eligibility and cost-sharing rules engine", "Service-level coverage data",
          "State-specific exemption logic"],
         ["A confidently wrong estimate would damage trust at the decision point",
          "Regulatory exposure if an estimate is treated as a guarantee",
          "Behaviour may not change even if the information is provided"],
         ["Technical spike: confirm the data fields exist and are populated",
          "Interview 10-12 members on whether they would act on an estimate",
          "Test whether a range with stated basis is more trusted than a single number"]),

        ("Make the zero-cost case unmistakable",
         "Members exempt from cost sharing may not know they owe nothing, and may defer care "
         "on a cost concern that does not apply to them.",
         "Medicaid member exempt from cost sharing",
         by_theme["Cost rules vary by state"] + by_theme["Cost is unknowable before care"],
         [findings[0].ref, findings[3].ref],
         "This is the subset of the problem where the answer is both certain and free of "
         "estimation risk.",
         "Exempt members know, before care, that they will owe nothing.",
         ["Surface exemption status in the member profile",
          "State it at the point of scheduling, not only in the handbook",
          "Give representatives the same statement to read"],
         "If exempt members are told plainly that they owe nothing, cost-related deferral in "
         "that group falls — because the barrier was a misapprehension.",
         "Mechanism: avoided deferrals and avoided calls in a population where the answer is "
         "certain. Size of that population not established here.",
         EvidenceStrength.MODERATE,
         ["That a material share of members are exempt and do not know it",
          "That exemption status is reliably derivable from existing systems"],
         ["Eligibility data", "State exemption rules"],
         ["Stating 'you owe nothing' incorrectly would be a serious trust and compliance "
          "failure"],
         ["Determine what share of members are exempt",
          "Verify exemption status can be derived reliably before displaying it"]),

        ("Give the phone channel the same answer as the app",
         "Members phoning the plan and the provider report receiving different answers.",
         "Medicaid member and customer service representative",
         by_theme["Members fall back on phone calls"],
         [findings[1].ref],
         "Consistency is achievable without solving estimation perfectly, and it addresses "
         "the failure mode of the workaround members already use.",
         "A member gets the same answer whether they call or look it up.",
         ["Expose the same resolution engine to the representative console",
          "Log what was told to the member, so the next call starts from it",
          "Show the representative the basis, not only the number"],
         "If both channels resolve cost the same way, repeat calls driven by contradictory "
         "answers fall.",
         "Mechanism: reduced repeat contacts and reduced handling time. Magnitude requires "
         "internal contact centre data.",
         EvidenceStrength.DIRECTIONAL,
         ["That inconsistency between channels is a material driver of repeat calls"],
         ["Representative console integration", "Interaction logging"],
         ["Rests on directional community evidence only; internal data should confirm it "
          "before investment"],
         ["Analyse contact centre records for repeat cost calls",
          "Measure answer consistency between channels today"]),
    ]

    opportunity_refs = refs.allocate(session, project.id, "opportunity", len(opportunities_spec))
    created: list[Opportunity] = []
    for (title, problem, user, ev_refs, f_refs, insight, outcome, directions, hypothesis,
         business, confidence, assumptions, dependencies, risks, validation), ref in zip(
        opportunities_spec, opportunity_refs, strict=True
    ):
        opportunity = Opportunity(
            project_id=project.id,
            ref=ref,
            title=title,
            problem=problem,
            user=user,
            evidence_refs=ev_refs,
            finding_refs=f_refs,
            insight=insight,
            desired_outcome=outcome,
            solution_directions=directions,
            value_hypothesis=hypothesis,
            business_value=business,
            confidence=confidence,
            assumptions=assumptions,
            dependencies=dependencies,
            risks=risks,
            validation_plan=validation,
            status=OpportunityStatus.NEEDS_VALIDATION,
        )
        session.add(opportunity)
        created.append(opportunity)
    session.flush()

    use_cases_spec = [
        ("Member checks expected cost before scheduling a visit",
         "Medicaid member",
         "The member is deciding whether to book an appointment and does not know what it "
         "will cost them.",
         "Member selects a service or provider in the app.",
         "At home, on a phone, often outside business hours.",
         "Phones the plan, phones the provider, or books and hopes.",
         "Sees an expected amount, or a clear statement that they owe nothing.",
         "Resolve published cost-sharing rules against the member's eligibility and the "
         "selected service, and show the basis alongside the amount.",
         "Removes the uncertainty that the evidence associates with deferral.",
         "Avoided inbound cost calls; avoided deferred care that presents later.",
         by_theme["Cost is unknowable before care"],
         EvidenceStrength.MODERATE,
         ["Eligibility data", "Service-level cost-sharing rules", "State exemption logic"],
         ["A wrong estimate at the decision point is worse than no estimate"],
         "Not established — depends on rules engine scope",
         "Share of scheduling journeys where an amount or exemption statement is shown, "
         "and cost-related call volume from those members.",
         created[0]),

        ("Exempt member is told they owe nothing",
         "Medicaid member exempt from cost sharing",
         "The member believes they may owe money for a service they are exempt from paying for.",
         "Member opens a service or benefit in the app.",
         "Any point before care.",
         "Assumes there will be a cost, or calls to check.",
         "Sees an unambiguous statement that this service costs them nothing.",
         "Derive exemption status from eligibility and state it plainly at the point of "
         "decision.",
         "Removes a cost barrier that does not actually exist for this member.",
         "Avoided deferrals and calls in a population where the answer is certain.",
         by_theme["Cost rules vary by state"],
         EvidenceStrength.MODERATE,
         ["Eligibility data", "State exemption rules"],
         ["An incorrect zero-cost statement is a serious trust and compliance failure"],
         "Not established",
         "Share of exempt members shown the statement, and cost-related contacts from that "
         "group.",
         created[1]),

        ("Representative reads the member the same answer the app shows",
         "Customer service representative",
         "The representative cannot see what the member was shown, so the channels contradict "
         "each other.",
         "Member calls asking what a service will cost.",
         "Contact centre, member on the line.",
         "Looks up benefits manually and interprets them.",
         "Reads the member the same resolved answer, with its basis.",
         "Expose the resolution engine to the representative console and log what was said.",
         "The member stops getting different answers from different channels.",
         "Reduced repeat contacts and handling time.",
         by_theme["Members fall back on phone calls"],
         EvidenceStrength.DIRECTIONAL,
         ["Representative console integration", "Interaction logging"],
         ["Rests on directional evidence; confirm with internal contact data first"],
         "Not established",
         "Answer consistency between channels, and repeat-call rate for cost questions.",
         created[2]),

        ("Member is told when the system cannot determine a cost",
         "Medicaid member",
         "The system cannot resolve a cost, and silence or a wrong number would both damage "
         "trust.",
         "Member requests a cost the engine cannot resolve.",
         "Any point before care.",
         "Sees an error, or an estimate that turns out to be wrong.",
         "Sees plainly that the cost cannot be determined, why, and what to do next.",
         "Treat 'cannot determine' as a designed state with a route to a representative.",
         "Preserves trust in the cases where the product cannot help.",
         "Avoids the trust damage that a confidently wrong estimate would cause.",
         by_theme["Data does not reach the member"] + by_theme["A data path may exist"],
         EvidenceStrength.STRONG,
         ["Resolution engine confidence signalling", "Representative handoff"],
         ["If this state is too common, the product will not be believed at all"],
         "Not established",
         "Share of requests ending in this state, and member trust measures for that group.",
         created[0]),
    ]

    use_case_refs = refs.allocate(session, project.id, "use_case", len(use_cases_spec))
    for (title, actor, problem, trigger, context, current, outcome, capability, user_value,
         business_value, ev_refs, strength, deps, risks, complexity, metric,
         opportunity), ref in zip(use_cases_spec, use_case_refs, strict=True):
        session.add(
            UseCase(
                project_id=project.id,
                opportunity_id=opportunity.id,
                ref=ref,
                title=title,
                actor=actor,
                problem=problem,
                trigger=trigger,
                context=context,
                current_behavior=current,
                desired_outcome=outcome,
                proposed_capability=capability,
                user_value=user_value,
                business_value=business_value,
                evidence_refs=ev_refs,
                evidence_strength=strength,
                dependencies=deps,
                risks=risks,
                complexity=complexity,
                success_metric=metric,
                status="candidate",
            )
        )
    session.flush()
