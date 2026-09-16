"""The source router decides where research happens. Its tiering is what
separates a regulation from an article about a regulation."""

from __future__ import annotations

from app.domain.enums import ResearchType, SourceTier, SourceType
from app.services import source_registry


def test_medicaid_regulatory_question_reaches_cms():
    sources = source_registry.lookup(
        domain="Healthcare",
        research_types=[ResearchType.REGULATORY],
        geography="United States",
        limit=6,
    )
    names = [s.name for s in sources]
    assert any("Centers for Medicare" in n for n in names)
    assert all(s.tier is SourceTier.TIER_1_AUTHORITATIVE for s in sources[:3])


def test_member_experience_question_reaches_tier_three():
    """Lived experience is genuinely best served by tier 3. The router must
    route there rather than treating it as a downgrade."""
    sources = source_registry.lookup(
        domain="Healthcare",
        research_types=[ResearchType.VOICE_OF_CUSTOMER],
        geography="United States",
    )
    tiers = {s.tier for s in sources}
    assert SourceTier.TIER_3_MARKET_USER in tiers


def test_routing_differs_by_research_type():
    regulatory = {
        s.name for s in source_registry.lookup(
            domain="Healthcare", research_types=[ResearchType.REGULATORY]
        )
    }
    voc = {
        s.name for s in source_registry.lookup(
            domain="Healthcare", research_types=[ResearchType.VOICE_OF_CUSTOMER]
        )
    }
    assert regulatory != voc, "the router must not return one fixed source set"


def test_life_sciences_routes_to_registries_not_healthcare():
    sources = source_registry.lookup(
        domain="Life Sciences", research_types=[ResearchType.SCIENTIFIC_CLINICAL]
    )
    names = [s.name for s in sources]
    assert any("ClinicalTrials" in n for n in names)


def test_domain_specific_sources_excluded_from_other_domains():
    technology = source_registry.lookup(
        domain="Technology", research_types=[ResearchType.TECHNOLOGY]
    )
    assert not any("Medicaid" in s.name for s in technology)


class TestUrlClassification:
    def test_government_domain_is_tier_one(self):
        _, tier = source_registry.classify_url("https://www.cms.gov/some/page")
        assert tier is SourceTier.TIER_1_AUTHORITATIVE

    def test_forum_is_market_evidence(self):
        source_type, tier = source_registry.classify_url("https://www.reddit.com/r/Medicaid/x")
        assert tier is SourceTier.TIER_3_MARKET_USER
        assert source_type is SourceType.COMMUNITY_FORUM

    def test_unknown_domain_defaults_to_general_web(self):
        """A source earns a higher tier by being identifiably authoritative,
        never by looking credible."""
        _, tier = source_registry.classify_url("https://some-consultancy.io/insights/x")
        assert tier is SourceTier.TIER_4_GENERAL_WEB

    def test_longest_registry_domain_wins(self):
        """pubmed.ncbi.nlm.nih.gov must not be shadowed by nih.gov."""
        source_type, _ = source_registry.classify_url("https://pubmed.ncbi.nlm.nih.gov/123/")
        assert source_type is SourceType.ACADEMIC

    def test_blog_is_downgraded_regardless_of_topic(self):
        _, tier = source_registry.classify_url(
            "https://medium.com/@someone/everything-about-medicaid-policy"
        )
        assert tier is SourceTier.TIER_4_GENERAL_WEB
