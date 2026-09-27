/**
 * The mock water course a row is drawn on. The erg has no GPS, so this is a
 * hand-drawn 10 km river that opens into a harbour, at a fixed scale: a
 * kilometre is always the same length on screen, so a longer row visibly
 * covers more water. Pure geometry and timing only — no React — so it runs in
 * node tests and on the server.
 */

export const COURSE_METERS = 10_000;
export const BUOY_EVERY_M = 500;

/** SVG user units for the map's viewBox. */
export const VIEW = { width: 400, height: 240 } as const;

export type Landmark = { meters: number; name: string };

export const LANDMARKS: Landmark[] = [
  { meters: 1500, name: "Willow Bend" },
  { meters: 3000, name: "The Narrows" },
  { meters: 4000, name: "Stone Bridge" },
  { meters: 5000, name: "Boathouse" },
  { meters: 7500, name: "Heron Point" },
  { meters: 10_000, name: "Harbour Light" },
];

export type Point = { x: number; y: number };
export type Pose = Point & { /** Heading in degrees, 0 = east, clockwise. */ angle: number };

// Control points of the river, start (bottom left) to harbour (top right).
const CONTROL: Point[] = [
  { x: 22, y: 212 },
  { x: 70, y: 196 },
  { x: 96, y: 160 },
  { x: 72, y: 124 },
  { x: 98, y: 88 },
  { x: 150, y: 86 },
  { x: 176, y: 124 },
  { x: 214, y: 168 },
  { x: 268, y: 170 },
  { x: 298, y: 132 },
  { x: 276, y: 92 },
  { x: 284, y: 52 },
  { x: 330, y: 36 },
  { x: 374, y: 46 },
];

const SAMPLES_PER_SPAN = 24;

/** Centripetal-ish Catmull-Rom through the control points, sampled into a dense polyline. */
function sampleSpline(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < SAMPLES_PER_SPAN; s += 1) {
      const t = s / SAMPLES_PER_SPAN;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const POLY = sampleSpline(CONTROL);
/** Cumulative length (SVG units) at each polyline vertex. */
const CUM: number[] = POLY.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - POLY[i - 1].x, p.y - POLY[i - 1].y));
  return acc;
}, []);
const LENGTH = CUM[CUM.length - 1];
const UNITS_PER_M = LENGTH / COURSE_METERS;

/** Laps completed and meters into the current lap. A finish exactly on the line stays on lap 0's end. */
export function lapOf(meters: number): { lap: number; meters: number } {
  if (meters <= 0) return { lap: 0, meters: 0 };
  const lap = Math.ceil(meters / COURSE_METERS) - 1;
  return { lap, meters: meters - lap * COURSE_METERS };
}

/** Where on the course a boat is after `meters` (wrapping onto later laps). */
export function pointAtDistance(meters: number): Pose {
  const target = Math.min(LENGTH, lapOf(meters).meters * UNITS_PER_M);
  let lo = 0;
  let hi = CUM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (CUM[mid] <= target) lo = mid;
    else hi = mid;
  }
  const a = POLY[lo];
  const b = POLY[hi];
  const span = CUM[hi] - CUM[lo] || 1;
  const k = (target - CUM[lo]) / span;
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

/** SVG path data along the course between two distances within one lap. */
export function pathBetween(fromM: number, toM: number): string {
  const from = Math.max(0, Math.min(COURSE_METERS, fromM));
  const to = Math.max(from, Math.min(COURSE_METERS, toM));
  const a = pointAtDistance(from);
  const parts = [`M${a.x.toFixed(1)} ${a.y.toFixed(1)}`];
  const fromU = from * UNITS_PER_M;
  const toU = to * UNITS_PER_M;
  for (let i = 0; i < POLY.length; i += 1) {
    if (CUM[i] > fromU && CUM[i] < toU)
      parts.push(`L${POLY[i].x.toFixed(1)} ${POLY[i].y.toFixed(1)}`);
  }
  const b = to >= COURSE_METERS ? POLY[POLY.length - 1] : pointAtDistance(to);
  parts.push(`L${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
  return parts.join(" ");
}

export const COURSE_PATH = pathBetween(0, COURSE_METERS);

/** A stretch of steady pace: `meters` covered in `seconds`. */
export type Leg = { seconds: number; meters: number };

/** Meters covered `t` seconds in, moving at each leg's own pace. */
export function distanceAt(legs: Leg[], t: number): number {
  let covered = 0;
  let clock = 0;
  for (const leg of legs) {
    if (t <= clock) break;
    if (t >= clock + leg.seconds) {
      covered += leg.meters;
    } else {
      covered += (leg.meters * (t - clock)) / leg.seconds;
    }
    clock += leg.seconds;
  }
  return covered;
}

/** The next landmark past `meters` on the current lap, or null at the end of the course. */
export function nextLandmark(meters: number): Landmark | null {
  const { meters: into } = lapOf(meters);
  return LANDMARKS.find((l) => l.meters > into) ?? null;
}

/** The furthest landmark at or before `meters` on the current lap. */
export function lastLandmark(meters: number): Landmark | null {
  const { meters: into } = lapOf(meters);
  return [...LANDMARKS].reverse().find((l) => l.meters <= into) ?? null;
}

/** Landmarks this row reached that no earlier row had. */
export function newLandmarks(meters: number, furthestBefore: number): Landmark[] {
  if (meters <= furthestBefore || furthestBefore >= COURSE_METERS) return [];
  return LANDMARKS.filter((l) => l.meters > furthestBefore && l.meters <= meters);
}

// ── Loop timing for the self-looping course animations ──

export type LoopPhase = "rowing" | "hold" | "fade";

export type LoopFrame = {
  /** 0 → 1 across the row; stays 1 through hold and fade. */
  progress: number;
  phase: LoopPhase;
  /** 0 → 1 within the current phase. */
  phaseProgress: number;
  /** Milliseconds the loop has been playing, for bob and oar motion. */
  clock: number;
  /** False on the server, with reduced motion, and before the first frame. */
  playing: boolean;
};

/** The finished picture: what the server renders and what reduced motion keeps. */
export const FINISHED_FRAME: LoopFrame = {
  progress: 1,
  phase: "hold",
  phaseProgress: 0,
  clock: 0,
  playing: false,
};

export type LoopOptions = {
  /** Time-lapse length of the row itself. */
  durationMs?: number;
  /** Pause at the finish with the margin showing. */
  holdMs?: number;
  /** Wake fades out before the next lap starts. */
  fadeMs?: number;
};

export function frameAt(
  elapsed: number,
  { durationMs = 8000, holdMs = 1500, fadeMs = 500 }: LoopOptions,
): LoopFrame {
  const at = elapsed % (durationMs + holdMs + fadeMs);
  if (at < durationMs) {
    const k = at / durationMs;
    return { progress: k, phase: "rowing", phaseProgress: k, clock: elapsed, playing: true };
  }
  if (at < durationMs + holdMs) {
    return {
      progress: 1,
      phase: "hold",
      phaseProgress: (at - durationMs) / holdMs,
      clock: elapsed,
      playing: true,
    };
  }
  return {
    progress: 1,
    phase: "fade",
    phaseProgress: (at - durationMs - holdMs) / fadeMs,
    clock: elapsed,
    playing: true,
  };
}
