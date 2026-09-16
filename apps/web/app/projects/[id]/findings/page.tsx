'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { FindingsBundle } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox, Notice } from '@/components/Shell';
import { StrengthBadge, KnowledgeBadge } from '@/components/Badges';
import { RefList, Cited } from '@/components/EvidenceChip';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';

export default function FindingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Findings">
      <Findings />
    </ProjectShell>
  );
}

function Findings() {
  const { project, reload } = useProject();
  const [bundle, setBundle] = useState<FindingsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBundle(await api.getFindings(project.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load findings.');
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const synth = useJobRunner(async () => { await load(); await reload(); });
  const synthesis = bundle?.synthesis;
  const hasEvidence = project.counts.evidence > 0;

  return (
    <>
      <PageHead
        title="Findings"
        lede="Patterns that hold across evidence — not a summary of each source. Every finding cites the evidence beneath it and carries an honest confidence label."
        actions={
          hasEvidence && (
            <button
              className="btn btn--primary"
              disabled={synth.busy}
              onClick={() => synth.run(() => api.runSynthesis(project.id))}
            >
              {synth.busy ? 'Synthesizing…' : synthesis ? 'Re-run synthesis' : 'Synthesize evidence'}
            </button>
          )
        }
      />

      <ErrorBox error={error ?? synth.error} />
      <JobStatusLine job={synth.job} busy={synth.busy} />

      {!bundle && <Loading what="Loading findings" />}

      {bundle && !synthesis && (
        <div className="card">
          <Empty mark="◇" title={hasEvidence ? 'Evidence collected, not yet synthesized' : 'No evidence yet'}>
            {hasEvidence
              ? `${project.counts.evidence} evidence items are waiting. Synthesis clusters them into themes, then derives findings that hold across sources.`
              : 'Run research first — findings are derived from evidence, never from the model’s own knowledge.'}
          </Empty>
        </div>
      )}

      {synthesis && bundle && (
        <div className="stack">
          <div className="card">
            <div className="card__head">
              <h2>Executive summary</h2>
              <span className="badge badge--neutral card__head-actions">
                {synthesis.ref} v{synthesis.version} · {synthesis.evidence_examined} evidence from {synthesis.sources_examined} sources
              </span>
            </div>
            <div className="card__body">
              <div className="doc" style={{ whiteSpace: 'pre-wrap' }}>
                <Cited text={synthesis.executive_summary} />
              </div>
            </div>
            <div className="card__foot row">
              <span>Export the full research report:</span>
              <a className="btn btn--sm" href={api.researchReportUrl(project.id, 'docx')}>DOCX</a>
              <a className="btn btn--sm" href={api.researchReportUrl(project.id, 'pdf')}>PDF</a>
              <a className="btn btn--sm" href={api.researchReportUrl(project.id, 'markdown')}>Markdown</a>
            </div>
          </div>

          {bundle.findings.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Key findings</h2></div>
              <div>
                {bundle.findings.map((finding) => (
                  <div key={finding.id} style={{ padding: '16px', borderTop: '1px solid var(--rule)' }}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="mono tiny" style={{ color: 'var(--pine)', fontWeight: 600 }}>
                        {finding.ref}
                      </span>
                      <strong style={{ flex: 1, minWidth: 200 }}>{finding.title}</strong>
                      <StrengthBadge strength={finding.confidence} />
                      <KnowledgeBadge state={finding.knowledge_state} />
                    </div>

                    <p className="small" style={{ marginBottom: 8 }}>{finding.finding}</p>

                    <div className="small muted" style={{ marginBottom: 8 }}>
                      <strong>Why it matters:</strong> {finding.why_it_matters}
                    </div>

                    {finding.prevalence && (
                      <div className="tiny subtle" style={{ marginBottom: 6 }}>{finding.prevalence}</div>
                    )}

                    {finding.limitations.length > 0 && (
                      <div className="notice notice--warn" style={{ margin: '8px 0', fontSize: '0.76rem' }}>
                        <span className="notice__mark">!</span>
                        <div>
                          <strong>Limits of this finding:</strong>
                          <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                            {finding.limitations.map((limit, index) => <li key={index}>{limit}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="row" style={{ marginTop: 8 }}>
                      <span className="tiny subtle">Evidence:</span>
                      <RefList refs={finding.evidence_refs} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bundle.insights.length > 0 && (
            <div className="card">
              <div className="card__head">
                <h2>Insights</h2>
                <span className="tiny subtle card__head-actions">why the findings matter</span>
              </div>
              <div>
                {bundle.insights.map((insight) => (
                  <div key={insight.id} style={{ padding: 16, borderTop: '1px solid var(--rule)' }}>
                    <div className="row" style={{ marginBottom: 6 }}>
                      <span className="mono tiny" style={{ color: 'var(--pine)', fontWeight: 600 }}>
                        {insight.ref}
                      </span>
                      <strong style={{ flex: 1, minWidth: 200 }}>{insight.title}</strong>
                      <StrengthBadge strength={insight.confidence} />
                    </div>
                    <p className="small">{insight.insight}</p>
                    <div className="small muted"><strong>Why it matters:</strong> {insight.why_it_matters}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      <strong>Product implication:</strong> {insight.product_implication}
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <span className="tiny subtle">Rests on findings:</span>
                      <span className="chips">
                        {insight.finding_refs.map((ref) => (
                          <span className="chip chip--plain" key={ref}>{ref}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {synthesis.contradictions.length > 0 && (
            <div className="card">
              <div className="card__head">
                <h2>Contradictions</h2>
                <span className="tiny subtle card__head-actions">
                  surfaced, not reconciled away
                </span>
              </div>
              <div>
                {synthesis.contradictions.map((contradiction, index) => (
                  <div key={index} style={{ padding: 16, borderTop: '1px solid var(--rule)' }}>
                    <strong className="small">{contradiction.topic}</strong>
                    <div className="grid grid--2" style={{ marginTop: 10, gap: 12 }}>
                      <div style={{ padding: 12, background: 'var(--paper-sunken)', borderRadius: 6 }}>
                        <div className="peek__k">Position A</div>
                        <p className="small" style={{ margin: '4px 0 8px' }}>{contradiction.position_a}</p>
                        <RefList refs={contradiction.evidence_refs_a} />
                      </div>
                      <div style={{ padding: 12, background: 'var(--paper-sunken)', borderRadius: 6 }}>
                        <div className="peek__k">Position B</div>
                        <p className="small" style={{ margin: '4px 0 8px' }}>{contradiction.position_b}</p>
                        <RefList refs={contradiction.evidence_refs_b} tone="clay" />
                      </div>
                    </div>
                    <div className="small muted" style={{ marginTop: 10 }}>
                      <strong>Assessment:</strong> {contradiction.assessment}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <KnowledgeBadge state={contradiction.resolution} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid--2">
            {synthesis.evidence_gaps.length > 0 && (
              <div className="card">
                <div className="card__head">
                  <h2>Evidence gaps</h2>
                  <span className="tiny subtle card__head-actions">what we could not establish</span>
                </div>
                <div className="card__body">
                  {synthesis.evidence_gaps.map((gap, index) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <strong className="small">{gap.gap}</strong>
                      <p className="tiny muted" style={{ margin: '3px 0' }}>{gap.why_it_matters}</p>
                      <div className="row" style={{ gap: 6 }}>
                        <span className={`badge badge--${gap.can_secondary_research_close_it ? 'likely' : 'hypothesis'}`}>
                          {gap.can_secondary_research_close_it ? 'More search could close this' : 'Needs primary research'}
                        </span>
                      </div>
                      <p className="tiny subtle" style={{ margin: '4px 0 0' }}>→ {gap.suggested_approach}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="stack">
              {bundle.themes.length > 0 && (
                <div className="card">
                  <div className="card__head"><h2>Themes</h2></div>
                  <div className="card__body">
                    {bundle.themes.map((theme) => (
                      <div key={theme.id} style={{ marginBottom: 12 }}>
                        <div className="row" style={{ gap: 7 }}>
                          <span className="mono tiny muted">{theme.ref}</span>
                          <strong className="small">{theme.name}</strong>
                        </div>
                        <p className="tiny muted" style={{ margin: '2px 0 4px' }}>{theme.description}</p>
                        <RefList refs={theme.evidence_refs} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.primary_research_questions.length > 0 && (
                <div className="card">
                  <div className="card__head"><h2>Questions for primary research</h2></div>
                  <div className="card__body">
                    <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                      {synthesis.primary_research_questions.map((question, index) => (
                        <li key={index} style={{ marginBottom: 5 }}>{question}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {synthesis.next_steps.length > 0 && (
                <div className="card">
                  <div className="card__head"><h2>Recommended next steps</h2></div>
                  <div className="card__body">
                    <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                      {synthesis.next_steps.map((step, index) => (
                        <li key={index} style={{ marginBottom: 5 }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {bundle.findings.length === 0 && (
            <Notice tone="warn">
              Synthesis ran but produced no findings. That usually means the evidence base is
              too thin or too scattered to support a cross-source pattern. Run more research
              before analysing.
            </Notice>
          )}
        </div>
      )}
    </>
  );
}
