# Resume desk

Everything in this folder except this README and the example file is git-ignored, so your resumes stay on your machine.

1. Copy `resumes.example.json` to `resumes.json` (or run `npm run setup`).
2. Put your resume files here, e.g. `Your_Name_Frontend.pdf`.
3. For each resume, also save a plain-text copy (`frontend.txt`): open the resume, select all, copy, and paste it into a `.txt` file. The AI drafts use this text so they only mention experience you actually have.
4. Edit `keywords` to list the skills that resume really covers, and `titleHints` to list the job titles it is meant for. KamSearch uses both to pick the right resume for each job.

Add a new resume by adding another entry with a new `id`.
