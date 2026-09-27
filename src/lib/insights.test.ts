import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  comparableWorkouts,
  ghostGapMeters,
  nextTarget,
  pacing,
  parseSegments,
  sessionInsights,
  type Baseline,
} from "./insights.ts";
import { withSlugs, type Workout } from "./workouts.ts";

type Row = [
  date: string,
  description: string,
  workSeconds: number,
  distanceM: number,
  split: number,
  spm?: number,
];

function log(rows: Row[]): Workout[] {
  return withSlugs(
    rows.map(([sessionDate, description, workSeconds, distanceM, splitSeconds, strokeRate], i) => ({
      id: i + 1,
      sourceKey: `test:${i}`,
      sessionDate,
      description,
      workSeconds,
      distanceM,
      strokeRate: strokeRate ?? null,
      splitSeconds,
      watts: null,
      calories: null,
      avgHr: null,
      notes: "",
      source: "sheet",
    })),
  );
}

// data/split-log.csv as of Sep 25, 2026.
const season = log([
  ["2026-05-05", "Just Row", 870.9, 2434, 178.9, 24],
  ["2026-07-04", "Just Row", 1151.0, 3217, 178.8, 24],
  ["2026-08-07", "Just Row", 1193.0, 3470, 171.9, 25],
  ["2026-08-18", "Just Row", 1152.1, 3360, 171.4, 25],
  ["2026-08-27", "Just Row", 1195.6, 3627, 164.8, 26],
  ["2026-09-09", "Just Row", 1559.0, 4474, 174.2, 27],
  ["2026-09-15", "Just Row", 1157.4, 3413, 169.5, 25],
  ["2026-09-25", "Just Row", 1186.6, 3505, 169.2, 25],
]);

const bySlug = (slug: string) => season.find((w) => w.slug === slug)!;

describe("withSlugs", () => {
  it("uses the date, numbering later same-day rows in log order", () => {
    const rows = log([
      ["2026-09-01", "Just Row", 600, 2000, 150],
      ["2026-09-02", "Just Row", 600, 2000, 150],
      ["2026-09-01", "5,000m", 1200, 5000, 120],
    ]);
    assert.deepEqual(
      rows.map((w) => w.slug),
      ["2026-09-01", "2026-09-02", "2026-09-01-2"],
    );
  });
});

describe("sessionInsights", () => {
  it("scores the Sep 25 row against earlier ~20 min rows", () => {
    const got = sessionInsights(bySlug("2026-09-25"), season);
    assert.equal(got.basis, "length");
    // May 5 (14:31) and Sep 9 (25:59) fall outside ±20% of 19:47.
    assert.deepEqual(
      got.comparables.map((w) => w.sessionDate),
      ["2026-07-04", "2026-08-07", "2026-08-18", "2026-08-27", "2026-09-15"],
    );
    assert.equal(got.baseline?.split, 171.4);
    assert.equal(got.verdict?.tone, "better");
    assert.equal(got.verdict?.label, "Better than usual");
    assert.ok(Math.abs(got.verdict!.deltaSplit - -2.2) < 1e-9);
    assert.equal(got.verdict?.rank, 2);
    assert.equal(got.verdict?.of, 6);
    assert.equal(got.verdict?.isPb, false);
    assert.equal(Math.round(got.ghostGap!), 44);
    assert.equal(got.needed, 0);
  });

  it("sets a next target half a second faster, with the best for this length", () => {
    const next = sessionInsights(bySlug("2026-09-25"), season).next!;
    assert.ok(Math.abs(next.split - 168.7) < 1e-9);
    assert.equal(Math.round(next.meters), 3517);
    assert.equal(Math.round(next.beatBy), 12);
    assert.equal(next.best?.sessionDate, "2026-08-27");
  });

  it("marks a new best", () => {
    const got = sessionInsights(bySlug("2026-08-27"), season);
    assert.equal(got.verdict?.isPb, true);
    assert.equal(got.verdict?.rank, 1);
  });

  it("gives no verdict without enough history", () => {
    const got = sessionInsights(bySlug("2026-08-07"), season);
    assert.equal(got.comparables.length, 1);
    assert.equal(got.verdict, null);
    assert.equal(got.baseline, null);
    assert.equal(got.needed, 2);
    assert.ok(got.next, "still sets a next target");
  });

  it("calls a slow row a building day and targets the baseline", () => {
    const rows = log([
      ["2026-08-01", "Just Row", 1200, 3500, 171.4],
      ["2026-08-02", "Just Row", 1200, 3500, 171.4],
      ["2026-08-03", "Just Row", 1200, 3500, 171.4],
      ["2026-08-04", "Just Row", 1200, 3400, 176.5],
    ]);
    const got = sessionInsights(rows[3], rows);
    assert.equal(got.verdict?.tone, "building");
    assert.equal(got.verdict?.label, "Building day");
    assert.equal(got.next?.split, 171.4);
  });

  it("compares named pieces by name once there are three", () => {
    const rows = log([
      ["2026-07-01", "2,000m test", 454, 2000, 113.6],
      ["2026-07-10", "2,000m test", 452, 2000, 113.0],
      ["2026-07-15", "8x500m/1:00r", 460, 2000, 115.0],
      ["2026-07-20", "2,000m test", 450, 2000, 112.5],
      ["2026-08-01", "2,000m test", 448, 2000, 112.0],
    ]);
    const got = sessionInsights(rows[4], rows);
    assert.equal(got.basis, "name");
    assert.deepEqual(
      got.comparables.map((w) => w.description),
      ["2,000m test", "2,000m test", "2,000m test"],
    );
  });

  it("keeps only the latest eight comparable rows", () => {
    const rows = log(
      Array.from({ length: 12 }, (_, i): Row => [
        `2026-08-${String(i + 1).padStart(2, "0")}`,
        "Just Row",
        1200,
        3500,
        171,
      ]),
    );
    const got = comparableWorkouts(rows[11], rows);
    assert.equal(got.length, 8);
    assert.equal(got[0].sessionDate, "2026-08-04");
  });

  it("ignores later rows, so old sessions are judged by their own time", () => {
    const got = sessionInsights(bySlug("2026-08-18"), season);
    assert.ok(got.comparables.every((w) => w.sessionDate < "2026-08-18"));
  });
});

