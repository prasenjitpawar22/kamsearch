// Company career boards (Greenhouse, Lever, Ashby). These are official public JSON APIs that the
// companies themselves publish, so they are the most reliable and allowed source of all.
import { request, politePause, htmlToText } from '../http.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);

export function normalizeGreenhouse(data, company) {
  return (data.jobs || []).map((j) => ({
    source: 'greenhouse',
    externalId: `${company.slug}:${j.id}`,
    title: j.title || '',
    company: j.company_name || company.name || company.slug,
    location: j.location?.name || '',
    remote: /remote/i.test(j.location?.name || ''),
    url: j.absolute_url,
    applyUrl: j.absolute_url,
    description: htmlToText(j.content || ''),
    postedAt: iso(j.first_published || j.updated_at),
  }));
}

export function normalizeLever(data, company) {
  return (Array.isArray(data) ? data : []).map((j) => {
    const location = [j.categories?.location, ...(j.categories?.allLocations || [])].filter(Boolean);
    return {
      source: 'lever',
      externalId: `${company.slug}:${j.id}`,
      title: j.text || '',
      company: company.name || company.slug,
      location: [...new Set(location)].join(' / '),
      remote: j.workplaceType === 'remote' || /remote/i.test(location.join(' ')),
      url: j.hostedUrl,
      applyUrl: j.applyUrl || j.hostedUrl,
      description: [j.descriptionPlain, ...(j.lists || []).map((l) => `${l.text}\n${htmlToText(l.content)}`), j.additionalPlain]
        .filter(Boolean)
        .join('\n\n'),
      postedAt: iso(j.createdAt),
    };
  });
}

export function normalizeAshby(data, company) {
  return (data.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const location = [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean);
      return {
        source: 'ashby',
        externalId: `${company.slug}:${j.id}`,
        title: j.title || '',
        company: company.name || company.slug,
        location: location.join(' / '),
        remote: Boolean(j.isRemote) || j.workplaceType === 'Remote',
        url: j.jobUrl,
        applyUrl: j.applyUrl || j.jobUrl,
        description: j.descriptionPlain || htmlToText(j.descriptionHtml || ''),
        postedAt: iso(j.publishedAt),
      };
    });
}

const BOARDS = {
  greenhouse: {
    url: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
    normalize: normalizeGreenhouse,
  },
  lever: {
    url: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
    normalize: normalizeLever,
  },
  ashby: {
    url: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
    normalize: normalizeAshby,
  },
};

export async function fetchBoards(kind, companies, log) {
  const board = BOARDS[kind];
  const out = [];
  for (const company of companies) {
    try {
      const jobs = board.normalize(await request(board.url(encodeURIComponent(company.slug)), { as: 'json' }), company);
      log(`${kind}: ${company.name || company.slug}: ${jobs.length}`);
      out.push(...jobs);
    } catch (err) {
      log(`${kind}: ${company.name || company.slug}: failed (${err.message})`);
    }
    await politePause(500, 1200);
  }
  return out;
}
