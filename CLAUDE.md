# KamSearch: project notes for Claude

A personal job-search "war room" for a software engineer and frontend developer looking for roles in Pune, remote India, and later other locations. One local web app fetches jobs, filters them, picks the right resume, drafts outreach, tracks applications and runs practice quizzes.

Repo: https://github.com/prasenjitpawar22/kamsearch

## Hard rules

- **Never send requests to job sites from a work machine or work network.** Many company proxies block and log them. Unless the user confirms you are on their personal machine, do not run `npm run fetch` or "Run sweep", and do not curl LinkedIn, Naukri, Indeed, Lever, Ashby or Greenhouse. Test with fixtures and seeded data only. Check `CLAUDE.local.md` (git-ignored) for machine-specific rules.
- **Approve before apply.** The user chose this. Never auto-submit applications. "Apply" opens the posting; the user submits and then confirms.
- **No LinkedIn login or scraping of profiles.** Only the public logged-out job search is used. Contact finding means emails found in the job post plus search links the user opens themselves.
- **Never invent experience in AI output.** Prompts in `src/ai.js` limit claims to what appears in the resume text. Keep it that way.
- **Personal data stays out of git.** `config/profile.json`, `config/companies.json`, `resumes/*` and `data/` are git-ignored. Only `*.example.json` files are committed.
- **The backend (`src/`) has zero npm dependencies**: it uses Node built-ins only. The frontend uses React, Vite and TypeScript, which the user approved on 2026-10-13. Ask before adding other packages.

## Stack

- Node.js ≥ 22.13 (developed on 24), ES modules.
- Backend: `node:http` server bound to `127.0.0.1`. The default port is 4321; override it with `PORT`.
- DB: `node:sqlite` (`DatabaseSync`) at `data/kamsearch.db`.
- Frontend: React 19 + TypeScript 7 + Vite 8 in `web/`, built to `web/dist/` (git-ignored), which the server serves. Plain CSS with design tokens in `web/src/styles.css`; no UI library. Job text is rendered as React text, never with `dangerouslySetInnerHTML`.
- AI: Claude Code CLI run as `claude -p --tools "" --strict-mcp-config`, with the prompt sent over stdin, so no API key is needed. Env vars: `KAMSEARCH_MODEL`, `CLAUDE_CMD`.
- Tests: `node --test` with offline fixtures in `test/fixtures/`.

## Design direction (chosen 2026-10-13)

The user is a designer and wants the app to feel like a **bunker**: a place they go to stay locked in on the job hunt. The concepts live on a design canvas: https://claude.ai/artifact/SanEtZFobTWdoHzarAHxwK. The user approved **board 05, "Bunker v2"**. Build the real UI to match it:

- **Palette:** ground `#14150f`, panel `#1c1d15`, raised `#24261c`, lines `#34362a`/`#4a4c3a`, text `#e8e3cf`, body text `#d6d1bc`, muted `#a29e88`, amber accent `#ffb21a`, have-skill green `#b8e07a` (border `#5d7a37`), danger `#ff9a7e`.
- **Type:** Big Shoulders Stencil Display for headings only; JetBrains Mono for labels, scores, tags and kbd hints; IBM Plex Sans for anything read at length (summaries, postings, drafts) at 16px, line-height about 1.65, max 68ch.
- **Comfort over long sessions:** the grid texture goes only behind the header and side rail; reading surfaces are plain. No scanlines or glow. (The Terminal concept was rejected as too tiring.)
- **Vocabulary:** Targets (feed), Stash (saved), Operations (tracker), Training (learn), Config. Dossier tabs are Brief, Posting and Comms. "Today's Orders" in the side rail.
- **Keyboard first:** Ctrl+K command bar; A apply, S stash, X skip, B block, J/K move, 1–5 switch desks, F focus mode.
- **Focus mode:** one big job card with Skip, Stash or Apply, plus a progress bar for working through new jobs.
- **Posting view:** highlights the user's skills (green underline) and gaps (amber dashed) inside the description text.
- **Motion:** follow the user's global Emil Kowalski design-engineering rules, e.g. press feedback `scale(0.97)`, ease-out about 150–250ms, no animation on keyboard actions.

## Commands

```bash
npm install        # UI tooling (React, Vite, TypeScript)
npm run setup      # copy *.example.json to the real (git-ignored) config files; sets me.huntStartedOn
npm start          # vite build, then the server at http://localhost:4321
npm run dev        # API server + Vite dev server with hot reload at http://localhost:5173 (proxies /api, /resumes)
npm run fetch      # one sweep from the CLI (personal machine only)
npm test           # offline backend tests, no network
npm run typecheck  # tsc -p web --noEmit
```