describe("ghostGapMeters / nextTarget", () => {
  const base: Baseline = {
    split: 120,
    workSeconds: 600,
    distanceM: 2500,
    watts: null,
    strokeRate: null,
    metersPerStroke: null,
  };

  it("is negative when behind the baseline pace", () => {
    const [w] = log([["2026-09-01", "Just Row", 600, 2400, 125]]);
    assert.equal(ghostGapMeters(w, base), -100);
  });

  it("returns null when the row has no time", () => {
    const [w] = log([["2026-09-01", "Just Row", 0, 2400, 125]]);
    assert.equal(nextTarget(w, base, []), null);
  });
});

describe("parseSegments", () => {
  it("reads 5-min splits, with the last segment covering the leftover time", () => {
    const segs = parseSegments("5-min splits 862 / 908 / 875 / 861 m", 1187, 3505)!;
    assert.deepEqual(
      segs.map((s) => [s.startSeconds, s.seconds, s.meters, s.partial]),
      [
        [0, 300, 862, false],
        [300, 300, 908, false],
        [600, 300, 875, false],
        [900, 287, 861, true],
      ],
    );
    assert.ok(Math.abs(segs[0].split - 174.0) < 0.05);
    // 861 m in 4:47 is quicker than any full segment.
    assert.ok(Math.abs(segs[3].split - 166.7) < 0.05);
  });

  it("handles a three-segment row (May 5, 14:31)", () => {
    const segs = parseSegments("5-min splits 836 / 849 / 750 m", 871, 2434)!;
    assert.equal(segs.length, 3);
    assert.equal(segs[2].seconds, 271);
    assert.equal(segs[2].partial, true);
  });

  it("treats a last segment of full length as full", () => {
    const segs = parseSegments("5-min splits 800 / 800 m", 600, 1600)!;
    assert.equal(segs[1].partial, false);
  });

  it("ignores notes without splits", () => {
    assert.equal(parseSegments("PM showed 3:25 /500m at the end (live split)", 1559, 4474), null);
    assert.equal(parseSegments("", 1187, 3505), null);
  });

  it("rejects splits that don't match the row", () => {
    // Four 5-min segments can't fit in 12 minutes.
    assert.equal(parseSegments("5-min splits 862 / 908 / 875 / 861 m", 720, 3505), null);
    // Two segments can't cover a 19:47 row.
    assert.equal(parseSegments("5-min splits 862 / 908 m", 1187, 3505), null);
    // Meters far off the logged distance.
    assert.equal(parseSegments("5-min splits 862 / 908 / 875 / 861 m", 1187, 5000), null);
  });
});

describe("pacing", () => {
  it("scores Sep 25 as a negative split with steady pacing", () => {
    const p = pacing(parseSegments("5-min splits 862 / 908 / 875 / 861 m", 1187, 3505)!)!;
    assert.ok(p.fade < 0, "finished faster than it started");
    assert.equal(p.evenness, "steady");
    assert.ok(Math.abs(p.split - (1187 / 3506) * 500) < 1e-9);
  });

  it("scores Aug 7 as even", () => {
    const p = pacing(parseSegments("5-min splits 872 / 864 / 871 / 865 m", 1193, 3470)!)!;
    assert.equal(p.evenness, "even");
  });

  it("measures a fade on Aug 18", () => {
    const p = pacing(parseSegments("5-min splits 886 / 854 / 899 / 721 m", 1152, 3360)!)!;
    assert.ok(Math.abs(p.fade - 0.0326) < 0.001);
  });

  it("feeds sessionInsights", () => {
    const row = {
      ...bySlug("2026-09-25"),
      workSeconds: 1187,
      notes: "5-min splits 862 / 908 / 875 / 861 m",
    };
    const got = sessionInsights(row, season);
    assert.equal(got.segments?.length, 4);
    assert.equal(got.pacing?.evenness, "steady");
    assert.equal(sessionInsights(bySlug("2026-09-25"), season).segments, null);
  });
});
