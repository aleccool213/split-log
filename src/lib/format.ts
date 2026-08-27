/** Concept 2 display helpers — splits, work time, meters. */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMeters(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return km >= 10 ? `${Math.round(km)}k m` : `${km.toFixed(km >= 10 ? 0 : 2).replace(/\.?0+$/, "")}k m`;
  }
  return `${m} m`;
}

export function formatMetersFull(m: number): string {
  if (!Number.isFinite(m)) return "—";
  return `${Math.round(m).toLocaleString("en-CA")} m`;
}

export function formatWorkTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const tenths = Math.round(totalSeconds * 10);
  const total = tenths / 10;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sStr = s.toFixed(1).padStart(4, "0");
  if (h > 0) return `${h}:${pad2(m)}:${sStr}`;
  return `${m}:${sStr}`;
}

export function formatSplit(splitSeconds: number | null | undefined): string {
  if (splitSeconds == null || !Number.isFinite(splitSeconds) || splitSeconds <= 0) {
    return "—";
  }
  const m = Math.floor(splitSeconds / 60);
  const s = splitSeconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function parseWorkTime(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length === 1) {
    const s = Number(parts[0]);
    return Number.isFinite(s) && s > 0 ? s : null;
  }
  if (parts.length === 2) {
    const m = Number(parts[0]);
    const s = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const s = Number(parts[2]);
    if (![h, m, s].every(Number.isFinite) || h < 0 || m < 0 || s < 0) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

export function parsePace(input: string): number | null {
  return parseWorkTime(input);
}

export function splitFromWork(distanceM: number, workSeconds: number): number | null {
  if (distanceM < 100 || workSeconds <= 0) return null;
  return (workSeconds / distanceM) * 500;
}

export function wattsFromSplit(splitSeconds: number): number | null {
  if (!Number.isFinite(splitSeconds) || splitSeconds <= 0) return null;
  const p = splitSeconds / 500;
  const w = 2.8 / p ** 3;
  return Number.isFinite(w) ? Math.round(w) : null;
}

export function caloriesFromWatts(watts: number, workSeconds: number): number | null {
  if (!Number.isFinite(watts) || workSeconds <= 0) return null;
  return Math.round((4 * watts + 300) * (workSeconds / 3600));
}

export function todayISO(timeZone = "America/Toronto"): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}
