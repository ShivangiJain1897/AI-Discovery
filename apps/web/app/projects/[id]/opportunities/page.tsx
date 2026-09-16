'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Opportunity, OpportunityStatus, Recommendation, UseCase } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox, Notice } from '@/components/Shell';
import { StrengthBadge } from '@/components/Badges';
import { RefList } from '@/components/EvidenceChip';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';
import { titleCase } from '@/lib/format';

export default function OpportunitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Opportunities">
      <Opportunities />
    </ProjectShell>
  );
}

const STATUSES: OpportunityStatus[] = [
  'identified', 'needs_validation', 'validated', 'prioritized', 'planned', 'rejected',
];

type Tab = 'opportunities' | 'use_cases' | 'recommendations';

function Opportunities() {
  const { project, reload } = useProject();
  const [tab, setTab] = useState<Tab>('opportunities');
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [open, setOpen] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ops, ucs, recs] = await Promise.allSettled([
      api.listOpportunities(project.id),
      api.listUseCases(project.id),
      api.listRecommendations(project.id),
    ]);
    setOpportunities(ops.status === 'fulfilled' ? ops.value : []);
    setUseCases(ucs.status === 'fulfilled' ? ucs.value : []);
    setRecommendations(recs.status === 'fulfilled' ? recs.value : []);
    if (ops.status === 'rejected') setError('Could not load opportunities.');
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const done = async () => { await load(); await reload(); };
  const opRunner = useJobRunner(done);
  const ucRunner = useJobRunner(done);
  const recRunner = useJobRunner(done);

  const setStatus = async (ref: string, status: OpportunityStatus) => {
    await api.updateOpportunity(project.id, ref, { status });
    setOpportunities((current) =>
      current?.map((o) => (o.ref === ref ? { ...o, status } : o)) ?? current);
  };

  const hasFindings = project.counts.findings > 0;

  return (
    <>
      <PageHead
        title="Opportunities"
        lede="Where intervention could create value. An opportunity is a problem space with a value hypothesis and a validation plan — not a feature."
        actions={
          hasFindings && (
            <>
              <button className="btn" disabled={ucRunner.busy}
                onClick={() => ucRunner.run(() => api.generateUseCases(project.id, 12))}>
                {ucRunner.busy ? 'Deriving…' : 'Derive use cases'}
              </button>
              <button className="btn" disabled={recRunner.busy}
                onClick={() => recRunner.run(() => api.generateRecommendations(project.id))}>
                {recRunner.busy ? 'Working…' : 'Generate recommendations'}
              </button>
              <button className="btn btn--primary" disabled={opRunner.busy}
                onClick={() => opRunner.run(() => api.generateOpportunities(project.id, true))}>
                {opRunner.busy ? 'Finding…' : 'Find opportunities'}
              </button>
            </>
          )
        }
      />

      <ErrorBox error={error ?? opRunner.error ?? ucRunner.error ?? recRunner.error} />
      <JobStatusLine job={opRunner.job ?? ucRunner.job ?? recRunner.job}
        busy={opRunner.busy || ucRunner.busy || recRunner.busy} />

      {!opportunities && <Loading what="Loading opportunities" />}

      {opportunities && !hasFindings && (
        <div className="card">
          <Empty mark="◇" title="No findings to work from">
            Opportunities are derived from findings. Run research and synthesis first.
          </Empty>
        </div>
      )}

      {opportunities && hasFindings && (
        <>
          <div className="tabs">
            {([
              ['opportunities', `Opportunities (${opportunities.length})`],
              ['use_cases', `Use cases (${useCases.length})`],
              ['recommendations', `Recommendations (${recommendations.length})`],
            ] as [Tab, string][]).map(([key, label]) => (
              <button key={key} className={`tab${tab === key ? ' tab--on' : ''}`}
                onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === 'opportunities' && (
            opportunities.length === 0
              ? <div className="card"><Empty mark="○" title="No opportunities yet">Run &ldquo;Find opportunities&rdquo; to derive them from the findings.</Empty></div>
              : (
                <div className="grid grid--2">
                  {opportunities.map((opportunity) => (
                    <div className="card" key={opportunity.id}>
                      <div className="card__head">
                        <span className="mono tiny muted">{opportunity.ref}</span>
                        <h2 style={{ flex: 1, minWidth: 0 }}>{opportunity.title}</h2>
                        <span className="card__head-actions">
                          <StrengthBadge strength={opportunity.confidence} compact />
                        </span>
                      </div>
                      <div className="card__body">
                        <div className="peek__field">
                          <div className="peek__k">Problem</div>
                          <div className="peek__v small">{opportunity.problem}</div>
                        </div>
                        <div className="peek__field">
                          <div className="peek__k">Value hypothesis</div>
                          <div className="peek__v small">{opportunity.value_hypothesis}</div>
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 6 }}>
                          <span className="tiny subtle">Evidence:</span>
                          <RefList refs={opportunity.evidence_refs} />
                        </div>
                      </div>
                      <div className="card__foot row">
                        <select
                          className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}
                          value={opportunity.status}
                          onChange={(event) => setStatus(opportunity.ref, event.target.value as OpportunityStatus)}
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>{titleCase(status)}</option>
                          ))}
                        </select>
                        <button className="btn btn--sm right" onClick={() => setOpen(opportunity)}>
                          Open
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}

          {tab === 'use_cases' && (
            useCases.length === 0
              ? <div className="card"><Empty mark="○" title="No use cases yet">Derive them from the findings to get a catalog you can prioritize.</Empty></div>
              : (
                <div className="card">
                  <div className="tablewrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Ref</th><th>Use case</th><th>Actor</th><th>Problem</th>
                          <th>Capability</th><th>Evidence</th><th>Complexity</th><th>Metric</th>
                        </tr>
                      </thead>
                      <tbody>
                        {useCases.map((useCase) => (
                          <tr key={useCase.id}>
                            <td className="num">{useCase.ref}</td>
                            <td style={{ minWidth: 180 }}><strong>{useCase.title}</strong></td>
                            <td className="small">{useCase.actor}</td>
                            <td className="small muted" style={{ maxWidth: 240 }}>{useCase.problem}</td>
                            <td className="small muted" style={{ maxWidth: 220 }}>{useCase.proposed_capability}</td>
                            <td>
                              <StrengthBadge strength={useCase.evidence_strength} compact />
                              <div style={{ marginTop: 4 }}><RefList refs={useCase.evidence_refs} /></div>
                            </td>
                            <td className="small muted">{useCase.complexity}</td>
                            <td className="small muted" style={{ maxWidth: 200 }}>{useCase.success_metric}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
          )}

          {tab === 'recommendations' && (
            recommendations.length === 0
              ? <div className="card"><Empty mark="○" title="No recommendations yet">Generate them once you have findings and analyses to draw on.</Empty></div>
              : (
                <div className="stack">
                  <Notice tone="info">
                    Every recommendation carries its reasoning, its confidence, and the
                    observation that would overturn it. Edit any of them — your edit wins over
                    regeneration.
                  </Notice>
                  {recommendations.map((recommendation) => (
                    <div className="card" key={recommendation.id}>
                      <div className="card__head">
                        <span className="mono tiny muted">{recommendation.ref}</span>
                        <h2 style={{ flex: 1, minWidth: 0 }}>{recommendation.recommendation}</h2>
                        <span className="card__head-actions">
                          <StrengthBadge strength={recommendation.confidence} compact />
                          {recommendation.user_edited && <span className="badge badge--neutral">edited</span>}
                        </span>
                      </div>
                      <div className="card__body">
                        <div className="grid grid--2" style={{ gap: 14 }}>
                          <div>
                            <Field k="Why" v={recommendation.why} />
                            <Field k="Expected value" v={recommendation.expected_value} />
                            <Field k="Who benefits" v={recommendation.who_benefits} />
                          </div>
                          <div>
                            <Field k="What would change this" v={recommendation.what_would_change_it} />
                            <Field k="Next validation step" v={recommendation.next_validation_step} />
                            {recommendation.risks.length > 0 && (
                              <div className="peek__field">
                                <div className="peek__k">Risks</div>
                                <ul className="small muted" style={{ paddingLeft: 16, margin: 0 }}>
                                  {recommendation.risks.map((risk, index) => <li key={index}>{risk}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="row" style={{ marginTop: 6 }}>
                          <span className="tiny subtle">Evidence:</span>
                          <RefList refs={recommendation.evidence_refs} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          )}
        </>
      )}

      {open && <OpportunityPeek opportunity={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Field({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="peek__field">
      <div className="peek__k">{k}</div>
      <div className="peek__v small">{v}</div>
    </div>
  );
}

function OpportunityPeek({
  opportunity, onClose,
}: { opportunity: Opportunity; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lists: [string, string[]][] = [
    ['Solution directions', opportunity.solution_directions],
    ['Assumptions', opportunity.assumptions],
    ['Dependencies', opportunity.dependencies],
    ['Risks', opportunity.risks],
    ['Validation plan', opportunity.validation_plan],
  ];

  return (
    <div className="peek" onClick={onClose} role="presentation">
      <aside className="peek__panel" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="peek__head">
          <span className="mono tiny" style={{ color: 'var(--pine)' }}>{opportunity.ref}</span>
          <strong style={{ flex: 1 }}>{opportunity.title}</strong>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Close</button>
        </header>
        <div className="peek__body">
          <Field k="Problem" v={opportunity.problem} />
          <Field k="User" v={opportunity.user} />
          <Field k="Insight" v={opportunity.insight} />
          <Field k="Desired outcome" v={opportunity.desired_outcome} />
          <Field k="Value hypothesis" v={opportunity.value_hypothesis} />
          <Field k="Business value" v={opportunity.business_value} />

          {lists.map(([label, items]) =>
            items.length > 0 ? (
              <div className="peek__field" key={label}>
                <div className="peek__k">{label}</div>
                <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                  {items.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            ) : null,
          )}

          <div className="divider" />
          <div className="peek__k">Evidence</div>
          <RefList refs={opportunity.evidence_refs} />
          {opportunity.finding_refs.length > 0 && (
            <>
              <div className="peek__k" style={{ marginTop: 12 }}>Findings</div>
              <span className="chips">
                {opportunity.finding_refs.map((ref) => (
                  <span className="chip chip--plain" key={ref}>{ref}</span>
                ))}
              </span>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
