import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { VAPID_PUBLIC_KEY } from "@/lib/push-vapid";
import { hasKv, isPushSub, savePushSub, type PushSub } from "@/lib/push-store";
import { sendToAll, sendToSub } from "@/lib/push-send";
import { loadFileSettings } from "@/lib/settings-file";
import { loadCsvWorkouts } from "@/lib/sheet-sync";
import { buildStats, SHEET_NAME } from "@/lib/workouts";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(8),
    auth: z.string().min(4),
  }),
});

export const getPushStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    publicKey: (process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY).trim(),
    kvReady: hasKv(),
    vapidReady: Boolean((process.env.VAPID_PRIVATE_KEY || "").trim()),
  };
});

export const saveSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasKv()) throw new Error("Marketplace Redis is not connected on this deploy.");
    await savePushSub(data);
    return { ok: true as const };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => subSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasKv()) throw new Error("Marketplace Redis is not connected on this deploy.");
    await savePushSub(data);
    const result = await sendToSub(data, {
      title: "Split Log — server test",
      body: "This came from Vercel, not the open app. Phone can stay locked.",
      url: "/",
    });
    return { ok: true as const, result };
  });

export async function runRemind(): Promise<{
  ok: boolean;
  skipped?: string;
  sent?: number;
  gone?: number;
}> {
  const file = loadFileSettings();
  const workouts = await loadCsvWorkouts();
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

export function parseSub(input: unknown): PushSub {
  const data = subSchema.parse(input);
  if (!isPushSub(data)) throw new Error("Invalid subscription");
  return data;
}
