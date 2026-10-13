export type Status = 'new' | 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'skipped';
export const PIPELINE: Status[] = ['applied', 'interview', 'offer', 'rejected'];

export interface Contacts {
  emails: string[];
  links: { label: string; url: string }[];
}

export interface Drafts {
  coverNote?: string;
  linkedinNote?: string;
  email?: { subject: string; body: string };
  followUp?: string;
  tailoring?: string;
  resumeId?: string;
  at?: string;
}

export interface JobSummary {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  apply_url: string | null;
  posted_at: string | null;
  fetched_at: string;
  score: number;
  resume_id: string | null;
  matched: string[];
  missing: string[];
  contacts: Contacts;
  extra: { experience?: string; salary?: string };
  status: Status;
  status_at: string | null;
  applied_at: string | null;
  notes: string;
  hasDrafts: boolean;
}

export interface Segment {
  t: string;
  kind?: 'have' | 'gap';
}

export interface Job extends Omit<JobSummary, 'hasDrafts'> {
  description: string;
  drafts: Drafts;
  segments: Segment[];
}

export interface SkillCount {
  skill: string;
  count: number;
}

export interface Stats {
  counts: Record<Status, number>;
  followUps: JobSummary[];
  gaps: SkillCount[];
  demand: SkillCount[];
  dayOfHunt: number;
  dailyGoal: number;
  appliedToday: number;
  drill: { skill: string; done: boolean } | null;
  blockedCount: number;
  lastFetch: { finished_at: string; summary: { added?: number; errors?: string[] } } | null;
  nextFetchAt: string | null;
}

export interface Resume {
  id: string;
  title: string;
  file?: string;
  textFile?: string;
  keywords: string[];
  titleHints: string[];
  hasFile: boolean;
  hasText: boolean;
}

export interface Search {
  keywords: string;
  location: string;
  remote?: boolean;
}

export interface Profile {
  me?: { name?: string; experienceYears?: number; pitch?: string; huntStartedOn?: string };
  searches: Search[];
  sources?: Record<string, boolean>;
  maxAgeDays?: number;
  pagesPerSearch?: number;
  maxDescriptionFetches?: number;
  fetchEveryHours?: number;
  dailyGoal?: number;
  blockedCompanies?: string[];
  excludeTitleWords?: string[];
  requireTitleWords?: string[];
  locationInclude?: string[];
  locationExclude?: string[];
  minScore?: number;
  [key: string]: unknown;
}

export interface FetchState {
  running: boolean;
  log: string[];
  startedAt: string | null;
  nextAt: string | null;
}

export interface QuizQuestion {
  type: 'mcq' | 'short';
  q: string;
  options?: string[];
  answer: number | string;
  explanation?: string;
}

export interface QuizResult {
  n: number;
  correct: boolean;
  feedback?: string;
}

export interface QuizHistoryRow {
  id: number;
  skill: string;
  taken_at: string;
  score: number;
  total: number;
}
