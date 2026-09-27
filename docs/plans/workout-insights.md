# Plan: Workout insights and the mock row map

Status: accepted · 2026-09-27

Right now the board is a set of season numbers. It never answers the question you
have after you climb off the erg: **was that a good one?** This plan adds a page for
each workout that compares it with your usual effort and shows it as a trip on a
drawn map. It then lists three more ideas in the same vein.

---

## 1. What we have to work with

- **Source of truth:** `data/split-log.csv`, parsed by `parseSheetRows`
  (`src/lib/sheet-sync.ts`) into `Workout` (`src/lib/workouts.ts`). A workout
  has date, description, work time, distance, SPM, split, watts, calories, HR and notes.
- **Hidden gold in the notes:** most rows log intervals as free text, for example
  `5-min splits 862 / 908 / 875 / 861 m`. That gives us the pacing inside a
  workout without any new column.
- **Current log (8 rows):** almost all are "Just Row" pieces of about 20 minutes,
  so "compared with normal" is easy to define today. It must still work later
  for 2k tests and 10k pieces.
- **UI kit:** `@omarchy/ui` already provides `OmStat` (with delta), `OmDelta`,
  `OmSparkline`, `OmCallout`, `OmTimeSeriesChart` and `OmStackedBar`. It has
  no map component, so we draw the map ourselves in SVG.
- **Routing:** TanStack Router file routes (`src/routes/*.tsx`). Every page
  loads `getDashboard()`.

### A gotcha to fix first: workout IDs are not stable

In CSV mode, `loadCsvWorkouts` sets `id = i + 1` from the row's position in the
file. If you insert a row out of date order, every ID after it shifts, so a
shared link like `/session/7` would point to a different workout. The URL
should use a **slug based on the date** instead:

- `2026-09-25` when one workout is logged that day
- `2026-09-25-2` for the second workout on the same day, in file order

A helper `workoutSlug(w, all)` in `src/lib/workouts.ts` builds the slug the same
way in CSV mode and Neon mode, because both have `sessionDate`.

---

## 2. Feature A: Single-workout view, "better or worse than normal?"

### Route and entry points

- New route `src/routes/session.$slug.tsx`, served at `/session/2026-09-25`.
- Entry points:
  - the "Last session" card on `/`, where the title becomes a link
  - `SessionRow` on the home page's recent sessions list
  - rows in the `/history` logbook
  - prev/next arrows on the session page, so you can flip through the season
- Share payloads (`src/lib/share.ts`) link to the session URL instead of `/`.

### What counts as "normal"

The baseline is **comparable workouts that came before this one**. Using only
earlier workouts keeps the page honest when you open an old session. It shows
how that row compared with what was normal *at the time*, not with a later,
fitter you.

Comparable means, in priority order:

1. **Same workout name** (such as `2,000m test` or `8x500m/1:00r`), if there are
   at least 3 earlier ones.
2. Otherwise, a **similar length**: work time within ±20% of this one. A 19:47
   row compares with 16–24 minute rows.
3. Use at most the **last 8** comparable rows, so "normal" follows your
   current fitness.

If fewer than 3 comparable rows exist, show "Not enough history yet. Log two
more ~20 min rows to unlock the comparison" instead of a verdict based on too
little data.

The baseline is the **median**, not the mean. With a handful of rows, one bad
day (such as the 3:25 live split on Sep 9) would drag a mean around.

### Metrics compared

| Metric | Better when | Notes |
| --- | --- | --- |
| Avg split /500m | lower | Headline metric |
| Distance, adjusted for time | higher | Meters at this pace over the baseline's median time, so a 19:11 and a 19:53 row compare fairly |
| Watts | higher | Worked out from the split when missing (`inferredWatts`) |
| Stroke rate | neutral | Shown for context, never counted as better or worse |
| Meters per stroke | higher | `distance / (spm × minutes)`, a measure of stroke efficiency. Shown only when SPM is present |
| Avg HR | lower at the same split | Only when both this row and the baseline have HR |

