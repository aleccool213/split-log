import { createHash } from "node:crypto";
import { getSql, hasDatabase } from "@/lib/db";
import { headerIndex, parseCsv, pick } from "@/lib/csv";
import {
  caloriesFromWatts,
  parseWorkTime,
  splitFromWork,
  wattsFromSplit,
} from "@/lib/format";
import { LOCAL_LOG_FILE, sourceKeyFor, toNumber, type Workout } from "@/lib/workouts";
import localCsv from "../../data/split-log.csv?raw";

export type SheetWorkout = Omit<Workout, "id">;

export type SyncResult =
  | { ok: true; imported: number; fileName: string; skipped?: false }
  | { ok: true; imported: number; fileName: string; skipped: true; reason: string }
  | { ok: false; error: string };

function csvHash(csv: string): string {
  return createHash("sha256").update(csv).digest("hex").slice(0, 32);
}

export function parseSheetRows(csv: string): SheetWorkout[] {
  const table = parseCsv(csv);
  if (table.length < 2) return [];
  const idx = headerIndex(table[0]);
  const out: SheetWorkout[] = [];
  for (const row of table.slice(1)) {
    const dateRaw = pick(idx, row, ["date", "workout date", "session date"]);
    const date = normalizeDate(dateRaw);
    if (!date) continue;
    const description = pick(idx, row, ["description", "workout", "name", "type"]) || "Just Row";
    const distance = toNumber(pick(idx, row, ["distance m", "distance", "work distance", "meters"])) ?? 0;
    const workRaw = pick(idx, row, ["work time", "time", "work time formatted", "duration"]);
    let workSeconds = parseWorkTime(workRaw) ?? 0;
    const paceRaw = pick(idx, row, ["pace", "split", "avg pace"]);
    const pace = parseWorkTime(paceRaw);
    if (!workSeconds && pace && distance >= 100) {
      workSeconds = (distance / 500) * pace;
    }
    if (distance < 100 || workSeconds <= 0) continue;
    const split = pace ?? splitFromWork(distance, workSeconds);
    const watts =
      toNumber(pick(idx, row, ["watts", "watt", "avg watts"])) ?? (split ? wattsFromSplit(split) : null);
    const calories =
      toNumber(pick(idx, row, ["calories", "calorie", "cal"])) ??
      (watts ? caloriesFromWatts(watts, workSeconds) : null);
    out.push({
      sourceKey: sourceKeyFor(date, description, distance, "sheet"),
      sessionDate: date,
      description,
      workSeconds: Math.round(workSeconds),
      distanceM: Math.round(distance),
      strokeRate: toNumber(pick(idx, row, ["stroke rate", "spm", "rate", "cadence"])),
      splitSeconds: split,
      watts,
      calories,
      avgHr: toNumber(pick(idx, row, ["avg hr", "heart rate", "hr", "heart"])),
      notes: pick(idx, row, ["notes", "comments", "comment"]),
      source: "sheet",
    });
  }
  return out;
}

export function loadCsvWorkouts(csv: string = localCsv): Workout[] {
  return parseSheetRows(csv)
    .map((row, i) => ({ ...row, id: i + 1 }))
    .sort((a, b) =>
      a.sessionDate === b.sessionDate ? b.id - a.id : a.sessionDate < b.sessionDate ? 1 : -1,
    );
}

function normalizeDate(raw: string): string | null {
  const t = raw.trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

export async function importRows(
  rows: SheetWorkout[],
  fileId: string | null,
  fileName: string,
): Promise<number> {
  const sql = await getSql();
  let imported = 0;
  for (const row of rows) {
    await sql`
      insert into workouts (
        source_key, session_date, description, work_seconds, distance_m,
        stroke_rate, split_seconds, watts, calories, avg_hr, notes, source
      ) values (
        ${row.sourceKey}, ${row.sessionDate}, ${row.description}, ${row.workSeconds},
        ${row.distanceM}, ${row.strokeRate}, ${row.splitSeconds}, ${row.watts}, ${row.calories},
        ${row.avgHr}, ${row.notes}, ${"sheet"}
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
    imported += 1;
  }
  await sql`
    update log_settings
    set sheet_file_id = coalesce(${fileId}, sheet_file_id),
        sheet_name = ${fileName},
        last_synced_at = now()
    where id = 1
  `;
  return imported;
}

async function storedHash(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ sheet_file_id: string | null }>`
    select sheet_file_id from log_settings where id = 1
  `;
  return rows[0]?.sheet_file_id ?? null;
}

export async function runSheetSync(opts?: { csv?: string; force?: boolean }): Promise<SyncResult> {
  const csv = (opts?.csv?.trim() || localCsv).trim();
  if (!csv) {
    return { ok: false, error: `No log file. Add rows to ${LOCAL_LOG_FILE} and push.` };
  }

  if (!hasDatabase()) {
    const rows = parseSheetRows(csv);
    if (rows.length === 0) {
      return { ok: false, error: `${LOCAL_LOG_FILE} had no workout rows to import.` };
    }
    return {
      ok: true,
      imported: rows.length,
      fileName: LOCAL_LOG_FILE,
      skipped: true,
      reason: "No DATABASE_URL — serving the CSV in-process.",
    };
  }

  const hash = `local:${csvHash(csv)}`;
  if (!opts?.force) {
    const prev = await storedHash();
    if (prev === hash) {
      return {
        ok: true,
        imported: 0,
        fileName: LOCAL_LOG_FILE,
        skipped: true,
        reason: "Log file unchanged.",
      };
    }
  }

  const rows = parseSheetRows(csv);
  if (rows.length === 0) {
    return { ok: false, error: `${LOCAL_LOG_FILE} had no workout rows to import.` };
  }
  const imported = await importRows(rows, hash, LOCAL_LOG_FILE);
  return { ok: true, imported, fileName: LOCAL_LOG_FILE };
}
