// Offline tests: no network calls. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractSkills, canonicalSkill, skillSpans } from '../src/skills.js';
import { isBlockedCompany, rejectReason, dedupeKey } from '../src/filters.js';
import { prepareResumes, scoreJob } from '../src/scoring.js';
import { findContacts } from '../src/contacts.js';
import { htmlToText } from '../src/http.js';
import { parseSearchResults, parseDescription } from '../src/sources/linkedin.js';
import { normalizeNaukri } from '../src/sources/naukri.js';
import { normalizeGreenhouse, normalizeLever, normalizeAshby } from '../src/sources/boards.js';
import { openDb } from '../src/db.js';
import { runFetch } from '../src/fetch.js';

const fixture = (f) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', f), 'utf8');

const profile = {
  blockedCompanies: ['globex'],
  excludeTitleWords: ['intern', 'director'],
  requireTitleWords: [],
  locationInclude: ['pune', 'india', 'remote'],
  locationExclude: ['united states', 'usa', 'europe'],
  maxAgeDays: 3,
};
const job = (over = {}) => ({
  source: 'linkedin', externalId: '1', title: 'Frontend Developer', company: 'Acme', location: 'Pune',
  url: 'https://x', description: '', postedAt: new Date().toISOString(), ...over,
});

const resumes = [
  { id: 'swe', title: 'SWE', keywords: ['java', 'node.js', 'sql', 'aws', 'microservices'], titleHints: ['software engineer', 'backend'] },
  { id: 'frontend', title: 'Frontend', keywords: ['react', 'typescript', 'javascript', 'css', 'redux'], titleHints: ['frontend', 'front end'] },
];

test('skills: word boundaries and aliases', () => {
  assert.deepEqual(extractSkills('We use JavaScript and ReactJS'), ['javascript', 'react']);
  assert.ok(!extractSkills('JavaScript only').includes('java'));
  assert.ok(extractSkills('Java 17, Spring Boot').includes('java'));
  assert.ok(extractSkills('Strong C++ and C# skills').includes('c++'));
  assert.ok(extractSkills('Strong C++ and C# skills').includes('c#'));
  assert.ok(extractSkills('Node.js backend').includes('node.js'));
  assert.ok(!extractSkills('the rest of the team, less is more').includes('rest api'));
  assert.equal(canonicalSkill('ReactJS'), 'react');
});

test('skillSpans: positions for highlighting, longest match wins, no overlaps', () => {
  const text = 'React Native and ReactJS with Node.js';
  const spans = skillSpans(text);
  assert.deepEqual(spans.map((s) => [text.slice(s.start, s.end), s.skill]), [
    ['React Native', 'react native'],
    ['ReactJS', 'react'],
    ['Node.js', 'node.js'],
  ]);
});

test('filters: blocked companies match variants, not substrings of words', () => {
  assert.ok(isBlockedCompany('Globex Technology Services India Limited', ['globex']));
  assert.ok(isBlockedCompany('GLOBEX ENGINEERING', ['Globex']));
  assert.ok(!isBlockedCompany('Acme', ['globex']));
  assert.equal(rejectReason(job({ company: 'Globex' }), profile), 'blocked company');
});

test('filters: titles, age and career-board locations', () => {
  assert.equal(rejectReason(job(), profile), null);
  assert.equal(rejectReason(job({ title: 'Frontend Intern' }), profile), 'excluded title');
  assert.equal(rejectReason(job({ title: 'Internal Tools Engineer' }), profile), null);
  assert.equal(rejectReason(job({ postedAt: new Date(Date.now() - 10 * 86400000).toISOString() }), profile), 'too old');
  assert.equal(rejectReason(job({ source: 'greenhouse', location: 'San Francisco, United States' }), profile), 'location');
  assert.equal(rejectReason(job({ source: 'greenhouse', location: 'Bengaluru, India' }), profile), null);
  assert.equal(rejectReason(job({ source: 'lever', location: 'Berlin', remote: true }), profile), null);
  assert.equal(rejectReason(job({ source: 'lever', location: 'Remote - USA', remote: true }), profile), 'location');
});

test('dedupe: same role across sources collapses', () => {
  assert.equal(dedupeKey(job({ company: 'Acme Pvt Ltd' })), dedupeKey(job({ company: 'ACME', source: 'naukri' })));
});

test('scoring: picks the resume that fits the job', () => {
  const prepared = prepareResumes(resumes, () => '');
  const fe = scoreJob(job({ description: 'React, TypeScript, Redux, CSS, Jest' }), prepared);
  assert.equal(fe.resumeId, 'frontend');
  assert.deepEqual(fe.missing, ['jest']);
  assert.ok(fe.score >= 80);

  const be = scoreJob(job({ title: 'Software Engineer - Backend', description: 'Java, microservices, SQL, AWS, Kafka' }), prepared);
  assert.equal(be.resumeId, 'swe');
  assert.deepEqual(be.missing, ['kafka']);
});

