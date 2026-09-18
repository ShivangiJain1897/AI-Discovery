'use client';

import type { CoverageLevel, EvidenceStrength, KnowledgeState, SourceTier } from '@/lib/types';
import {
  COVERAGE_LABEL, KNOWLEDGE_LABEL, KNOWLEDGE_WHY,
  STRENGTH_LABEL, STRENGTH_WHY, TIER_LABEL, TIER_RANK,
} from '@/lib/format';

/** Evidence strength. The `title` carries the reasoning, because a label
 *  without its justification is the numeric-score problem in disguise. */
export function StrengthBadge({
  strength, reasoning, compact = false,
}: { strength: EvidenceStrength; reasoning?: string; compact?: boolean }) {
  return (
    <span
      className={`badge badge--${strength}`}
      title={reasoning || STRENGTH_WHY[strength]}
    >
      <span className="badge__dot" />
      {compact ? strength : STRENGTH_LABEL[strength]}
    </span>
  );
}

export function KnowledgeBadge({ state }: { state: KnowledgeState }) {
  return (
    <span className={`badge badge--${state}`} title={KNOWLEDGE_WHY[state]}>
      {KNOWLEDGE_LABEL[state]}
    </span>
  );
}

/** Source tier as a four-segment bar: rank is readable without the label,
 *  which matters when scanning a long evidence list. */
export function TierBadge({ tier, showLabel = true }: { tier: SourceTier; showLabel?: boolean }) {
  const rank = TIER_RANK[tier];
  return (
    <span className={`tier tier--${rank}`} title={`Tier ${rank} — ${TIER_LABEL[tier]}`}>
      <span className="tier__bar">
        {[0, 1, 2, 3].map((i) => <span key={i} className="tier__seg" />)}
      </span>
      {showLabel && <span>T{rank}</span>}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: 'internal' | 'external' }) {
  if (origin === 'external') return null;
  return (
    <span
      className="badge badge--internal"
      title="Internal material. Never used to build a public search query."
    >
      Internal
    </span>
  );
}

export function CoverageMeter({
  dimension, level, evidenceCount, tier1Count, rationale,
}: {
  dimension: string; level: CoverageLevel;
  evidenceCount: number; tier1Count: number; rationale: string;
}) {
  return (
    <div className={`cov__row cov--${level}`}>
      <span className="cov__dim">{dimension}</span>
      <span className="cov__meter">
        {[0, 1, 2].map((i) => <span key={i} className="cov__seg" />)}
      </span>
      <span className="cov__level">{COVERAGE_LABEL[level]}</span>
      <span className="cov__why" title={rationale}>
        {evidenceCount === 0
          ? 'No evidence collected'
          : `${evidenceCount} item${evidenceCount === 1 ? '' : 's'} · ${tier1Count} authoritative`}
      </span>
    </div>
  );
}

export function ConfidenceNote({ children }: { children: React.ReactNode }) {
  return <p className="tiny subtle" style={{ marginTop: 4 }}>{children}</p>;
}
