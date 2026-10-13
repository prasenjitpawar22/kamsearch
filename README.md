# KamSearch

A personal job-search bunker that runs on your own machine: dark, keyboard-first, built for long focused sessions.

- **Job feed**: pulls fresh jobs from LinkedIn, Naukri and company career boards (Greenhouse, Lever, Ashby), removes duplicates, and ranks them by how well they fit you.
- **Filters**: never see certain companies (e.g. your current employer), skip titles like "intern", and keep only Pune, India or remote roles.
- **Resume desk**: picks the right resume for each job and shows which skills match and which are missing.
- **Outreach**: drafts a cover note, LinkedIn note, cold email and follow-up for each job, and finds HR emails in the post plus recruiter search links.
- **Tracker**: tracks each application through applied → interview → offer / rejected, with notes and a reminder to follow up after 7 days.
- **Learn**: shows the skills employers keep asking for that your resumes lack, with AI-written quizzes to practise them and a score history.

Nothing is submitted without you. **Apply** opens the posting, you submit it yourself, and KamSearch records which resume you used.

## Run it

You need [Node.js](https://nodejs.org) 22.13 or newer.

```bash
git clone <this repo> && cd kamsearch
npm install        # React, Vite and TypeScript for the UI (the server itself has no dependencies)
npm run setup      # creates your private config files from the examples
npm start          # builds the UI and opens http://localhost:4321
```

Then:

1. Put your resumes in `resumes/` and edit `resumes/resumes.json` (see [resumes/README.md](resumes/README.md)).
2. In **Config** (press `5`), fill in "Operator", check the searches, and set **Auto-sweep every (hours)** (e.g. `6`). It is off by default.
3. Press **Run sweep**.

| Command | What it does |
|---|---|
| `npm start` | Build the UI, then run the app |
| `npm run dev` | Hot-reloading UI at http://localhost:5173 plus the API server |
| `npm run fetch` | One sweep from the terminal, no UI |
| `npm test` | Offline backend tests |
| `npm run typecheck` | TypeScript check of the UI |

### Keyboard

| Key | Action |
|---|---|
| `Ctrl K` | Command bar: search targets, jump to desks, run a sweep |
| `J` / `K` | Next / previous target |
| `A` | Apply: opens the posting, then asks you to confirm (`Y` / `N`) |
| `S` / `X` | Stash for later / skip (both can be undone from the toast) |
| `B` | Block this company |
| `F` | Focus mode: one target at a time |
| `1`–`5` | Targets, Stash, Operations, Training, Config |

### Run it on a personal machine and network

Many company networks block job sites and log every attempt to reach them. Run KamSearch at home on a personal laptop.

## AI features (drafts, tailoring, quizzes)

These call the [Claude Code](https://claude.com/claude-code) CLI you're already logged into (`claude -p`), so no API key is needed. The model gets the job text and your resume text only, with every tool switched off. Set `KAMSEARCH_MODEL` to choose a model, or `CLAUDE_CMD` if `claude` isn't on your PATH.

Everything else (fetching, filtering, scoring, tracking) works without AI.

## Sources and their limits

| Source | How | Notes |
|---|---|---|
| LinkedIn | Public logged-out job search | Never uses your account. Too many requests get rate-limited, so keep `pagesPerSearch` low. |
| Naukri | The JSON API naukri.com's own search page uses | Not checked yet. May require a captcha if called too often. |
| Greenhouse / Lever / Ashby | Official public job-board APIs | The most reliable. Add companies in `config/companies.json`. Only the Razorpay slug in the example was checked. |
| Indeed | Not supported yet | Blocks automated access aggressively. |

A source that fails is logged and skipped; the others still run. If a site changes its HTML, only that source's parser in `src/sources/` needs updating.

## How matching works

Each job's description is scanned for known skills (`src/skills.js`). For each resume:

**score = 65% × (share of the job's skills your resume covers) + 35% × (job title matches the resume's `titleHints`)**

The resume with the highest score is the one KamSearch suggests. Green chips are skills you have; amber chips are gaps, and they feed the Learn desk.

## Project layout

```
src/                 Node backend, no dependencies
  server.js          local web server and API (127.0.0.1 only), serves web/dist
  fetch.js           fetch → filter → dedupe → score → store
  sources/           linkedin.js, naukri.js, boards.js (greenhouse/lever/ashby)
  filters.js         blocked companies, title and location rules
  scoring.js         resume picking and match score
  skills.js          skill dictionary, aliases and highlight spans
  contacts.js        emails from the post + recruiter search links
  ai.js              Claude Code prompts for drafts, tailoring and quizzes
  db.js              SQLite (built into Node) at data/kamsearch.db
web/                 React 19 + TypeScript UI, built with Vite
  src/App.tsx        desks, keyboard shortcuts, apply/undo flows
  src/components/    TopBar, Rail, TargetList, Dossier, FocusMode, CommandPalette, Training, Config
  src/styles.css     "Bunker v2" design tokens and styles
config/              *.example.json are committed; your copies are git-ignored
resumes/             your resumes (git-ignored)
```

## Ideas for next

- Indeed support
- Hunter.io lookup for HR emails by company domain
- Pre-filling Greenhouse/Lever application forms (still with your final click)
- Spaced repetition: re-quiz weak skills after a few days
