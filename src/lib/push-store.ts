import { createHash } from "node:crypto";
import { hasKv, kvCommand } from "@/lib/kv";

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

const SET_KEY = "split-log:push:endpoints";

function idFor(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 24);
}

function recKey(id: string): string {
  return `split-log:push:sub:${id}`;
}

export function isPushSub(value: unknown): value is PushSub {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const keys = v.keys as Record<string, unknown> | undefined;
  return (
    typeof v.endpoint === "string" &&
    Boolean(keys) &&
    typeof keys?.p256dh === "string" &&
    typeof keys?.auth === "string"
  );
}

export async function savePushSub(sub: PushSub): Promise<void> {
  const id = idFor(sub.endpoint);
  await kvCommand(["SET", recKey(id), JSON.stringify(sub)]);
  await kvCommand(["SADD", SET_KEY, id]);
}

export async function removePushSub(endpoint: string): Promise<void> {
  const id = idFor(endpoint);
  await kvCommand(["DEL", recKey(id)]);
  await kvCommand(["SREM", SET_KEY, id]);
}

export async function listPushSubs(): Promise<PushSub[]> {
  const ids = (await kvCommand<string[]>(["SMEMBERS", SET_KEY])) ?? [];
  const out: PushSub[] = [];
  for (const id of ids) {
    const raw = await kvCommand<string | PushSub | null>(["GET", recKey(id)]);
    if (!raw) continue;
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (isPushSub(parsed)) out.push(parsed);
  }
  return out;
}

export { hasKv };
