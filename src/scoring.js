import { extractSkills, canonicalSkill } from './skills.js';
import { resumeText } from './config.js';

// Resolve each resume's skill set once: its listed keywords plus anything found in its text copy.
export function prepareResumes(resumes, readText = resumeText) {
  return resumes.map((r) => ({
    ...r,
    skills: new Set([...r.keywords.map(canonicalSkill), ...extractSkills(readText(r))]),
    hints: r.titleHints.map((h) => h.toLowerCase()),
  }));
}

// Score = how much of what the job asks for this resume covers (65%) + whether the job title is
// the kind of role this resume targets (35%). The best-scoring resume is the one to send.
export function scoreJob(job, prepared) {
  const jobSkills = extractSkills(`${job.title}\n${job.description}`);
  const title = job.title.toLowerCase();
  let best = null;

  for (const r of prepared) {
    const matched = jobSkills.filter((s) => r.skills.has(s));
    const coverage = jobSkills.length ? matched.length / jobSkills.length : 0.5;
    const titleFit = r.hints.some((h) => title.includes(h)) ? 1 : 0;
    const score = Math.round(100 * (0.65 * coverage + 0.35 * titleFit));
    if (!best || score > best.score) {
      best = { score, resumeId: r.id, matched, missing: jobSkills.filter((s) => !r.skills.has(s)) };
    }
  }
  return best ?? { score: 0, resumeId: null, matched: [], missing: jobSkills };
}
