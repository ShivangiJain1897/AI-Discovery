'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProjectDetail } from '@/lib/types';
import { Rail, TopBar, Loading, Notice } from '@/components/Shell';
import { ProjectNav } from '@/components/ProjectNav';
import { Copilot } from '@/components/Copilot';
import { EvidencePeekProvider } from '@/components/EvidenceChip';

interface ProjectContextValue {
  project: ProjectDetail;
  reload: () => Promise<void>;
}

const Ctx = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useProject must be used inside ProjectShell');
  return value;
}

export function ProjectShell({
  projectId, section, children,
}: { projectId: string; section: string; children: React.ReactNode }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setProject(await api.getProject(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the project.');
    }
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  if (error) {
    return (
      <div className="app">
        <Rail />
        <main className="main">
          <TopBar crumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Error' }]} />
          <div className="content"><Notice tone="risk">{error}</Notice></div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app">
        <Rail />
        <main className="main"><Loading what="Loading project" /></main>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ project, reload }}>
      <EvidencePeekProvider projectId={projectId}>
        <div className="app">
          <Rail>
            <ProjectNav projectId={projectId} counts={project.counts} />
          </Rail>

          <main
            className="main"
            style={copilotOpen ? { marginRight: 'var(--copilot)' } : undefined}
          >
            <TopBar
              crumbs={[
                { label: 'Projects', href: '/projects' },
                { label: project.title, href: `/projects/${projectId}` },
                { label: section },
              ]}
              actions={
                <button
                  className={`btn btn--sm${copilotOpen ? ' btn--primary' : ''}`}
                  onClick={() => setCopilotOpen((open) => !open)}
                >
                  Copilot
                </button>
              }
            />
            <div className="content">{children}</div>
          </main>

          {copilotOpen && (
            <Copilot projectId={projectId} onClose={() => setCopilotOpen(false)} />
          )}
        </div>
      </EvidencePeekProvider>
    </Ctx.Provider>
  );
}
