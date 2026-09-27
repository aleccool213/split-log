/**
 * "Was that a good one?" — compares one workout with the comparable rows that
 * came before it. Pure functions only, so they run in node tests as-is.
 */
import { byLogOrder, inferredSplit, inferredWatts, type Workout } from "./workouts.ts";

/** Split delta (s/500m) inside which a row counts as "normal". */
export const NORMAL_BAND_S = 1.0;
/** Fewer comparable rows than this and there is no verdict. */
export const MIN_COMPARABLE = 3;
/** Only the most recent comparable rows count, so "normal" tracks current fitness. */
export const MAX_COMPARABLE = 8;
/** A comparable row's work time is within this fraction of the target's. */
export const LENGTH_TOLERANCE = 0.2;
/** How much faster (s/500m) the next-time target asks for. */
export const NEXT_STEP_S = 0.5;

/** Segment-pace spread (coefficient of variation) under which a row is "even". */
export const EVEN_CV = 0.02;
/** …and under which it is still "steady". */
export const STEADY_CV = 0.04;
/** Logged segment meters may differ from the row's distance by this fraction (PM rounding). */
const SEGMENT_SUM_TOLERANCE = 0.03;

/** Descriptions that name no fixed piece, so they are compared by length instead. */
const OPEN_ENDED = /^just row$/i;

export type ComparisonBasis = "name" | "length";

export type Baseline = {
  split: number;
  workSeconds: number;
  distanceM: number;
  watts: number | null;
  strokeRate: number | null;
  metersPerStroke: number | null;
};

export type VerdictTone = "better" | "normal" | "building";

export type Verdict = {
  label: string;
  tone: VerdictTone;
  /** This split minus the baseline median; negative is faster. */
  deltaSplit: number;
  /** 1 = fastest among the comparable rows plus this one. */
  rank: number;
  of: number;
  isPb: boolean;
};

export type NextTarget = {
  split: number;
  /** Meters that split covers over this workout's time. */
  meters: number;
  /** Meters more than this workout. */
  beatBy: number;
  best: { slug: string; sessionDate: string; split: number } | null;
};

export type SessionInsights = {
  basis: ComparisonBasis;
  /** Oldest first. */
  comparables: Workout[];
  baseline: Baseline | null;
  verdict: Verdict | null;
  /** Rows still needed before a verdict; 0 once there is one. */
  needed: number;
  /** Meters ahead (+) or behind (−) of the baseline pace over the same time. */
  ghostGap: number | null;
  next: NextTarget | null;
  /** Null when the notes carry no usable splits. */
  segments: Segment[] | null;
  pacing: Pacing | null;
};

export type Segment = {
  startSeconds: number;
  seconds: number;
  meters: number;
  /** Pace for this segment, s/500m. */
  split: number;
  /** Shorter than the logged segment length (the final stretch of the row). */
  partial: boolean;
};

export type Evenness = "even" | "steady" | "uneven";

