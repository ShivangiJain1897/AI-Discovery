'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Artifact, ArtifactTypeInfo } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox } from '@/components/Shell';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';
import { relativeTime } from '@/lib/format';

export default function ArtifactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Artifacts">
      <Artifacts />
    </ProjectShell>
  );
}

/** Grouped so the list of twenty artifact types is navigable rather than a wall. */
const GROUPS: { label: string; types: string[] }[] = [
  { label: 'Decision documents', types: ['prd', 'business_case', 'feature_brief', 'decision_memo', 'executive_summary'] },
  { label: 'Discovery output', types: ['research_report', 'use_case_catalog', 'use_case', 'opportunity_brief', 'competitive_analysis', 'market_research_report'] },
  { label: 'Delivery input', types: ['product_backlog', 'user_stories', 'acceptance_criteria', 'roadmap_input'] },
  { label: 'Research instruments', types: ['research_plan', 'interview_guide', 'survey_draft', 'experiment_plan'] },
  { label: 'Strategy', types: ['product_strategy_brief'] },
];

function Artifacts() {
  const { project, reload } = useProject();
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [types, setTypes] = useState<ArtifactTypeInfo[]>([]);
  const [chosen, setChosen] = useState('prd');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, typeList] = await Promise.allSettled([
      api.listArtifacts(project.id),
      api.artifactTypes(project.id),
    ]);
    setArtifacts(list.status === 'fulfilled' ? list.value : []);
    setTypes(typeList.status === 'fulfilled' ? typeList.value : []);
    if (list.status === 'rejected') setError('Could not load artifacts.');
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const runner = useJobRunner(async () => { await load(); await reload(); });
  const hasEvidence = project.counts.evidence > 0;
  const byKey = new Map(types.map((type) => [type.artifact_type, type]));
  const selected = byKey.get(chosen);

  return (
    <>
      <PageHead
        title="Artifacts"
        lede="Generated from this project's existing evidence — not from a fresh round of invention. Citations survive into the exported document."
      />

      <ErrorBox error={error ?? runner.error} />
      <JobStatusLine job={runner.job} busy={runner.busy} />

      {!artifacts && <Loading what="Loading artifacts" />}

      {artifacts && !hasEvidence && (
        <div className="card">
          <Empty mark="◇" title="No evidence to build from">
            Artifacts are assembled from the project&rsquo;s evidence. Run research first, so
            a generated PRD says what the research established rather than what sounds right.
          </Empty>
        </div>
      )}

      {artifacts && hasEvidence && (
        <div className="stack">
          <div className="card">
            <div className="card__head"><h2>Generate an artifact</h2></div>
            <div className="card__body">
              {GROUPS.map((group) => {
                const available = group.types.filter((type) => byKey.has(type));
                if (available.length === 0) return null;
                return (
                  <div key={group.label} style={{ marginBottom: 14 }}>
                    <div className="filter__title">{group.label}</div>
                    <div className="row" style={{ gap: 6 }}>
                      {available.map((type) => (
                        <button
                          key={type}
                          className={`btn btn--sm${chosen === type ? ' btn--primary' : ''}`}
                          onClick={() => setChosen(type)}
                        >
                          {byKey.get(type)!.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {selected && (
                <div className="notice notice--info" style={{ marginTop: 14 }}>
                  <span className="notice__mark">i</span>
                  <div>
                    <strong>{selected.label}</strong> — {selected.sections.length} sections.
                    Any section the discovery did not establish is marked{' '}
                    <em>Unknown</em>, <em>Assumption</em> or <em>Needs Validation</em>,
                    never filled with invented content.
                    <div className="tiny subtle" style={{ marginTop: 6 }}>
                      Exports as {selected.export_formats.join(', ').toUpperCase()}.
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="card__foot row">
              <span className="tiny">
                Built from {project.counts.evidence} evidence items, {project.counts.findings} findings
                {project.counts.opportunities > 0 && `, ${project.counts.opportunities} opportunities`}
              </span>
              <button
                className="btn btn--primary right"
                disabled={runner.busy}
                onClick={() => runner.run(() => api.generateArtifact(project.id, { artifact_type: chosen }))}
              >
                {runner.busy ? 'Generating…' : `Generate ${selected?.label ?? 'artifact'}`}
              </button>
            </div>
          </div>

          {artifacts.length === 0 ? (
            <div className="card">
              <Empty mark="○" title="Nothing generated yet">
                Pick a type above. Every artifact passes the artifact critic before you see it —
                unsupported claims get downgraded and broken citations get removed.
              </Empty>
            </div>
          ) : (
            <div className="card">
              <div className="card__head"><h2>Generated artifacts</h2></div>
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr><th>Ref</th><th>Artifact</th><th>Type</th><th>Version</th><th>Created</th><th></th></tr>
                  </thead>
                  <tbody>
                    {artifacts.map((artifact) => (
                      <tr key={artifact.id}>
                        <td className="num">{artifact.ref}</td>
                        <td>
                          <Link href={`/projects/${project.id}/artifacts/${artifact.ref}`}>
                            <strong>{artifact.title}</strong>
                          </Link>
                        </td>
                        <td className="small muted">
                          {byKey.get(artifact.artifact_type)?.label ?? artifact.artifact_type}
                        </td>
                        <td className="num">v{artifact.current_version}</td>
                        <td className="small subtle">{relativeTime(artifact.created_at)}</td>
                        <td>
                          <Link className="btn btn--sm" href={`/projects/${project.id}/artifacts/${artifact.ref}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
