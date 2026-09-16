"""The rules that make the product trustworthy.

These tests assert the behaviours the platform exists to guarantee: that
strength labels follow authority, that coverage is honest about gaps, that
identifiers never leave unscreened, and that a broken citation is caught.
"""

from __future__ import annotations

from app.domain.enums import (
    CoverageLevel,
    EvidenceStrength,
    KnowledgeState,
    SourceTier,
)
from app.services import coverage, safety


class TestEvidenceStrength:
    def test_strength_labels_are_ordered(self):
        order = [
            EvidenceStrength.ANECDOTAL,
            EvidenceStrength.DIRECTIONAL,
            EvidenceStrength.MODERATE,
            EvidenceStrength.STRONG,
        ]
        assert [s.label for s in order] == [
            "Anecdotal Evidence", "Directional Evidence",
            "Moderate Evidence", "Strong Evidence",
        ]

    def test_tier_rank_is_monotonic(self):
        ranks = [
            SourceTier.TIER_1_AUTHORITATIVE.rank,
            SourceTier.TIER_2_STRONG_SECONDARY.rank,
            SourceTier.TIER_3_MARKET_USER.rank,
            SourceTier.TIER_4_GENERAL_WEB.rank,
        ]
        assert ranks == sorted(ranks) == [1, 2, 3, 4]

    def test_finding_is_never_stronger_than_its_weakest_evidence(self):
        from app.llm.mock_provider import MockProvider

        weakest = MockProvider._weakest(
            [EvidenceStrength.STRONG, EvidenceStrength.ANECDOTAL, EvidenceStrength.MODERATE]
        )
        assert weakest is EvidenceStrength.ANECDOTAL

    def test_weakest_of_empty_is_anecdotal(self):
        from app.llm.mock_provider import MockProvider

        assert MockProvider._weakest([]) is EvidenceStrength.ANECDOTAL


class TestCoverage:
    def test_no_evidence_is_not_researched(self):
        assert coverage._level(0, 0, 0) is CoverageLevel.NOT_RESEARCHED

    def test_authority_beats_volume(self):
        """Ten general-web items are not stronger coverage than two federal
        datasets plus corroboration."""
        volume_only = coverage._level(evidence_count=10, tier1=0, tier2=0)
        authoritative = coverage._level(evidence_count=6, tier1=2, tier2=1)
        assert authoritative is CoverageLevel.STRONG
        assert volume_only is CoverageLevel.WEAK

    def test_thin_authoritative_evidence_is_not_strong(self):
        assert coverage._level(evidence_count=2, tier1=1, tier2=0) is CoverageLevel.WEAK

    def test_rationale_explains_the_level(self):
        text = coverage._rationale(CoverageLevel.WEAK, 3, 0, 0)
        assert "thin or low-authority" in text

    def test_coverage_uses_qualitative_levels_only(self):
        """No completeness percentage: it would imply a methodology that does
        not exist."""
        assert set(CoverageLevel) == {
            CoverageLevel.NOT_RESEARCHED, CoverageLevel.WEAK,
            CoverageLevel.MODERATE, CoverageLevel.STRONG,
        }


class TestKnowledgeState:
    def test_unknown_is_a_first_class_answer(self):
        assert KnowledgeState.UNKNOWN in set(KnowledgeState)

    def test_four_states_are_distinct(self):
        assert len({s.value for s in KnowledgeState}) == 4


class TestSafety:
    def test_detects_common_identifiers(self):
        result = safety.scan(
            "Call 555-123-4567 or email jane.doe@example.com. SSN 123-45-6789. "
            "Member ID: A12345678."
        )
        assert result.found
        assert {"ssn", "email", "phone", "member_id"} <= set(result.kinds)

    def test_samples_are_masked_not_stored_whole(self):
        result = safety.scan("SSN 123-45-6789")
        sample = result.detections[0].sample
        assert "123-45-6789" not in sample

    def test_redaction_removes_the_identifier(self):
        result = safety.scan("SSN 123-45-6789 on file", redact=True)
        assert "123-45-6789" not in (result.redacted_text or "")
        assert "[SSN REDACTED]" in (result.redacted_text or "")

    def test_clean_text_produces_no_detections(self):
        result = safety.scan("Members cannot determine cost before care.")
        assert not result.found

    def test_scan_handles_empty_input(self):
        assert not safety.scan("").found


class TestCitationIntegrity:
    def test_unresolvable_citations_are_dropped(self):
        from app.orchestration.analysis import _known_refs

        known = [{"ref": "E-001"}, {"ref": "E-002"}]
        assert _known_refs(["E-001", "E-999", "E-002"], known) == ["E-001", "E-002"]

    def test_finding_refs_resolve_by_index_and_title(self):
        from app.orchestration.synthesis import _resolve_finding_refs

        index_map = {0: "F-001", 1: "F-002"}
        title_map = {"cost is unknowable": "F-002"}
        assert _resolve_finding_refs(["F-001"], index_map, title_map) == ["F-001"]
        assert _resolve_finding_refs(["2"], index_map, title_map) == ["F-002"]
        assert _resolve_finding_refs(["Cost is unknowable"], index_map, title_map) == ["F-002"]

    def test_unresolvable_finding_ref_is_dropped_not_invented(self):
        from app.orchestration.synthesis import _resolve_finding_refs

        assert _resolve_finding_refs(["something else"], {0: "F-001"}, {}) == []
