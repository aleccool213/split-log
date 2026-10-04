import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseLifetime } from "./lifetime.ts";

const file = readFileSync(new URL("../../data/lifetime.json", import.meta.url), "utf8");

test("data/lifetime.json parses and derives per-workout averages like the PM5", () => {
  const l = parseLifetime(file);
  assert.ok(l);
  assert.equal(l.logbookSeconds, 42 * 3600 + 16 * 60 + 21);
  assert.equal(l.metersPerWorkout, 1843);
  assert.equal(l.secondsPerWorkout, 11 * 60 + 16);
  assert.equal(l.avgSplitSeconds, 183.4);
});

test("malformed lifetime data yields null", () => {
  assert.equal(parseLifetime("{}"), null);
  assert.equal(parseLifetime("nope"), null);
});
