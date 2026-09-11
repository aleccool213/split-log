import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  enableNotifications,
  isStandalonePwa,
  notificationSupported,
  sendDebugNotification,
} from "@/lib/push-client";

export function PushSettings() {
  const [supported, setSupported] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(notificationSupported());
    setStandalone(isStandalonePwa());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  async function onEnable() {
    setBusy(true);
    try {
      const next = await enableNotifications();
      setPermission(next);
      if (next === "granted") toast.success("Notifications allowed");
      else if (next === "denied") toast.error("Blocked — enable them in iOS Settings → Split Log");
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
          <dd className="font-medium">
            {!supported ? "Not supported" : standalone ? "Installed PWA" : "Browser tab"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Permission</dt>
          <dd className="font-medium capitalize">{permission}</dd>
        </div>
      </dl>
      {!standalone && supported ? (
        <p className="text-sm text-muted">
          On iPhone, add Split Log to the Home Screen first. Safari tabs cannot show push banners.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy || !supported} onClick={onEnable}>
          <Bell />
          Allow notifications
        </Button>
        <Button type="button" disabled={busy || !supported} onClick={onTest}>
          <BellRing />
          Send test notification
        </Button>
      </div>
    </div>
  );
}
