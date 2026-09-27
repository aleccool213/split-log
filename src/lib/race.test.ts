import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionInsights } from "./insights.ts";
import { legsFor, race, raceLine, raceRivals } from "./race.ts";
import { withSlugs, type Workout } from "./workouts.ts";

type Row = [date: string, workSeconds: number, distanceM: number, split: number, notes?: string];

function log(rows: Row[]): Workout[] {
  return withSlugs(
    rows.map(([sessionDate, workSeconds, distanceM, splitSeconds, notes], i) => ({
      id: i + 1,
      sourceKey: `test:${i}`,
      sessionDate,
      description: "Just Row",
      workSeconds,
      distanceM,
      strokeRate: null,
      splitSeconds,
      watts: null,
      calories: null,
      avgHr: null,
      notes: notes ?? "",
      source: "sheet",
    })),
  );
}

// data/split-log.csv as of Sep 25, 2026, work time rounded as the loader does.
const season = log([
  ["2026-05-05", 871, 2434, 178.9, "5-min splits 836 / 849 / 750 m"],
  ["2026-07-04", 1151, 3217, 178.8, "5-min splits 741 / 882 / 863 / 731 m"],
  ["2026-08-07", 1193, 3470, 171.9, "5-min splits 872 / 864 / 871 / 865 m"],
  ["2026-08-18", 1152, 3360, 171.4, "5-min splits 886 / 854 / 899 / 721 m"],
  ["2026-08-27", 1196, 3627, 164.8, "5-min splits 893 / 946 / 914 / 874 m"],
  ["2026-09-09", 1559, 4474, 174.2, "PM showed 3:25 /500m at the end (live split)"],
  ["2026-09-15", 1157, 3413, 169.5, "5-min splits 832 / 914 / 878 / 790 m"],
  ["2026-09-25", 1187, 3505, 169.2, "5-min splits 862 / 908 / 875 / 861 m"],
]);
const sep25 = season[7];

describe("legsFor", () => {
  it("uses logged splits, scaled to finish on the logged distance", () => {
    const legs = legsFor(sep25);
    assert.equal(legs.length, 4);
    assert.deepEqual(
      legs.map((l) => l.seconds),
      [300, 300, 300, 287],
    );
    const total = legs.reduce((s, l) => s + l.meters, 0);
    assert.ok(Math.abs(total - 3505) < 1e-9);
  });

  it("falls back to an even pace", () => {
    assert.deepEqual(legsFor(season[5]), [{ seconds: 1559, meters: 4474 }]);
  });
});

describe("raceRivals", () => {
  const base = sessionInsights(sep25, season).baseline;
  const rivals = raceRivals(sep25, season, base);

  it("offers usual you, your best, the last row, then the rest newest first", () => {
    assert.deepEqual(
      rivals.map((r) => [r.id, r.kind]),
      [
        ["usual", "usual"],
        ["2026-08-27", "best"],
        ["2026-09-15", "last"],
        ["2026-09-09", "row"],
        ["2026-08-18", "row"],
        ["2026-08-07", "row"],
        ["2026-07-04", "row"],
        ["2026-05-05", "row"],
      ],
    );
    assert.equal(rivals[1].label, "Your best · Aug 27 · 3,627 m");
    assert.equal(rivals[1].name, "Aug 27");
  });

  it("paces usual you evenly at the baseline over this row's time", () => {
    const usual = rivals[0];
    assert.equal(usual.workSeconds, 1187);
    assert.equal(Math.round(usual.legs[0].meters), 3463);
  });

  it("skips usual you without a baseline, and the last row on the first one", () => {
    assert.equal(raceRivals(sep25, season, null)[0].id, "2026-08-27");
    const first = raceRivals(season[0], season, null);
    assert.ok(first.every((r) => r.kind !== "last"));
    assert.ok(!first.some((r) => r.id === season[0].slug));
  });
});

describe("race", () => {
  it("scores Sep 25 against usual you", () => {
    const rivals = raceRivals(sep25, season, sessionInsights(sep25, season).baseline);
    const r = race(legsFor(sep25), 1187, rivals[0].legs, rivals[0].workSeconds);
    assert.equal(r.cut, false);
    assert.equal(r.gap, 42);
    assert.equal(raceLine(r, rivals[0], "19:47"), "You beat usual you by 42 m");
  });

  it("loses to the Aug 27 best, over the first 19:47", () => {
    const aug27 = season[4];
    const r = race(legsFor(sep25), 1187, legsFor(aug27), aug27.workSeconds);
    assert.equal(r.seconds, 1187);
    assert.ok(r.gap < 0);
    assert.match(raceLine(r, { name: "Aug 27" }, "19:47"), /^Aug 27 wins by \d+ m$/);
  });

  it("stops at the shorter row's time", () => {
    const may5 = season[0];
    const r = race(legsFor(sep25), 1187, legsFor(may5), may5.workSeconds);
    assert.equal(r.seconds, 871);
    assert.equal(r.cut, true);
    assert.equal(Math.round(r.rival), 2434);
    assert.match(raceLine(r, { name: "May 5" }, "14:31"), /over the first 14:31$/);
  });

  it("calls a dead heat", () => {
    const legs = [{ seconds: 600, meters: 2000 }];
    const r = race(legs, 600, legs, 600);
    assert.equal(raceLine(r, { name: "usual you" }, "10:00"), "Dead heat with usual you");
  });
});
