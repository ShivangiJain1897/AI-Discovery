'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api, downloadBlob } from '@/lib/api';
import type { ArtifactDetail, ArtifactVersion } from '@/lib/types';
import { ProjectShell, useProject } from '../../ProjectShell';
import { PageHead, Loading, ErrorBox, Notice } from '@/components/Shell';
import { DocView } from '@/components/DocView';
import { RefList } from '@/components/EvidenceChip';
import { useJobRunner, JobStatusLine } from '@/components/JobRunner';
import { relativeTime } from '@/lib/format';

export default function ArtifactPage({
  params,
}: { params: Promise<{ id: string; ref: string }> }) {
  const { id, ref } = use(params);
  return (
    <ProjectShell projectId={id} section="Artifact">
      <ArtifactView artifactRef={ref} />
    </ProjectShell>
  );
}

function ArtifactView({ artifactRef }: { artifactRef: string }) {
  const { project } = useProject();
  const [artifact, setArtifact] = useState<ArtifactDetail | null>(null);
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [viewing, setViewing] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, history] = await Promise.all([
        api.getArtifact(project.id, artifactRef, viewing),
        api.listVersions(project.id, artifactRef),
      ]);
      setArtifact(detail);
      setVersions(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the artifact.');
    }
  }, [project.id, artifactRef, viewing]);

  useEffect(() => { load(); }, [load]);

  const runner = useJobRunner(async () => {
    setViewing(undefined);
    await load();
    setRegenerating(null);
  });

  const exportAs = async (format: string) => {
    setExporting(format);
    try {
      const { blob, name } = await api.exportArtifact(project.id, artifactRef, format);
      downloadBlob(blob, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  if (!artifact) return error ? <ErrorBox error={error} /> : <Loading what="Loading artifact" />;

  const version = artifact.version;
  const critique = version?.critique;
  const blocking = critique?.issues.filter((issue) => issue.severity === 'blocking') ?? [];
  const warnings = critique?.issues.filter((issue) => issue.severity === 'warning') ?? [];

  return (
    <>
      <PageHead
        title={artifact.title}
        lede={version?.summary}
        actions={
          <>
            {artifact.export_formats.map((format) => (
              <button
                key={format}
                className="btn btn--sm"
                disabled={exporting !== null}
                onClick={() => exportAs(format)}
              >
                {exporting === format ? '…' : format.toUpperCase()}
              </button>
            ))}
          </>
        }
      />

      <ErrorBox error={error ?? runner.error} />
      <JobStatusLine job={runner.job} busy={runner.busy} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 18, alignItems: 'start' }}>
        <div className="stack">
          {critique && (
            blocking.length > 0 ? (
              <Notice tone="risk">
                <strong>The artifact critic found {blocking.length} blocking issue(s)</strong>,
                which were corrected before this version was stored. The corrections are marked
                inline on the affected sections.
              </Notice>
            ) : warnings.length > 0 ? (
              <Notice tone="warn">
                <strong>{warnings.length} warning(s) from the artifact critic.</strong> See the
                quality panel for detail — sections making unsourced claims were downgraded to
                hypothesis rather than presented as fact.
              </Notice>
            ) : (
              <Notice tone="good">
                <strong>Quality check passed.</strong> Every citation resolves, no conclusion
                exceeds its evidence, and nothing was generalized beyond its stated population.
              </Notice>
            )
          )}

          <div className="card">
            <div className="card__head">
              <h2>{version?.title}</h2>
              <span className="badge badge--neutral card__head-actions">
                v{version?.version} of {versions.length}
              </span>
            </div>
            <div className="card__body content--doc">
              {version && <DocView sections={version.sections} />}

              {version && version.open_questions.length > 0 && (
                <>
                  <div className="divider" />
                  <h2 style={{
                    fontFamily: 'var(--font-sans)', fontSize: '0.78rem',
                    textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--amber)',
                  }}>
                    Open questions
                  </h2>
                  <ul className="small muted" style={{ paddingLeft: 18 }}>
                    {version.open_questions.map((question, index) => <li key={index}>{question}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="stack">
          <div className="card">
            <div className="card__head"><h3>Regenerate a section</h3></div>
            <div className="card__body">
              <p className="tiny muted" style={{ marginBottom: 10 }}>
                Rewrite one section without touching the rest of the document. Produces a new
                version, so nothing is lost.
              </p>
              <select
                className="select"
                value={regenerating ?? ''}
                onChange={(event) => setRegenerating(event.target.value || null)}
              >
                <option value="">Choose a section…</option>
                {version?.sections.map((section) => (
                  <option key={section.heading} value={section.heading}>{section.heading}</option>
                ))}
              </select>
              <button
                className="btn btn--primary btn--sm"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!regenerating || runner.busy}
                onClick={() =>
                  regenerating &&
                  runner.run(() => api.regenerateSection(project.id, artifactRef, regenerating))}
              >
                {runner.busy ? 'Regenerating…' : 'Regenerate section'}
              </button>
            </div>
          </div>

          {critique && (
            <div className="card">
              <div className="card__head"><h3>Quality check</h3></div>
              <div className="card__body">
                <div className="row" style={{ marginBottom: 10 }}>
                  <span className={`badge badge--${critique.passed ? 'known' : 'risk'}`}>
                    {critique.passed ? 'Passed' : 'Issues found'}
                  </span>
                  <span className={`badge badge--${critique.citations_preserved ? 'known' : 'risk'}`}>
                    {critique.citations_preserved ? 'Citations intact' : 'Broken citations'}
                  </span>
                </div>

                {critique.issues.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="peek__k">Issues</div>
                    {critique.issues.map((issue, index) => (
                      <div key={index} className="tiny" style={{ marginBottom: 8 }}>
                        <span className={`badge badge--${issue.severity === 'blocking' ? 'risk' : 'hypothesis'}`}>
                          {issue.severity}
                        </span>{' '}
                        {issue.section && <strong>{issue.section}: </strong>}
                        {issue.detail}
                        {issue.correction && (
                          <div className="subtle">→ {issue.correction}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {critique.still_unknown.length > 0 && (
                  <div>
                    <div className="peek__k">Still unknown</div>
                    <ul className="tiny muted" style={{ paddingLeft: 16, margin: 0 }}>
                      {critique.still_unknown.slice(0, 8).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card__head"><h3>Versions</h3></div>
            <div className="card__body">
              {versions.map((entry) => (
                <button
                  key={entry.id}
                  className="copilot__sugg"
                  style={{
                    borderColor: entry.version === version?.version ? 'var(--pine)' : 'var(--rule)',
                  }}
                  onClick={() => setViewing(entry.version)}
                >
                  <strong>v{entry.version}</strong>
                  <span className="tiny subtle"> · {relativeTime(entry.created_at)}</span>
                  <div className="tiny">{entry.change_summary}</div>
                  {(entry.evidence_delta.added?.length || entry.evidence_delta.removed?.length) ? (
                    <div className="tiny subtle">
                      {entry.evidence_delta.added?.length ? `+${entry.evidence_delta.added.length} refs ` : ''}
                      {entry.evidence_delta.removed?.length ? `−${entry.evidence_delta.removed.length} refs` : ''}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {version && version.evidence_refs.length > 0 && (
            <div className="card">
              <div className="card__head"><h3>Cited evidence</h3></div>
              <div className="card__body">
                <RefList refs={version.evidence_refs} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
