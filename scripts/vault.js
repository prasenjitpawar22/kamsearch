#!/usr/bin/env node
// vault.js: sync a project's private files (databases, configs, resumes…) with a private git "vault"
// repo shared by all your projects. Copy this file into any project; it has no dependencies.
//
//   node scripts/vault.js pull     vault → this project (current files are backed up first)
//   node scripts/vault.js push     this project → vault, then commit and push
//   node scripts/vault.js status   what differs between this project and the vault
//
// Each project describes itself in vault.json at its root:
//   { "repo": "https://github.com/you/vault.git", "name": "my-project", "paths": ["data/app.db", "config/"] }
// Files live in the vault under <name>/<path>. The vault is cloned once into ~/.vault (override with VAULT_DIR).
// A file named .novault in the project root blocks pull and push on that machine (e.g. a work laptop).

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const manifestFile = path.join(root, 'vault.json');
const fail = (msg) => {
  console.error(`vault: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(manifestFile)) fail('no vault.json in this folder.');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const repo = process.env.VAULT_REPO || manifest.repo;
const name = manifest.name;
const paths = manifest.paths || [];
if (!repo || !name || !paths.length) fail('vault.json needs "repo", "name" and "paths".');
if (!/^[\w.-]+$/.test(name)) fail('"name" may only contain letters, digits, dot, dash and underscore.');
for (const p of paths) {
  if (path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) fail(`path "${p}" must stay inside the project.`);
}

const vaultDir = process.env.VAULT_DIR || path.join(os.homedir(), '.vault');
const projectDir = path.join(vaultDir, name);
const git = (...args) => execFileSync('git', ['-C', vaultDir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return '';
  }
};

function syncVault() {
  if (!fs.existsSync(path.join(vaultDir, '.git'))) {
    console.log(`vault: cloning ${repo} into ${vaultDir}`);
    execFileSync('git', ['clone', '--quiet', repo, vaultDir], { stdio: ['ignore', 'inherit', 'pipe'] });
  } else if (git('ls-remote', '--heads', 'origin')) {
    git('pull', '--ff-only', '--quiet');
  }
  // Copy files byte for byte: no line-ending conversion of databases or configs.
  git('config', 'core.autocrlf', 'false');
}

// Every file under a path (a file path gives itself), relative to base.
function listFiles(base, rel) {
  const abs = path.join(base, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).flatMap((entry) => listFiles(base, path.join(rel, entry)));
}

const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

function copyPath(fromBase, toBase, rel) {
  const from = path.join(fromBase, rel);
  const to = path.join(toBase, rel);
  fs.rmSync(to, { recursive: true, force: true }); // mirror, so deleted files are deleted on the other side too
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return true;
}

function diff() {
  const rows = [];
  for (const p of paths) {
    const files = new Set([...listFiles(root, p), ...listFiles(projectDir, p)]);
    for (const f of [...files].sort()) {
      const here = path.join(root, f);
      const there = path.join(projectDir, f);
      const state = !fs.existsSync(there) ? 'only here' : !fs.existsSync(here) ? 'only in vault' : hash(here) === hash(there) ? 'same' : 'changed';
      rows.push({ file: f.split(path.sep).join('/'), state });
    }
  }
  return rows;
}

const command = process.argv[2];
if (!['pull', 'push', 'status'].includes(command)) fail('usage: node scripts/vault.js pull|push|status');
if (command !== 'status' && fs.existsSync(path.join(root, '.novault'))) {
  fail('.novault exists here: this machine is not allowed to sync with the vault.');
}

process.on('uncaughtException', (err) => fail(err.stderr?.toString().trim() || err.message));
syncVault();

if (command === 'status') {
  const rows = diff();
  if (!rows.length) console.log('vault: nothing to sync yet.');
  for (const r of rows) console.log(`${r.state.padEnd(14)} ${r.file}`);
  const last = tryGit('log', '-1', '--format=%cr from %s', '--', name);
  if (last) console.log(`\nlast vault change for ${name}: ${last}`);
}

if (command === 'pull') {
  if (!fs.existsSync(projectDir)) fail(`the vault has nothing for "${name}" yet. Run push on the machine that has your data.`);
  const changed = diff().filter((r) => r.state !== 'same' && r.state !== 'only here');
  if (!changed.length) {
    console.log('vault: already up to date.');
    process.exit(0);
  }
  const backup = path.join(root, '.vault-backup', new Date().toISOString().replace(/[:.]/g, '-'));
  for (const p of paths) {
    if (!fs.existsSync(path.join(projectDir, p))) continue; // never delete local files the vault doesn't have
    if (fs.existsSync(path.join(root, p))) copyPath(root, backup, p);
    copyPath(projectDir, root, p);
  }
  for (const r of changed) console.log(`pulled  ${r.file}`);
  if (fs.existsSync(backup)) console.log(`\nprevious local files saved in ${path.relative(root, backup)}`);
}

if (command === 'push') {
  for (const p of paths) {
    if (!copyPath(root, projectDir, p)) console.log(`skip    ${p} (not found here)`);
  }
  if (!fs.existsSync(projectDir)) fail('none of the paths in vault.json exist here, so there is nothing to push.');
  const attributes = path.join(vaultDir, '.gitattributes');
  if (!fs.existsSync(attributes)) fs.writeFileSync(attributes, '* -text\n');
  git('add', '-A', '--', name, '.gitattributes');
  if (!git('status', '--porcelain', '--', name)) {
    console.log('vault: nothing changed.');
    process.exit(0);
  }
  for (const line of git('status', '--porcelain', '--', name).split('\n')) console.log(`pushed  ${line.slice(3)}`);
  git('commit', '--quiet', '-m', `${name}: push from ${os.hostname()}`);
  execFileSync('git', ['-C', vaultDir, 'push', '--quiet', 'origin', 'HEAD'], { stdio: 'inherit' });
  console.log('vault: saved.');
}
