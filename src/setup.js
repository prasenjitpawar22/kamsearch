// Copies the example config files into place without overwriting anything you already edited.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR, RESUME_DIR, DATA_DIR } from './config.js';

const pairs = [
  [path.join(CONFIG_DIR, 'profile.example.json'), path.join(CONFIG_DIR, 'profile.json')],
  [path.join(CONFIG_DIR, 'companies.example.json'), path.join(CONFIG_DIR, 'companies.json')],
  [path.join(RESUME_DIR, 'resumes.example.json'), path.join(RESUME_DIR, 'resumes.json')],
];

fs.mkdirSync(DATA_DIR, { recursive: true });
for (const [from, to] of pairs) {
  if (fs.existsSync(to)) {
    console.log(`keep    ${path.relative(process.cwd(), to)}`);
  } else {
    fs.copyFileSync(from, to);
    console.log(`created ${path.relative(process.cwd(), to)}`);
  }
}

// The bunker's "Day N" counter starts the day you set up.
const profileFile = pairs[0][1];
const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
if (!profile.me?.huntStartedOn) {
  profile.me = { ...profile.me, huntStartedOn: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(profileFile, JSON.stringify(profile, null, 2) + '\n');
}
console.log('\nNext: edit config/profile.json and resumes/resumes.json, add your resume files, then run `npm start`.');
