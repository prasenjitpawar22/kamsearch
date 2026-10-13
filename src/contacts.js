// Finds who to reach out to. Emails come only from the job post itself; for everything else we
// build search links you open yourself, so nothing is scraped from LinkedIn profiles.
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IGNORE = /^(no-?reply|donotreply|privacy|support|abuse)@|@(example|sentry|email)\./i;

export function findContacts(job) {
  const emails = [...new Set((job.description.match(EMAIL) || []).map((e) => e.toLowerCase()))].filter(
    (e) => !IGNORE.test(e),
  );
  const company = job.company.trim();
  const people = (q) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
  const google = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

  return {
    emails,
    links: [
      { label: 'Recruiters on LinkedIn', url: people(`${company} recruiter`) },
      { label: 'Talent acquisition on LinkedIn', url: people(`${company} talent acquisition`) },
      {
        label: 'Hiring manager (Google)',
        url: google(`site:linkedin.com/in "${company}" ("engineering manager" OR "hiring") ${job.title}`),
      },
      { label: 'HR email pattern (Google)', url: google(`"${company}" HR email "@"`) },
    ],
  };
}