## Layout

```
src/server.js          API routes + static files + auto-fetch scheduler
src/fetch.js           runFetch: sources → NFKC normalize → filter → dedupe → fetch description → score → contacts → insert; rescoreAll
src/sources/linkedin.js  guest search HTML parser (+ jobPosting detail for description)
src/sources/naukri.js    naukri.com/jobapi/v3/search (appid 109 headers)
src/sources/boards.js    Greenhouse / Lever / Ashby public JSON APIs
src/filters.js         blocked companies (normalized, word-boundary), title include/exclude, age, board locations, dedupeKey
src/skills.js          skill dictionary + aliases; extractSkills, canonicalSkill, skillSpans (highlight positions)
src/scoring.js         score = 65% skill coverage + 35% title-hint match; best resume wins
src/contacts.js        emails from description + LinkedIn/Google search links
src/ai.js              draftOutreach, tailorResume, makeQuiz, gradeShortAnswers
src/db.js              schema (jobs, fetch_runs, quiz_results) + queries
src/config.js          load/save profile, companies, resumes (falls back to *.example.json)
src/dev.js             runs server + vite together for `npm run dev`
web/src/App.tsx        desks, data loading, apply/confirm, stash/skip/block with Undo toasts, hotkeys, sweep polling
web/src/components/    TopBar, Rail (desks + Today's Orders), TargetList, Dossier (Brief/Posting/Comms), FocusMode,
                       CommandPalette (Ctrl+K), Training, Config, Overlays (Toast, FetchLog)
web/src/hooks.ts       useHotkeys (single keys ignored while typing in fields)
web/src/api.ts, types.ts  typed API client and shared types
```

Server safety: it only accepts Host `localhost`/`127.0.0.1`, non-GET requests must be `application/json`, and static paths can't escape `web/dist/`. Resume downloads are limited to the files listed in `resumes.json`.

API additions for the UI: `GET /api/jobs/:id` includes `segments` (description split into text and have/gap skill mentions); `GET /api/stats` includes `dayOfHunt`, `dailyGoal`, `appliedToday`, `drill`, `blockedCount`.

Job statuses: `new, saved, applied, interview, offer, rejected, skipped`. Each source returns normalized jobs shaped as `{source, externalId, title, company, location, remote, url, applyUrl, description, postedAt, extra?, loadDescription?}`.

## Status (as of 2026-10-13)

**Done**
- Job feed covering LinkedIn, Naukri, Greenhouse, Lever and Ashby, with cross-source dedupe, a 0–100 fit score, a live fetch log, and auto-fetch every N hours (off by default).
- Filters: blocked companies (set in Config, plus a one-click "Never show X"), title words, job age, location.
- Resume desk: best resume picked per job (Software Engineer vs Frontend), matched and missing skill chips, resume download.
- Outreach via AI: cover note, LinkedIn note, cold email and follow-up; resume-tailoring advice; mailto links pre-filled with the email draft.
- Tracker: apply → confirm → applied with the resume recorded; then interview / offer / rejected; notes; follow-up flag after 7 days.
- Learn: skill gaps and demand from the feed, AI quizzes (5 MCQ + 2 short answer, graded), score history.
- Settings UI for every profile option.
- **Bunker v2 UI built in React** (2026-10-13), covering every desk, the command bar, Focus mode, keyboard shortcuts, posting highlights, Undo toasts and Today's Orders.
- Verified: 12 offline tests pass, plus a clean typecheck and build. The React UI was clicked through on seeded data (feed, posting highlights, J/F/X keys, Ctrl+K, Training, Config). Earlier: The LinkedIn parser handled a real saved page (10/10 jobs). The UI was clicked through on seeded data, and one real `draftOutreach` call succeeded.

**Not verified yet (needs the personal laptop)**
- Live fetches from LinkedIn (including description fetches), Naukri (may hit a captcha; the `wfhType=2` remote parameter is a guess), Lever and Ashby.
- Company slugs in `companies.example.json`: only `razorpaysoftwareprivatelimited` (Greenhouse) is confirmed.
- `tailorResume`, `makeQuiz` and `gradeShortAnswers` have not been called for real.

**Not built yet**
- Indeed source (it blocks bots heavily).
- Pre-filling Greenhouse/Lever application forms, with the user still clicking submit.
- Hunter.io email lookup by company domain.
- Generating a tailored resume file per job (today it only gives advice).
- Spaced repetition: automatically re-quiz weak skills.
- Search locations beyond Pune and remote India.

**User setup still to do**: clone on the personal laptop, run `npm run setup`, add the 2 resumes plus `.txt` copies, edit `resumes.json`, fill in "Operator" in Config, and turn on auto-sweep.
