'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProjectSummary } from '@/lib/types';
import { Rail, TopBar, PageHead, Empty, Loading, ErrorBox } from '@/components/Shell';
import { relativeTime } from '@/lib/format';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects()
      .then(setProjects)
      .catch((err) => { setError(err.message); setProjects([]); });
  }, []);

  return (
    <div className="app">
      <Rail />
      <main className="main">
        <TopBar crumbs={[{ label: 'Projects' }]} />
        <div className="content">
          <PageHead
            title="Discovery projects"
            lede="Each project holds its own evidence library, findings and artifacts."
            actions={<Link className="btn btn--primary" href="/">Start discovery</Link>}
          />

          <ErrorBox error={error} />
          {projects === null && <Loading what="Loading projects" />}

          {projects?.length === 0 && (
            <Empty mark="◆" title="No projects yet"
              action={<Link className="btn btn--primary" href="/">Start your first discovery</Link>}>
              A discovery project turns an ambiguous product question into evidence,
              findings and decision-ready artifacts.
            </Empty>
          )}

          {projects && projects.length > 0 && (
            <div className="card">
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Question</th>
                      <th>Lens</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td style={{ minWidth: 200 }}>
                          <Link href={`/projects/${project.id}`}>
                            <strong>{project.title}</strong>
                          </Link>
                        </td>
                        <td className="muted" style={{ maxWidth: 420 }}>{project.question}</td>
                        <td className="small">{project.persona.replace(/_/g, ' ')}</td>
                        <td><span className="badge badge--neutral">{project.status}</span></td>
                        <td className="small subtle">{relativeTime(project.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
