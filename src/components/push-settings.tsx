import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  enableNotifications,
  hasNotificationApi,
  pushEnvironment,
  sendDebugNotification,
  type PushEnv,
} from "@/lib/push-client";

export function PushSettings() {
  const [env, setEnv] = useState<PushEnv | null>(null);
  const [permission, setPermission] = useState<string>("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnv(pushEnvironment());
    setPermission(hasNotificationApi() ? Notification.permission : "hidden until installed");
  }, []);

  async function onEnable() {
    setBusy(true);
    try {
      const next = await enableNotifications();
      setPermission(next);
      setEnv(pushEnvironment());
      if (next === "granted") toast.success("Notifications allowed");
      else if (next === "denied") toast.error("Blocked — iOS Settings → Notifications → Split Log");
      else toast.message("Permission was dismissed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    try {
      await sendDebugNotification();
      toast.success("Test banner sent — check the lock screen / banner");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
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
      </dl>
      {env?.hint ? <p className="text-sm text-muted">{env.hint}</p> : null}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>In Safari: Share → Add to Home Screen → Add</li>
        <li>Leave Safari. Open the Split Log icon on the Home Screen</li>
        <li>Settings → Allow notifications → Send test notification</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onEnable}>
          <Bell />
          Allow notifications
        </Button>
        <Button type="button" disabled={busy} onClick={onTest}>
          <BellRing />
          Send test notification
        </Button>
      </div>
    </div>
  );
}
