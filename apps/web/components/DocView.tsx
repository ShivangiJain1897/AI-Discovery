'use client';

import type { DocSection } from '@/lib/types';
import { KNOWLEDGE_WHY, KNOWLEDGE_LABEL } from '@/lib/format';
import { Cited, RefList } from './EvidenceChip';

/** Renders a generated document section.
 *
 *  Knowledge state is shown inline rather than hidden in metadata: a reader
 *  scanning a PRD needs to see which sections the research actually
 *  established and which are marked Unknown, without cross-referencing. */
export function DocSectionView({ section }: { section: DocSection }) {
  const tone =
    section.knowledge_state === 'known' ? '' :
    section.knowledge_state === 'likely' ? 'badge--likely' :
    section.knowledge_state === 'hypothesis' ? 'badge--hypothesis' : 'badge--unknown';

  const empty = !section.body && section.points.length === 0 && section.rows.length === 0;

  return (
    <section className="doc__section">
      <h2>{section.heading}</h2>

      {(section.knowledge_state !== 'known' || section.note) && (
        <div className={`doc__note badge ${tone}`} title={KNOWLEDGE_WHY[section.knowledge_state]}>
          {section.note || KNOWLEDGE_LABEL[section.knowledge_state]}
        </div>
      )}

      {section.body && <p><Cited text={section.body} /></p>}

      {section.points.length > 0 && (
        <ul>
          {section.points.map((point, index) => (
            <li key={index}><Cited text={point} /></li>
          ))}
        </ul>
      )}

      {section.rows.length > 0 && section.columns.length > 0 && (
        <div className="tablewrap" style={{ margin: '12px 0' }}>
          <table className="data">
            <thead>
              <tr>{section.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {section.rows.map((row, index) => (
                <tr key={index}>
                  {section.columns.map((column) => (
                    <td key={column}><Cited text={String(row[column] ?? '')} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {empty && (
        <p className="muted small" style={{ fontStyle: 'italic' }}>
          The discovery did not establish this. Nothing has been invented to fill it.
        </p>
      )}

      {section.evidence_refs.length > 0 && (
        <div className="doc__refs">
          <RefList refs={section.evidence_refs} />
        </div>
      )}
    </section>
  );
}

export function DocView({ sections }: { sections: DocSection[] }) {
  return (
    <div className="doc">
      {sections.map((section, index) => (
        <DocSectionView key={`${section.heading}-${index}`} section={section} />
      ))}
    </div>
  );
}
