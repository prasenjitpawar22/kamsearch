import { fetchLinkedIn } from './sources/linkedin.js';
import { fetchNaukri } from './sources/naukri.js';
import { fetchBoards } from './sources/boards.js';
import { rejectReason, dedupeKey } from './filters.js';
import { prepareResumes, scoreJob } from './scoring.js';
import { findContacts } from './contacts.js';
import { politePause } from './http.js';

// Each source runs on its own; one failing (blocked, captcha, site change) never stops the others.
export async function runFetch({ db, profile, companies, resumes, log = console.log }) {
  const runId = db.startFetch();
  const summary = { sources: {}, rejected: {}, added: 0, duplicates: 0, errors: [] };
  const enabled = profile.sources || {};

  const tasks = [
    ['linkedin', () => fetchLinkedIn(profile, log)],
    ['naukri', () => fetchNaukri(profile, log)],
    ['greenhouse', () => fetchBoards('greenhouse', companies.greenhouse, log)],
    ['lever', () => fetchBoards('lever', companies.lever, log)],
    ['ashby', () => fetchBoards('ashby', companies.ashby, log)],
  ].filter(([name]) => enabled[name] !== false);

  const found = [];
  for (const [name, run] of tasks) {
    try {
      const jobs = await run();
      summary.sources[name] = jobs.length;
      found.push(...jobs);
    } catch (err) {
      summary.sources[name] = 0;
      summary.errors.push(`${name}: ${err.message}`);
      log(`${name}: failed (${err.message})`);
    }
  }

  const prepared = prepareResumes(resumes);
  const seenKeys = new Set();
  let descriptionFetches = 0;

  for (const job of found) {
    const id = `${job.source}:${job.externalId}`;
    // Some posters use "𝗕𝗢𝗟𝗗" Unicode letters in titles; NFKC turns them back into plain text.
    job.title = job.title.normalize('NFKC');
    job.company = job.company.normalize('NFKC');
    if (db.hasJob(id)) continue;

    const reason = rejectReason(job, profile);
    if (reason) {
      summary.rejected[reason] = (summary.rejected[reason] || 0) + 1;
      continue;
    }

    const key = dedupeKey(job);
    if (seenKeys.has(key) || db.hasDedupe(key)) {
      summary.duplicates++;
      continue;
    }
    seenKeys.add(key);

    // LinkedIn search results have no description; fetch it only for jobs that survived filtering.
    if (!job.description && job.loadDescription && descriptionFetches < (profile.maxDescriptionFetches ?? 40)) {
      descriptionFetches++;
      try {
        job.description = await job.loadDescription();
      } catch (err) {
        log(`description for ${id}: ${err.message}`);
      }
      await politePause(1000, 2500);
    }

    const s = scoreJob(job, prepared);
    db.insertJob({ ...job, id, dedupeKey: key, ...s, contacts: findContacts(job) });
    summary.added++;
  }

  db.finishFetch(runId, summary);
  log(`done: ${summary.added} new jobs, ${summary.duplicates} duplicates, rejected ${JSON.stringify(summary.rejected)}`);
  return summary;
}

// Re-run scoring after resumes change, so the picked resume and match score stay current.
export function rescoreAll(db, resumes) {
  const prepared = prepareResumes(resumes);
  const jobs = db.listJobs();
  for (const job of jobs) db.setScore(job.id, scoreJob(job, prepared));
  return jobs.length;
}
