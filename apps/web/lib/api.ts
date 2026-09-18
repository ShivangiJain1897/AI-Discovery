import type {
  Analysis, AnalysisRouting, Artifact, ArtifactDetail, ArtifactTypeInfo,
  ArtifactVersion, CopilotAnswer, CoverageEntry, Evidence, EvidenceList,
  FindingsBundle, Health, Job, Opportunity, ProjectContext, ProjectDetail,
  ProjectSummary, PromptTemplate, Recommendation, ResearchPlan, ResearchRun,
  Source, UploadedDocument, UseCase,
} from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      cache: 'no-store',
    });
  } catch {
    // A dead API is the most common local failure; say so plainly rather
    // than surfacing "Failed to fetch" to the user.
    throw new ApiError(0, `Cannot reach the API at ${API_BASE}. Is it running?`);
  }

  if (!response.ok) {
    let detail: unknown;
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = body;
      if (typeof body?.detail === 'string') message = body.detail;
      else if (Array.isArray(body?.detail)) message = body.detail.map((d: { msg?: string }) => d.msg).join('; ');
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, message, detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const qs = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  health: () => request<Health>('/health'),

  // ── projects ──────────────────────────────────────────
  listProjects: () => request<ProjectSummary[]>('/projects'),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  createProject: (body: { question: string; persona?: string; depth?: string; title?: string }) =>
    request<ProjectDetail>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateContext: (id: string, body: Partial<ProjectContext>) =>
    request<ProjectContext>(`/projects/${id}/context`, { method: 'PATCH', body: JSON.stringify(body) }),
  coverage: (id: string) => request<CoverageEntry[]>(`/projects/${id}/coverage`),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // ── research ──────────────────────────────────────────
  createPlan: (id: string, depth: string) =>
    request<ResearchPlan>(`/projects/${id}/research/plan`, {
      method: 'POST', body: JSON.stringify({ depth }),
    }),
  getPlan: (id: string) => request<ResearchPlan>(`/projects/${id}/research/plan`),
  updatePlan: (id: string, planId: string, body: Record<string, unknown>) =>
    request<ResearchPlan>(`/projects/${id}/research/plan/${planId}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
  updateQuestion: (id: string, questionId: string, body: Record<string, unknown>) =>
    request<unknown>(`/projects/${id}/research/questions/${questionId}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
  addQuestion: (id: string, planId: string, body: Record<string, unknown>) =>
    request<unknown>(`/projects/${id}/research/plan/${planId}/questions`, {
      method: 'POST', body: JSON.stringify(body),
    }),
  deleteQuestion: (id: string, questionId: string) =>
    request<void>(`/projects/${id}/research/questions/${questionId}`, { method: 'DELETE' }),
  runResearch: (id: string, body: Record<string, unknown> = {}) =>
    request<Job>(`/projects/${id}/research/run`, { method: 'POST', body: JSON.stringify(body) }),
  listRuns: (id: string) => request<ResearchRun[]>(`/projects/${id}/research/runs`),

  // ── evidence ──────────────────────────────────────────
  listEvidence: (id: string, filters: Record<string, unknown> = {}) =>
    request<EvidenceList>(`/projects/${id}/evidence${qs(filters)}`),
  getEvidence: (id: string, ref: string) =>
    request<Evidence>(`/projects/${id}/evidence/${ref}`),
  listSources: (id: string) => request<Source[]>(`/projects/${id}/sources`),
  evidenceExportUrl: (id: string, format: string) =>
    `${API_BASE}/projects/${id}/evidence-export?format=${format}`,

  // ── synthesis ─────────────────────────────────────────
  runSynthesis: (id: string) => request<Job>(`/projects/${id}/synthesis`, { method: 'POST' }),
  getFindings: (id: string) => request<FindingsBundle>(`/projects/${id}/findings`),
  researchReportUrl: (id: string, format: string) =>
    `${API_BASE}/projects/${id}/research-report?format=${format}`,

  // ── analysis ──────────────────────────────────────────
  recommendedAnalyses: (id: string) =>
    request<AnalysisRouting>(`/projects/${id}/analysis/recommended`),
  runAnalyses: (id: string, analysisTypes: string[], persona?: string) =>
    request<Job>(`/projects/${id}/analysis`, {
      method: 'POST',
      body: JSON.stringify({ analysis_types: analysisTypes, persona, parameters: {} }),
    }),
  listAnalyses: (id: string) => request<Analysis[]>(`/projects/${id}/analysis`),
  getAnalysis: (id: string, ref: string) => request<Analysis>(`/projects/${id}/analysis/${ref}`),
  analysisExportUrl: (id: string, ref: string, format: string) =>
    `${API_BASE}/projects/${id}/analysis/${ref}/export?format=${format}`,

  // ── opportunities, use cases, recommendations ─────────
  generateOpportunities: (id: string, replace = false) =>
    request<Job>(`/projects/${id}/opportunities?replace=${replace}`, { method: 'POST' }),
  listOpportunities: (id: string) => request<Opportunity[]>(`/projects/${id}/opportunities`),
  updateOpportunity: (id: string, ref: string, body: Record<string, unknown>) =>
    request<Opportunity>(`/projects/${id}/opportunities/${ref}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
  prioritize: (id: string, body: Record<string, unknown>) =>
    request<Analysis>(`/projects/${id}/prioritize`, { method: 'POST', body: JSON.stringify(body) }),
  generateUseCases: (id: string, count = 10) =>
    request<Job>(`/projects/${id}/use-cases?count=${count}`, { method: 'POST' }),
  listUseCases: (id: string) => request<UseCase[]>(`/projects/${id}/use-cases`),
  generateRecommendations: (id: string) =>
    request<Job>(`/projects/${id}/recommendations`, { method: 'POST' }),
  listRecommendations: (id: string) => request<Recommendation[]>(`/projects/${id}/recommendations`),

  // ── artifacts ─────────────────────────────────────────
  artifactTypes: (id: string) => request<ArtifactTypeInfo[]>(`/projects/${id}/artifacts/types`),
  generateArtifact: (id: string, body: Record<string, unknown>) =>
    request<Job>(`/projects/${id}/artifacts`, { method: 'POST', body: JSON.stringify(body) }),
  listArtifacts: (id: string) => request<Artifact[]>(`/projects/${id}/artifacts`),
  getArtifact: (id: string, ref: string, version?: number) =>
    request<ArtifactDetail>(`/projects/${id}/artifacts/${ref}${qs({ version })}`),
  listVersions: (id: string, ref: string) =>
    request<ArtifactVersion[]>(`/projects/${id}/artifacts/${ref}/versions`),
  regenerateSection: (id: string, ref: string, heading: string, instruction = '') =>
    request<Job>(`/projects/${id}/artifacts/${ref}/regenerate`, {
      method: 'POST', body: JSON.stringify({ heading, instruction }),
    }),
  exportArtifact: async (id: string, ref: string, format: string) => {
    const response = await fetch(`${API_BASE}/projects/${id}/artifacts/${ref}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    if (!response.ok) throw new ApiError(response.status, 'Export failed');
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${ref}.${format}`;
    return { blob, name };
  },

  // ── uploads ───────────────────────────────────────────
  listDocuments: (id: string) => request<UploadedDocument[]>(`/projects/${id}/uploads`),
  uploadDocument: (id: string, file: File, kind: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('document_kind', kind);
    return request<UploadedDocument>(`/projects/${id}/uploads`, { method: 'POST', body: form });
  },
  documentKinds: (id: string) =>
    request<{ value: string; label: string; research_type: string }[]>(`/projects/${id}/uploads/kinds`),

  // ── copilot ───────────────────────────────────────────
  askCopilot: (id: string, question: string, focusRefs?: string[]) =>
    request<CopilotAnswer>(`/projects/${id}/copilot`, {
      method: 'POST', body: JSON.stringify({ question, focus_refs: focusRefs }),
    }),
  copilotSuggestions: (id: string) => request<string[]>(`/projects/${id}/copilot/suggestions`),

  // ── prompts & jobs ────────────────────────────────────
  listPrompts: () => request<PromptTemplate[]>('/prompts'),
  getPrompt: (key: string) => request<PromptTemplate>(`/prompts/${key}`),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  listJobs: (projectId?: string, activeOnly = false) =>
    request<Job[]>(`/jobs${qs({ project_id: projectId, active_only: activeOnly })}`),
};

/** Poll a job to completion. Used by every long-running action. */
export async function waitForJob(
  jobId: string,
  onTick?: (job: Job) => void,
  { intervalMs = 1200, timeoutMs = 600_000 } = {},
): Promise<Job> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await api.getJob(jobId);
    onTick?.(job);
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }
    if (Date.now() > deadline) {
      throw new ApiError(408, 'Timed out waiting for the job to finish.');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
