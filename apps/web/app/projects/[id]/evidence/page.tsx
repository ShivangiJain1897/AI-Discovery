'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Evidence, EvidenceList } from '@/lib/types';
import { ProjectShell, useProject } from '../ProjectShell';
import { PageHead, Empty, Loading, ErrorBox } from '@/components/Shell';
import { StrengthBadge, TierBadge, OriginBadge } from '@/components/Badges';
import { EvidenceChip } from '@/components/EvidenceChip';
import { EVIDENCE_TYPE_LABEL, titleCase } from '@/lib/format';

export default function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProjectShell projectId={id} section="Evidence">
      <EvidenceLibrary />
    </ProjectShell>
  );
}

type Filters = {
  q: string;
  research_type: string[];
  evidence_type: string[];
  strength: string[];
  tier: string[];
  origin: string;
  contradictions_only: boolean;
};

const EMPTY: Filters = {
  q: '', research_type: [], evidence_type: [],
  strength: [], tier: [], origin: '', contradictions_only: false,
};

function EvidenceLibrary() {
  const { project } = useProject();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [data, setData] = useState<EvidenceList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.listEvidence(project.id, {
        q: filters.q || undefined,
        research_type: filters.research_type,
        evidence_type: filters.evidence_type,
        strength: filters.strength,
        tier: filters.tier,
        origin: filters.origin || undefined,
        contradictions_only: filters.contradictions_only || undefined,
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load evidence.');
    } finally {
      setLoading(false);
    }
  }, [project.id, filters]);

  useEffect(() => {
    const timer = setTimeout(load, filters.q ? 280 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.q]);

  const toggle = (key: keyof Filters, value: string) => {
    setFilters((current) => {
      const list = current[key] as string[];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  const active = useMemo(
    () =>
      filters.q !== '' || filters.origin !== '' || filters.contradictions_only ||
      filters.research_type.length + filters.evidence_type.length +
      filters.strength.length + filters.tier.length > 0,
    [filters],
  );

  return (
    <>
      <PageHead
        title="Evidence library"
        lede="Every atomic statement the research collected, with its source, population and strength. This is the substrate every finding, analysis and artifact is built from."
        actions={
          <>
            <a className="btn" href={api.evidenceExportUrl(project.id, 'xlsx')}>Export XLSX</a>
            <a className="btn" href={api.evidenceExportUrl(project.id, 'csv')}>Export CSV</a>
          </>
        }
      />

      <ErrorBox error={error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 250px', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card__head">
            <input
              className="input"
              style={{ maxWidth: 340 }}
              placeholder="Search statements, excerpts and sources…"
              value={filters.q}
              onChange={(event) => setFilters((f) => ({ ...f, q: event.target.value }))}
            />
            <span className="muted small card__head-actions">
              {data ? `${data.items.length} of ${data.total}` : ''}
            </span>
          </div>

          {loading && <Loading what="Filtering evidence" />}

          {!loading && data?.items.length === 0 && (
            <Empty mark="○" title={active ? 'No evidence matches these filters' : 'No evidence yet'}
              action={active ? <button className="btn" onClick={() => setFilters(EMPTY)}>Clear filters</button> : undefined}>
              {active
                ? 'Try widening the filters.'
                : 'Run research, or upload internal material, to start building the evidence library.'}
            </Empty>
          )}

          {!loading && data?.items.map((item) => <EvidenceRow key={item.id} item={item} />)}
        </div>

        <aside className="card">
          <div className="card__head">
            <h3>Filters</h3>
            {active && (
              <button className="btn btn--ghost btn--sm card__head-actions" onClick={() => setFilters(EMPTY)}>
                Clear
              </button>
            )}
          </div>
          <div className="card__body">
            <div className="filters">
              <FacetGroup
                title="Strength" facetKey="strength"
                facets={data?.facets.strength} selected={filters.strength}
                onToggle={toggle} labeller={titleCase}
              />
              <FacetGroup
                title="Source tier" facetKey="tier"
                facets={data?.facets.tier} selected={filters.tier}
                onToggle={toggle}
                labeller={(value) => `T${value.match(/tier_(\d)/)?.[1]} ${titleCase(value.replace(/tier_\d_/, ''))}`}
              />
              <FacetGroup
                title="Evidence type" facetKey="evidence_type"
                facets={data?.facets.evidence_type} selected={filters.evidence_type}
                onToggle={toggle} labeller={(v) => EVIDENCE_TYPE_LABEL[v] ?? titleCase(v)}
              />
              <FacetGroup
                title="Research type" facetKey="research_type"
                facets={data?.facets.research_type} selected={filters.research_type}
                onToggle={toggle} labeller={titleCase}
              />

              <div>
                <div className="filter__title">Origin</div>
                {['', 'external', 'internal'].map((value) => (
                  <label className="filter__opt" key={value || 'all'}>
                    <input
                      type="radio" name="origin"
                      checked={filters.origin === value}
                      onChange={() => setFilters((f) => ({ ...f, origin: value }))}
                    />
                    {value === '' ? 'All' : titleCase(value)}
                    {value !== '' && data?.facets.origin?.[value] !== undefined && (
                      <span className="filter__n">{data.facets.origin[value]}</span>
                    )}
                  </label>
                ))}
              </div>

              <div>
                <div className="filter__title">Flags</div>
                <label className="filter__opt">
                  <input
                    type="checkbox"
                    checked={filters.contradictions_only}
                    onChange={(event) =>
                      setFilters((f) => ({ ...f, contradictions_only: event.target.checked }))}
                  />
                  Contradicted only
                </label>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function FacetGroup({
  title, facetKey, facets, selected, onToggle, labeller,
}: {
  title: string;
  facetKey: keyof Filters;
  facets?: Record<string, number>;
  selected: string[];
  onToggle: (key: keyof Filters, value: string) => void;
  labeller: (value: string) => string;
}) {
  const entries = Object.entries(facets ?? {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="filter__title">{title}</div>
      {entries.map(([value, count]) => (
        <label className="filter__opt" key={value}>
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => onToggle(facetKey, value)}
          />
          {labeller(value)}
          <span className="filter__n">{count}</span>
        </label>
      ))}
    </div>
  );
}

function EvidenceRow({ item }: { item: Evidence }) {
  return (
    <div className="ev">
      <div>
        <EvidenceChip refId={item.ref} />
      </div>
      <div>
        <div className="ev__statement">{item.statement}</div>

        <div className="ev__meta">
          <StrengthBadge strength={item.strength} reasoning={item.strength_reasoning} />
          <TierBadge tier={item.source.tier} />
          <OriginBadge origin={item.origin} />
          <span className="badge badge--neutral">
            {EVIDENCE_TYPE_LABEL[item.evidence_type] ?? item.evidence_type}
          </span>
          {item.population && (
            <span className="ev__pop" title="The population the source actually described">
              {item.population}
            </span>
          )}
          {item.corroboration_count > 0 && (
            <span className="badge badge--known" title="Independent sources agreeing">
              +{item.corroboration_count} corroborating
            </span>
          )}
          {item.contradiction_flag && (
            <span className="badge badge--risk">Contradicted</span>
          )}
        </div>

        {item.excerpt && <div className="ev__excerpt">&ldquo;{item.excerpt}&rdquo;</div>}

        <div className="tiny subtle" style={{ marginTop: 7 }}>
          {[item.source.publisher, item.source.publication_date, item.source.ref]
            .filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  );
}
