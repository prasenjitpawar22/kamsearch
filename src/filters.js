const LEGAL_SUFFIXES =
  /\b(private|pvt|limited|ltd|llp|inc|incorporated|corp|corporation|co|company|technologies|technology|solutions|services|india|group)\b/g;

export function normalizeCompany(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Same role at the same company posted on LinkedIn and Naukri should only show up once.
export function dedupeKey(job) {
  const title = job.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${normalizeCompany(job.company)}|${title}`;
}

const hasWord = (text, word) =>
  new RegExp(`(^|[^a-z0-9])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(
    text.toLowerCase(),
  );

export function isBlockedCompany(company, blocked = []) {
  const norm = normalizeCompany(company);
  if (!norm) return false;
  return blocked.some((b) => {
    const nb = normalizeCompany(b);
    return nb && hasWord(norm, nb);
  });
}

// Returns null when the job passes, otherwise a short reason (used for the fetch summary).
export function rejectReason(job, profile) {
  if (!job.title || !job.url) return 'incomplete';
  if (isBlockedCompany(job.company, profile.blockedCompanies)) return 'blocked company';
  if ((profile.excludeTitleWords || []).some((w) => hasWord(job.title, w))) return 'excluded title';
  const required = profile.requireTitleWords || [];
  if (required.length && !required.some((w) => hasWord(job.title, w))) return 'title not wanted';

  if (job.postedAt && profile.maxAgeDays) {
    const ageDays = (Date.now() - new Date(job.postedAt).getTime()) / 86400000;
    if (ageDays > profile.maxAgeDays + 1) return 'too old';
  }

  // Search-based sources already filter by location; career boards list jobs worldwide.
  if (['greenhouse', 'lever', 'ashby'].includes(job.source)) {
    const loc = job.location || '';
    const include = profile.locationInclude || [];
    const exclude = profile.locationExclude || [];
    if (exclude.some((w) => hasWord(loc, w)) && !hasWord(loc, 'india')) return 'location';
    if (include.length && !include.some((w) => hasWord(loc, w)) && !job.remote) return 'location';
  }
  return null;
}