export type Pacing = {
  /** Last segment's pace vs the first, as a fraction; positive = slowed down. */
  fade: number;
  /** Spread of segment paces (stdev / mean). */
  cv: number;
  evenness: Evenness;
  /** Average pace across segments, weighted by time — the bars' reference line. */
  split: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function present(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
}

export function metersPerStroke(w: Workout): number | null {
  if (!w.strokeRate || w.strokeRate <= 0 || w.workSeconds <= 0) return null;
  return w.distanceM / (w.strokeRate * (w.workSeconds / 60));
}

export function comparisonBasis(target: Workout, all: Workout[]): ComparisonBasis {
  if (OPEN_ENDED.test(target.description.trim())) return "length";
  const name = target.description.trim().toLowerCase();
  const sameName = earlierWithSplit(target, all).filter(
    (w) => w.description.trim().toLowerCase() === name,
  );
  return sameName.length >= MIN_COMPARABLE ? "name" : "length";
}

function earlierWithSplit(target: Workout, all: Workout[]): Workout[] {
  return all
    .filter((w) => w.slug !== target.slug && byLogOrder(w, target) < 0 && inferredSplit(w) != null)
    .sort(byLogOrder);
}

/** Up to MAX_COMPARABLE earlier rows like this one, oldest first. */
export function comparableWorkouts(target: Workout, all: Workout[]): Workout[] {
  const earlier = earlierWithSplit(target, all);
  const basis = comparisonBasis(target, all);
  const name = target.description.trim().toLowerCase();
  const lo = target.workSeconds * (1 - LENGTH_TOLERANCE);
  const hi = target.workSeconds * (1 + LENGTH_TOLERANCE);
  const matches = earlier.filter((w) =>
    basis === "name"
      ? w.description.trim().toLowerCase() === name
      : w.workSeconds >= lo && w.workSeconds <= hi,
  );
  return matches.slice(-MAX_COMPARABLE);
}

/** Medians, not means: one bad day shouldn't move "normal" much. */
export function baseline(rows: Workout[]): Baseline | null {
  const split = median(present(rows.map(inferredSplit)));
  if (split == null) return null;
  return {
    split,
    workSeconds: median(present(rows.map((w) => w.workSeconds)))!,
    distanceM: median(present(rows.map((w) => w.distanceM)))!,
    watts: median(present(rows.map(inferredWatts))),
    strokeRate: median(present(rows.map((w) => w.strokeRate))),
    metersPerStroke: median(present(rows.map(metersPerStroke))),
  };
}

export function verdict(target: Workout, base: Baseline, comparables: Workout[]): Verdict | null {
  const split = inferredSplit(target);
  if (split == null) return null;
  const deltaSplit = split - base.split;
  const others = present(comparables.map(inferredSplit));
  const rank = 1 + others.filter((s) => s < split).length;
  const tone: VerdictTone =
    deltaSplit <= -NORMAL_BAND_S ? "better" : deltaSplit >= NORMAL_BAND_S ? "building" : "normal";
  const label =
    tone === "better"
      ? "Better than usual"
      : tone === "building"
        ? "Building day"
        : "Right on your normal";
  return { label, tone, deltaSplit, rank, of: others.length + 1, isPb: rank === 1 };
}

/** Distance ahead of where baseline pace would have been after the same work time. */
export function ghostGapMeters(target: Workout, base: Baseline): number {
  return target.distanceM - (target.workSeconds / base.split) * 500;
}

/**
 * A small step, not the PB: half a second faster than today, or back to the
 * baseline after a building day.
 */
export function nextTarget(
  target: Workout,
  base: Baseline | null,
  comparables: Workout[],
): NextTarget | null {
  const split = inferredSplit(target);
  if (split == null || target.workSeconds <= 0) return null;
  const goal = base && split - base.split >= NORMAL_BAND_S ? base.split : split - NEXT_STEP_S;
  const meters = (target.workSeconds / goal) * 500;
  let best: NextTarget["best"] = null;
  for (const w of [...comparables, target]) {
    const s = inferredSplit(w);
    if (s != null && (best == null || s < best.split)) {
      best = { slug: w.slug, sessionDate: w.sessionDate, split: s };
    }
  }
  return { split: goal, meters, beatBy: meters - target.distanceM, best };
}

const SPLITS_NOTE = /(\d+)\s*-?\s*min(?:ute)?\s+splits?\s*:?\s*((?:\d+\s*\/\s*)+\d+)\s*m\b/i;

/**
 * Reads PM splits logged in the notes, e.g. `5-min splits 862 / 908 / 875 / 861 m`.
 * Every segment but the last is the logged length; the last one is whatever
 * work time is left, so a 19:47 row's fourth split covers 4:47.
 */
export function parseSegments(
  notes: string,
  workSeconds: number,
  distanceM: number,
): Segment[] | null {
  const match = SPLITS_NOTE.exec(notes);
  if (!match || workSeconds <= 0) return null;
  const segSeconds = Number(match[1]) * 60;
  const meters = match[2].split("/").map((m) => Number(m.trim()));
  if (segSeconds <= 0 || meters.length < 2 || meters.some((m) => !(m > 0))) return null;

  const lastSeconds = workSeconds - segSeconds * (meters.length - 1);
  // The splits must account for the whole row: the last segment exists and is
  // no longer than the others (small slack for PM rounding).
  if (lastSeconds <= 0 || lastSeconds > segSeconds + 1) return null;
  const total = meters.reduce((sum, m) => sum + m, 0);
  if (distanceM > 0 && Math.abs(total - distanceM) / distanceM > SEGMENT_SUM_TOLERANCE) return null;

  return meters.map((m, i) => {
    const last = i === meters.length - 1;
    const seconds = last ? lastSeconds : segSeconds;
    return {
      startSeconds: i * segSeconds,
      seconds,
      meters: m,
      split: (seconds / m) * 500,
      partial: last && seconds < segSeconds - 1,
    };
  });
}

export function pacing(segments: Segment[]): Pacing | null {
  if (segments.length < 2) return null;
  const splits = segments.map((s) => s.split);
  const mean = splits.reduce((sum, x) => sum + x, 0) / splits.length;
  const sd = Math.sqrt(splits.reduce((sum, x) => sum + (x - mean) ** 2, 0) / splits.length);
  const cv = sd / mean;
  const seconds = segments.reduce((sum, s) => sum + s.seconds, 0);
  const meters = segments.reduce((sum, s) => sum + s.meters, 0);
  return {
    fade: splits[splits.length - 1] / splits[0] - 1,
    cv,
    evenness: cv < EVEN_CV ? "even" : cv < STEADY_CV ? "steady" : "uneven",
    split: (seconds / meters) * 500,
  };
}

export function sessionInsights(target: Workout, all: Workout[]): SessionInsights {
  const comparables = comparableWorkouts(target, all);
  const enough = comparables.length >= MIN_COMPARABLE;
  const base = enough ? baseline(comparables) : null;
  const segments = parseSegments(target.notes, target.workSeconds, target.distanceM);
  return {
    basis: comparisonBasis(target, all),
    comparables,
    baseline: base,
    verdict: base ? verdict(target, base, comparables) : null,
    needed: enough ? 0 : MIN_COMPARABLE - comparables.length,
    ghostGap: base ? ghostGapMeters(target, base) : null,
    next: nextTarget(target, base, comparables),
    segments,
    pacing: segments ? pacing(segments) : null,
  };
}