test('contacts: emails from the post, minus no-reply', () => {
  const c = findContacts(job({ description: 'Send CV to Hiring@Acme.in or noreply@acme.in' }));
  assert.deepEqual(c.emails, ['hiring@acme.in']);
  assert.ok(c.links.every((l) => l.url.startsWith('https://')));
});

test('htmlToText handles escaped HTML', () => {
  assert.equal(htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;/ul&gt;'), 'Hello & welcome\n\n• React');
});

test('linkedin: parses both card layouts and the description', () => {
  const jobs = parseSearchResults(fixture('linkedin-search.html'));
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    jobs.map(({ externalId, title, company, location }) => ({ externalId, title, company, location })),
    [
      { externalId: '4000000001', title: 'Sr Angular Developer', company: 'Docbrains', location: 'Pune, Maharashtra, India' },
      { externalId: '4000000002', title: 'React & Next.js Engineer', company: 'Acme Labs', location: 'India (Remote)' },
    ],
  );
  assert.equal(jobs[0].url, 'https://in.linkedin.com/jobs/view/sr-angular-developer-4000000001');
  assert.ok(jobs[1].remote);
  assert.match(parseDescription(fixture('linkedin-detail.html')), /Build UI with React\n• 3\+ years/);
});

test('naukri / greenhouse / lever / ashby normalizers', () => {
  const [n] = normalizeNaukri(JSON.parse(fixture('naukri.json')));
  assert.equal(n.company, 'Acme Software');
  assert.equal(n.location, 'Pune');
  assert.equal(n.url, 'https://www.naukri.com/job-listings-frontend-developer-acme-pune-3-to-5-years-111');
  assert.match(n.description, /Skills: react,typescript/);
  assert.equal(n.extra.experience, '3-5 Yrs');

  const [g] = normalizeGreenhouse(
    { jobs: [{ id: 9, title: 'SDE 2', absolute_url: 'https://g/9', location: { name: 'Pune, India' }, content: '&lt;p&gt;Node.js&lt;/p&gt;', updated_at: '2026-10-12T00:00:00Z' }] },
    { slug: 'acme', name: 'Acme' },
  );
  assert.equal(g.externalId, 'acme:9');
  assert.equal(g.description, 'Node.js');

  const [l] = normalizeLever(
    [{ id: 'a', text: 'Frontend Eng', hostedUrl: 'https://l/a', applyUrl: 'https://l/a/apply', categories: { location: 'Remote, India' }, workplaceType: 'remote', descriptionPlain: 'React', createdAt: 1760000000000 }],
    { slug: 'acme', name: 'Acme' },
  );
  assert.equal(l.remote, true);
  assert.equal(l.applyUrl, 'https://l/a/apply');

  const ashby = normalizeAshby(
    { jobs: [
      { id: 'b', title: 'SWE', location: 'Pune', isRemote: false, jobUrl: 'https://a/b', descriptionPlain: 'Go', publishedAt: '2026-10-12' },
      { id: 'c', title: 'Hidden', location: 'Pune', isListed: false, jobUrl: 'https://a/c' },
    ] },
    { slug: 'acme', name: 'Acme' },
  );
  assert.equal(ashby.length, 1);
});

test('db: insert, status flow, applied date kept', () => {
  const db = openDb(':memory:');
  db.insertJob({ ...job(), id: 'linkedin:1', dedupeKey: 'k', score: 50, resumeId: 'frontend', matched: ['react'], missing: [], contacts: { emails: [] } });
  assert.ok(db.hasJob('linkedin:1'));
  assert.ok(db.hasDedupe('k'));
  const applied = db.setStatus('linkedin:1', 'applied', { resumeId: 'swe' });
  assert.equal(applied.resume_id, 'swe');
  assert.ok(applied.applied_at);
  const interview = db.setStatus('linkedin:1', 'interview', { notes: 'Round 1 on Monday' });
  assert.equal(interview.applied_at, applied.applied_at);
  assert.equal(interview.notes, 'Round 1 on Monday');
  assert.deepEqual(interview.matched, ['react']);
});

test('fetch pipeline with all sources disabled stores nothing and records the run', async () => {
  const db = openDb(':memory:');
  const summary = await runFetch({
    db,
    profile: { ...profile, searches: [], sources: { linkedin: false, naukri: false, greenhouse: false, lever: false, ashby: false } },
    companies: { greenhouse: [], lever: [], ashby: [] },
    resumes,
    log: () => {},
  });
  assert.equal(summary.added, 0);
  assert.equal(db.lastFetch().summary.added, 0);
});
