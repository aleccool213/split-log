# Split Log

Public Concept 2 rowing log. Meters, weekly volume, split trends, PBs, and a streak — plus an email nudge if you’ve been off the water for a few days.

Friends and family can view the board without an account.

## Log a piece

The source of truth is [`data/split-log.csv`](data/split-log.csv). Add a row, commit, and push.

```csv
Date,Description,Work Time,Distance (m),Stroke Rate,Pace,Watts,Calories,Avg HR,Notes
2026-09-09,Just Row,25:59.0,4474,27,2:54.2,66,266,,PM showed 3:25 /500m at the end (live split)
```

- **Date** — `YYYY-MM-DD`
- **Work Time** — `H:MM:SS.t` or `MM:SS.t`
- **Pace** — split per 500m, same time format
- **Distance (m)** — meters as a number

On Vercel with no database, the board **reads this file directly**. A `git push` + redeploy is enough for friends to see new pieces.

A multi-week sample log lives in [`tests/fixtures/split-log.seed.csv`](tests/fixtures/split-log.seed.csv) for local/parser tests. Nothing under `tests/` is imported by the app, so that file is not bundled or shown on the public board.

Reminder prefs live in [`data/settings.json`](data/settings.json):

```json
{
  "reminderEnabled": true,
  "reminderDays": 3,
  "reminderTo": "alec at alec.coffee"
}
```

- **reminderEnabled** — `true` to send off-the-water emails
- **reminderDays** — quiet period (1–14) before a nudge
- **reminderTo** — write `name at domain` (not `name@domain`) so scrapers miss it. The public board never shows the address.

Edit either file, commit, and push. There is no public “log a session” form — add rows in the CSV only.

With `DATABASE_URL` set, the board also imports the CSV into Neon on dashboard load and at midnight Eastern. Reminder knobs still come from `data/settings.json`.

## Scheduled jobs (Vercel Cron)

In-chat automations are off. The board still needs two recurring jobs, and **Vercel Cron** is how they should run.

Import this repo as a Vercel project (GitHub → Vercel). Crons in [`vercel.json`](vercel.json) are registered on deploy. Vercel only speaks UTC.

| Job | When | Endpoint | Status |
| --- | --- | --- | --- |
| Import `data/split-log.csv` | midnight Eastern (`0 4 * * *` UTC) | `GET /api/cron/sync` | Wired in `vercel.json` (no-ops until Neon is attached) |
| Off-the-water email | 6pm Eastern (`0 22 * * *` UTC) | a `/api/cron/nudge` route | **Not wired yet** — still needed |

The 6pm job should check Settings (reminders on, gap of N days, default 3) and send a short email if you have been off the water that long. Grok’s Gmail connector does not exist on Vercel, so this wants Resend, SES, or SMTP — plus `REMINDER_TO` (or similar) in env. Until that route exists, the Settings toggle only stores the preference.

Protect both endpoints with `CRON_SECRET`. Vercel Cron sends `User-Agent: vercel-cron`; anything else should send `Authorization: Bearer $CRON_SECRET`.

Hobby includes two crons, which is enough for both jobs.

Turn off **Deployment Protection** (Settings → Deployment Protection → Vercel Authentication → Disabled, or Only Preview Deployments) so the production URL is public.

## Run locally

```bash
npm install
npm run dev
```

Needs Node 22+. Without `DATABASE_URL` it uses a local Postgres (PGLite). Do not use PGLite on Vercel — the wasm file is missing from the lambda (`ENOENT …/pglite.data`).

```bash
npm run build
npm run typecheck
```

## Deploy

1. Create a Vercel project from `aleccool213/split-log`.
2. Disable Deployment Protection so friends can open the production URL.
3. Deploy. The board works from the CSV with no database.
4. Optional: add a Neon Postgres database and set `DATABASE_URL` if you want the Log page, reminder prefs, and the midnight import to persist.

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | no (CSV-only board works without it) | Neon Postgres. Needed for Log page, settings, cron import, reminders |
| `CRON_SECRET` | recommended | Bearer token for `/api/cron/*` |
| `RESEND_API_KEY` / SMTP | for the 6pm email | Not used until `/api/cron/nudge` exists |
| `REMINDER_TO` | for the 6pm email | Address the nudge goes to |

## Stack

Vite, React, TanStack Start, Tailwind, Recharts, Neon Postgres (optional).
