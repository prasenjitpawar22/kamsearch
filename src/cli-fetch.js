import { openDb } from './db.js';
import { loadProfile, loadCompanies, loadResumes } from './config.js';
import { runFetch } from './fetch.js';

const db = openDb();
await runFetch({ db, profile: loadProfile(), companies: loadCompanies(), resumes: loadResumes() });
