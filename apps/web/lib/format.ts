import type { CoverageLevel, EvidenceStrength, KnowledgeState, SourceTier } from './types';

export const titleCase = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  directional: 'Directional evidence',
  anecdotal: 'Anecdotal evidence',
};

export const STRENGTH_WHY: Record<EvidenceStrength, string> = {
  strong: 'Authoritative source, corroborated. Safe to build a conclusion on.',
  moderate: 'Credible source. Supports a finding with its limits stated.',
  directional: 'Indicative, usually lived experience. Shows direction, not magnitude.',
  anecdotal: 'Single or low-authority source. Treat as a lead, not a basis.',
};

export const KNOWLEDGE_LABEL: Record<KnowledgeState, string> = {
  known: 'Known',
  likely: 'Likely',
  hypothesis: 'Hypothesis',
  unknown: 'Unknown',
};

export const KNOWLEDGE_WHY: Record<KnowledgeState, string> = {
  known: 'Directly supported by evidence in this project.',
  likely: 'A reasonable inference from the evidence, stated as inference.',
  hypothesis: 'Plausible but unsupported. Needs validation before acting.',
  unknown: 'The research did not establish this.',
};

export const TIER_LABEL: Record<SourceTier, string> = {
  tier_1_authoritative: 'Primary / Authoritative',
  tier_2_strong_secondary: 'Strong Secondary',
  tier_3_market_user: 'Market / User Evidence',
  tier_4_general_web: 'General Web',
};

export const TIER_RANK: Record<SourceTier, 1 | 2 | 3 | 4> = {
  tier_1_authoritative: 1,
  tier_2_strong_secondary: 2,
  tier_3_market_user: 3,
  tier_4_general_web: 4,
};

export const COVERAGE_LABEL: Record<CoverageLevel, string> = {
  not_researched: 'Not researched',
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
};

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  fact: 'Fact',
  claim: 'Claim',
  opinion: 'Opinion',
  user_feedback: 'User feedback',
  statistic: 'Statistic',
  observation: 'Observation',
  inference: 'AI inference',
};

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Split prose on inline refs so they can be rendered as chips. */
export function splitRefs(text: string): { text: string; ref?: string }[] {
  const pattern = /\[((?:E|F|I|O|T|S|A|UC|ART|RP|RQ|SYN|DOC)-\d+(?:\s*,\s*(?:E|F|I|O|T|S|A|UC|ART|RP|RQ|SYN|DOC)-\d+)*)\]/g;
  const parts: { text: string; ref?: string }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    for (const ref of match[1].split(',').map((r) => r.trim())) {
      parts.push({ text: ref, ref });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
