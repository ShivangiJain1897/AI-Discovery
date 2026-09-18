'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Evidence } from '@/lib/types';
import { EVIDENCE_TYPE_LABEL, splitRefs, TIER_LABEL } from '@/lib/format';
import { StrengthBadge, TierBadge } from './Badges';

/** The peek panel is the product's core interaction: any citation, anywhere,
 *  opens the evidence behind it and links on to the original source. It lives
 *  in context so a chip nested six components deep needs no prop drilling. */
const PeekContext = createContext<{ open: (ref: string) => void } | null>(null);

export function EvidencePeekProvider({
  projectId, children,
}: { projectId: string; children: React.ReactNode }) {
  const [ref, setRef] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((next: string) => {
    setRef(next);
    setEvidence(null);
    setError(null);
  }, []);

  const close = useCallback(() => setRef(null), []);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    api.getEvidence(projectId, ref)
      .then((found) => { if (!cancelled) setEvidence(found); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [ref, projectId]);

  useEffect(() => {
    if (!ref) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref, close]);

  return (
    <PeekContext.Provider value={{ open }}>
      {children}
      {ref && (
        <div className="peek" onClick={close} role="presentation">
          <aside
            className="peek__panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Evidence ${ref}`}
          >
            <header className="peek__head">
              <span className="mono" style={{ fontWeight: 600, color: 'var(--pine)' }}>{ref}</span>
              {evidence && (
                <StrengthBadge
                  strength={evidence.strength}
                  reasoning={evidence.strength_reasoning}
                />
              )}
              <button className="btn btn--ghost btn--sm right" onClick={close}>Close</button>
            </header>

            <div className="peek__body">
              {error && <div className="notice notice--risk">{error}</div>}
              {!evidence && !error && <div className="row"><span className="spin" /> <span className="muted small">Loading evidence…</span></div>}

              {evidence && (
                <>
                  <div className="peek__field">
                    <div className="peek__k">Statement</div>
                    <div className="peek__v">{evidence.statement}</div>
                  </div>

                  <div className="peek__field">
                    <div className="peek__k">Source excerpt</div>
                    <div className="ev__excerpt" style={{ marginTop: 0 }}>
                      &ldquo;{evidence.excerpt}&rdquo;
                    </div>
                  </div>

                  <div className="peek__field">
                    <div className="peek__k">Why this strength</div>
                    <div className="peek__v small muted">{evidence.strength_reasoning}</div>
                  </div>

                  <div className="peek__field">
                    <div className="peek__k">Population</div>
                    <div className="peek__v">
                      <span className="ev__pop">{evidence.population ?? 'Not stated by the source'}</span>
                      {evidence.population_note && (
                        <p className="tiny" style={{ color: 'var(--amber)', marginTop: 6 }}>
                          {evidence.population_note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="peek__field">
                    <div className="peek__k">Classification</div>
                    <div className="peek__v small">
                      {EVIDENCE_TYPE_LABEL[evidence.evidence_type] ?? evidence.evidence_type}
                      {' · '}
                      {evidence.research_type.replace(/_/g, ' ')}
                      {evidence.origin === 'internal' && ' · Internal'}
                    </div>
                  </div>

                  {evidence.limitations.length > 0 && (
                    <div className="peek__field">
                      <div className="peek__k">Limitations</div>
                      <ul className="peek__v small muted" style={{ paddingLeft: 18, margin: 0 }}>
                        {evidence.limitations.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    </div>
                  )}

                  {(evidence.corroborated_by.length > 0 || evidence.contradicted_by.length > 0) && (
                    <div className="peek__field">
                      <div className="peek__k">Cross-references</div>
                      <div className="peek__v small">
                        {evidence.corroborated_by.length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            Corroborated by{' '}
                            <RefList refs={evidence.corroborated_by} />
                          </div>
                        )}
                        {evidence.contradicted_by.length > 0 && (
                          <div>
                            Contradicted by{' '}
                            <RefList refs={evidence.contradicted_by} tone="clay" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="divider" />

                  <div className="peek__field">
                    <div className="peek__k">Source</div>
                    <div className="peek__v">
                      <div style={{ marginBottom: 6 }}>{evidence.source.title}</div>
                      <div className="row small muted">
                        <TierBadge tier={evidence.source.tier} />
                        <span>{TIER_LABEL[evidence.source.tier]}</span>
                      </div>
                      <div className="tiny subtle" style={{ marginTop: 6 }}>
                        {[
                          evidence.source.publisher,
                          evidence.source.publication_date,
                          evidence.source.source_type.replace(/_/g, ' '),
                        ].filter(Boolean).join(' · ')}
                      </div>
                      {evidence.source.url && (
                        <a
                          className="btn btn--sm"
                          style={{ marginTop: 10 }}
                          href={evidence.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open original source ↗
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </PeekContext.Provider>
  );
}

export function EvidenceChip({ refId, tone }: { refId: string; tone?: 'clay' }) {
  const context = useContext(PeekContext);
  if (!context) return <span className="chip chip--plain">{refId}</span>;
  return (
    <button
      className={`chip${tone === 'clay' ? ' chip--clay' : ''}`}
      onClick={() => context.open(refId)}
      title={`Show the evidence behind ${refId}`}
      type="button"
    >
      {refId}
    </button>
  );
}

export function RefList({ refs, tone }: { refs: string[]; tone?: 'clay' }) {
  if (refs.length === 0) return <span className="subtle tiny">No citations</span>;
  return (
    <span className="chips">
      {refs.map((ref) => <EvidenceChip key={ref} refId={ref} tone={tone} />)}
    </span>
  );
}

/** Renders prose, converting inline `[E-012]` markers into live chips so a
 *  citation stays clickable wherever the text ends up. */
export function Cited({ text }: { text: string }) {
  return (
    <>
      {splitRefs(text).map((part, index) =>
        part.ref
          ? <EvidenceChip key={`${part.ref}-${index}`} refId={part.ref} />
          : <span key={index}>{part.text}</span>,
      )}
    </>
  );
}
