import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  classifyCallToolError,
  ConnectorType,
  GmailTools,
  GoogleCalendarTools,
  isLoginRequired,
} from "@/lib/app-data";
import {
  caloriesFromWatts,
  parseWorkTime,
  splitFromWork,
  wattsFromSplit,
} from "@/lib/format";
import {
  buildStats,
  SHEET_NAME,
  sourceKeyFor,
  toNumber,
  type LogSettings,
  type Workout,
} from "@/lib/workouts";

type WorkoutRow = {
  id: number;
  source_key: string;
  session_date: string;
  description: string;
  work_seconds: number;
  distance_m: number;
  stroke_rate: number | null;
  split_seconds: string | number | null;
  watts: number | null;
  calories: number | null;
  avg_hr: number | null;
  notes: string;
  source: string;
};

type SettingsRow = {
  sheet_file_id: string | null;
  sheet_name: string;
  reminder_days: number;
  reminder_enabled: boolean;
  last_synced_at: string | Date | null;
  last_nudge_at: string | Date | null;
};

function mapWorkout(row: WorkoutRow): Workout {
  const split = toNumber(row.split_seconds);
  return {
    id: row.id,
    sourceKey: row.source_key,
    sessionDate: String(row.session_date).slice(0, 10),
    description: row.description ?? "",
    workSeconds: Number(row.work_seconds) || 0,
    distanceM: Number(row.distance_m) || 0,
    strokeRate: row.stroke_rate == null ? null : Number(row.stroke_rate),
    splitSeconds: split,
    watts: row.watts == null ? null : Number(row.watts),
    calories: row.calories == null ? null : Number(row.calories),
    avgHr: row.avg_hr == null ? null : Number(row.avg_hr),
    notes: row.notes ?? "",
    source: row.source,
  };
}

function stamp(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function mapSettings(row: SettingsRow | undefined): LogSettings {
  return {
    sheetFileId: row?.sheet_file_id ?? null,
    sheetName: row?.sheet_name ?? SHEET_NAME,
    reminderDays: row?.reminder_days ?? 3,
    reminderEnabled: row?.reminder_enabled ?? true,
    lastSyncedAt: stamp(row?.last_synced_at ?? null),
    lastNudgeAt: stamp(row?.last_nudge_at ?? null),
  };
}

async function loadWorkouts(): Promise<Workout[]> {
  const sql = await getSql();
  const rows = await sql<WorkoutRow>`
    select id, source_key, session_date, description, work_seconds, distance_m,
           stroke_rate, split_seconds, watts, calories, avg_hr, notes, source
    from workouts
    order by session_date desc, id desc
  `;
  return rows.map(mapWorkout);
}

async function loadSettings(): Promise<LogSettings> {
  const sql = await getSql();
  const rows = await sql<SettingsRow>`
    select sheet_file_id, sheet_name, reminder_days, reminder_enabled,
           last_synced_at, last_nudge_at
    from log_settings where id = 1
  `;
  return mapSettings(rows[0]);
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { runSheetSync } = await import("@/lib/sheet-sync");
    await runSheetSync();
  } catch {
    // Board still renders from whatever is already in the log.
  }
  const [workouts, settings] = await Promise.all([loadWorkouts(), loadSettings()]);
  return { workouts, settings, stats: buildStats(workouts, settings) };
});

const logSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(120),
  workTime: z.string().trim().min(1).max(16),
  distanceM: z.number().int().min(100).max(200000),
  strokeRate: z.number().int().min(10).max(50).nullable(),
  avgHr: z.number().int().min(40).max(220).nullable(),
  notes: z.string().trim().max(280).default(""),
});

