import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RESUME_DIR, loadProfile, saveProfile, loadCompanies, loadResumes, resumeText } from './config.js';
import { openDb, STATUSES } from './db.js';
import { runFetch, rescoreAll } from './fetch.js';
import { isBlockedCompany } from './filters.js';
import { skillSpans } from './skills.js';
import { draftOutreach, tailorResume, makeQuiz, gradeShortAnswers } from './ai.js';

const PORT = Number(process.env.PORT) || 4321;
const HOST = '127.0.0.1';
const PUBLIC = path.join(ROOT, 'web', 'dist');
const FOLLOW_UP_DAYS = 7;
const DAY = 86400000;

const db = openDb();
const fetchState = { running: false, log: [], startedAt: null, nextAt: null };

// ---------- jobs ----------

function startFetch() {
  if (fetchState.running) return false;
  Object.assign(fetchState, { running: true, log: [], startedAt: new Date().toISOString() });
  const log = (line) => {
    fetchState.log.push(`${new Date().toLocaleTimeString()}  ${line}`);
    if (fetchState.log.length > 300) fetchState.log.shift();
    console.log(line);
  };
  runFetch({ db, profile: loadProfile(), companies: loadCompanies(), resumes: loadResumes(), log })
    .catch((err) => log(`fetch failed: ${err.message}`))
    .finally(() => (fetchState.running = false));
  return true;
}

const summary = ({ description, drafts, ...job }) => ({ ...job, hasDrafts: Object.keys(drafts).length > 0 });

function listJobs(view) {
  const profile = loadProfile();
  if (view === 'tracker') {
    return db
      .listJobs({ statuses: ['applied', 'interview', 'offer', 'rejected'] })
      .sort((a, b) => (b.status_at || '').localeCompare(a.status_at || ''))
      .map(summary);
  }
  return db
    .listJobs({ statuses: view === 'saved' ? ['saved'] : ['new'] })
    .filter((j) => !isBlockedCompany(j.company, profile.blockedCompanies) && j.score >= (profile.minScore || 0))
    .sort((a, b) => b.score - a.score || (b.posted_at || '').localeCompare(a.posted_at || ''))
    .map(summary);
}

function stats() {
  const all = db.listJobs();
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const j of all) counts[j.status]++;

  const cutoff = Date.now() - FOLLOW_UP_DAYS * 86400000;
  const followUps = all
    .filter((j) => j.status === 'applied' && j.applied_at && new Date(j.applied_at).getTime() < cutoff)
    .map(summary);

  // Skills employers keep asking for that your best-matching resume doesn't show: your study list.
  const gaps = {};
  const demand = {};
  for (const j of all.filter((j) => j.status !== 'skipped')) {
    for (const s of j.missing) gaps[s] = (gaps[s] || 0) + 1;
    for (const s of [...j.matched, ...j.missing]) demand[s] = (demand[s] || 0) + 1;
  }
  const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([skill, count]) => ({ skill, count }));
  const topGaps = top(gaps, 15);

  // "Today's Orders": the daily apply goal and one drill on the most-asked skill you're missing.
  const profile = loadProfile();
  const today = new Date().toDateString();
  const isToday = (iso) => iso && new Date(iso).toDateString() === today;
  const drillSkill = topGaps[0]?.skill || null;
  const drill = drillSkill && {
    skill: drillSkill,
    done: db.quizHistory().some((q) => q.skill.toLowerCase() === drillSkill && isToday(q.taken_at)),
  };

  const start = profile.me?.huntStartedOn || all.map((j) => j.fetched_at).sort()[0] || new Date().toISOString();
  const midnight = (d) => new Date(new Date(d).toDateString()).getTime();
  const dayOfHunt = Math.max(1, Math.round((midnight(Date.now()) - midnight(start)) / DAY) + 1);

  return {
    counts,
    followUps,
    gaps: topGaps,
    demand: top(demand, 20),
    dayOfHunt,
    dailyGoal: profile.dailyGoal ?? 5,
    appliedToday: all.filter((j) => isToday(j.applied_at)).length,
    drill,
    blockedCount: (profile.blockedCompanies || []).length,
    lastFetch: db.lastFetch(),
    nextFetchAt: fetchState.nextAt,
  };
}

