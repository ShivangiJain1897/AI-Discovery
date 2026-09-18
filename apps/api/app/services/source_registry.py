"""The source registry behind the Source Router.

Authority is a property of what a source *is*, not of how well it ranks. This
registry encodes that: each entry declares its tier, its type, the domains it
serves and the research types it can actually answer. The router combines it
with the project's domain, geography and question to produce a ranked source
set — which is why a Medicaid policy question reaches CMS and a member
experience question reaches Reddit, and why neither substitutes for the other.

Adding a source is a data change here, not a code change in the router.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.enums import ResearchType, SourceTier, SourceType


@dataclass(frozen=True)
class RegisteredSource:
    name: str
    url: str | None
    source_type: SourceType
    tier: SourceTier
    why: str
    domains: tuple[str, ...] = ()
    research_types: tuple[ResearchType, ...] = ()
    geographies: tuple[str, ...] = ()
    search_domains: tuple[str, ...] = field(default=())


T1 = SourceTier.TIER_1_AUTHORITATIVE
T2 = SourceTier.TIER_2_STRONG_SECONDARY
T3 = SourceTier.TIER_3_MARKET_USER
T4 = SourceTier.TIER_4_GENERAL_WEB

RT = ResearchType
ST = SourceType


# ── US Healthcare ────────────────────────────────────────────
HEALTHCARE: tuple[RegisteredSource, ...] = (
    RegisteredSource(
        "Centers for Medicare & Medicaid Services", "https://www.cms.gov", ST.GOVERNMENT, T1,
        "Administers Medicare and Medicaid; the primary source for program rules, "
        "coverage policy and price transparency requirements.",
        ("healthcare",), (RT.REGULATORY, RT.PROBLEM_DOMAIN, RT.MARKET), ("united states",),
        ("cms.gov",),
    ),
    RegisteredSource(
        "Data.CMS.gov", "https://data.cms.gov", ST.DATASET, T1,
        "Original CMS datasets — utilization, spending, provider and plan data.",
        ("healthcare",), (RT.DATA, RT.MARKET), ("united states",), ("data.cms.gov",),
    ),
    RegisteredSource(
        "Data.Medicaid.gov", "https://data.medicaid.gov", ST.DATASET, T1,
        "Medicaid enrollment, spending and program datasets.",
        ("healthcare",), (RT.DATA, RT.MARKET), ("united states",), ("data.medicaid.gov",),
    ),
    RegisteredSource(
        "Medicaid.gov", "https://www.medicaid.gov", ST.GOVERNMENT, T1,
        "Federal Medicaid program policy, waivers and state plan guidance.",
        ("healthcare",), (RT.REGULATORY, RT.PROBLEM_DOMAIN), ("united states",),
        ("medicaid.gov",),
    ),
    RegisteredSource(
        "HealthCare.gov datasets", "https://www.healthcare.gov", ST.DATASET, T1,
        "Marketplace plan, benefit and cost-sharing data.",
        ("healthcare",), (RT.DATA, RT.MARKET), ("united states",), ("healthcare.gov",),
    ),
    RegisteredSource(
        "Medicare Provider Data", "https://data.cms.gov/provider-data", ST.DATASET, T1,
        "Provider-level quality, cost and utilization measures.",
        ("healthcare",), (RT.DATA, RT.COMPETITIVE), ("united states",),
    ),
    RegisteredSource(
        "US Department of Health & Human Services", "https://www.hhs.gov", ST.GOVERNMENT, T1,
        "Federal health policy, privacy rules and departmental guidance.",
        ("healthcare",), (RT.REGULATORY,), ("united states",), ("hhs.gov",),
    ),
    RegisteredSource(
        "Centers for Disease Control and Prevention", "https://www.cdc.gov", ST.GOVERNMENT, T1,
        "Population health surveillance and behavioural survey data.",
        ("healthcare",), (RT.PROBLEM_DOMAIN, RT.DATA), ("united states",), ("cdc.gov",),
    ),
    RegisteredSource(
        "National Institutes of Health", "https://www.nih.gov", ST.GOVERNMENT, T1,
        "Federally funded biomedical and health services research.",
        ("healthcare", "life sciences"), (RT.SCIENTIFIC_CLINICAL, RT.PROBLEM_DOMAIN),
        ("united states",), ("nih.gov",),
    ),
    RegisteredSource(
        "Agency for Healthcare Research and Quality", "https://www.ahrq.gov", ST.GOVERNMENT, T1,
        "Research on healthcare cost, quality, access and patient experience.",
        ("healthcare",), (RT.PROBLEM_DOMAIN, RT.USER, RT.WORKFLOW_OPERATIONAL),
        ("united states",), ("ahrq.gov",),
    ),
    RegisteredSource(
        "State Medicaid agencies", None, ST.GOVERNMENT, T1,
        "Medicaid is state-administered; eligibility, benefits and member experience "
        "vary by state, so federal sources alone understate the variation.",
        ("healthcare",), (RT.REGULATORY, RT.PROBLEM_DOMAIN), ("united states",),
    ),
    RegisteredSource(
        "State Departments of Insurance", None, ST.REGULATOR, T1,
        "State-level insurance regulation, market conduct and consumer complaint data.",
        ("healthcare",), (RT.REGULATORY, RT.VOICE_OF_CUSTOMER), ("united states",),
    ),
    RegisteredSource(
        "KFF", "https://www.kff.org", ST.RESEARCH_ORGANIZATION, T2,
        "Independent health policy research, including recurring consumer surveys.",
        ("healthcare",), (RT.MARKET, RT.PROBLEM_DOMAIN, RT.VOICE_OF_CUSTOMER),
        ("united states",), ("kff.org",),
    ),
    RegisteredSource(
        "Commonwealth Fund", "https://www.commonwealthfund.org", ST.RESEARCH_ORGANIZATION, T2,
        "Health system performance and affordability research.",
        ("healthcare",), (RT.PROBLEM_DOMAIN, RT.MARKET), ("united states",),
    ),
    RegisteredSource(
        "PubMed", "https://pubmed.ncbi.nlm.nih.gov", ST.ACADEMIC, T1,
        "Peer-reviewed literature. Use for established findings, not market framing.",
        ("healthcare", "life sciences"), (RT.SCIENTIFIC_CLINICAL, RT.PROBLEM_DOMAIN, RT.USER),
        (), ("pubmed.ncbi.nlm.nih.gov",),
    ),
    RegisteredSource(
        "Health Affairs", "https://www.healthaffairs.org", ST.ACADEMIC, T2,
        "Peer-reviewed health policy research and analysis.",
        ("healthcare",), (RT.PROBLEM_DOMAIN, RT.MARKET), ("united states",),
    ),
)

# ── Life Sciences ────────────────────────────────────────────
LIFE_SCIENCES: tuple[RegisteredSource, ...] = (
    RegisteredSource(
        "US Food and Drug Administration", "https://www.fda.gov", ST.REGULATOR, T1,
        "Approvals, labelling, guidance and regulatory status.",
        ("life sciences",), (RT.REGULATORY, RT.SCIENTIFIC_CLINICAL), ("united states",),
        ("fda.gov",),
    ),
    RegisteredSource(
        "openFDA", "https://open.fda.gov", ST.DATASET, T1,
        "Structured FDA data: approvals, labels, recalls, adverse events.",
        ("life sciences",), (RT.DATA, RT.SCIENTIFIC_CLINICAL), ("united states",),
        ("open.fda.gov",),
    ),
    RegisteredSource(
        "Drugs@FDA", "https://www.accessdata.fda.gov/scripts/cder/daf/", ST.REGULATOR, T1,
        "Approval history and review documents for specific products.",
        ("life sciences",), (RT.REGULATORY, RT.COMPETITIVE), ("united states",),
    ),
    RegisteredSource(
        "FAERS", "https://www.fda.gov/drugs/questions-and-answers-fdas-adverse-event-"
        "reporting-system-faers", ST.DATASET, T1,
        "Post-market adverse event reports. Reporting bias is significant; never read "
        "as incidence.",
        ("life sciences",), (RT.SCIENTIFIC_CLINICAL, RT.DATA), ("united states",),
    ),
    RegisteredSource(
        "ClinicalTrials.gov", "https://clinicaltrials.gov", ST.CLINICAL_REGISTRY, T1,
        "Registered trials: design, endpoints, phase, sponsor and status.",
        ("life sciences",), (RT.SCIENTIFIC_CLINICAL, RT.COMPETITIVE), (),
        ("clinicaltrials.gov",),
    ),
    RegisteredSource(
        "European Medicines Agency", "https://www.ema.europa.eu", ST.REGULATOR, T1,
        "EU regulatory status, assessment reports and guidance.",
        ("life sciences",), (RT.REGULATORY,), ("europe", "european union"), ("ema.europa.eu",),
    ),
    RegisteredSource(
        "World Health Organization", "https://www.who.int", ST.GOVERNMENT, T1,
        "Global health guidance, classifications and surveillance.",
        ("life sciences", "healthcare"), (RT.SCIENTIFIC_CLINICAL, RT.PROBLEM_DOMAIN), (),
        ("who.int",),
    ),
    RegisteredSource(
        "SEC EDGAR", "https://www.sec.gov/edgar", ST.COMPANY_FILING, T1,
        "Filings state pipeline, risk and revenue as the company is legally obliged to.",
        ("life sciences", "financial services", "technology"),
        (RT.BUSINESS_COMMERCIAL, RT.COMPETITIVE), ("united states",), ("sec.gov",),
    ),
    RegisteredSource(
        "Google Patents", "https://patents.google.com", ST.STANDARDS_BODY, T2,
        "Claimed invention and freedom-to-operate signals.",
        ("life sciences", "technology"), (RT.TECHNOLOGY, RT.COMPETITIVE), (),
    ),
)

# ── Digital products ─────────────────────────────────────────
DIGITAL: tuple[RegisteredSource, ...] = (
    RegisteredSource(
        "Apple App Store", "https://apps.apple.com", ST.APP_STORE, T3,
        "Unprompted user complaints and praise about shipped experiences.",
        (), (RT.VOICE_OF_CUSTOMER, RT.COMPETITIVE), (),
    ),
    RegisteredSource(
        "Google Play", "https://play.google.com", ST.APP_STORE, T3,
        "Review volume and recurring complaint themes for mobile products.",
        (), (RT.VOICE_OF_CUSTOMER, RT.COMPETITIVE), (),
    ),
    RegisteredSource(
        "G2", "https://www.g2.com", ST.REVIEW_PLATFORM, T3,
        "Business software reviews, segmented by company size.",
        (), (RT.VOICE_OF_CUSTOMER, RT.COMPETITIVE, RT.SOLUTION_VENDOR), (), ("g2.com",),
    ),
    RegisteredSource(
        "Capterra", "https://www.capterra.com", ST.REVIEW_PLATFORM, T3,
        "Software reviews with feature and pricing detail.",
        (), (RT.COMPETITIVE, RT.SOLUTION_VENDOR), (),
    ),
    RegisteredSource(
        "Reddit", "https://www.reddit.com", ST.COMMUNITY_FORUM, T3,
        "Lived experience in users' own language, including workarounds. The best "
        "available source for how people actually describe a problem.",
        (), (RT.VOICE_OF_CUSTOMER, RT.USER, RT.PROBLEM_DOMAIN), (), ("reddit.com",),
    ),
    RegisteredSource(
        "Competitor product documentation", None, ST.PRODUCT_DOCUMENTATION, T1,
        "What a competitor actually ships, from its own surface — outranks any "
        "analyst summary of the same product.",
        (), (RT.COMPETITIVE, RT.SOLUTION_VENDOR, RT.TECHNOLOGY), (),
    ),
    RegisteredSource(
        "Competitor pricing pages and release notes", None, ST.PRODUCT_DOCUMENTATION, T1,
        "Published pricing and shipped changes; the only observable roadmap signal.",
        (), (RT.COMPETITIVE, RT.BUSINESS_COMMERCIAL), (),
    ),
    RegisteredSource(
        "Consumer Financial Protection Bureau complaints",
        "https://www.consumerfinance.gov/data-research/consumer-complaints/",
        ST.GOVERNMENT, T1,
        "Structured, verified consumer complaint records.",
        ("financial services",), (RT.VOICE_OF_CUSTOMER, RT.REGULATORY), ("united states",),
    ),
)

# ── Technology ───────────────────────────────────────────────
TECHNOLOGY: tuple[RegisteredSource, ...] = (
    RegisteredSource(
        "Official product documentation", None, ST.PRODUCT_DOCUMENTATION, T1,
        "Documented behaviour and limits. Distinguish documented from announced.",
        ("technology",), (RT.TECHNOLOGY, RT.DATA, RT.SOLUTION_VENDOR), (),
    ),
    RegisteredSource(
        "GitHub", "https://github.com", ST.PRODUCT_DOCUMENTATION, T2,
        "Implementation reality: maintenance activity, open issues, real usage.",
        ("technology",), (RT.TECHNOLOGY,), (), ("github.com",),
    ),
    RegisteredSource(
        "IETF RFCs", "https://www.rfc-editor.org", ST.STANDARDS_BODY, T1,
        "Protocol specifications.",
        ("technology",), (RT.TECHNOLOGY,), (), ("rfc-editor.org",),
    ),
    RegisteredSource(
        "W3C", "https://www.w3.org", ST.STANDARDS_BODY, T1,
        "Web platform and accessibility standards.",
        ("technology",), (RT.TECHNOLOGY,), (), ("w3.org",),
    ),
    RegisteredSource(
        "HL7 / FHIR", "https://www.hl7.org/fhir/", ST.STANDARDS_BODY, T1,
        "Healthcare interoperability standards — the data layer for any payer or "
        "provider integration.",
        ("healthcare", "technology"), (RT.TECHNOLOGY, RT.DATA), (), ("hl7.org",),
    ),
    RegisteredSource(
        "Stack Overflow", "https://stackoverflow.com", ST.COMMUNITY_FORUM, T3,
        "Where a technology's real friction surfaces.",
        ("technology",), (RT.TECHNOLOGY,), (), ("stackoverflow.com",),
    ),
    RegisteredSource(
        "NIST National Vulnerability Database", "https://nvd.nist.gov", ST.GOVERNMENT, T1,
        "Known vulnerabilities for a dependency under consideration.",
        ("technology",), (RT.TECHNOLOGY,), (), ("nvd.nist.gov",),
    ),
    RegisteredSource(
        "arXiv", "https://arxiv.org", ST.ACADEMIC, T2,
        "Preprints. Not peer reviewed — tier accordingly.",
        ("technology",), (RT.TECHNOLOGY, RT.SCIENTIFIC_CLINICAL), (), ("arxiv.org",),
    ),
)

# ── Cross-domain ─────────────────────────────────────────────
GENERAL: tuple[RegisteredSource, ...] = (
    RegisteredSource(
        "US Census Bureau", "https://www.census.gov", ST.DATASET, T1,
        "Population and economic data for sizing and segmentation.",
        (), (RT.MARKET, RT.DATA), ("united states",), ("census.gov",),
    ),
    RegisteredSource(
        "Bureau of Labor Statistics", "https://www.bls.gov", ST.DATASET, T1,
        "Employment, wage and price data.",
        (), (RT.MARKET, RT.BUSINESS_COMMERCIAL), ("united states",), ("bls.gov",),
    ),
    RegisteredSource(
        "Pew Research Center", "https://www.pewresearch.org", ST.RESEARCH_ORGANIZATION, T2,
        "Methodologically transparent survey research on behaviour and attitudes.",
        (), (RT.USER, RT.MARKET), (), ("pewresearch.org",),
    ),
    RegisteredSource(
        "Industry analyst research", None, ST.ANALYST_RESEARCH, T2,
        "Market framing. Check who commissioned it before relying on a number.",
        (), (RT.MARKET, RT.COMPETITIVE), (),
    ),
    RegisteredSource(
        "Trade and industry publications", None, ST.INDUSTRY_PUBLICATION, T2,
        "Current developments and named deals.",
        (), (RT.MARKET, RT.COMPETITIVE), (),
    ),
)

REGISTRY: tuple[RegisteredSource, ...] = (
    HEALTHCARE + LIFE_SCIENCES + DIGITAL + TECHNOLOGY + GENERAL
)


def lookup(
    *,
    domain: str | None = None,
    research_types: list[ResearchType] | None = None,
    geography: str | None = None,
    limit: int | None = None,
) -> list[RegisteredSource]:
    """Rank registry entries for a domain, research type set and geography.

    Tier is the dominant term: an authoritative source that matches the domain
    outranks a general-web source that matches the query more closely. That
    ordering is the point of the registry.
    """
    domain_key = (domain or "").lower()
    geo_key = (geography or "").lower()
    wanted = set(research_types or [])

    scored: list[tuple[float, RegisteredSource]] = []
    for source in REGISTRY:
        score = 0.0

        if source.domains:
            if any(d in domain_key for d in source.domains):
                score += 4.0
            else:
                continue  # domain-specific source, wrong domain
        else:
            score += 1.0  # cross-domain source

        if wanted:
            overlap = wanted & set(source.research_types)
            if not overlap and source.research_types:
                continue
            score += 2.0 * len(overlap)

        if source.geographies:
            if geo_key and any(g in geo_key for g in source.geographies):
                score += 2.0
            elif geo_key:
                continue  # geography-specific source, wrong geography

        score += (5 - source.tier.rank) * 1.5
        scored.append((score, source))

    scored.sort(key=lambda pair: (-pair[0], pair[1].tier.rank, pair[1].name))
    ranked = [source for _, source in scored]
    return ranked[:limit] if limit else ranked


def search_domains_for(sources: list[RegisteredSource]) -> list[str]:
    """The `site:` filters a query should prefer for this source set."""
    domains: list[str] = []
    for source in sources:
        for domain in source.search_domains:
            if domain not in domains:
                domains.append(domain)
    return domains


# ── Classification of sources not in the registry ────────────

#: Host suffixes that determine tier on their own. A `.gov` host is primary by
#: definition; a review platform is market evidence however it is written.
_HOST_RULES: tuple[tuple[tuple[str, ...], SourceType, SourceTier], ...] = (
    ((".gov", ".mil"), ST.GOVERNMENT, T1),
    ((".edu", ".ac.uk"), ST.ACADEMIC, T1),
    (("who.int", "europa.eu", "oecd.org", "un.org"), ST.GOVERNMENT, T1),
    (("pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "clinicaltrials.gov"),
     ST.CLINICAL_REGISTRY, T1),
    (("doi.org", "sciencedirect.com", "springer.com", "nature.com", "jamanetwork.com",
      "nejm.org", "bmj.com", "thelancet.com"), ST.ACADEMIC, T1),
    (("ietf.org", "rfc-editor.org", "w3.org", "iso.org", "hl7.org", "nist.gov"),
     ST.STANDARDS_BODY, T1),
    (("sec.gov", "investor.", "annualreports.com"), ST.COMPANY_FILING, T1),
    (("kff.org", "pewresearch.org", "commonwealthfund.org", "rand.org", "brookings.edu",
      "urban.org", "mathematica.org"), ST.RESEARCH_ORGANIZATION, T2),
    (("gartner.com", "forrester.com", "idc.com", "mckinsey.com", "deloitte.com"),
     ST.ANALYST_RESEARCH, T2),
    (("healthaffairs.org", "modernhealthcare.com", "fiercehealthcare.com",
      "statnews.com", "techcrunch.com", "wsj.com", "ft.com"),
     ST.INDUSTRY_PUBLICATION, T2),
    (("g2.com", "capterra.com", "trustpilot.com", "trustradius.com"),
     ST.REVIEW_PLATFORM, T3),
    (("apps.apple.com", "play.google.com"), ST.APP_STORE, T3),
    (("reddit.com", "stackoverflow.com", "stackexchange.com", "quora.com",
      "news.ycombinator.com", "discourse."), ST.COMMUNITY_FORUM, T3),
    (("x.com", "twitter.com", "linkedin.com", "facebook.com", "youtube.com"),
     ST.SOCIAL_MEDIA, T3),
    (("github.com", "gitlab.com", "docs.", "developer.", "developers."),
     ST.PRODUCT_DOCUMENTATION, T2),
    (("medium.com", "substack.com", "blogspot.", "wordpress.", "/blog"), ST.BLOG, T4),
)


def classify_url(url: str, title: str = "") -> tuple[SourceType, SourceTier]:
    """Tier a retrieved source that is not in the registry.

    Falls through to general web, which is the right default: a source earns a
    higher tier by being identifiably authoritative, never by looking credible.
    """
    haystack = f"{url} {title}".lower()

    # Longest domain first: "pubmed.ncbi.nlm.nih.gov" must win over "nih.gov",
    # or a registry entry is shadowed by a shorter one that merely contains it.
    candidates = sorted(
        ((domain, entry) for entry in REGISTRY for domain in entry.search_domains),
        key=lambda pair: -len(pair[0]),
    )
    for domain, entry in candidates:
        if domain in haystack:
            return entry.source_type, entry.tier

    for hosts, source_type, tier in _HOST_RULES:
        if any(host in haystack for host in hosts):
            return source_type, tier

    if any(term in haystack for term in ("press-release", "newsroom", "/pr/")):
        return ST.MARKETING, T4
    if any(term in haystack for term in ("pricing", "/product", "/docs", "release-notes")):
        return ST.PRODUCT_DOCUMENTATION, T2

    return ST.NEWS, T4
