import { createServerFn } from "@tanstack/react-start";
import { getSql, hasDatabase } from "@/lib/db";
import {
  classifyCallToolError,
  ConnectorType,
  GmailTools,
  GoogleCalendarTools,
  isLoginRequired,
} from "@/lib/app-data";
import { loadFileSettings } from "@/lib/settings-file";
import {
  buildStats,
  SHEET_NAME,
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
  const file = loadFileSettings();
  return {
    sheetFileId: row?.sheet_file_id ?? null,
    sheetName: row?.sheet_name ?? SHEET_NAME,
    reminderDays: file.reminderDays,
    reminderEnabled: file.reminderEnabled,
    reminderTo: file.reminderTo,
    reminderToSet: Boolean(file.reminderTo),
    lastSyncedAt: stamp(row?.last_synced_at ?? null),
    lastNudgeAt: stamp(row?.last_nudge_at ?? null),
  };
}

async function loadWorkouts(): Promise<Workout[]> {
  if (!hasDatabase()) {
    const { loadCsvWorkouts } = await import("@/lib/sheet-sync");
    return loadCsvWorkouts();
  }
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
  const file = loadFileSettings();
  if (!hasDatabase()) {
    return {
      sheetFileId: null,
      sheetName: SHEET_NAME,
      reminderDays: file.reminderDays,
      reminderEnabled: file.reminderEnabled,
      reminderTo: file.reminderTo,
      reminderToSet: Boolean(file.reminderTo),
      lastSyncedAt: new Date().toISOString(),
      lastNudgeAt: null,
    };
  }
  const sql = await getSql();
  const rows = await sql<SettingsRow>`
    select sheet_file_id, sheet_name, reminder_days, reminder_enabled,
           last_synced_at, last_nudge_at
    from log_settings where id = 1
  `;
  return mapSettings(rows[0]);
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  if (hasDatabase()) {
    try {
      const { runSheetSync } = await import("@/lib/sheet-sync");
      await runSheetSync();
    } catch {
      // Board still renders from whatever is already in the log.
    }
  }
  const [workouts, settings] = await Promise.all([loadWorkouts(), loadSettings()]);
  return {
    workouts,
    settings: { ...settings, reminderTo: "" },
    stats: buildStats(workouts, settings),
  };
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
  if (!hasDatabase()) {
    return {
      ok: false as const,
      error: "Reminders need DATABASE_URL (Neon) plus an email provider on Vercel.",
    };
  }
  const { callTool } = await import("@/lib/app-data/client.server");
  const [workouts, settings] = await Promise.all([loadWorkouts(), loadSettings()]);
  const stats = buildStats(workouts, settings);

  if (!settings.reminderEnabled) {
    return { ok: false as const, error: "Reminders are off in data/settings.json." };
  }

  if (settings.lastNudgeAt) {
    const last = Date.parse(settings.lastNudgeAt);
    if (Number.isFinite(last) && Date.now() - last < 12 * 60 * 60 * 1000) {
      return { ok: false as const, error: "A nudge already went out in the last 12 hours." };
    }
  }

  let to = settings.reminderTo;
  if (!to) {
    const cal = await callTool(
      GoogleCalendarTools.listCalendars,
      { max_results: 20 },
      { connectorType: ConnectorType.GoogleCalendar },
    );
    if (isLoginRequired(cal)) {
      return { ok: false as const, loginRequired: true, loginUrl: cal.loginUrl, error: cal.errorMessage };
    }
    to = emailFromUnknown(cal.data) ?? "";
    if (!to) {
      const classified = classifyCallToolError(cal);
      return {
        ok: false as const,
        error:
          classified?.message ??
          "Set reminderTo in data/settings.json, or connect Google Calendar so we can find an address.",
      };
    }
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
