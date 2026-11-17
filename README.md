# INNOVA Hire

Technical assessments for hiring structural engineers. HR invites a candidate, the candidate takes a timed exam in the browser, Claude drafts scores for the written answers, and an engineer reviews every score and records the hiring decision.

## What it does

| Who | Can |
| --- | --- |
| **HR / Recruiting** | Add candidates, generate an exam for their level, email a single-use link, revoke or reissue links, read results. |
| **Candidate** | Open the link, read the rules, take the exam against a server-enforced timer. Answers autosave; written questions can be answered by typing, by uploading a photo or PDF of the handwritten solution, or both. |
| **Engineer** | Maintain the question bank (choice questions, short answers, calculation/design problems with rubrics), review AI-drafted grades, override any score, finalize the decision. |
| **Admin** | Everything above, plus staff accounts, reopening finalized reviews and the audit log. |

### Exam lifecycle

```
ready ──start──▶ in_progress ──submit / time up──▶ submitted ──all scored──▶ graded ──engineer signs off──▶ finalized
  │                   │                                (AI drafting runs here)
  └──── revoke ───────┴──▶ revoked
```

* **Questions are frozen per exam.** Generating an exam snapshots each question (text, options, rubric, reference answer). Editing the bank later never changes an exam a candidate already saw.
* **Balanced selection.** Questions are drawn at random from the published bank for the candidate's level, spread evenly across the chosen categories. Option order is shuffled per exam.
* **Server-authoritative time.** The deadline is stored when the candidate presses Start. Saves after the deadline (plus a 30-second grace) are rejected and the exam is submitted automatically, even if the browser is closed.
* **Grading.**
  * Single choice and true/false: full points for the exact answer.
  * Multiple choice: partial credit `(correct picks − wrong picks) / correct options`, never below zero.
  * Written answers: Claude scores each rubric criterion against the reference answer (reading attached photos/PDFs), returns a rationale, confidence and any concerns. These are **drafts**: the exam cannot be finalized until an engineer accepts or changes every one. Blank answers score 0 without an AI call. Human grades are never overwritten by re-running AI grading.
* **Suggested decision** from the score (≥85 strong hire, ≥70 hire, ≥55 hire with training, ≥40 further interview, else no hire). A **high** integrity-signal level caps the suggestion at "further interview". The engineer makes the actual decision.
* **Integrity signals.** Leaving the tab, window blur, copy/paste attempts (both blocked), right-click, dev-tools shortcuts and full-screen exits are recorded with timestamps and shown to reviewers as indicators, not proof.

### Security notes

* Exam links contain a 256-bit random token; only its SHA-256 is stored, so links are shown once and can be reissued (which invalidates the old one). `Referrer-Policy: no-referrer` keeps tokens out of Referer headers.
* Starting an exam binds the browser with an `httpOnly`, `SameSite=Strict` signed cookie; every candidate API call is scoped to that exam. Candidates never receive correct answers, rubrics or reference answers.
* Staff sessions are signed JWT cookies, re-checked against the database on each request (deactivation takes effect immediately). Passwords use bcrypt; login is rate-limited.
* Uploads are limited to PDF/PNG/JPEG/WebP/GIF ≤ 10 MB, checked by content signature, stored in the database and only served to signed-in staff.
* Grade changes, decisions, link reissues and account changes are written to the audit log.
* The AI grader treats the candidate's answer as data; text in an answer asking for marks is ignored and surfaced as a concern.

## Running locally

Requires Node.js 22+.

```bash
cp .env.example .env      # then edit AUTH_SECRET and the seed admin password
npm install
npm run db:seed           # creates the first admin and loads the 63 sample questions (all written)
npm run dev
```

Open http://localhost:3000 and sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

With no `DATABASE_URL`, the app uses an embedded Postgres ([PGlite](https://pglite.dev)) stored in `./.data/pglite` and migrates it automatically, so there is nothing else to install. Stop the dev server before running `db:seed` against the embedded database (it allows a single process).

`db:seed` is safe to re-run. With `SEED_SAMPLE_QUESTIONS=true` it adds any sample question the bank has not received yet, and never re-adds one that staff edited or deleted (each sample has a stable `key`, recorded in the audit log when loaded). Samples replaced by a newer version are listed in `src/db/sample-questions/retired.ts`; the seed archives them unless staff edited them, and exams already taken keep their own copy.

### Configuration

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | **Required in production.** 32+ random characters for signing session cookies. |
| `APP_URL` | Public URL used in invitation links. |
| `DATABASE_URL` | PostgreSQL connection string. Omit for embedded PGlite. |
| `ANTHROPIC_API_KEY` | Enables AI grading drafts with Claude. Without an AI key, written answers wait for manual grading. |
| `OPENAI_API_KEY`, `OPENAI_GRADING_MODEL` | Alternative AI grader using OpenAI (Responses API, structured output; default model `gpt-5.5`). Used when no Anthropic key is set. |
| `AI_GRADING_PROVIDER` | `anthropic` or `openai`, to choose when both keys are set. |
| `OPENAI_STORE_RESPONSES` | `true` keeps each OpenAI grading call (answers included, at least 30 days) so it appears in the OpenAI dashboard under Logs → Responses, tagged with `exam_id`, `exam_question_id`, `question_id`, `position`, `category` and `level`. Off by default. |
| `AI_GRADING_MODEL` | Defaults to `claude-opus-5-5`. |
| `SMTP_URL`, `EMAIL_FROM` | Send invitations by email. Without them, emails are stored in the outbox table and printed to the server log. |
| `SEED_ADMIN_*`, `SEED_SAMPLE_QUESTIONS` | Used by `npm run db:seed`. |

AI grading uses adaptive thinking, structured JSON output and the API's server-side refusal fallback (`server-side-fallback-2026-07-01`, `fallbacks: "default"`), so a declined request is retried on a fallback model within the same call. If grading still fails, the question is left for manual grading and the error is logged.

### Production

```bash
export DATABASE_URL=postgres://...
npm run db:migrate
npm run db:seed           # first deploy only
npm run build && npm start
```

Every AI grading call writes one `[grading]` line to the server log (exam and question, model, the provider's response ID, tokens, time and result; no candidate details), and the response ID is saved with the draft and shown on the review page.

AI grading runs right after the candidate submits (via Next.js `after()`), and again for exams that time out the next time staff open the dashboard or exam list. Engineers can also start it from the exam page.

## Development

```bash
npm test          # unit + integration tests (in-memory PGlite)
npm run lint      # type check
npm run build
npm run db:generate   # after editing src/db/schema.ts
```

```
src/
  app/
    (staff)/            dashboard, candidates, exams, questions, users, audit (server components + server actions)
    exam/[token]/       candidate experience (exam-runner.tsx is the client app)
    api/exam/*          candidate JSON endpoints (cookie-scoped)
    api/attachments/    staff-only file download
  db/                   Drizzle schema, connection and seed
    sample-questions/   sample bank, one file per category (3+ questions per level each)
    figures/            SVG diagrams attached to sample questions
  lib/
    domain/             pure logic: scoring, selection, integrity, decisions, tokens
    services/           business rules (all DB writes go through here), AI grader, email
    auth/               sessions and role permissions
tests/                  vitest suites
drizzle/                SQL migrations
```

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Drizzle ORM on PostgreSQL/PGlite, Zod, Anthropic TypeScript SDK.
