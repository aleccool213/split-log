import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COURSE_METERS,
  distanceAt,
  frameAt,
  lapOf,
  lastLandmark,
  newLandmarks,
  nextLandmark,
  pathBetween,
  pointAtDistance,
  VIEW,
} from "./course.ts";

describe("pointAtDistance", () => {
  it("starts at the first control point and ends at the harbour", () => {
    const start = pointAtDistance(0);
    const end = pointAtDistance(COURSE_METERS);
    assert.deepEqual([Math.round(start.x), Math.round(start.y)], [22, 212]);
    assert.deepEqual([Math.round(end.x), Math.round(end.y)], [374, 46]);
  });

  it("keeps a fixed scale: equal meters cover equal path length", () => {
    const step = 50;
    const gaps: number[] = [];
    for (let m = 0; m < COURSE_METERS; m += step) {
      const a = pointAtDistance(m);
      const b = pointAtDistance(m + step);
      gaps.push(Math.hypot(b.x - a.x, b.y - a.y));
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    // Chords on curves come out slightly short; never by much.
    assert.ok(gaps.every((g) => g > mean * 0.9 && g < mean * 1.05));
  });

  it("stays inside the map", () => {
    for (let m = 0; m <= COURSE_METERS; m += 100) {
      const p = pointAtDistance(m);
      assert.ok(p.x >= 0 && p.x <= VIEW.width && p.y >= 0 && p.y <= VIEW.height, `${m} m`);
    }
  });

  it("wraps onto the next lap", () => {
    assert.deepEqual(pointAtDistance(12_500), pointAtDistance(2500));
  });
});

describe("lapOf", () => {
  it("keeps a finish on the line in the lap it closes", () => {
    assert.deepEqual(lapOf(10_000), { lap: 0, meters: 10_000 });
    assert.deepEqual(lapOf(10_001), { lap: 1, meters: 1 });
    assert.deepEqual(lapOf(0), { lap: 0, meters: 0 });
  });
});

describe("pathBetween", () => {
  it("draws from the start to the boat", () => {
    const d = pathBetween(0, 3505);
    assert.match(d, /^M22\.0 212\.0 L/);
    const end = pointAtDistance(3505);
    assert.ok(d.endsWith(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`));
  });
});

describe("distanceAt", () => {
  const legs = [
    { seconds: 300, meters: 862 },
    { seconds: 300, meters: 908 },
    { seconds: 300, meters: 875 },
    { seconds: 287, meters: 861 },
  ];

  it("follows each leg's pace", () => {
    assert.equal(distanceAt(legs, 0), 0);
    assert.equal(distanceAt(legs, 150), 431);
    assert.equal(distanceAt(legs, 300), 862);
    assert.equal(distanceAt(legs, 450), 862 + 454);
    assert.equal(distanceAt(legs, 1187), 3506);
  });

  it("stops at the finish", () => {
    assert.equal(distanceAt(legs, 5000), 3506);
  });
});

describe("landmarks", () => {
  it("names where a row got to and what's next", () => {
    assert.equal(lastLandmark(3505)?.name, "The Narrows");
    assert.equal(nextLandmark(3505)?.name, "Stone Bridge");
    assert.equal(lastLandmark(900), null);
    assert.equal(nextLandmark(10_000), null);
  });

  it("flags landmarks no earlier row reached", () => {
    // Sep 9 (4,474 m) was the first row past Stone Bridge.
    assert.deepEqual(
      newLandmarks(4474, 3627).map((l) => l.name),
      ["Stone Bridge"],
    );
    assert.deepEqual(newLandmarks(3505, 4474), []);
    assert.deepEqual(
      newLandmarks(2434, 0).map((l) => l.name),
      ["Willow Bend"],
    );
  });
});

describe("frameAt", () => {
  const opts = { durationMs: 8000, holdMs: 1500, fadeMs: 500 };

  it("rows, holds at the finish, fades, then starts over", () => {
    assert.equal(frameAt(0, opts).phase, "rowing");
    assert.equal(frameAt(4000, opts).progress, 0.5);
    const hold = frameAt(8750, opts);
    assert.deepEqual([hold.phase, hold.progress, hold.phaseProgress], ["hold", 1, 0.5]);
    const fade = frameAt(9750, opts);
    assert.deepEqual([fade.phase, fade.phaseProgress], ["fade", 0.5]);
    const again = frameAt(10_000 + 2000, opts);
    assert.deepEqual([again.phase, again.progress], ["rowing", 0.25]);
    assert.equal(again.clock, 12_000);
  });
});
