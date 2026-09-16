"""The orchestration pipeline: refs, ingestion, jobs and provider fallback."""

from __future__ import annotations

import pytest

from app.db.models import Project, Workspace
from app.domain.enums import JobStatus
from app.services import ingestion, refs


@pytest.fixture
def project(session):
    workspace = Workspace(name="Test", slug=f"test-{id(session)}")
    session.add(workspace)
    session.flush()
    project = Project(
        workspace_id=workspace.id,
        title="Test project",
        question="A test discovery question for the pipeline.",
        ref_counters={},
    )
    session.add(project)
    session.flush()
    return project


class TestRefAllocation:
    def test_refs_are_sequential_and_prefixed(self, session, project):
        assert refs.allocate(session, project.id, "evidence", 3) == [
            "E-001", "E-002", "E-003"
        ]

    def test_counters_continue_across_calls(self, session, project):
        refs.allocate(session, project.id, "evidence", 2)
        assert refs.allocate_one(session, project.id, "evidence") == "E-003"

    def test_entity_types_have_independent_counters(self, session, project):
        refs.allocate(session, project.id, "evidence", 5)
        assert refs.allocate_one(session, project.id, "finding") == "F-001"

    def test_refs_are_unique_within_a_project(self, session, project):
        allocated = refs.allocate(session, project.id, "evidence", 50)
        assert len(set(allocated)) == 50

    def test_unregistered_entity_is_rejected(self, session, project):
        with pytest.raises(ValueError, match="No ref prefix"):
            refs.allocate(session, project.id, "not_an_entity")


class TestDocumentParsing:
    def test_plain_text(self):
        text, pages = ingestion.parse("notes.txt", b"Interview notes about cost.")
        assert "Interview notes" in text
        assert pages == 0

    def test_csv_becomes_delimited_rows(self):
        text, _ = ingestion.parse("tickets.csv", b"id,issue\n1,cost unclear\n")
        assert "cost unclear" in text

    def test_json_is_pretty_printed(self):
        text, _ = ingestion.parse("data.json", b'{"issue":"cost"}')
        assert '"issue"' in text

    def test_docx_round_trips(self):
        import io

        from docx import Document as DocxDocument

        document = DocxDocument()
        document.add_paragraph("Members cannot estimate cost.")
        buffer = io.BytesIO()
        document.save(buffer)

        text, _ = ingestion.parse("interview.docx", buffer.getvalue())
        assert "Members cannot estimate cost." in text

    def test_unsupported_extension_is_rejected_with_guidance(self):
        with pytest.raises(ingestion.UnsupportedDocument, match="Supported"):
            ingestion.parse("recording.mp3", b"\x00\x01")

    def test_invalid_json_is_rejected_clearly(self):
        with pytest.raises(ingestion.UnsupportedDocument, match="Invalid JSON"):
            ingestion.parse("bad.json", b"{not json")


class TestInternalEvidenceIsolation:
    def test_uploads_are_labelled_internal(self, session, project):
        document = ingestion.ingest(
            session, project,
            filename="interview.txt",
            data=b"The member said they could not find out what it would cost.",
            document_kind="interview_transcript",
        )
        assert document.origin.value == "internal"

    def test_identifiers_are_detected_at_ingest(self, session, project):
        document = ingestion.ingest(
            session, project,
            filename="ticket.txt",
            data=b"Member ID: A12345678 called about a bill. Phone 555-123-4567.",
            document_kind="support_tickets",
        )
        assert document.phi_scan["found"] is True
        kinds = {d["kind"] for d in document.phi_scan["detections"]}
        assert "member_id" in kinds

    def test_document_kind_sets_the_research_type(self):
        from app.domain.enums import ResearchType

        assert ingestion.DOCUMENT_KINDS["support_tickets"] is ResearchType.VOICE_OF_CUSTOMER
        assert ingestion.DOCUMENT_KINDS["interview_transcript"] is ResearchType.USER


class TestJobs:
    def test_every_handler_is_registered(self):
        # Importing the routers registers their handlers.
        import app.main  # noqa: F401
        from app.services import jobs

        assert {
            "research_run", "synthesis", "analysis", "opportunities",
            "use_cases", "recommendations", "artifact", "artifact_section",
            "ingest_document",
        } <= set(jobs.HANDLERS)

    def test_unknown_kind_cannot_be_enqueued(self, session, project):
        from app.services import jobs

        with pytest.raises(ValueError, match="No handler registered"):
            jobs.enqueue(session, kind="not_a_job", project_id=project.id)

    def test_status_is_compared_by_value_not_identity(self, session, project):
        """The column is a String, so the DB returns a plain str — an identity
        check here would silently skip every job."""
        import app.main  # noqa: F401
        from app.services import jobs

        job = jobs.enqueue(session, kind="synthesis", project_id=project.id)
        session.commit()
        assert JobStatus(job.status) is JobStatus.QUEUED


class TestProviderFallback:
    def test_missing_credential_selects_the_deterministic_provider(self):
        from app.config import Settings

        settings = Settings(llm_provider="anthropic", anthropic_api_key="")
        assert settings.effective_llm_provider == "mock"
        assert settings.is_live_ai is False

    def test_present_credential_selects_the_real_provider(self):
        from app.config import Settings

        settings = Settings(llm_provider="anthropic", anthropic_api_key="sk-test")
        assert settings.effective_llm_provider == "anthropic"
        assert settings.is_live_ai is True

    def test_search_falls_back_independently(self):
        from app.config import Settings

        settings = Settings(search_provider="tavily", tavily_api_key="")
        assert settings.effective_search_provider == "mock"

    def test_deterministic_provider_never_invents_a_statistic(self):
        """The fallback composes stored data; it must not manufacture figures."""
        from app.domain.contracts import SynthesisContract
        from app.llm.mock_provider import MockProvider

        result, meta = MockProvider().complete_structured(
            system="", user="",
            schema=SynthesisContract,
            context={
                "evidence_items": [
                    {"ref": "E-001", "statement": "A statement.", "strength": "strong"}
                ],
                "themes": [],
                "research_plan": {},
            },
        )
        assert "Not established" in result.executive_summary or "require" in result.executive_summary
        assert meta.warnings, "the fallback must flag that no model ran"

    def test_deterministic_artifact_marks_sections_unknown(self):
        from app.domain.contracts import ArtifactContract
        from app.llm.mock_provider import MockProvider

        result, _ = MockProvider().complete_structured(
            system="", user="",
            schema=ArtifactContract,
            context={"artifact_type": "prd", "findings": [], "evidence_items": []},
        )
        states = {section.knowledge_state.value for section in result.sections}
        assert states == {"unknown"}