### The verdict

A single headline sentence, driven by the split delta against the baseline median:

| Split delta vs median | Label | Tone |
| --- | --- | --- |
| ≤ −1.0 s | **Better than usual** | positive |
| within ±1.0 s | **Right on your normal** | neutral |
| ≥ +1.0 s | **Building day** | warn, but kind (the board is public) |

The sentence also gives a rank, such as "2nd fastest of 6 comparable rows". A
PB gets its own badge: "New best for a ~20 min row".

**Worked example with real data: Sep 25, 3,505 m in 19:46.6 @ 2:49.2**

- Comparable earlier rows (16–24 min): Jul 4 (2:58.8), Aug 7 (2:51.9),
  Aug 18 (2:51.4), Aug 27 (2:44.8), Sep 15 (2:49.5). The median is **2:51.4**.
- Split delta: **−2.2 s/500m**, so the verdict is **Better than usual**.
- Rank: 2nd of 6. Only Aug 27 was faster.
- Ghost gap: at the median pace over the same 19:46.6 you would have rowed
  about 3,461 m, so **you finished 44 m ahead of your usual self**. That
  number feeds the map (see Feature B).

### Pacing inside the workout (from notes)

Parse interval splits out of `notes` with a small, well-tested regex:

- `(\d+)-min splits ([\d\s/]+) m` gives meters per N-minute segment.
- A short final segment (such as `721` over a 19:12 row) counts as partial
  and is pro-rated before it is compared.

From those segments, show:

- **Segment bars**: one bar per segment, colored faster or slower than the
  workout's own average, with a tick marking your typical segment.
- **Fade**: last full segment against the first. "You held 99% of your opening
  pace" motivates more than a raw number.
- **Evenness**: spread of segment paces (coefficient of variation). Low means
  even pacing. This is the basis for the pacing badges in Idea 3.

Rows without parseable splits hide this section. Later we can add an optional
`Splits` CSV column (`862/908/875/861`) and keep the notes regex as a fallback.

### "Next time" target, which is the motivational part

A small card at the bottom:

> **Next time:** hold **2:48.7** for 19:47 and you'd row **~3,517 m**, enough to
> beat today by 12 m. Your best for this length is 2:44.8 (Aug 27).

The target is this workout's split minus 0.5 s, or the baseline median after a
building day. That keeps the next goal a small step within reach, not the PB.

### Page layout (mobile first)

1. Header: date, description, a verdict badge, and share
2. `OmStatGrid`: split, meters, time, and watts, each `OmStat` with a `delta`
   against the baseline median
3. **Mock map** (Feature B)
4. Segment bars with fade and evenness
5. "Where this sits": an `OmSparkline` of the comparable rows' splits with
   this workout highlighted
6. Next-time target card
7. Notes, then prev/next navigation

### Code shape

- `src/lib/insights.ts` holds pure functions with no React code:
  - `comparableWorkouts(target, all): Workout[]`
  - `baseline(rows): { split, meters, workSeconds, watts, spm } | null`
  - `verdict(target, baseline, rows): { label, tone, deltaSplit, rank, of, isPb }`
  - `parseSegments(notes, workSeconds): Segment[] | null`
  - `pacing(segments): { fadePct, cv }`
  - `nextTarget(target, baseline, best): { split, meters }`
  - `ghostGapMeters(target, baseline): number`
- `src/lib/insights.test.ts` holds tests. Add them to the `npm test` script next
  to `app-data.test.ts`, using the existing `node --experimental-strip-types
  --test` runner. Cover the Sep 25 worked example, the Sep 9 outlier, the
  partial last segment, the case with fewer than 3 comparable rows, and
  duplicate dates in slugs.
- `getWorkout` in `workouts.functions.ts` is a server function that takes a
  slug and returns `{ workout, comparables, insights, prevSlug, nextSlug }`, so
  the page does not send the whole log to the client when the log grows.

---

## 3. Feature B: Mock map of how far you rowed

