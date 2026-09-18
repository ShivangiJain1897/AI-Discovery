'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Health, Persona, ProjectSummary } from '@/lib/types';
import { Rail, TopBar, Notice, ErrorBox } from '@/components/Shell';
import { relativeTime } from '@/lib/format';
import Link from 'next/link';

const STARTERS = [
  { label: 'Explore a problem', text: 'Why do users abandon our onboarding flow? Research the problem and identify where it breaks down.' },
  { label: 'Research a market', text: 'Research the market for AI-assisted clinical documentation in US hospitals.' },
  { label: 'Understand customers', text: 'What are customers complaining about in our category, and what do they actually want instead?' },
  { label: 'Analyse competitors', text: 'Research the competitive landscape for member-facing healthcare cost tools.' },
  { label: 'Evaluate a feature', text: 'Should we build a cost estimator into our member app? Evaluate the evidence for and against.' },
  { label: 'Explore a product idea', text: 'We are considering improving cost transparency for Medicaid members. Research the problem and identify potential product opportunities.' },
  { label: 'Investigate a technology', text: 'What technologies could let us surface real-time benefit and cost data to members?' },
  { label: 'Discover use cases', text: 'Discover use cases for AI-assisted prior authorization in a payer organization.' },
];

const PERSONAS: { value: Persona; label: string; lens: string }[] = [
  { value: 'product_manager', label: 'Product Manager', lens: 'User problems, JTBD, opportunities, prioritization, success metrics' },
  { value: 'business_analyst', label: 'Business Analyst', lens: 'Workflows, requirements, rules, process gaps, acceptance criteria' },
  { value: 'senior_pm', label: 'Senior PM / Product Lead', lens: 'Strategy, competing opportunities, roadmap and investment trade-offs' },
  { value: 'director_vp', label: 'Director / VP Product', lens: 'Market change, positioning, portfolio, economics, strategic bets' },
  { value: 'ux_researcher', label: 'UX / Research', lens: 'Behaviours, unmet needs, journeys, qualitative evidence, research gaps' },
  { value: 'technical_pm', label: 'Technical PM', lens: 'Feasibility, APIs, standards, constraints, integration, build vs buy' },
];

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [persona, setPersona] = useState<Persona>('product_manager');
  const [depth, setDepth] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api.listProjects().then((all) => setRecent(all.slice(0, 4))).catch(() => setRecent([]));
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const start = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const project = await api.createProject({ question: question.trim(), persona, depth });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project.');
      setBusy(false);
    }
  };

  const selected = PERSONAS.find((p) => p.value === persona)!;

  return (
    <div className="app">
      <Rail />
      <main className="main">
        <TopBar crumbs={[{ label: 'Start discovery' }]} />
        <div className="content content--doc">

          {health && !health.llm.live && (
            <div style={{ marginBottom: 20 }}>
              <Notice tone="warn">
                <strong>Deterministic mode.</strong> No model credential is configured, so
                research and synthesis will report &ldquo;Not established&rdquo; rather than
                generating content. Set <code className="mono">ANTHROPIC_API_KEY</code> to
                enable full discovery.
              </Notice>
            </div>
          )}

          <div style={{ padding: '18px 0 26px' }}>
            <h1 style={{ fontSize: '1.9rem', marginBottom: 10 }}>
              What are you trying to understand, decide, improve, or build?
            </h1>
            <p className="muted" style={{ maxWidth: '62ch' }}>
              Describe it the way you would to a colleague. The platform infers the framing,
              proposes a research strategy for you to edit, then keeps every conclusion
              traceable back to the source it came from.
            </p>
          </div>

          <div className="card">
            <div className="card__body">
              <textarea
                className="textarea"
                style={{ minHeight: 118, fontSize: '0.95rem' }}
                placeholder="e.g. We are considering improving cost transparency for Medicaid members. Research the problem and identify potential product opportunities."
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) start();
                }}
              />

              <div className="grid grid--2" style={{ marginTop: 16 }}>
                <div>
                  <label className="label" htmlFor="persona">Your lens</label>
                  <select
                    id="persona"
                    className="select"
                    value={persona}
                    onChange={(event) => setPersona(event.target.value as Persona)}
                  >
                    {PERSONAS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <p className="hint">{selected.lens}</p>
                </div>

                <div>
                  <label className="label" htmlFor="depth">Research depth</label>
                  <select
                    id="depth"
                    className="select"
                    value={depth}
                    onChange={(event) => setDepth(event.target.value)}
                  >
                    <option value="quick_scan">Quick scan — breadth, top-tier sources</option>
                    <option value="standard">Standard — balanced</option>
                    <option value="deep">Deep — exhaustive, heavy tier 1</option>
                  </select>
                  <p className="hint">Sets how many questions and sources the plan will cover.</p>
                </div>
              </div>

              <p className="hint" style={{ marginTop: 12 }}>
                Persona changes the interpretation and the output. It never changes the
                evidence — the same research supports every lens.
              </p>
            </div>

            <div className="card__foot row">
              <span className="tiny">⌘↵ to start</span>
              <button
                className="btn btn--primary btn--lg right"
                onClick={start}
                disabled={busy || question.trim().length < 8}
              >
                {busy ? 'Setting up…' : 'Start discovery'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}><ErrorBox error={error} /></div>

          <div style={{ marginTop: 30 }}>
            <div className="filter__title">Or start from one of these</div>
            <div className="row" style={{ gap: 7 }}>
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  className="btn btn--sm"
                  onClick={() => setQuestion(starter.text)}
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>

          {recent.length > 0 && (
            <div style={{ marginTop: 34 }}>
              <div className="filter__title">Recent projects</div>
              <div className="card">
                {recent.map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    style={{
                      display: 'block', padding: '13px 16px', color: 'inherit',
                      borderTop: index ? '1px solid var(--rule)' : 'none',
                      textDecoration: 'none',
                    }}
                  >
                    <div className="row">
                      <strong style={{ fontSize: '0.88rem' }}>{project.title}</strong>
                      <span className="badge badge--neutral right">{project.status}</span>
                    </div>
                    <div className="tiny subtle" style={{ marginTop: 3 }}>
                      Updated {relativeTime(project.updated_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
