'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { CopilotAnswer } from '@/lib/types';
import { KnowledgeBadge } from './Badges';
import { Cited, RefList } from './EvidenceChip';

interface Turn {
  question: string;
  answer?: CopilotAnswer;
  error?: string;
}

/** Answers from the project's own evidence, never from general knowledge.
 *  Every answer shows its knowledge state and the evidence it used, so the
 *  copilot is held to the same standard as the rest of the platform. */
export function Copilot({
  projectId, onClose,
}: { projectId: string; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.copilotSuggestions(projectId).then(setSuggestions).catch(() => setSuggestions([]));
  }, [projectId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setQuestion('');
    setBusy(true);
    const index = turns.length;
    setTurns((prev) => [...prev, { question: trimmed }]);
    try {
      const answer = await api.askCopilot(projectId, trimmed);
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, answer } : t)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, error: message } : t)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="copilot" aria-label="Project copilot">
      <header className="copilot__head">
        <strong style={{ fontSize: '0.87rem' }}>Copilot</strong>
        <span className="tiny subtle">answers from this project&rsquo;s evidence</span>
        <button className="btn btn--ghost btn--sm right" onClick={onClose}>Close</button>
      </header>

      <div className="copilot__body" ref={bodyRef}>
        {turns.length === 0 && (
          <>
            <p className="small muted" style={{ marginBottom: 14 }}>
              Ask about what this project has actually established. The copilot reads the
              evidence library, findings and gaps — it will say when something is not known.
            </p>
            {suggestions.map((s) => (
              <button key={s} className="copilot__sugg" onClick={() => ask(s)}>{s}</button>
            ))}
          </>
        )}

        {turns.map((turn, index) => (
          <div className="copilot__turn" key={index}>
            <div className="copilot__q">{turn.question}</div>
            {turn.error && <div className="notice notice--risk">{turn.error}</div>}
            {!turn.answer && !turn.error && (
              <div className="row"><span className="spin" /><span className="muted small">Reading the evidence…</span></div>
            )}
            {turn.answer && (
              <div className="copilot__a">
                <div style={{ marginBottom: 8 }}>
                  <KnowledgeBadge state={turn.answer.knowledge_state} />
                </div>
                <p><Cited text={turn.answer.answer} /></p>

                {turn.answer.evidence_refs.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="peek__k">Evidence used</div>
                    <RefList refs={turn.answer.evidence_refs} />
                  </div>
                )}

                {turn.answer.caveats.length > 0 && (
                  <ul className="tiny subtle" style={{ paddingLeft: 16, marginTop: 10 }}>
                    {turn.answer.caveats.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                )}

                {turn.answer.suggested_actions.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {turn.answer.suggested_actions.map((a, i) => (
                      <div key={i} className="tiny muted">→ {a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        className="copilot__foot"
        onSubmit={(event) => { event.preventDefault(); ask(question); }}
      >
        <textarea
          className="textarea"
          style={{ minHeight: 64, marginBottom: 8 }}
          placeholder="Ask about this project's evidence…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              ask(question);
            }
          }}
        />
        <button className="btn btn--primary" style={{ width: '100%' }} disabled={busy || !question.trim()}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </aside>
  );
}
