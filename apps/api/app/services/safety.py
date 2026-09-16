"""PII / PHI detection and redaction.

Healthcare discovery projects attract identifiable material — a pasted support
transcript, an exported claims extract, an interview recording's notes. Before
any text reaches a third-party model provider it passes through here.

This is a detection layer, not a compliance claim. It reduces the chance of
accidentally transmitting identifiers; it does not make a deployment HIPAA
compliant, and nothing in this codebase should be read as asserting that.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.config import settings


@dataclass
class Detection:
    kind: str
    count: int
    sample: str


@dataclass
class ScanResult:
    detections: list[Detection] = field(default_factory=list)
    redacted_text: str | None = None

    @property
    def found(self) -> bool:
        return bool(self.detections)

    @property
    def kinds(self) -> list[str]:
        return [d.kind for d in self.detections]

    def as_dict(self) -> dict:
        return {
            "found": self.found,
            "detections": [
                {"kind": d.kind, "count": d.count, "sample": d.sample} for d in self.detections
            ],
        }


#: Ordered so the most specific patterns match before the general ones.
PATTERNS: list[tuple[str, re.Pattern]] = [
    ("ssn", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("mrn", re.compile(r"\b(?:MRN|Medical Record(?: Number)?)[:\s#]*([A-Z0-9-]{6,})\b", re.I)),
    (
        "member_id",
        re.compile(r"\b(?:Member|Subscriber|Policy)\s*(?:ID|Number|#)[:\s]*([A-Z0-9-]{6,})\b", re.I),
    ),
    ("npi", re.compile(r"\bNPI[:\s#]*(\d{10})\b", re.I)),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b")),
    ("phone", re.compile(r"\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")),
    (
        "date_of_birth",
        re.compile(r"\b(?:DOB|Date of Birth)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", re.I),
    ),
    ("credit_card", re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")),
    ("ip_address", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    (
        "street_address",
        re.compile(
            r"\b\d{1,5}\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s"
            r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b"
        ),
    ),
]

_MASK = {
    "ssn": "[SSN REDACTED]",
    "mrn": "[MRN REDACTED]",
    "member_id": "[MEMBER ID REDACTED]",
    "npi": "[NPI REDACTED]",
    "email": "[EMAIL REDACTED]",
    "phone": "[PHONE REDACTED]",
    "date_of_birth": "[DOB REDACTED]",
    "credit_card": "[CARD REDACTED]",
    "ip_address": "[IP REDACTED]",
    "street_address": "[ADDRESS REDACTED]",
}


def _mask_sample(kind: str, value: str) -> str:
    """Show enough to be recognizable, never enough to be identifying."""
    if kind == "email" and "@" in value:
        local, _, domain = value.partition("@")
        return f"{local[:2]}***@{domain}"
    return f"{value[:2]}***{value[-2:]}" if len(value) > 6 else "***"


def scan(text: str, *, redact: bool = False) -> ScanResult:
    """Scan text for identifiers, optionally returning a redacted copy."""
    if not text or not settings.phi_detection_enabled:
        return ScanResult()

    detections: list[Detection] = []
    working = text

    for kind, pattern in PATTERNS:
        matches = pattern.findall(working)
        if not matches:
            continue
        flat = [m if isinstance(m, str) else next((g for g in m if g), "") for m in matches]
        detections.append(
            Detection(kind=kind, count=len(flat), sample=_mask_sample(kind, flat[0] or ""))
        )
        if redact:
            working = pattern.sub(_MASK[kind], working)

    return ScanResult(detections=detections, redacted_text=working if redact else None)


class PHIBlocked(Exception):
    """Raised when policy is `block` and identifiers were detected."""

    def __init__(self, result: ScanResult) -> None:
        self.result = result
        super().__init__(
            "Text contains identifiers ("
            + ", ".join(result.kinds)
            + ") and PHI_ON_DETECT is set to block."
        )


def guard_outbound(text: str) -> tuple[str, ScanResult]:
    """Apply the configured policy before text leaves for a model provider.

    Returns the text to send and what was found. `block` raises, `redact`
    substitutes, `warn` passes the text through with the finding recorded so
    the UI can surface it.
    """
    result = scan(text, redact=settings.phi_on_detect == "redact")
    if not result.found:
        return text, result
    if settings.phi_on_detect == "block":
        raise PHIBlocked(result)
    if settings.phi_on_detect == "redact":
        return result.redacted_text or text, result
    return text, result