// Splits a description into plain text and skill mentions, so the UI can highlight have/gap skills.
function segments(job) {
  const text = job.description || '';
  const out = [];
  let i = 0;
  for (const s of skillSpans(text)) {
    if (s.start > i) out.push({ t: text.slice(i, s.start) });
    const kind = job.matched.includes(s.skill) ? 'have' : job.missing.includes(s.skill) ? 'gap' : undefined;
    out.push({ t: text.slice(s.start, s.end), kind });
    i = s.end;
  }
  if (i < text.length) out.push({ t: text.slice(i) });
  return out;
}

function resumeFor(job, resumeId) {
  const resumes = loadResumes();
  return resumes.find((r) => r.id === (resumeId || job.resume_id)) || resumes[0];
}

// ---------- http plumbing ----------

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

function serveFile(res, file, download) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'not found' });
  const headers = { 'content-type': (MIME[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' };
  if (download) headers['content-disposition'] = `attachment; filename="${path.basename(file)}"`;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const routes = [
  ['GET', /^\/api\/jobs$/, (req, res, m, url) => send(res, 200, listJobs(url.searchParams.get('view') || 'feed'))],

  ['GET', /^\/api\/jobs\/([^/]+)$/, (req, res, [, id]) => {
    const job = db.getJob(decodeURIComponent(id));
    job ? send(res, 200, { ...job, segments: segments(job) }) : send(res, 404, { error: 'job not found' });
  }],

  ['POST', /^\/api\/jobs\/([^/]+)\/status$/, async (req, res, [, id]) => {
    const { status, resumeId, notes } = await readJson(req);
    if (!STATUSES.includes(status)) return send(res, 400, { error: `status must be one of ${STATUSES.join(', ')}` });
    const job = db.setStatus(decodeURIComponent(id), status, { resumeId, notes });
    job ? send(res, 200, summary(job)) : send(res, 404, { error: 'job not found' });
  }],

  ['POST', /^\/api\/jobs\/([^/]+)\/draft$/, async (req, res, [, id]) => {
    const job = db.getJob(decodeURIComponent(id));
    if (!job) return send(res, 404, { error: 'job not found' });
    const { resumeId } = await readJson(req);
    const resume = resumeFor(job, resumeId);
    const drafts = await draftOutreach({ job, resume, text: resumeText(resume), me: loadProfile().me });
    db.setDrafts(job.id, { ...drafts, resumeId: resume?.id, at: new Date().toISOString() });
    send(res, 200, db.getJob(job.id).drafts);
  }],

  ['POST', /^\/api\/jobs\/([^/]+)\/tailor$/, async (req, res, [, id]) => {
    const job = db.getJob(decodeURIComponent(id));
    if (!job) return send(res, 404, { error: 'job not found' });
    const { resumeId } = await readJson(req);
    const resume = resumeFor(job, resumeId);
    const advice = await tailorResume({ job, resume, text: resumeText(resume) });
    db.setDrafts(job.id, { ...job.drafts, tailoring: advice });
    send(res, 200, { advice });
  }],

  ['POST', /^\/api\/block-company$/, async (req, res) => {
    const { company } = await readJson(req);
    if (!company?.trim()) return send(res, 400, { error: 'company is required' });
    const profile = loadProfile();
    if (!isBlockedCompany(company, profile.blockedCompanies)) {
      profile.blockedCompanies = [...(profile.blockedCompanies || []), company.trim()];
      saveProfile(profile);
    }
    send(res, 200, { blockedCompanies: profile.blockedCompanies });
  }],

  ['POST', /^\/api\/fetch$/, (req, res) => send(res, 202, { started: startFetch() })],
  ['GET', /^\/api\/fetch$/, (req, res) => send(res, 200, fetchState)],

  ['GET', /^\/api\/stats$/, (req, res) => send(res, 200, stats())],

  ['GET', /^\/api\/profile$/, (req, res) => send(res, 200, loadProfile())],
  ['PUT', /^\/api\/profile$/, async (req, res) => {
    const profile = await readJson(req);
    if (!Array.isArray(profile.searches)) return send(res, 400, { error: 'profile.searches must be a list' });
    saveProfile(profile);
    schedule();
    send(res, 200, profile);
  }],

  ['GET', /^\/api\/resumes$/, (req, res) => send(res, 200, loadResumes().map(({ keywords, titleHints, ...r }) => ({ ...r, keywords, titleHints, hasText: Boolean(resumeText(r)) })))],
  ['POST', /^\/api\/rescore$/, (req, res) => send(res, 200, { rescored: rescoreAll(db, loadResumes()) })],

  ['GET', /^\/resumes\/([^/]+)$/, (req, res, [, id]) => {
    // Only files listed in resumes.json can be downloaded.
    const resume = loadResumes().find((r) => r.id === decodeURIComponent(id) && r.hasFile);
    resume ? serveFile(res, path.join(RESUME_DIR, resume.file), true) : send(res, 404, { error: 'resume file not found' });
  }],

  ['POST', /^\/api\/learn\/quiz$/, async (req, res) => {
    const { skill, level } = await readJson(req);
    if (!skill?.trim()) return send(res, 400, { error: 'skill is required' });
    const context = stats().demand.map((d) => d.skill).slice(0, 10).join(', ');
    send(res, 200, await makeQuiz({ skill: skill.trim(), level, context }));
  }],

  ['POST', /^\/api\/learn\/grade$/, async (req, res) => {
    const { skill, questions = [], answers = [] } = await readJson(req);
    const results = questions.map((q, i) =>
      q.type === 'mcq' ? { n: i, correct: Number(answers[i]) === q.answer, feedback: q.explanation } : null,
    );
    const short = questions.map((q, i) => ({ ...q, n: i, given: answers[i] })).filter((q) => q.type !== 'mcq');
    if (short.length) {
      const grades = await gradeShortAnswers({ skill, items: short });
      short.forEach((q, k) => {
        const g = grades.find((x) => x.n === k) || grades[k] || {};
        results[q.n] = { n: q.n, correct: Boolean(g.correct), feedback: g.feedback || q.explanation };
      });
    }
    const score = results.filter((r) => r?.correct).length;
    db.saveQuiz({ skill, score, total: questions.length, detail: { questions, answers, results } });
    send(res, 200, { score, total: questions.length, results });
  }],
  ['GET', /^\/api\/learn\/history$/, (req, res) => send(res, 200, db.quizHistory())],
];

const server = http.createServer(async (req, res) => {
  try {
    // Only answer requests addressed to this machine (blocks DNS-rebinding tricks from websites).
    const host = (req.headers.host || '').split(':')[0];
    if (!['127.0.0.1', 'localhost'].includes(host)) return send(res, 403, { error: 'forbidden host' });
    // Writes must be JSON: a browser can't send that cross-site without a preflight we never approve.
    if (req.method !== 'GET' && !(req.headers['content-type'] || '').startsWith('application/json')) {
      return send(res, 415, { error: 'send JSON' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    for (const [method, re, handler] of routes) {
      const m = url.pathname.match(re);
      if (m && req.method === method) return await handler(req, res, m, url);
    }
    if (req.method !== 'GET') return send(res, 404, { error: 'not found' });

    if (!fs.existsSync(path.join(PUBLIC, 'index.html'))) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('The UI is not built yet. Run `npm run build` (or `npm start`, which builds first).');
    }
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(PUBLIC + path.sep)) return send(res, 404, { error: 'not found' });
    serveFile(res, file);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err.message });
  }
});

// ---------- schedule ----------

let timer = null;
function schedule() {
  clearTimeout(timer);
  const hours = Number(loadProfile().fetchEveryHours) || 0;
  if (hours <= 0) return (fetchState.nextAt = null);
  const last = db.lastFetch()?.finished_at;
  const due = last ? new Date(last).getTime() + hours * 3600000 : Date.now() + 5000;
  const wait = Math.max(5000, due - Date.now());
  fetchState.nextAt = new Date(Date.now() + wait).toISOString();
  timer = setTimeout(() => {
    startFetch();
    setTimeout(schedule, 60000);
  }, wait);
}

server.listen(PORT, HOST, () => {
  console.log(`KamSearch is running at http://localhost:${PORT}`);
  schedule();
});
