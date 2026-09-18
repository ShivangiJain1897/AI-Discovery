'use client';

import Link from 'next/link';
import { use } from 'react';
import { ProjectShell, useProject } from './ProjectShell';
import { CoverageMeter } from '@/components/Badges';
import { PageHead, Notice, Stat, Empty } from '@/components/Shell';
import { titleCase } from '@/lib/format';

export default function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Overview">
      <Overview />
    </ProjectShell>
  );
}

function Overview() {
  const { project } = useProject();
  const context = project.context;
  const base = `/projects/${project.id}`;
  const { counts, coverage } = project;

  const weakest = coverage.filter(
    (entry) => entry.level === 'not_researched' || entry.level === 'weak',
  );

  // The next action in the pipeline, so the overview is a starting point
  // rather than a dashboard the user has to interpret.
  const next =
    counts.evidence === 0
      ? { label: 'Plan the research', href: `${base}/research`, why: 'No evidence has been collected yet.' }
      : counts.findings === 0
      ? { label: 'Synthesize findings', href: `${base}/findings`, why: `${counts.evidence} evidence items are waiting to be synthesized.` }
      : counts.analyses === 0
      ? { label: 'Analyse the research', href: `${base}/analysis`, why: 'Findings exist but have not been analysed.' }
      : counts.opportunities === 0
      ? { label: 'Find opportunities', href: `${base}/opportunities`, why: 'Turn findings into opportunities you can act on.' }
      : { label: 'Generate an artifact', href: `${base}/artifacts`, why: 'Turn this discovery into a PRD, business case or brief.' };

  return (
    <>
      <PageHead
        title={project.title}
        lede={project.question}
        actions={<Link className="btn btn--primary" href={next.href}>{next.label}</Link>}
      />

      <div style={{ marginBottom: 18 }}>
        <Notice tone="info" mark="→">
          <strong>Next: {next.label}.</strong> {next.why}
        </Notice>
      </div>

      <div className="grid grid--3" style={{ marginBottom: 18 }}>
        <div className="card"><Stat label="Evidence" value={counts.evidence} note={`from ${counts.sources} sources`} /></div>
        <div className="card"><Stat label="Findings" value={counts.findings} note={`${counts.insights} insights`} /></div>
        <div className="card"><Stat label="Opportunities" value={counts.opportunities} note={`${counts.use_cases} use cases`} /></div>
        <div className="card"><Stat label="Open questions" value={counts.open_questions} note="gaps + primary research" /></div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head">
            <h2>Discovery context</h2>
            <Link className="btn btn--ghost btn--sm card__head-actions" href={`${base}/research`}>Edit</Link>
          </div>
          <div className="card__body">
            {context ? (
              <>
                <Field k="Objective" v={context.objective} />
                <Field k="Decision this supports" v={context.decision} />
                <Field k="Domain" v={[context.domain, context.subdomain].filter(Boolean).join(' → ')} />
                <Field k="Primary user" v={context.primary_user} />
                {context.secondary_users.length > 0 && (
                  <Field k="Secondary users" v={context.secondary_users.join(', ')} />
                )}
                <Field k="Geography" v={context.geography} />
                <Field k="Product type" v={context.product_type} />
                <Field k="Discovery stage" v={context.discovery_stage} />

                {context.constraints.length > 0 && (
                  <div className="peek__field">
                    <div className="peek__k">Constraints</div>
                    <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
                      {context.constraints.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}

                {context.assumptions.length > 0 && (
                  <>
                    <div className="divider" />
                    <div className="peek__k">Inferred — edit anything that is wrong</div>
                    <div className="small muted" style={{ marginTop: 6 }}>
                      {context.assumptions.map((assumption, index) => (
                        <div key={index} style={{ marginBottom: 7 }}>
                          <strong>{titleCase(assumption.field)}:</strong> {assumption.value}
                          <div className="tiny subtle">{assumption.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="muted small">No context has been established yet.</p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card__head">
              <h2>Research coverage</h2>
            </div>
            <div className="card__body">
              <div className="cov">
                {coverage.map((entry) => (
                  <CoverageMeter
                    key={entry.dimension}
                    dimension={entry.dimension}
                    level={entry.level}
                    evidenceCount={entry.evidence_count}
                    tier1Count={entry.tier1_count}
                    rationale={entry.rationale}
                  />
                ))}
              </div>
            </div>
            <div className="card__foot">
              {weakest.length > 0 ? (
                <>Weakest: <strong>{weakest.map((w) => w.dimension).join(', ')}</strong>. No
                completeness percentage is shown — it would imply a methodology that does not exist.</>
              ) : (
                <>Every dimension has moderate or better coverage.</>
              )}
            </div>
          </div>

          {context && context.clarifications.length > 0 && (
            <div className="card">
              <div className="card__head"><h2>Worth confirming</h2></div>
              <div className="card__body">
                {context.clarifications.map((clarification, index) => (
                  <div key={index} style={{ marginBottom: 12 }}>
                    <strong className="small">{clarification.question}</strong>
                    <p className="tiny muted" style={{ margin: '3px 0 0' }}>
                      {clarification.why_it_matters}
                    </p>
                    {clarification.suggested_default && (
                      <p className="tiny subtle" style={{ margin: 0 }}>
                        Proceeding with: {clarification.suggested_default}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {counts.evidence === 0 && (
            <div className="card">
              <Empty mark="◆" title="No evidence yet"
                action={<Link className="btn btn--primary" href={`${base}/research`}>Plan the research</Link>}>
                Nothing in this project is established until research has run and evidence
                has been collected.
              </Empty>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="peek__field">
      <div className="peek__k">{k}</div>
      <div className="peek__v">{v}</div>
    </div>
  );
}
