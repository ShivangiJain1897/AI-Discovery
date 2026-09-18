'use client';

import { useCallback, useState } from 'react';
import { waitForJob } from '@/lib/api';
import type { Job } from '@/lib/types';

/** Runs a long action and tracks its job.
 *
 *  Every generation path in the product is asynchronous, so this exists once
 *  rather than being re-implemented per screen. It exposes the job's own
 *  progress messages instead of a generic spinner, because a user waiting two
 *  minutes deserves to know which stage is running. */
export function useJobRunner(onDone?: () => void | Promise<void>) {
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (start: () => Promise<Job>) => {
      setBusy(true);
      setError(null);
      setJob(null);
      try {
        const started = await start();
        setJob(started);
        const finished = await waitForJob(started.id, setJob);
        if (finished.status === 'failed') {
          setError(finished.message || finished.error || 'The job failed.');
        } else {
          await onDone?.();
        }
        return finished;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  return { run, job, busy, error, clearError: () => setError(null) };
}

export function JobStatusLine({ job, busy }: { job: Job | null; busy: boolean }) {
  if (!busy && !job) return null;
  const last = job?.progress?.[job.progress.length - 1];
  return (
    <div className="row small muted" style={{ padding: '8px 0' }}>
      {busy && <span className="spin" />}
      <span>{last?.message ?? job?.message ?? 'Starting…'}</span>
      {job?.status === 'succeeded' && <span style={{ color: 'var(--pine)' }}>✓ complete</span>}
    </div>
  );
}
