'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ProjectCounts } from '@/lib/types';

/** The pipeline nav. The sidebar is the method: Research → Evidence →
 *  Findings → Analysis → Opportunities → Artifacts, with live counts and a
 *  connector line, so the state of a discovery is legible at a glance and the
 *  next step is obvious. */
export function ProjectNav({
  projectId, counts,
}: { projectId: string; counts: ProjectCounts }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const steps = [
    { slug: '', label: 'Overview', count: null as number | null },
    { slug: '/research', label: 'Research', count: counts.sources },
    { slug: '/evidence', label: 'Evidence', count: counts.evidence },
    { slug: '/findings', label: 'Findings', count: counts.findings },
    { slug: '/analysis', label: 'Analysis', count: counts.analyses },
    { slug: '/opportunities', label: 'Opportunities', count: counts.opportunities },
    { slug: '/artifacts', label: 'Artifacts', count: counts.artifacts },
  ];

  return (
    <>
      <div className="rail__label" style={{ marginTop: 8 }}>Discovery pipeline</div>
      <div className="pipe">
        {steps.map((step) => {
          const href = `${base}${step.slug}`;
          const active = step.slug === '' ? pathname === base : pathname.startsWith(href);
          const done = (step.count ?? 0) > 0;
          return (
            <Link
              key={step.slug}
              href={href}
              className={[
                'pipe__step',
                active ? 'pipe__step--on' : '',
                done ? 'pipe__step--done' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="pipe__node" />
              <span className="pipe__label">{step.label}</span>
              {step.count !== null && step.count > 0 && (
                <span className="pipe__count">{step.count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
