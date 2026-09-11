import webpush from "web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/push-vapid";
import { listPushSubs, removePushSub, type PushSub } from "@/lib/push-store";

export type PushMessage = { title: string; body: string; url?: string };

function vapid() {
  const pub = (process.env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY).trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = (process.env.VAPID_SUBJECT || "mailto:alec@alec.coffee").trim();
  if (!priv) throw new Error("VAPID_PRIVATE_KEY is not set on Vercel.");
  webpush.setVapidDetails(subject, pub, priv);
}

export async function sendToSub(sub: PushSub, message: PushMessage): Promise<"sent" | "gone"> {
  vapid();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify({
        title: message.title,
        body: message.body,
        url: message.url ?? "/",
      }),
    );
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await removePushSub(sub.endpoint);
      return "gone";
    }
    throw err;
  }
}

export async function sendToAll(message: PushMessage): Promise<{ sent: number; gone: number }> {
  const subs = await listPushSubs();
  let sent = 0;
  let gone = 0;
  for (const sub of subs) {
    const result = await sendToSub(sub, message);
    if (result === "sent") sent += 1;
    else gone += 1;
  }
  return { sent, gone };
}