export const logWorkout = createServerFn({ method: "POST" })
  .validator(logSchema)
  .handler(async ({ data }) => {
    const workSeconds = parseWorkTime(data.workTime);
    if (!workSeconds) throw new Error("Work time looks off — try 20:28.0 or 7:28.4");
    const split = splitFromWork(data.distanceM, workSeconds);
    const watts = split ? wattsFromSplit(split) : null;
    const calories = watts ? caloriesFromWatts(watts, workSeconds) : null;
    const sourceKey = sourceKeyFor(data.sessionDate, data.description, data.distanceM, "manual");
    const sql = await getSql();
    await sql`
      insert into workouts (
        source_key, session_date, description, work_seconds, distance_m,
        stroke_rate, split_seconds, watts, calories, avg_hr, notes, source
      ) values (
        ${sourceKey}, ${data.sessionDate}, ${data.description}, ${Math.round(workSeconds)},
        ${data.distanceM}, ${data.strokeRate}, ${split}, ${watts}, ${calories},
        ${data.avgHr}, ${data.notes}, ${"manual"}
      )
      on conflict (source_key) do update set
        work_seconds = excluded.work_seconds,
        stroke_rate = excluded.stroke_rate,
        split_seconds = excluded.split_seconds,
        watts = excluded.watts,
        calories = excluded.calories,
        avg_hr = excluded.avg_hr,
        notes = excluded.notes
    `;
    return { ok: true as const };
  });

const settingsSchema = z.object({
  reminderDays: z.number().int().min(1).max(14),
  reminderEnabled: z.boolean(),
});

export const updateSettings = createServerFn({ method: "POST" })
  .validator(settingsSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update log_settings
      set reminder_days = ${data.reminderDays},
          reminder_enabled = ${data.reminderEnabled}
      where id = 1
    `;
    return { ok: true as const };
  });

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function emailFromUnknown(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const calendars = (rec.calendars ?? rec.items ?? rec.data) as unknown;
  const list = Array.isArray(calendars) ? calendars : [];
  for (const cal of list) {
    if (!cal || typeof cal !== "object") continue;
    const c = cal as Record<string, unknown>;
    if (c.primary === true && typeof c.id === "string" && looksLikeEmail(c.id)) return c.id;
  }
  for (const cal of list) {
    if (!cal || typeof cal !== "object") continue;
    const c = cal as Record<string, unknown>;
    if (typeof c.id === "string" && looksLikeEmail(c.id)) return c.id;
  }
  return null;
}

export const sendNudge = createServerFn({ method: "POST" }).handler(async () => {
  const { callTool } = await import("@/lib/app-data/client.server");
  const [workouts, settings] = await Promise.all([loadWorkouts(), loadSettings()]);
  const stats = buildStats(workouts, settings);

  if (settings.lastNudgeAt) {
    const last = Date.parse(settings.lastNudgeAt);
    if (Number.isFinite(last) && Date.now() - last < 12 * 60 * 60 * 1000) {
      return { ok: false as const, error: "A nudge already went out in the last 12 hours." };
    }
  }

  const cal = await callTool(
    GoogleCalendarTools.listCalendars,
    { max_results: 20 },
    { connectorType: ConnectorType.GoogleCalendar },
  );
  if (isLoginRequired(cal)) {
    return { ok: false as const, loginRequired: true, loginUrl: cal.loginUrl, error: cal.errorMessage };
  }
  const to = emailFromUnknown(cal.data);
  if (!to) {
    const classified = classifyCallToolError(cal);
    return {
      ok: false as const,
      error: classified?.message ?? "Could not find a connected email to send the nudge to.",
    };
  }

  const days = stats.daysSince;
  const last = stats.lastWorkout;
  const subject = days == null ? "Time to row — Split Log" : `Day ${days} off the water — Split Log`;
  const lastLine = last
    ? `Last session: ${last.sessionDate} · ${last.description} · ${last.distanceM.toLocaleString("en-CA")} m.`
    : "The log is empty — first session of the block is the hardest one to start.";
  const body = [
    "The tank is waiting.",
    "",
    lastLine,
    days == null ? "" : `That's ${days} day${days === 1 ? "" : "s"} since you last sat down.`,
    "",
    "Twenty minutes of steady state counts. Log it in Split Log or add a row to the log file.",
    "",
    "— Split Log",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const sent = await callTool(
    GmailTools.sendMessage,
    { to: [to], subject, body },
    { connectorType: ConnectorType.Gmail },
  );
  if (isLoginRequired(sent)) {
    return { ok: false as const, loginRequired: true, loginUrl: sent.loginUrl, error: sent.errorMessage };
  }
  if (!sent.ok) {
    const classified = classifyCallToolError(sent);
    return { ok: false as const, error: classified?.message ?? sent.errorMessage ?? "Gmail could not send." };
  }

  const sql = await getSql();
  await sql`update log_settings set last_nudge_at = now() where id = 1`;
  return { ok: true as const };
});
