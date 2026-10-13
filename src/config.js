import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG_DIR = path.join(ROOT, 'config');
export const RESUME_DIR = path.join(ROOT, 'resumes');
export const DATA_DIR = path.join(ROOT, 'data');

const PROFILE = path.join(CONFIG_DIR, 'profile.json');
const COMPANIES = path.join(CONFIG_DIR, 'companies.json');
const RESUMES = path.join(RESUME_DIR, 'resumes.json');

// Personal files are git-ignored; fall back to the committed example so a fresh clone still runs.
function readJson(file) {
  const target = fs.existsSync(file) ? file : file.replace(/\.json$/, '.example.json');
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

export function loadProfile() {
  return readJson(PROFILE);
}

export function saveProfile(profile) {
  fs.writeFileSync(PROFILE, JSON.stringify(profile, null, 2) + '\n');
}

export function loadCompanies() {
  const { greenhouse = [], lever = [], ashby = [] } = readJson(COMPANIES);
  return { greenhouse, lever, ashby };
}

export function loadResumes() {
  return readJson(RESUMES).map((r) => ({
    titleHints: [],
    keywords: [],
    ...r,
    hasFile: Boolean(r.file) && fs.existsSync(path.join(RESUME_DIR, r.file)),
  }));
}

export function resumeText(resume) {
  if (!resume?.textFile) return '';
  const file = path.join(RESUME_DIR, resume.textFile);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
