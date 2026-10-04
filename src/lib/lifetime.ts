import { z } from "zod";

const clock = /^\d+:[0-5]\d:[0-5]\d$/;
const split = /^\d+:[0-5]\d(\.\d)?$/;

const schema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lifetimeMeters: z.number().int().nonnegative(),
  logbookMeters: z.number().int().nonnegative(),
  logbookTime: z.string().regex(clock),
  workouts: z.number().int().positive(),
  avgSplit: z.string().regex(split),
  intervalRestMeters: z.number().int().nonnegative(),
});

export type LifetimeStats = {
  asOf: string;
  lifetimeMeters: number;
  logbookMeters: number;
  logbookSeconds: number;
  workouts: number;
  avgSplitSeconds: number;
  metersPerWorkout: number;
  secondsPerWorkout: number;
  intervalRestMeters: number;
};

export function parseLifetime(text: string): LifetimeStats | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    const d = parsed.data;
    const [h, m, s] = d.logbookTime.split(":").map(Number);
    const logbookSeconds = h * 3600 + m * 60 + s;
    const [sm, ss] = d.avgSplit.split(":");
    return {
      asOf: d.asOf,
      lifetimeMeters: d.lifetimeMeters,
      logbookMeters: d.logbookMeters,
      logbookSeconds,
      workouts: d.workouts,
      avgSplitSeconds: Number(sm) * 60 + Number(ss),
      metersPerWorkout: Math.round(d.logbookMeters / d.workouts),
      secondsPerWorkout: Math.round(logbookSeconds / d.workouts),
      intervalRestMeters: d.intervalRestMeters,
    };
  } catch {
    return null;
  }
}