The erg doesn't move, so there is no GPS. We **draw a stylized water course**
and place your meters on it. The goal is to make the distance feel real and to
show your usual self as a "ghost boat" you beat or didn't.

### The course

- A fixed, hand-drawn **10 km course** stored as a polyline in
  `src/lib/course.ts`. Think of a winding river that opens into a harbour.
  It is a stylized shape, so no map tiles and no API key are needed.
- **Fixed scale**: 1 km always has the same length on screen. A 3.5 km row
  covers about a third of the course and a 10k covers all of it. Seeing that
  change between sessions is part of what makes it motivating. Rows over 10 km
  lap the course and show a "Lap 2" chip.
- **Buoys every 500 m** with small labels (500, 1k, 1.5k …). Rows are about 3.5 km,
  so the buoys give a sense of progress within a single session.
- A few **named landmarks** at fixed distances, such as "The Narrows" at 2 km,
  "Boathouse" at 5 km, and "Harbour light" at 10 km. The first time a row reaches
  one, it gets a small "New water!" note.

### What is drawn

- The whole course is drawn faint, as water ahead of you.
- **Your wake**: the distance covered is drawn as a solid line. If segment splits
  exist, the line is split into segments colored by pace, the same colors as the
  bars, so the map and the chart tell the same story.
- **Your boat** is marked at the finish point.
- A **ghost boat** is placed where your baseline median pace would have been at
  the same work time, labeled "usual you". With the Sep 25 data, the ghost sits
  44 m behind you.
- A caption states the result, for example "3,505 m, past The Narrows, 44 m
  ahead of usual you".

### Implementation

- Pure SVG, inline, and themed with `--om-*` tokens so light and dark modes work
  with no extra effort.
- Position along the course comes from **arc-length interpolation over the
  polyline, done in TS** (`pointAtDistance(course, meters)`). We avoid
  `SVGPathElement.getPointAtLength` so the page renders on the server with no
  layout jump, and the math can be unit-tested.
- A single `<RowMap distance ghostDistance segments />` component in
  `src/components/row-map.tsx`.
- Motion: the map is a **self-looping animation** (see section 4a). Your
  boat and the ghost row the course over and over at their relative paces,
  so the gap between them opens up as you watch.
- Accessibility: `role="img"` plus an `aria-label` with the same caption text.

### Later (not v1)

- Several courses picked by distance: a sprint lane for 2k tests, the river for
  steady rows, and a lake crossing for 10k+.
- A course based on real geography (for example, a trace of the Toronto
  waterfront), drawn as our own simplified path. This keeps it free of tile
  licensing and network calls.

---

## 4. Three more ideas

### Idea 1: Season voyage (cumulative meters on a real route)

The mock map works for one session, and this does the same for the season. All
meters logged move a boat along a long real-world route, for example **Toronto
to Kingston along Lake Ontario (~260 km)**, with towns as milestones (Oshawa,
Cobourg, Belleville…). The home page gets a strip showing "31.5 km logged, next
stop: Pickering, 7 km away". It uses the same `pointAtDistance` code as Feature B.
The strip is a **self-looping animation**: the boat sails from Toronto to its
current spot, and each town it passes lights up. It rests there for a moment,
then starts over.
When a new row crosses a town, the session page shows "You reached Pickering 🎉".
Friends and family viewing the public board get an easy story to follow.

### Idea 2: Race your past self (ghost replay)

On the session page, choose any other workout, such as your best or last week's
row, to use as the ghost instead of "usual you". Both boats race across the
mock map in a **self-looping** 10-second time-lapse. There is no play button:
the race just keeps running, and picking a different rival restarts it. The replay uses segment splits
when available and even pacing otherwise. It ends on a margin: "Beat Aug 27 by
—" or "Aug 27 wins by 95 m". This reuses Feature A's `ghostGapMeters` and
Feature B's map, so most of the work is already done.

### Idea 3: Pacing badges and weekly check-in

Small, earned labels that reward how you rowed, not just how far:

