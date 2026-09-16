'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Analysis, AnalysisRouting } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox, Notice } from '@/components/Shell';
import { StrengthBadge } from '@/components/Badges';
import { RefList } from '@/components/EvidenceChip';
import { DocView } from '@/components/DocView';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';
import { relativeTime } from '@/lib/format';

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Analysis">
      <AnalysisGallery />
    </ProjectShell>
  );
}

function AnalysisGallery() {
  const { project, reload } = useProject();
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [routing, setRouting] = useState<AnalysisRouting | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, route] = await Promise.allSettled([
      api.listAnalyses(project.id),
      api.recommendedAnalyses(project.id),
    ]);
    if (list.status === 'fulfilled') setAnalyses(list.value);
    else { setAnalyses([]); setError(list.reason?.message ?? 'Could not load analyses.'); }
    if (route.status === 'fulfilled') {
      setRouting(route.value);
      setSelected((current) =>
        current.length ? current : route.value.recommended.slice(0, 2).map((r) => r.analysis_type));
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const runner = useJobRunner(async () => { await load(); await reload(); });
  const hasFindings = project.counts.findings > 0;

  return (
    <>
      <PageHead
        title="Analysis"
        lede="Research answers “what did we learn?”. Analysis answers “what does this mean?”. The same evidence base supports every analysis — run as many as the question needs."
        actions={
          hasFindings && (
            <button
              className="btn btn--primary"
              disabled={runner.busy || selected.length === 0}
              onClick={() => runner.run(() => api.runAnalyses(project.id, selected))}
            >
              {runner.busy
                ? 'Analysing…'
                : `Run ${selected.length || ''} ${selected.length === 1 ? 'analysis' : 'analyses'}`}
            </button>
          )
        }
      />

      <ErrorBox error={error ?? runner.error} />
      <JobStatusLine job={runner.job} busy={runner.busy} />

      {!analyses && <Loading what="Loading analyses" />}

      {analyses && !hasFindings && (
        <div className="card">
          <Empty mark="◇" title="Nothing to analyse yet">
            Analysis runs on findings. Synthesize the evidence first, then come back —
            the router will suggest which analyses this evidence base can actually support.
          </Empty>
        </div>
      )}

      {analyses && hasFindings && (
        <div className="stack">
          {routing && (
            <div className="card">
              <div className="card__head">
                <h2>Choose analyses</h2>
                <span className="tiny subtle card__head-actions">{routing.reasoning}</span>
              </div>
              <div className="card__body">
                {routing.recommended.length > 0 && (
                  <>
                    <div className="filter__title">Recommended for this evidence base</div>
                    <div className="grid grid--2" style={{ gap: 10, marginBottom: 18 }}>
                      {routing.recommended.map((item) => (
                        <label
                          key={item.analysis_type}
                          className="card"
                          style={{
                            padding: 12, cursor: 'pointer', display: 'flex', gap: 10,
                            borderColor: selected.includes(item.analysis_type)
                              ? 'var(--pine)' : 'var(--rule)',
                            background: selected.includes(item.analysis_type)
                              ? 'var(--pine-soft)' : 'var(--paper-raised)',
                          }}
                        >
                          <input
                            type="checkbox"
                            style={{ marginTop: 3, accentColor: 'var(--pine)' }}
                            checked={selected.includes(item.analysis_type)}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(item.analysis_type)
                                  ? current.filter((t) => t !== item.analysis_type)
                                  : [...current, item.analysis_type])}
                          />
                          <div>
                            <strong className="small">{item.label}</strong>
                            <p className="tiny muted" style={{ margin: '2px 0 0' }}>{item.why}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                <details>
                  <summary className="filter__title" style={{ cursor: 'pointer' }}>
                    All {routing.available.length} analysis types
                  </summary>
                  <div className="row" style={{ gap: 6, marginTop: 10 }}>
                    {routing.available.map((item) => (
                      <button
                        key={item.analysis_type}
                        className={`btn btn--sm${selected.includes(item.analysis_type) ? ' btn--primary' : ''}`}
                        onClick={() =>
                          setSelected((current) =>
                            current.includes(item.analysis_type)
                              ? current.filter((t) => t !== item.analysis_type)
                              : [...current, item.analysis_type])}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="hint" style={{ marginTop: 10 }}>
                    You do not need to know every framework — the recommendations above are
                    a good default. This list is here when you want something specific.
                  </p>
                </details>
              </div>
            </div>
          )}

          {analyses.length === 0 && (
            <div className="card">
              <Empty mark="○" title="No analyses run yet">
                Pick one or more above and run them. Each produces a structured result that
                cites the evidence it rests on.
              </Empty>
            </div>
          )}

          {analyses.length > 0 && (
            <div className="grid grid--2">
              {analyses.map((analysis) => (
                <div className="card" key={analysis.id}>
                  <div className="card__head">
                    <h2>{analysis.title}</h2>
                    <span className="card__head-actions">
                      <StrengthBadge strength={analysis.confidence} compact />
                    </span>
                  </div>
                  <div className="card__body">
                    <p className="small muted">{analysis.summary}</p>
                    <div className="row" style={{ marginTop: 10, gap: 6 }}>
                      <span className="mono tiny muted">{analysis.ref}</span>
                      <span className="tiny subtle">{analysis.sections.length} sections</span>
                      <span className="tiny subtle">· {relativeTime(analysis.created_at)}</span>
                    </div>
                    {analysis.unknowns.length > 0 && (
                      <p className="tiny" style={{ color: 'var(--amber)', marginTop: 8 }}>
                        {analysis.unknowns.length} open unknown{analysis.unknowns.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  <div className="card__foot row">
                    <button className="btn btn--sm" onClick={() => setOpen(analysis)}>Open</button>
                    <a className="btn btn--sm" href={api.analysisExportUrl(project.id, analysis.ref, 'docx')}>DOCX</a>
                    <a className="btn btn--sm" href={api.analysisExportUrl(project.id, analysis.ref, 'xlsx')}>XLSX</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open && <AnalysisPeek analysis={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AnalysisPeek({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="peek" onClick={onClose} role="presentation">
      <aside
        className="peek__panel"
        style={{ width: 'min(760px, 100%)' }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={analysis.title}
      >
        <header className="peek__head">
          <strong>{analysis.title}</strong>
          <StrengthBadge strength={analysis.confidence} compact />
          <button className="btn btn--ghost btn--sm right" onClick={onClose}>Close</button>
        </header>
        <div className="peek__body">
          <p className="muted small" style={{ marginBottom: 18 }}>{analysis.summary}</p>

          <DocView sections={analysis.sections} />

          {analysis.assumptions.length > 0 && (
            <>
              <div className="divider" />
              <div className="peek__k">Assumptions this analysis makes</div>
              <ul className="small muted" style={{ paddingLeft: 18 }}>
                {analysis.assumptions.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </>
          )}

          {analysis.unknowns.length > 0 && (
            <>
              <Notice tone="warn">
                <strong>Still unknown.</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                  {analysis.unknowns.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </Notice>
            </>
          )}

          {analysis.evidence_refs.length > 0 && (
            <>
              <div className="divider" />
              <div className="peek__k">Evidence used</div>
              <RefList refs={analysis.evidence_refs} />
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
