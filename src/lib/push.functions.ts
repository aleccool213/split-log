import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VAPID_PUBLIC_KEY } from "@/lib/push-vapid";
import { hasKv, isPushSub, savePushSub, type PushSub } from "@/lib/push-store";
import { sendToAll, sendToSub } from "@/lib/push-send";
import { loadFileSettings } from "@/lib/settings-file";
import { loadCsvWorkouts } from "@/lib/sheet-sync";
import { buildStats, SHEET_NAME } from "@/lib/workouts";

const subSchema = z.object({
  endpoint: z.string().min(8),
  keys: z.object({
    p256dh: z.string().min(8),
    auth: z.string().min(4),
  }),
});

function unwrapSub(input: unknown): PushSub {
  if (input && typeof input === "object" && "data" in input) {
    const inner = (input as { data: unknown }).data;
    if (inner && typeof inner === "object" && "endpoint" in inner) {
      return subSchema.parse(inner);
    }
  }
  return subSchema.parse(input);
}

export const getPushStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    publicKey: (process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY).trim(),
    kvReady: hasKv(),
    vapidReady: Boolean((process.env.VAPID_PRIVATE_KEY || "").trim()),
  };
});

export const saveSubscription = createServerFn({ method: "POST" }).handler(async (ctx) => {
  try {
    if (!hasKv()) return { ok: false as const, error: "Marketplace Redis is not connected on this deploy." };
    const data = unwrapSub((ctx as { data?: unknown }).data ?? ctx);
    if (!isPushSub(data)) return { ok: false as const, error: "Invalid subscription." };
    await savePushSub(data);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Could not save subscription." };
  }
});

export const sendTestPush = createServerFn({ method: "POST" }).handler(async (ctx) => {
  try {
    if (!hasKv()) return { ok: false as const, error: "Marketplace Redis is not connected. Add Redis in Vercel → Storage." };
    if (!(process.env.VAPID_PRIVATE_KEY || "").trim()) {
      return { ok: false as const, error: "VAPID_PRIVATE_KEY is not set on this Vercel project." };
    }
    const data = unwrapSub((ctx as { data?: unknown }).data ?? ctx);
    await savePushSub(data);
    const result = await sendToSub(data, {
      title: "Split Log — server test",
      body: "This came from Vercel, not the open app. Phone can stay locked.",
      url: "/",
    });
    return { ok: true as const, result };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Server test failed." };
  }
});

export async function runRemind(): Promise<{
  ok: boolean;
  skipped?: string;
  sent?: number;
  gone?: number;
}> {
  const file = loadFileSettings();
  const workouts = loadCsvWorkouts();
  const stats = buildStats(workouts, {
    sheetFileId: null,
    sheetName: SHEET_NAME,
    reminderDays: file.reminderDays,
    reminderEnabled: file.reminderEnabled,
    reminderTo: file.reminderTo,
    reminderToSet: Boolean(file.reminderTo),
    lastSyncedAt: null,
    lastNudgeAt: null,
  });
  if (!file.reminderEnabled) return { ok: true, skipped: "reminders off" };
  if (!stats.due) return { ok: true, skipped: "not due" };
  if (!hasKv()) return { ok: false, skipped: "no redis" };

  const days = stats.daysSince;
  const last = stats.lastWorkout;
  const body =
    days == null
      ? "First session of the block is waiting."
      : last
        ? `${days} day${days === 1 ? "" : "s"} off the water. Last: ${last.description} · ${last.distanceM.toLocaleString("en-CA")} m.`
        : `${days} days off the water.`;

  const result = await sendToAll({
    title: days == null ? "Time to row" : `Day ${days} — Split Log`,
    body,
    url: "/",
  });
  return { ok: true, ...result };
}
