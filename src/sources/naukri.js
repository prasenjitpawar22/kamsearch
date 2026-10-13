// Naukri's search API, the same one naukri.com's own search page calls. It can start asking for a
// captcha if hit too often; if it fails, the other sources still run.
import { request, politePause, htmlToText } from '../http.js';

const API = 'https://www.naukri.com/jobapi/v3/search';
const HEADERS = {
  accept: 'application/json',
  appid: '109',
  systemid: 'Naukri',
  clientid: 'd3skt0p',
  gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
  'content-type': 'application/json',
};

const placeholder = (job, type) => job.placeholders?.find((p) => p.type === type)?.label || '';

export function normalizeNaukri(data) {
  return (data.jobDetails || []).map((j) => {
    const location = placeholder(j, 'location');
    const url = j.jdURL ? new URL(j.jdURL, 'https://www.naukri.com').href : `https://www.naukri.com/job-listings-${j.jobId}`;
    return {
      source: 'naukri',
      externalId: String(j.jobId),
      title: j.title?.trim() || '',
      company: j.companyName?.trim() || '',
      location,
      remote: /remote|work from home/i.test(location),
      url,
      applyUrl: null,
      description: [htmlToText(j.jobDescription || ''), j.tagsAndSkills ? `Skills: ${j.tagsAndSkills}` : '']
        .filter(Boolean)
        .join('\n\n'),
      postedAt: j.createdDate ? new Date(Number(j.createdDate)).toISOString() : null,
      extra: { experience: placeholder(j, 'experience'), salary: placeholder(j, 'salary') },
    };
  });
}

export async function fetchNaukri(profile, log) {
  const out = [];
  for (const s of profile.searches) {
    // Naukri wants a city, not "Pune, Maharashtra, India".
    const city = (s.location || '').split(',')[0].trim();
    for (let page = 1; page <= (profile.pagesPerSearch ?? 2); page++) {
      const params = new URLSearchParams({
        noOfResults: '20',
        urlType: 'search_by_keyword',
        searchType: 'adv',
        keyword: s.keywords,
        k: s.keywords,
        pageNo: String(page),
        seoKey: `${s.keywords.toLowerCase().replace(/\s+/g, '-')}-jobs`,
        src: 'jobsearchDesk',
        jobAge: String(profile.maxAgeDays ?? 3),
      });
      if (city && city.toLowerCase() !== 'india') params.set('location', city);
      if (s.remote) params.set('wfhType', '2');
      const jobs = normalizeNaukri(await request(`${API}?${params}`, { headers: HEADERS, as: 'json' }));
      log(`naukri: "${s.keywords}" @ ${city || 'India'}${s.remote ? ' (remote)' : ''} page ${page}: ${jobs.length}`);
      out.push(...jobs);
      await politePause();
      if (jobs.length < 20) break;
    }
  }
  return out;
}
