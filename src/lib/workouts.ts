import {
  addDaysISO,
  daysBetween,
  mondayOf,
  splitFromWork,
  todayISO,
  wattsFromSplit,
} from "./format";

export const SHEET_NAME = "Split Log — Concept 2";
export const LOCAL_LOG_FILE = "data/split-log.csv";
export const TZ = "America/Toronto";

export type Workout = {
  id: number;
  sourceKey: string;
  sessionDate: string;
  description: string;
  workSeconds: number;
  distanceM: number;
  strokeRate: number | null;
  splitSeconds: number | null;
  watts: number | null;
  calories: number | null;
  avgHr: number | null;
  notes: string;
  source: string;
};

export type LogSettings = {
  sheetFileId: string | null;
  sheetName: string;
  reminderDays: number;
  reminderEnabled: boolean;
  reminderTo: string;
  reminderToSet: boolean;
  lastSyncedAt: string | null;
  lastNudgeAt: string | null;
};

export type WeeklyPoint = {
  weekStart: string;
  meters: number;
  sessions: number;
  avgSplit: number | null;
};

export type PersonalBest = {
  label: string;
  distanceM: number;
  workout: Workout | null;
};

export type DashboardStats = {
  today: string;
  totalMeters: number;
  totalSessions: number;
  totalSeconds: number;
  weekMeters: number;
  lastWeekMeters: number;
  weekSessions: number;
  daysSince: number | null;
  lastWorkout: Workout | null;
  due: boolean;
  streakWeeks: number;
  avgSplit7: number | null;
  weekly: WeeklyPoint[];
  pbs: PersonalBest[];
};

export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function inferredSplit(w: Pick<Workout, "distanceM" | "workSeconds" | "splitSeconds">): number | null {
  if (w.splitSeconds && w.splitSeconds > 0) return w.splitSeconds;
  return splitFromWork(w.distanceM, w.workSeconds);
}

export function inferredWatts(w: Workout): number | null {
  if (w.watts && w.watts > 0) return w.watts;
  const split = inferredSplit(w);
  return split ? wattsFromSplit(split) : null;
}

function isDistancePiece(w: Workout, meters: number): boolean {
  if (w.distanceM === meters) return true;
  const d = w.description.toLowerCase();
  if (meters === 2000) return /\b2,?000m\b|\b2k\b/.test(d) && w.distanceM >= 1900 && w.distanceM <= 2100;
  if (meters === 5000) return /\b5,?000m\b|\b5k\b/.test(d) && w.distanceM >= 4800 && w.distanceM <= 5200;
  if (meters === 10000) return /\b10,?000m\b|\b10k\b/.test(d) && w.distanceM >= 9600 && w.distanceM <= 10400;
  return false;
}

function bestForDistance(workouts: Workout[], meters: number): Workout | null {
  const candidates = workouts.filter((w) => isDistancePiece(w, meters) && w.workSeconds > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, w) => (w.workSeconds < best.workSeconds ? w : best));
}

export function buildStats(workouts: Workout[], settings: LogSettings): DashboardStats {
  const today = todayISO(TZ);
  const weekStart = mondayOf(today);
  const lastWeekStart = addDaysISO(weekStart, -7);
  const last7 = addDaysISO(today, -6);

  let totalMeters = 0;
  let totalSeconds = 0;
  let weekMeters = 0;
  let lastWeekMeters = 0;
  let weekSessions = 0;
  const split7: number[] = [];
  const byWeek = new Map<string, { meters: number; sessions: number; splits: number[] }>();

  const sorted = [...workouts].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  const lastWorkout = sorted[sorted.length - 1] ?? null;

  for (const w of sorted) {
    totalMeters += w.distanceM;
    totalSeconds += w.workSeconds;
    const wk = mondayOf(w.sessionDate);
    const bucket = byWeek.get(wk) ?? { meters: 0, sessions: 0, splits: [] };
    bucket.meters += w.distanceM;
    bucket.sessions += 1;
    const split = inferredSplit(w);
    if (split) bucket.splits.push(split);
    byWeek.set(wk, bucket);

    if (w.sessionDate >= weekStart) {
      weekMeters += w.distanceM;
      weekSessions += 1;
    } else if (w.sessionDate >= lastWeekStart) {
      lastWeekMeters += w.distanceM;
    }
    if (w.sessionDate >= last7 && split) split7.push(split);
  }

  const weekly: WeeklyPoint[] = [];
  // 12 weeks ending this week
  for (let i = 11; i >= 0; i -= 1) {
    const start = addDaysISO(weekStart, -7 * i);
    const b = byWeek.get(start);
    const avg =
      b && b.splits.length
        ? b.splits.reduce((s, x) => s + x, 0) / b.splits.length
        : null;
    weekly.push({
      weekStart: start,
      meters: b?.meters ?? 0,
      sessions: b?.sessions ?? 0,
      avgSplit: avg,
    });
  }

  let streakWeeks = 0;
  for (let i = weekly.length - 1; i >= 0; i -= 1) {
    if (weekly[i].sessions >= 2) streakWeeks += 1;
    else if (i === weekly.length - 1 && weekly[i].sessions === 0) continue; // current week still open
    else break;
  }

  const daysSince = lastWorkout ? daysBetween(lastWorkout.sessionDate, today) : null;
  const due =
    settings.reminderEnabled &&
    (daysSince == null || daysSince >= settings.reminderDays);

  return {
    today,
    totalMeters,
    totalSessions: workouts.length,
    totalSeconds,
    weekMeters,
    lastWeekMeters,
    weekSessions,
    daysSince,
    lastWorkout,
    due,
    streakWeeks,
    avgSplit7: split7.length ? split7.reduce((s, x) => s + x, 0) / split7.length : null,
    weekly,
    pbs: [
      { label: "2k", distanceM: 2000, workout: bestForDistance(workouts, 2000) },
      { label: "5k", distanceM: 5000, workout: bestForDistance(workouts, 5000) },
      { label: "10k", distanceM: 10000, workout: bestForDistance(workouts, 10000) },
    ],
  };
}

export function sourceKeyFor(date: string, description: string, distanceM: number, source: string): string {
  return `${source}:${date}:${description.trim()}:${distanceM}`;
}
