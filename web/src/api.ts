import type {
  Drafts, FetchState, Job, JobSummary, Profile, QuizHistoryRow, QuizQuestion, QuizResult, Resume, Stats, Status,
} from './types';

async function call<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

const jobPath = (id: string) => `/api/jobs/${encodeURIComponent(id)}`;

export type View = 'feed' | 'saved' | 'tracker';

export const api = {
  jobs: (view: View) => call<JobSummary[]>(`/api/jobs?view=${view}`),
  job: (id: string) => call<Job>(jobPath(id)),
  setStatus: (id: string, status: Status, extra: { resumeId?: string; notes?: string } = {}) =>
    call<JobSummary>(`${jobPath(id)}/status`, { status, ...extra }),
  draft: (id: string, resumeId?: string) => call<Drafts>(`${jobPath(id)}/draft`, { resumeId }),
  tailor: (id: string, resumeId?: string) => call<{ advice: string }>(`${jobPath(id)}/tailor`, { resumeId }),
  blockCompany: (company: string) => call<{ blockedCompanies: string[] }>('/api/block-company', { company }),
  stats: () => call<Stats>('/api/stats'),
  fetchState: () => call<FetchState>('/api/fetch'),
  startFetch: () => call<{ started: boolean }>('/api/fetch', {}),
  profile: () => call<Profile>('/api/profile'),
  saveProfile: (p: Profile) => call<Profile>('/api/profile', p, 'PUT'),
  resumes: () => call<Resume[]>('/api/resumes'),
  rescore: () => call<{ rescored: number }>('/api/rescore', {}),
  quiz: (skill: string, level: string) => call<{ questions: QuizQuestion[] }>('/api/learn/quiz', { skill, level }),
  grade: (skill: string, questions: QuizQuestion[], answers: (string | number | null)[]) =>
    call<{ score: number; total: number; results: QuizResult[] }>('/api/learn/grade', { skill, questions, answers }),
  quizHistory: () => call<QuizHistoryRow[]>('/api/learn/history'),
};

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}
