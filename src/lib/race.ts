/**
 * Ghost races on the course map: this row against "usual you" or any other
 * logged row. Pure functions, so they run in node tests and on the server.
 */
import { distanceAt, type Leg } from "./course.ts";
import { formatDate, formatMetersFull, formatSplit } from "./format.ts";
import { LENGTH_TOLERANCE, parseSegments, type Baseline } from "./insights.ts";
import { byLogOrder, inferredSplit, type Workout } from "./workouts.ts";

export type RivalKind = "usual" | "best" | "last" | "row";

export type Rival = {
  /** "usual", or the rival row's slug. */
  id: string;
  kind: RivalKind;
  /** Picker text, e.g. "Your best · Thu, Aug 27". */
  label: string;
  /** Short name for results, e.g. "Aug 27" or "usual you". */
  name: string;
  /** One line on how the ghost rows, for the legend. */
  detail: string;
  workSeconds: number;
  legs: Leg[];
};

export type RaceResult = {
  /** The race runs for the shorter of the two work times. */
  seconds: number;
  /** True when that is shorter than this row, so your boat stops early. */
  cut: boolean;
  you: number;
  rival: number;
  /** Rounded meters; positive = you won. */
  gap: number;
};

/**
 * How a row moves through its work time: its logged splits scaled so it
 * finishes on its logged distance, or an even pace without splits.
 */
export function legsFor(w: Pick<Workout, "notes" | "workSeconds" | "distanceM">): Leg[] {
  const segments = parseSegments(w.notes, w.workSeconds, w.distanceM);
  if (!segments) return [{ seconds: w.workSeconds, meters: w.distanceM }];
  const total = segments.reduce((sum, s) => sum + s.meters, 0);
  return segments.map((s) => ({ seconds: s.seconds, meters: (s.meters * w.distanceM) / total }));
}

function shortDate(iso: string): string {
  return formatDate(iso).replace(/^\w+, /, "");
}

function rowRival(w: Workout, kind: RivalKind): Rival {
  const prefix = kind === "best" ? "Your best · " : kind === "last" ? "Last row · " : "";
  return {
    id: w.slug,
    kind,
    label: `${prefix}${shortDate(w.sessionDate)} · ${formatMetersFull(w.distanceM)}`,
    name: shortDate(w.sessionDate),
    detail: `${formatDate(w.sessionDate)}: ${formatMetersFull(w.distanceM)} at ${formatSplit(inferredSplit(w))} /500m`,
    workSeconds: w.workSeconds,
    legs: legsFor(w),
  };
}

/**
 * Who this row can race, in picker order: usual you, your best row of a
 * similar length, the row before this one, then every other row newest first.
 */
export function raceRivals(target: Workout, all: Workout[], base: Baseline | null): Rival[] {
  const out: Rival[] = [];
  const seen = new Set<string>([target.slug]);
  const add = (r: Rival) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push(r);
  };

  if (base && target.workSeconds > 0) {
    add({
      id: "usual",
      kind: "usual",
      label: `Usual you · ${formatSplit(base.split)} /500m`,
      name: "usual you",
      detail: `Usual you: your median pace (${formatSplit(base.split)}) for rows like this`,
      workSeconds: target.workSeconds,
      legs: [{ seconds: target.workSeconds, meters: (target.workSeconds / base.split) * 500 }],
    });
  }

  const others = all.filter((w) => w.slug !== target.slug && w.workSeconds > 0 && w.distanceM > 0);
  const lo = target.workSeconds * (1 - LENGTH_TOLERANCE);
  const hi = target.workSeconds * (1 + LENGTH_TOLERANCE);
  let best: Workout | null = null;
  for (const w of others) {
    if (w.workSeconds < lo || w.workSeconds > hi) continue;
    const s = inferredSplit(w);
    const b = best && inferredSplit(best);
    if (s != null && (b == null || s < b)) best = w;
  }
  if (best) add(rowRival(best, "best"));

  const earlier = others.filter((w) => byLogOrder(w, target) < 0).sort(byLogOrder);
  const last = earlier[earlier.length - 1];
  if (last) add(rowRival(last, "last"));

  for (const w of [...others].sort(byLogOrder).reverse()) add(rowRival(w, "row"));
  return out;
}

/** Race two pace profiles for as long as both rows lasted. */
export function race(
  you: Leg[],
  youSeconds: number,
  rival: Leg[],
  rivalSeconds: number,
): RaceResult {
  const seconds = Math.min(youSeconds, rivalSeconds);
  const a = distanceAt(you, seconds);
  const b = distanceAt(rival, seconds);
  return { seconds, cut: seconds < youSeconds, you: a, rival: b, gap: Math.round(a - b) };
}

export function raceLine(
  result: RaceResult,
  rival: Pick<Rival, "name">,
  overLabel: string,
): string {
  const over = result.cut ? ` over the first ${overLabel}` : "";
  if (result.gap === 0) return `Dead heat with ${rival.name}${over}`;
  const m = formatMetersFull(Math.abs(result.gap));
  return result.gap > 0
    ? `You beat ${rival.name} by ${m}${over}`
    : `${rival.name[0].toUpperCase()}${rival.name.slice(1)} wins by ${m}${over}`;
}