- **Even Steven**: segment CV under 2%
- **Negative split**: last segment faster than the first
- **Held it**: fade under 2%
- **Streak saver**: logged the row that kept the 2+/week streak alive
- **New water**: reached a new landmark on the course or the voyage

Badges appear on the session page and as small chips in the logbook. A Sunday
push (the push code already exists in `src/lib/push-*.ts`) sums up the week, for
example "3 rows, 10.4 km, 2 badges, split down 1.8 s vs last week", and links to
the best session of the week.

---

## 4a. Self-looping boat animations

The mock map, the ghost race, and the season voyage all use one looping
animation. Each is a small, quiet scene that plays on its own, like a GIF, with
nothing to press.

**One loop:**

1. Boats start at 0 and row along the course. The wake draws in behind them.
2. Speed follows real pacing: each boat's speed through a segment matches its
   split for that segment. With no segment data, speed is even. A time-lapse
   maps the whole row onto about **8 s** (voyage: about 10 s).
3. At the finish, the boats hold for **1.5 s**. The margin label appears ("+44 m
   vs usual you"), and a ripple pulses at the finish point.
4. The wake fades out over 0.5 s and the loop starts again.

Small touches that make it feel alive without being noisy: a gentle bob (±1 px),
oar strokes shown as a tick that pulses at the workout's stroke rate (sped up to
match the time-lapse), and buoys that brighten briefly as a boat passes.

**Implementation:**

- A shared `useCourseLoop({ racers, durationMs, holdMs })` hook in
  `src/components/course-loop.ts`. It returns each racer's distance at the
  current frame. `RowMap`, the race view, and the voyage strip only draw.
- Driven by `requestAnimationFrame`, using `pointAtDistance` for positions. We
  don't use CSS `offset-path` because it can't vary speed by segment and
  behaves unevenly inside SVG.
- **Cheap when idle:** an `IntersectionObserver` pauses the loop when it is
  scrolled off screen, and it also pauses when the tab is hidden
  (`visibilitychange`).
- **`prefers-reduced-motion`:** no loop. Show the finished frame with the
  margin label.
- The server renders the finished frame, so the page never flashes empty
  before JS loads. The loop takes over once the page is interactive.
- Timing math (distance at time *t* over pace segments) is a pure function,
  `distanceAt(segments, t)`, in `src/lib/course.ts` and gets its own tests.

---

## 5. Phasing

| Phase | Scope | Size |
| --- | --- | --- |
| 1 | Stable slugs; `insights.ts` with tests; `/session/$slug` with verdict, delta stats, and next-time card; links from home, logbook, and share | M |
| 2 | Notes segment parser, segment bars, fade and evenness | S |
| 3 | `course.ts` + `useCourseLoop` + `RowMap`: wake, buoys, landmarks, ghost boat, self-looping animation | M |
| 4 | Idea 2: looping ghost race with rival picker (builds on 1 and 3) | S |
| 5 | Idea 3: badges, then the weekly push | S–M |
| 6 | Idea 1: looping season voyage strip on the home page | M |

Phases 1 to 3 deliver what was asked. Each phase can ship on its own.

## 6. Decisions

These were open questions in the first draft. They are now settled.

- **Baseline window: last 8 comparable rows**, not a date window. The log has
  gaps of up to 2 months, and a 60-day window would often be empty or hold just
  one row. A count window always has something to compare against.
- **"Normal" band: ±1.0 s/500m.** That is about 20 m on a ~20 min row. Your
  usual rows already vary by about that much (Aug 7 at 2:51.9 against Aug 18 at
  2:51.4), so a tighter band would call noise "better" or "worse". We can tighten
  it once the log is longer.
- **Tone: "Building day"** replaces "Off day". The board is public, and the label
  should still motivate on a slow day. The next-time card sets a reachable target
  for the next row.
- **Splits stay in notes for now.** The `N-min splits a / b / c m` format is
  consistent across the log, and one parser covers it. We will add a `Splits`
  column only if the notes format starts to drift. The parser would then read
  the column first and fall back to notes.
