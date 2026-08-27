# Split Log

Public Concept 2 rowing log. Meters, weekly volume, split trends, PBs, and a streak — plus an email nudge if you’ve been off the water for a few days.

Friends and family can view the board without an account.

## Log a piece

The source of truth is [`data/split-log.csv`](data/split-log.csv). Add a row, commit, and push.

```csv
Date,Description,Work Time,Distance (m),Stroke Rate,Pace,Watts,Calories,Avg HR,Notes
2026-08-27,5,000m,21:10.0,5000,22,2:07.0,170,348,152,Steady
```

- **Date** — `YYYY-MM-DD`
- **Work Time** — `H:MM:SS.t` or `MM:SS.t`
- **Pace** — split per 500m, same time format
- **Distance (m)** — meters as a number

The board imports the CSV on the next dashboard load, or overnight at midnight Eastern. Unchanged files are skipped (hash check). You can still log a one-off from the **Log** page; those rows live in the database and are not overwritten.

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

Vercel. Set:

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes, in prod | Neon Postgres connection string |
| `CRON_SECRET` | recommended | Bearer token for `GET/POST /api/cron/sync` |

A Vercel cron hits `/api/cron/sync` at `0 4 * * *` UTC (midnight Eastern). That re-reads `data/split-log.csv` and sends a Gmail reminder if the last piece was 3+ days ago.

## Stack

Vite, React, TanStack Start, Tailwind, Recharts, Neon Postgres.
