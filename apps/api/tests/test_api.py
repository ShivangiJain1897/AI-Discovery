"""End-to-end API tests against the real schema and the seeded project."""

from __future__ import annotations


class TestHealth:
    def test_reports_effective_providers(self, client):
        body = client.get("/health").json()
        assert body["status"] == "ok"
        assert body["prompts"]["count"] == 31
        assert body["llm"]["effective"] == "mock"

    def test_warns_when_running_without_a_credential(self, client):
        """A user seeing 'Not established' everywhere needs a visible reason."""
        body = client.get("/health").json()
        assert body["llm"]["live"] is False
        assert "ANTHROPIC_API_KEY" in body["llm"]["note"]

    def test_confirms_pgvector_is_available(self, client):
        assert client.get("/health").json()["database"]["pgvector"] is True


class TestProjects:
    def test_seeded_project_is_listed(self, client, seeded):
        ids = [p["id"] for p in client.get("/projects").json()]
        assert str(seeded.id) in ids

    def test_detail_includes_counts_and_coverage(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}").json()
        assert body["counts"]["evidence"] == 16
        assert body["counts"]["findings"] == 6
        assert len(body["coverage"]) == 8

    def test_coverage_reports_honest_gaps(self, client, seeded):
        """Dimensions with no evidence must say so rather than being omitted."""
        coverage = client.get(f"/projects/{seeded.id}/coverage").json()
        by_dimension = {c["dimension"]: c for c in coverage}
        assert by_dimension["market"]["level"] == "not_researched"
        assert by_dimension["market"]["evidence_count"] == 0

    def test_context_edits_are_marked_as_user_owned(self, client, seeded):
        """A user's edit must not be silently re-inferred later."""
        body = client.patch(
            f"/projects/{seeded.id}/context", json={"geography": "California"}
        ).json()
        assert body["geography"] == "California"
        assert "geography" in body["user_edited_fields"]

    def test_unknown_project_is_404(self, client):
        response = client.get("/projects/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404


class TestEvidenceLibrary:
    def test_lists_evidence_with_facets(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/evidence").json()
        assert body["total"] == 16
        assert set(body["facets"]) >= {"strength", "tier", "evidence_type", "origin"}

    def test_tier_filter_narrows_results(self, client, seeded):
        body = client.get(
            f"/projects/{seeded.id}/evidence",
            params={"tier": "tier_3_market_user"},
        ).json()
        assert body["total"] == 4
        assert all(
            item["source"]["tier"] == "tier_3_market_user" for item in body["items"]
        )

    def test_evidence_type_filter_isolates_user_feedback(self, client, seeded):
        body = client.get(
            f"/projects/{seeded.id}/evidence",
            params={"evidence_type": "user_feedback"},
        ).json()
        assert body["total"] == 4

    def test_free_text_search_matches_statements(self, client, seeded):
        body = client.get(
            f"/projects/{seeded.id}/evidence", params={"q": "exempt"}
        ).json()
        assert body["total"] >= 1

    def test_every_item_carries_its_population(self, client, seeded):
        """Population is what stops a finding being generalized beyond its source."""
        body = client.get(f"/projects/{seeded.id}/evidence").json()
        assert all(item["population"] for item in body["items"])

    def test_strength_is_accompanied_by_its_reasoning(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/evidence").json()
        assert all(item["strength_reasoning"] for item in body["items"])

    def test_single_evidence_lookup_resolves_a_ref(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/evidence/E-001").json()
        assert body["ref"] == "E-001"
        assert body["source"]["ref"]

    def test_unknown_ref_is_404(self, client, seeded):
        assert client.get(f"/projects/{seeded.id}/evidence/E-999").status_code == 404


class TestFindings:
    def test_findings_cite_evidence(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/findings").json()
        assert len(body["findings"]) == 6
        assert all(f["evidence_refs"] for f in body["findings"])

    def test_findings_carry_confidence_and_limits(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/findings").json()
        for finding in body["findings"]:
            assert finding["confidence"] in {
                "strong", "moderate", "directional", "anecdotal"
            }
            assert finding["limitations"]

    def test_insights_reference_findings_not_sources(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/findings").json()
        known = {f["ref"] for f in body["findings"]}
        for insight in body["insights"]:
            assert insight["finding_refs"]
            assert set(insight["finding_refs"]) <= known

    def test_contradictions_present_both_positions(self, client, seeded):
        synthesis = client.get(f"/projects/{seeded.id}/synthesis").json()
        for contradiction in synthesis["contradictions"]:
            assert contradiction["evidence_refs_a"] and contradiction["evidence_refs_b"]

    def test_gaps_say_whether_search_can_close_them(self, client, seeded):
        synthesis = client.get(f"/projects/{seeded.id}/synthesis").json()
        assert synthesis["evidence_gaps"]
        for gap in synthesis["evidence_gaps"]:
            assert isinstance(gap["can_secondary_research_close_it"], bool)
            assert gap["suggested_approach"]


class TestAnalysis:
    def test_router_only_recommends_supportable_analyses(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/analysis/recommended").json()
        assert len(body["recommended"]) <= 4
        assert len(body["available"]) == 15

    def test_recommendations_explain_themselves(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/analysis/recommended").json()
        assert all(item["why"] for item in body["recommended"])

    def test_seeded_analysis_marks_unquantified_fields(self, client, seeded):
        """Frequency and severity must read 'Not established', never a score
        the evidence cannot support."""
        analyses = client.get(f"/projects/{seeded.id}/analysis").json()
        pain = next(a for a in analyses if a["analysis_type"] == "pain_point")
        rows = pain["sections"][0]["rows"]
        assert all(row["Frequency"] == "Not established" for row in rows)


class TestOpportunities:
    def test_opportunities_carry_a_validation_plan(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/opportunities").json()
        assert len(body) == 3
        assert all(o["validation_plan"] for o in body)

    def test_opportunities_offer_multiple_solution_directions(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/opportunities").json()
        assert all(len(o["solution_directions"]) >= 2 for o in body)

    def test_status_is_updatable(self, client, seeded):
        body = client.patch(
            f"/projects/{seeded.id}/opportunities/O-001", json={"status": "validated"}
        ).json()
        assert body["status"] == "validated"

    def test_use_cases_trace_to_evidence(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/use-cases").json()
        assert len(body) == 4
        assert all(u["evidence_refs"] for u in body)


class TestArtifacts:
    def test_artifact_types_declare_sections_and_formats(self, client, seeded):
        body = client.get(f"/projects/{seeded.id}/artifacts/types").json()
        prd = next(t for t in body if t["artifact_type"] == "prd")
        assert len(prd["sections"]) == 23
        assert "docx" in prd["export_formats"]

    def test_generation_runs_and_passes_the_critic(self, client, seeded):
        job = client.post(
            f"/projects/{seeded.id}/artifacts",
            json={"artifact_type": "prd", "title": "Test PRD"},
        ).json()
        # TestClient runs background tasks synchronously on response close.
        finished = client.get(f"/jobs/{job['id']}").json()
        assert finished["status"] == "succeeded", finished.get("error")
        assert finished["result"]["critique_passed"] is True

    def test_generated_prd_marks_unestablished_sections(self, client, seeded):
        client.post(
            f"/projects/{seeded.id}/artifacts", json={"artifact_type": "prd"}
        )
        artifacts = client.get(f"/projects/{seeded.id}/artifacts").json()
        detail = client.get(
            f"/projects/{seeded.id}/artifacts/{artifacts[0]['ref']}"
        ).json()
        states = {s["knowledge_state"] for s in detail["version"]["sections"]}
        assert "unknown" in states, "unsupported sections must not be invented"

    def test_every_citation_in_an_artifact_resolves(self, client, seeded):
        client.post(f"/projects/{seeded.id}/artifacts", json={"artifact_type": "prd"})
        artifacts = client.get(f"/projects/{seeded.id}/artifacts").json()
        detail = client.get(
            f"/projects/{seeded.id}/artifacts/{artifacts[0]['ref']}"
        ).json()
        known = {
            item["ref"]
            for item in client.get(f"/projects/{seeded.id}/evidence").json()["items"]
        }
        for section in detail["version"]["sections"]:
            assert set(section["evidence_refs"]) <= known

    def test_export_returns_a_native_document(self, client, seeded):
        client.post(f"/projects/{seeded.id}/artifacts", json={"artifact_type": "prd"})
        ref = client.get(f"/projects/{seeded.id}/artifacts").json()[0]["ref"]
        response = client.post(
            f"/projects/{seeded.id}/artifacts/{ref}/export", json={"format": "docx"}
        )
        assert response.status_code == 200
        assert response.content[:2] == b"PK"  # OOXML is a zip
        assert "attachment" in response.headers["content-disposition"]

    def test_artifact_generation_requires_evidence(self, client):
        """An artifact built from nothing would be pure invention."""
        project = client.post(
            "/projects",
            json={"question": "A question with no research behind it at all.",
                  "normalize": False},
        ).json()
        response = client.post(
            f"/projects/{project['id']}/artifacts", json={"artifact_type": "prd"}
        )
        assert response.status_code == 409


class TestCopilot:
    def test_answers_cite_project_evidence(self, client, seeded):
        body = client.post(
            f"/projects/{seeded.id}/copilot",
            json={"question": "What evidence supports members calling about cost?"},
        ).json()
        assert body["evidence_refs"]
        assert body["knowledge_state"] in {"known", "likely", "hypothesis", "unknown"}

    def test_returns_the_evidence_it_used(self, client, seeded):
        body = client.post(
            f"/projects/{seeded.id}/copilot", json={"question": "cost sharing exemptions"}
        ).json()
        assert len(body["evidence"]) == len(body["evidence_refs"])


class TestPromptsEndpoint:
    def test_lists_all_prompts(self, client):
        assert len(client.get("/prompts").json()) == 31

    def test_groups_prompts_by_stage(self, client):
        stages = client.get("/prompts/stages").json()
        assert "synthesis" in stages and "quality" in stages

    def test_unknown_prompt_is_404(self, client):
        assert client.get("/prompts/nope").status_code == 404
