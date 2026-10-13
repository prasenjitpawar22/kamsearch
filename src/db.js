import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './config.js';

export const STATUSES = ['new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'skipped'];
const JSON_COLS = ['matched', 'missing', 'contacts', 'drafts', 'extra'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  location    TEXT,
  remote      INTEGER DEFAULT 0,
  url         TEXT NOT NULL,
  apply_url   TEXT,
  description TEXT,
  posted_at   TEXT,
  fetched_at  TEXT NOT NULL,
  dedupe_key  TEXT,
  score       INTEGER DEFAULT 0,
  resume_id   TEXT,
  matched     TEXT DEFAULT '[]',
  missing     TEXT DEFAULT '[]',
  contacts    TEXT DEFAULT '{}',
  drafts      TEXT DEFAULT '{}',
  extra       TEXT DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'new',
  status_at   TEXT,
  applied_at  TEXT,
  notes       TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_dedupe ON jobs(dedupe_key);

CREATE TABLE IF NOT EXISTS fetch_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  summary     TEXT
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  skill     TEXT NOT NULL,
  taken_at  TEXT NOT NULL,
  score     INTEGER NOT NULL,
  total     INTEGER NOT NULL,
  detail    TEXT
);
`;

function fromRow(row) {
  if (!row) return null;
  const job = { ...row, remote: Boolean(row.remote) };
  for (const c of JSON_COLS) job[c] = JSON.parse(row[c] || (c === 'matched' || c === 'missing' ? '[]' : '{}'));
  return job;
}

export function openDb(file = path.join(DATA_DIR, 'kamsearch.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const now = () => new Date().toISOString();

  return {
    raw: db,

    hasJob: (id) => Boolean(db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id)),
    hasDedupe: (key) => Boolean(db.prepare('SELECT 1 FROM jobs WHERE dedupe_key = ?').get(key)),

    insertJob(j) {
      db.prepare(
        `INSERT INTO jobs (id, source, title, company, location, remote, url, apply_url, description, posted_at,
           fetched_at, dedupe_key, score, resume_id, matched, missing, contacts, extra, status_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        j.id, j.source, j.title, j.company, j.location || '', j.remote ? 1 : 0, j.url, j.applyUrl || null,
        j.description || '', j.postedAt || null, now(), j.dedupeKey, j.score, j.resumeId,
        JSON.stringify(j.matched), JSON.stringify(j.missing), JSON.stringify(j.contacts), JSON.stringify(j.extra || {}),
        now(),
      );
    },

    getJob: (id) => fromRow(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id)),

    listJobs({ statuses } = {}) {
      const rows = statuses?.length
        ? db.prepare(`SELECT * FROM jobs WHERE status IN (${statuses.map(() => '?').join(',')})`).all(...statuses)
        : db.prepare('SELECT * FROM jobs').all();
      return rows.map(fromRow);
    },

    setStatus(id, status, { resumeId, notes } = {}) {
      const job = this.getJob(id);
      if (!job) return null;
      db.prepare(
        `UPDATE jobs SET status = ?, status_at = ?, resume_id = ?, notes = ?,
           applied_at = CASE WHEN ? = 'applied' AND applied_at IS NULL THEN ? ELSE applied_at END
         WHERE id = ?`,
      ).run(status, now(), resumeId ?? job.resume_id, notes ?? job.notes, status, now(), id);
      return this.getJob(id);
    },

    setScore(id, { score, resumeId, matched, missing }) {
      db.prepare('UPDATE jobs SET score = ?, resume_id = ?, matched = ?, missing = ? WHERE id = ?').run(
        score, resumeId, JSON.stringify(matched), JSON.stringify(missing), id,
      );
    },

    setDrafts(id, drafts) {
      db.prepare('UPDATE jobs SET drafts = ? WHERE id = ?').run(JSON.stringify(drafts), id);
    },

    startFetch: () => Number(db.prepare('INSERT INTO fetch_runs (started_at) VALUES (?)').run(now()).lastInsertRowid),
    finishFetch(runId, summary) {
      db.prepare('UPDATE fetch_runs SET finished_at = ?, summary = ? WHERE id = ?').run(now(), JSON.stringify(summary), runId);
    },
    lastFetch() {
      const row = db.prepare('SELECT * FROM fetch_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1').get();
      return row ? { ...row, summary: JSON.parse(row.summary || '{}') } : null;
    },

    saveQuiz({ skill, score, total, detail }) {
      db.prepare('INSERT INTO quiz_results (skill, taken_at, score, total, detail) VALUES (?, ?, ?, ?, ?)').run(
        skill, now(), score, total, JSON.stringify(detail),
      );
    },
    quizHistory: () =>
      db.prepare('SELECT id, skill, taken_at, score, total FROM quiz_results ORDER BY id DESC LIMIT 100').all(),
  };
}
