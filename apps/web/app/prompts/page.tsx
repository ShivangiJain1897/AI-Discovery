'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { PromptTemplate } from '@/lib/types';
import { Rail, TopBar, PageHead, Loading, ErrorBox, Notice } from '@/components/Shell';
import { titleCase } from '@/lib/format';

/** The pipeline order, so the library reads as the method rather than
 *  alphabetically. */
const STAGE_ORDER = [
  'context', 'planning', 'retrieval', 'evidence', 'synthesis',
  'analysis', 'recommendation', 'artifact', 'quality',
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[] | null>(null);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPrompts()
      .then((all) => { setPrompts(all); setSelected(all[0] ?? null); })
      .catch((err) => { setError(err.message); setPrompts([]); });
  }, []);

  const byStage = useMemo(() => {
    const groups = new Map<string, PromptTemplate[]>();
    for (const prompt of prompts ?? []) {
      groups.set(prompt.stage, [...(groups.get(prompt.stage) ?? []), prompt]);
    }
    return [...groups.entries()].sort(
      (a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]),
    );
  }, [prompts]);

  return (
    <div className="app">
      <Rail />
      <main className="main">
        <TopBar crumbs={[{ label: 'Prompt library' }]} />
        <div className="content">
          <PageHead
            title="Prompt library"
            lede="The product is not one enormous prompt. Each orchestration stage owns a versioned template that declares its inputs, the schema it must return, and the guardrails it is held to."
          />

          <ErrorBox error={error} />

          <div style={{ marginBottom: 18 }}>
            <Notice tone="info">
              These are version-controlled files under <code className="mono">/prompts</code>,
              reviewed in git. This screen is read-only on purpose — a prompt change is a code
              change, and every artifact records the exact prompt version that produced it.
            </Notice>
          </div>

          {!prompts && <Loading what="Loading prompt library" />}

          {prompts && prompts.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
              <aside className="card">
                <div className="card__head">
                  <h3>{prompts.length} stages</h3>
                </div>
                <div className="card__body">
                  {byStage.map(([stage, items]) => (
                    <div key={stage} style={{ marginBottom: 14 }}>
                      <div className="filter__title">{titleCase(stage)}</div>
                      {items.map((prompt) => (
                        <button
                          key={prompt.key}
                          className="filter__opt"
                          style={{
                            width: '100%',
                            border: 'none',
                            background: selected?.key === prompt.key ? 'var(--pine-soft)' : 'transparent',
                            color: selected?.key === prompt.key ? 'var(--pine)' : 'inherit',
                            fontWeight: selected?.key === prompt.key ? 600 : 400,
                          }}
                          onClick={() => setSelected(prompt)}
                        >
                          {prompt.name}
                          <span className="filter__n">v{prompt.version}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </aside>

              {selected && (
                <div className="stack">
                  <div className="card">
                    <div className="card__head">
                      <h2>{selected.name}</h2>
                      <span className="card__head-actions row" style={{ gap: 6 }}>
                        <span className="badge badge--neutral">{titleCase(selected.stage)}</span>
                        <span className="badge badge--known">v{selected.version}</span>
                      </span>
                    </div>
                    <div className="card__body">
                      <div className="peek__field">
                        <div className="peek__k">Purpose</div>
                        <div className="peek__v">{selected.purpose}</div>
                      </div>

                      <div className="grid grid--2" style={{ gap: 14 }}>
                        <div className="peek__field">
                          <div className="peek__k">Inputs</div>
                          {selected.inputs.length === 0 ? (
                            <span className="small subtle">None declared</span>
                          ) : (
                            <ul className="small muted" style={{ paddingLeft: 16, margin: 0 }}>
                              {selected.inputs.map((input) => (
                                <li key={input.name}>
                                  <span className="mono">{input.name}</span> — {input.description}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="peek__field">
                          <div className="peek__k">Output schema</div>
                          <div className="peek__v mono">
                            {selected.output_schema ?? 'none (shared preamble)'}
                          </div>
                          <p className="hint">
                            Resolved against the contract classes in code, so the prompt and
                            the schema cannot drift apart.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="card__foot">
                      <span className="mono tiny">{selected.key}</span>
                      {' · checksum '}
                      <span className="mono tiny">{selected.checksum.slice(0, 12)}</span>
                    </div>
                  </div>

                  {selected.guardrails.length > 0 && (
                    <div className="card">
                      <div className="card__head"><h3>Guardrails</h3></div>
                      <div className="card__body">
                        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                          {selected.guardrails.map((guardrail, index) => (
                            <li key={index} style={{ marginBottom: 4 }}>{guardrail}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="card">
                    <div className="card__head"><h3>Instructions</h3></div>
                    <div className="card__body">
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        lineHeight: 1.6,
                        margin: 0,
                        color: 'var(--ink-muted)',
                      }}>
                        {selected.instructions}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
