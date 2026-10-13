// LinkedIn's public (logged-out) job search. No login is used, so your account is never at risk.
import { request, politePause, decodeEntities, htmlToText } from '../http.js';

const SEARCH = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const DETAIL = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/';
const PAGE_SIZE = 25;

const clean = (s) => decodeEntities((s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const pick = (html, re) => html.match(re)?.[1];

export function parseSearchResults(html) {
  const jobs = [];
  for (const card of html.split(/<li>/).slice(1)) {
    const id = pick(card, /urn:li:jobPosting:(\d+)/);
    if (!id) continue;
    const title = clean(pick(card, /base-search-card__title[^>]*>([\s\S]*?)<\/h3>/));
    const company = clean(pick(card, /base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/));
    const location = clean(pick(card, /job-search-card__location[^>]*>([\s\S]*?)<\/span>/));
    const postedAt = pick(card, /<time[^>]*datetime="([^"]+)"/);
    const href = pick(card, /href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^"?]+)/);
    jobs.push({
      source: 'linkedin',
      externalId: id,
      title,
      company,
      location,
      remote: /remote/i.test(location),
      url: href ? decodeEntities(href) : `https://www.linkedin.com/jobs/view/${id}`,
      applyUrl: null,
      description: '',
      postedAt: postedAt ? new Date(postedAt).toISOString() : null,
      loadDescription: () => fetchDescription(id),
    });
  }
  return jobs;
}

export function parseDescription(html) {
  const body = pick(html, /show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
  return body ? htmlToText(body) : '';
}

async function fetchDescription(id) {
  return parseDescription(await request(DETAIL + id));
}

export async function fetchLinkedIn(profile, log) {
  const out = [];
  const seconds = Math.max(1, profile.maxAgeDays ?? 3) * 86400;
  for (const s of profile.searches) {
    for (let page = 0; page < (profile.pagesPerSearch ?? 2); page++) {
      const params = new URLSearchParams({
        keywords: s.keywords,
        location: s.location || 'India',
        f_TPR: `r${seconds}`,
        start: String(page * PAGE_SIZE),
      });
      if (s.remote) params.set('f_WT', '2');
      const jobs = parseSearchResults(await request(`${SEARCH}?${params}`));
      log(`linkedin: "${s.keywords}" @ ${s.location}${s.remote ? ' (remote)' : ''} page ${page + 1}: ${jobs.length}`);
      out.push(...jobs);
      await politePause();
      if (jobs.length < 10) break;
    }
  }
  return out;
}
