'use client';

import { useEffect, useState } from 'react';
import { api, API_BASE } from '@/lib/api';
import type { Health } from '@/lib/types';
import { Rail, TopBar, PageHead, Loading, ErrorBox, Notice } from '@/components/Shell';

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    api.health().then(setHealth).catch((err) => setError(err.message));
    setTheme(localStorage.getItem('discovery-theme') ?? 'system');
  }, []);

  const applyTheme = (next: string) => {
    setTheme(next);
    try { localStorage.setItem('discovery-theme', next); } catch { /* private mode */ }
    if (next === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="app">
      <Rail />
      <main className="main">
        <TopBar crumbs={[{ label: 'Settings' }]} />
        <div className="content content--doc">
          <PageHead
            title="Settings"
            lede="Providers are configured through environment variables so they can be swapped without touching code. This screen reports what is actually in use."
          />

          <ErrorBox error={error} />
          {!health && !error && <Loading what="Checking services" />}

          {health && (
            <div className="stack">
              {!health.llm.live && (
                <Notice tone="warn">
                  <strong>Deterministic mode.</strong> {health.llm.note}
                </Notice>
              )}

              <div className="card">
                <div className="card__head"><h2>Providers</h2></div>
                <div className="tablewrap">
                  <table className="data">
                    <thead>
                      <tr><th>Service</th><th>Configured</th><th>In use</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Model</strong></td>
                        <td className="mono">{health.llm.configured}</td>
                        <td className="mono">{health.llm.effective} · {health.llm.model}</td>
                        <td>
                          <span className={`badge badge--${health.llm.live ? 'known' : 'hypothesis'}`}>
                            {health.llm.live ? 'Live' : 'Fallback'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Web search</strong></td>
                        <td className="mono">{health.search.configured}</td>
                        <td className="mono">{health.search.effective}</td>
                        <td>
                          <span className={`badge badge--${health.search.live ? 'known' : 'hypothesis'}`}>
                            {health.search.live ? 'Live' : 'Fallback'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Embeddings</strong></td>
                        <td className="mono">{String(health.embeddings.configured)}</td>
                        <td className="mono">
                          {String(health.embeddings.effective)} · dim {String(health.embeddings.dimension)}
                        </td>
                        <td><span className="badge badge--neutral">active</span></td>
                      </tr>
                      <tr>
                        <td><strong>Database</strong></td>
                        <td className="mono">postgres</td>
                        <td className="mono">{String(health.database.url ?? '—')}</td>
                        <td>
                          <span className={`badge badge--${health.database.status === 'ok' ? 'known' : 'risk'}`}>
                            {String(health.database.status)}
                            {health.database.pgvector ? ' · pgvector' : ''}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="card__foot">
                  A provider falls back automatically when its credential is absent, so the
                  product and its tests always run. The fallback never invents content — it
                  reports &ldquo;Not established&rdquo;.
                </div>
              </div>

              <div className="card">
                <div className="card__head"><h2>Safety &amp; governance</h2></div>
                <div className="card__body">
                  <div className="grid grid--2" style={{ gap: 14 }}>
                    <Row k="PII / PHI detection" v={health.safety.phi_detection ? 'Enabled' : 'Disabled'} />
                    <Row k="On detection" v={String(health.safety.on_detect)} />
                    <Row k="Audit logging" v={health.safety.audit_log ? 'Enabled' : 'Disabled'} />
                    <Row k="Data retention" v={`${health.safety.retention_days} days`} />
                  </div>
                  <Notice tone="warn">
                    Identifier detection reduces the chance of transmitting PHI to a third-party
                    model provider. It does not make a deployment HIPAA compliant, and nothing
                    here should be read as claiming that.
                  </Notice>
                </div>
              </div>

              <div className="card">
                <div className="card__head"><h2>Appearance</h2></div>
                <div className="card__body">
                  <label className="label">Theme</label>
                  <div className="row" style={{ gap: 6 }}>
                    {['system', 'light', 'dark'].map((option) => (
                      <button
                        key={option}
                        className={`btn btn--sm${theme === option ? ' btn--primary' : ''}`}
                        onClick={() => applyTheme(option)}
                      >
                        {option[0].toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__head"><h2>Platform</h2></div>
                <div className="card__body">
                  <div className="grid grid--2" style={{ gap: 14 }}>
                    <Row k="Version" v={health.version} />
                    <Row k="API" v={API_BASE} />
                    <Row k="Prompt templates" v={String(health.prompts.count)} />
                    <Row k="Prompt directory" v={health.prompts.directory} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="peek__field">
      <div className="peek__k">{k}</div>
      <div className="peek__v mono small">{v}</div>
    </div>
  );
}
