# Split Log

Public Concept 2 rowing log. Meters, weekly volume, split trends, PBs, and a streak — plus an email nudge if you’ve been off the water for a few days.

Friends and family can view the board without an account.

## Log a piece

The source of truth is [`data/split-log.csv`](data/split-log.csv). Add a row, commit, and push.

```csv
Date,Description,Work Time,Distance (m),Stroke Rate,Pace,Watts,Calories,Avg HR,Notes
2026-08-27,"5,000m",21:10.0,5000,22,2:07.0,170,348,152,Steady
```

- **Date** — `YYYY-MM-DD`
- **Work Time** — `H:MM:SS.t` or `MM:SS.t`
- **Pace** — split per 500m, same time format
- **Distance (m)** — meters as a number

The board imports the CSV on the next dashboard load, or overnight at midnight Eastern. Unchanged files are skipped (hash check). You can still log a one-off from the **Log** page; those rows live in the database and are not overwritten.

## Scheduled jobs (Vercel Cron)

In-chat automations are off. The board still needs two recurring jobs, and **Vercel Cron** is how they should run.

Import this repo as a Vercel project (GitHub → Vercel). Crons in [`vercel.json`](vercel.json) are registered on deploy. Vercel only speaks UTC.

| Job | When | Endpoint | Status |
| --- | --- | --- | --- |
| Import `data/split-log.csv` | midnight Eastern (`0 4 * * *` UTC) | `GET /api/cron/sync` | Wired in `vercel.json` |
| Off-the-water email | 6pm Eastern (`0 22 * * *` UTC) | a `/api/cron/nudge` route | **Not wired yet** — still needed |

The midnight job re-reads the CSV and upserts new rows. Without this Vercel project, a `git push` of the log file does not update the live board by itself.

The 6pm job should check Settings (reminders on, gap of N days, default 3) and send a short email if you have been off the water that long. Grok’s Gmail connector does not exist on Vercel, so this wants Resend, SES, or SMTP — plus `REMINDER_TO` (or similar) in env. Until that route exists, the Settings toggle only stores the preference.

Protect both endpoints with `CRON_SECRET`. Vercel Cron sends `User-Agent: vercel-cron`; anything else should send `Authorization: Bearer $CRON_SECRET`.

Hobby includes two crons, which is enough for both jobs.

## Run locally

```bash
npm install
npm run dev
```

Needs Node 22+. Without `DATABASE_URL` it uses a local Postgres (PGLite). For production, point `DATABASE_URL` at Neon.

```bash
npm run build
npm run typecheck
```

## Deploy

1. Create a Vercel project from `aleccool213/split-log`.
2. Add a Neon Postgres database and set the env vars below.
3. Deploy. The midnight cron starts with the first production deploy.

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes, in prod | Neon Postgres connection string |
| `CRON_SECRET` | recommended | Bearer token for `/api/cron/*` |
| `RESEND_API_KEY` / SMTP | for the 6pm email | Not used until `/api/cron/nudge` exists |
| `REMINDER_TO` | for the 6pm email | Address the nudge goes to |

## Stack

Vite, React, TanStack Start, Tailwind, Recharts, Neon Postgres.
