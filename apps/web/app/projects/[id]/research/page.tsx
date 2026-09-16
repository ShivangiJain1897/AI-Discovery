'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ResearchPlan, ResearchRun, Source, UploadedDocument } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox, Notice } from '@/components/Shell';
import { TierBadge, OriginBadge } from '@/components/Badges';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';
import { TIER_LABEL, formatBytes, titleCase } from '@/lib/format';

export default function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Research">
      <Research />
    </ProjectShell>
  );
}

type Tab = 'plan' | 'runs' | 'sources' | 'internal';

function Research() {
  const { project, reload } = useProject();
  const [tab, setTab] = useState<Tab>('plan');
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState('standard');

  const load = useCallback(async () => {
    setLoading(true);
    const [planResult, runsResult, sourcesResult, documentsResult] = await Promise.allSettled([
      api.getPlan(project.id),
      api.listRuns(project.id),
      api.listSources(project.id),
      api.listDocuments(project.id),
    ]);
    setPlan(planResult.status === 'fulfilled' ? planResult.value : null);
    setRuns(runsResult.status === 'fulfilled' ? runsResult.value : []);
    setSources(sourcesResult.status === 'fulfilled' ? sourcesResult.value : []);
    setDocuments(documentsResult.status === 'fulfilled' ? documentsResult.value : []);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const planner = useJobRunner(load);
  const runner = useJobRunner(async () => { await load(); await reload(); });

  const createPlan = async () => {
    setError(null);
    try {
      setPlan(await api.createPlan(project.id, depth));
      setTab('plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a plan.');
    }
  };

  const toggleQuestion = async (questionId: string, enabled: boolean) => {
    await api.updateQuestion(project.id, questionId, { enabled });
    setPlan((current) =>
      current
        ? { ...current, questions: current.questions.map((q) => q.id === questionId ? { ...q, enabled } : q) }
        : current);
  };

  const activeRun = runs.find((run) => run.status === 'running') ?? runs[0];

  return (
    <>
      <PageHead
        title="Research"
        lede="Plan what to find out and where to look, review it, then run it. The plan is editable — you can remove questions, change queries and add sources before anything executes."
        actions={
          plan && (
            <button
              className="btn btn--primary"
              disabled={runner.busy}
              onClick={() => runner.run(() => api.runResearch(project.id, { plan_id: plan.id }))}
            >
              {runner.busy ? 'Researching…' : 'Run research'}
            </button>
          )
        }
      />

      <ErrorBox error={error ?? planner.error ?? runner.error} />
      <JobStatusLine job={runner.job} busy={runner.busy} />

      <div className="tabs">
        {([
          ['plan', 'Research plan'],
          ['runs', `Runs${runs.length ? ` (${runs.length})` : ''}`],
          ['sources', `Sources${sources.length ? ` (${sources.length})` : ''}`],
          ['internal', `Internal material${documents.length ? ` (${documents.length})` : ''}`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab${tab === key ? ' tab--on' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <Loading what="Loading research" />}

      {!loading && tab === 'plan' && (
        plan ? (
          <PlanView plan={plan} onToggle={toggleQuestion} />
        ) : (
          <div className="card">
            <Empty mark="◇" title="No research plan yet"
              action={
                <div className="row" style={{ justifyContent: 'center' }}>
                  <select className="select" style={{ width: 230 }} value={depth}
                    onChange={(e) => setDepth(e.target.value)}>
                    <option value="quick_scan">Quick scan</option>
                    <option value="standard">Standard discovery</option>
                    <option value="deep">Deep research</option>
                  </select>
                  <button className="btn btn--primary" onClick={createPlan}>Build research plan</button>
                </div>
              }>
              The planner works out the minimum sufficient research to answer your question:
              which research types apply, what needs primary research, which sources to consult,
              and what probably cannot be established at all.
            </Empty>
          </div>
        )
      )}

      {!loading && tab === 'runs' && (
        runs.length === 0
          ? <div className="card"><Empty mark="○" title="No research runs yet">Run the plan to start collecting evidence.</Empty></div>
          : <RunsView runs={runs} active={activeRun} />
      )}

      {!loading && tab === 'sources' && (
        sources.length === 0
          ? <div className="card"><Empty mark="○" title="No sources yet">Sources appear here as research runs examine them.</Empty></div>
          : <SourcesView sources={sources} />
      )}

      {!loading && tab === 'internal' && (
        <InternalView projectId={project.id} documents={documents} onChange={load} />
      )}
    </>
  );
}

function PlanView({
  plan, onToggle,
}: { plan: ResearchPlan; onToggle: (id: string, enabled: boolean) => void }) {
  const byTier = [...plan.planned_sources].sort((a, b) => a.tier.localeCompare(b.tier));
  return (
    <div className="stack">
      <div className="card">
        <div className="card__head">
          <h2>Research brief</h2>
          <span className="badge badge--neutral card__head-actions">{plan.ref} · v{plan.version} · {titleCase(plan.depth)}</span>
        </div>
        <div className="card__body">
          <div className="peek__field">
            <div className="peek__k">Objective</div>
            <div className="peek__v">{plan.objective}</div>
          </div>
          <div className="peek__field">
            <div className="peek__k">Decision this supports</div>
            <div className="peek__v">{plan.decision_supported}</div>
          </div>
          <div className="divider" />
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }} className="muted">
            {plan.human_readable_plan}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2>Research questions</h2>
          <span className="tiny subtle card__head-actions">Uncheck any you do not want researched</span>
        </div>
        <div>
          {plan.questions.map((question) => (
            <div key={question.id} style={{ padding: '14px 16px', borderTop: '1px solid var(--rule)' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={question.enabled}
                  onChange={(event) => onToggle(question.id, event.target.checked)}
                  style={{ marginTop: 4, accentColor: 'var(--pine)' }}
                  aria-label={`Include ${question.ref}`}
                />
                <span className="mono tiny muted" style={{ marginTop: 2 }}>{question.ref}</span>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <strong style={{ fontSize: '0.89rem' }}>{question.question}</strong>
                  <p className="tiny muted" style={{ margin: '3px 0 0' }}>{question.why}</p>
                  <p className="tiny subtle" style={{ margin: '5px 0 0' }}>
                    <strong>Expected evidence:</strong> {question.expected_evidence}
                  </p>
                  <div className="row" style={{ gap: 5, marginTop: 7 }}>
                    {question.research_types.map((type) => (
                      <span key={type} className="badge badge--neutral">{type.replace(/_/g, ' ')}</span>
                    ))}
                    {!question.answerable_by_secondary && (
                      <span className="badge badge--hypothesis">Needs primary research</span>
                    )}
                    {question.evidence_count > 0 && (
                      <span className="badge badge--known">{question.evidence_count} evidence</span>
                    )}
                  </div>
                  {question.queries.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary className="tiny muted" style={{ cursor: 'pointer' }}>
                        {question.queries.length} search {question.queries.length === 1 ? 'query' : 'queries'}
                      </summary>
                      <div style={{ marginTop: 6 }}>
                        {question.queries.map((query, index) => (
                          <div key={index} className="tiny" style={{ marginBottom: 5 }}>
                            <span className="mono">{query.query}</span>
                            <div className="subtle">{query.intent}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><h2>Sources to consult</h2></div>
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>Tier</th><th>Source</th><th>Why</th></tr></thead>
              <tbody>
                {byTier.map((source, index) => (
                  <tr key={index}>
                    <td><TierBadge tier={source.tier} /></td>
                    <td>
                      {source.url
                        ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                        : source.name}
                      <div className="tiny subtle">{TIER_LABEL[source.tier]}</div>
                    </td>
                    <td className="tiny muted">{source.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          {plan.primary_research_needed.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Primary research needed</h2></div>
              <div className="card__body">
                <p className="tiny muted" style={{ marginBottom: 12 }}>
                  These cannot be answered by searching. The platform prepares them; you run them.
                </p>
                {plan.primary_research_needed.map((need, index) => (
                  <div key={index} style={{ marginBottom: 14 }}>
                    <strong className="small">{need.question}</strong>
                    <div className="tiny muted" style={{ marginTop: 3 }}>
                      <strong>{need.method}</strong> · {need.participant_profile}
                    </div>
                    <div className="tiny subtle">{need.why_secondary_is_insufficient}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.anticipated_gaps.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Anticipated gaps</h2></div>
              <div className="card__body">
                <p className="tiny muted" style={{ marginBottom: 10 }}>
                  Named before the run, not discovered after it.
                </p>
                <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                  {plan.anticipated_gaps.map((gap, index) => <li key={index}>{gap}</li>)}
                </ul>
              </div>
            </div>
          )}

          {plan.out_of_scope.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Out of scope</h2></div>
              <div className="card__body">
                <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                  {plan.out_of_scope.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Progress is reported per research question, so a question that returned
 *  nothing is visible rather than hidden behind a generic spinner. */
function RunsView({ runs, active }: { runs: ResearchRun[]; active?: ResearchRun }) {
  return (
    <div className="stack">
      {active && active.progress.length > 0 && (
        <div className="card">
          <div className="card__head">
            <h2>{active.status === 'running' ? 'Research in progress' : `Run ${active.ref}`}</h2>
            <span className="badge badge--neutral card__head-actions">
              {active.sources_examined} sources · {active.evidence_extracted} evidence
            </span>
          </div>
          <div className="prog">
            {active.progress.map((entry) => (
              <div className="prog__row" key={entry.ref}>
                <span className="prog__ref">{entry.ref}</span>
                <span className="prog__q">
                  {entry.question}
                  {entry.notes?.map((note, index) => (
                    <span className="prog__note" key={index}>{note}</span>
                  ))}
                </span>
                <span className="prog__stat">
                  {entry.status === 'running' && <span className="spin" style={{ marginRight: 6 }} />}
                  {entry.sources_examined}/{entry.sources_found} sources · {entry.evidence_extracted} ev
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__head"><h2>Run history</h2></div>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr><th>Run</th><th>Status</th><th>Depth</th><th>Sources</th><th>Evidence</th><th>Completed</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="num">{run.ref}</td>
                  <td>
                    <span className={`badge badge--${run.status === 'succeeded' ? 'known' : run.status === 'failed' ? 'risk' : 'neutral'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="small">{titleCase(run.depth)}</td>
                  <td className="num">{run.sources_examined}</td>
                  <td className="num">{run.evidence_extracted}</td>
                  <td className="small subtle">
                    {run.completed_at ? new Date(run.completed_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SourcesView({ sources }: { sources: Source[] }) {
  return (
    <div className="card">
      <div className="tablewrap">
        <table className="data">
          <thead>
            <tr><th>Ref</th><th>Tier</th><th>Source</th><th>Publisher</th><th>Published</th><th>Type</th></tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td className="num">{source.ref}</td>
                <td><TierBadge tier={source.tier} /></td>
                <td style={{ maxWidth: 380 }}>
                  {source.url
                    ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                    : source.title}
                  {source.assessment && <div className="tiny subtle">{source.assessment}</div>}
                </td>
                <td className="small">
                  {source.publisher} <OriginBadge origin={source.origin} />
                </td>
                <td className="small subtle">{source.publication_date ?? 'Undated'}</td>
                <td className="small">{source.source_type.replace(/_/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InternalView({
  projectId, documents, onChange,
}: { projectId: string; documents: UploadedDocument[]; onChange: () => void }) {
  const [kind, setKind] = useState('interview_transcript');
  const [kinds, setKinds] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.documentKinds(projectId).then(setKinds).catch(() => setKinds([]));
  }, [projectId]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await api.uploadDocument(projectId, file, kind);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Notice tone="info">
        Internal material is labelled <strong>INTERNAL</strong> and kept separate from public
        research. It is never used to build a public search query, and it is filterable
        separately so you can always tell which findings rest on your own data.
      </Notice>

      <div className="card">
        <div className="card__head"><h2>Upload internal material</h2></div>
        <div className="card__body">
          <div className="field">
            <label className="label" htmlFor="kind">What is this?</label>
            <select id="kind" className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="hint">Sets how the extracted evidence is classified.</p>
          </div>

          <input
            type="file"
            className="input"
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = '';
            }}
          />
          <p className="hint">PDF, DOCX, TXT, Markdown, CSV, XLSX or JSON. Up to 40MB.</p>
          {busy && <div className="row small muted" style={{ marginTop: 10 }}><span className="spin" /> Parsing and scanning…</div>}
          <ErrorBox error={error} />
        </div>
      </div>

      {documents.length > 0 && (
        <div className="card">
          <div className="card__head"><h2>Uploaded documents</h2></div>
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr><th>Ref</th><th>File</th><th>Kind</th><th>Size</th><th>Status</th><th>Identifiers</th></tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="num">{document.ref}</td>
                    <td>{document.filename}</td>
                    <td className="small">{titleCase(document.document_kind)}</td>
                    <td className="num">{formatBytes(document.size_bytes)}</td>
                    <td><span className="badge badge--neutral">{document.status}</span></td>
                    <td>
                      {document.phi_scan?.found ? (
                        <span className="badge badge--risk" title="Detected before any model call">
                          {document.phi_scan.detections?.map((d) => d.kind).join(', ')}
                        </span>
                      ) : (
                        <span className="tiny subtle">none detected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
