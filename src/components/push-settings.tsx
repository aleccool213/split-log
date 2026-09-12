import { useEffect, useState } from "react";
import { Bell, BellRing, Cloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  enableNotifications,
  hasNotificationApi,
  pushEnvironment,
  sendDebugNotification,
  subscribePush,
  type PushEnv,
} from "@/lib/push-client";
import { getPushStatus, saveSubscription, sendTestPush } from "@/lib/push.functions";

function failMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export function PushSettings() {
  const [env, setEnv] = useState<PushEnv | null>(null);
  const [permission, setPermission] = useState<string>("unknown");
  const [kvReady, setKvReady] = useState<boolean | null>(null);
  const [vapidReady, setVapidReady] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnv(pushEnvironment());
    setPermission(hasNotificationApi() ? Notification.permission : "hidden until installed");
    void getPushStatus()
      .then((s) => {
        setKvReady(s.kvReady);
        setVapidReady(s.vapidReady);
      })
      .catch((err) => setLastError(failMessage(err)));
  }, []);

  async function onEnable() {
    setBusy(true);
    setLastError(null);
    try {
      const next = await enableNotifications();
      setPermission(next);
      setEnv(pushEnvironment());
      const sub = await subscribePush();
      const saved = await saveSubscription({ data: sub } as never);
      if (saved && "ok" in saved && saved.ok === false) throw new Error(saved.error);
      toast.success("This iPhone is subscribed for closed-app reminders");
    } catch (err) {
      const message = failMessage(err);
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onLocalTest() {
    setBusy(true);
    setLastError(null);
    try {
      await sendDebugNotification();
      toast.success("Local banner sent");
    } catch (err) {
      const message = failMessage(err);
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onServerTest() {
    setBusy(true);
    setLastError(null);
    try {
      const sub = await subscribePush();
      const result = await sendTestPush({ data: sub } as never);
      if (!result.ok) throw new Error(result.error);
      toast.success(result.result === "gone" ? "Subscription expired — tap Allow again" : "Server push sent — lock the phone and wait a second");
    } catch (err) {
      const message = failMessage(err);
      setLastError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">This device</dt>
          <dd className="font-medium">{env?.label ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-muted">Permission</dt>
          <dd className="font-medium capitalize">{permission}</dd>
        </div>
        <div>
          <dt className="text-muted">Redis</dt>
          <dd className="font-medium">{kvReady == null ? "…" : kvReady ? "Connected" : "Not connected"}</dd>
        </div>
        <div>
          <dt className="text-muted">VAPID</dt>
          <dd className="font-medium">{vapidReady == null ? "…" : vapidReady ? "Ready" : "Private key missing"}</dd>
        </div>
      </dl>
      {env?.hint ? <p className="text-sm text-muted">{env.hint}</p> : null}
      {kvReady === false ? (
        <p className="text-sm text-muted">
          Server test needs Redis. Vercel project → Storage → Create → Redis. Also set VAPID_PRIVATE_KEY.
        </p>
      ) : null}
      {lastError ? <p className="text-sm text-danger">{lastError}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onEnable}>
          <Bell />
          Allow + subscribe
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onLocalTest}>
          <BellRing />
          Local test
        </Button>
        <Button type="button" disabled={busy} onClick={onServerTest}>
          <Cloud />
          Send server test
        </Button>
      </div>
    </div>
  );
}
