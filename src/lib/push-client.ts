export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function hasNotificationApi(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export type PushEnv = {
  kind: "ready" | "needs-install" | "unsupported";
  label: string;
  hint: string;
};

export function pushEnvironment(): PushEnv {
  if (typeof window === "undefined") {
    return { kind: "unsupported", label: "Unknown", hint: "" };
  }
  const ios = isIosDevice();
  const standalone = isStandalonePwa();
  const notify = hasNotificationApi();
  const sw = "serviceWorker" in navigator;

  if (ios && !standalone) {
    return {
      kind: "needs-install",
      label: "Safari tab",
      hint: "iPhone only exposes notifications after Add to Home Screen. Share → Add to Home Screen, then open the icon and come back here.",
    };
  }
  if (notify && sw) {
    return {
      kind: "ready",
      label: standalone ? "Installed PWA" : "Browser",
      hint: "Allow notifications, then send a test banner.",
    };
  }
  if (ios && standalone && !notify) {
    return {
      kind: "needs-install",
      label: "Home Screen app",
      hint: "Opened from the icon, but this iOS build is still hiding Notification. Close every Split Log card, reopen the Home Screen icon (not Safari), then retry.",
    };
  }
  return {
    kind: "unsupported",
    label: "Not available",
    hint: "This browser has no Notifications API.",
  };
}

export async function enableNotifications(): Promise<NotificationPermission> {
  const env = pushEnvironment();
  if (env.kind === "needs-install") throw new Error(env.hint);
  if (!hasNotificationApi()) throw new Error("Notifications are not available in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await getRegistration();
  return permission;
}

export async function sendDebugNotification(): Promise<void> {
  const env = pushEnvironment();
  if (env.kind === "needs-install") throw new Error(env.hint);
  if (!hasNotificationApi()) throw new Error("Notifications are not available in this browser.");
  if (Notification.permission !== "granted") throw new Error("Allow notifications first.");
  const reg = await getRegistration();
  if (!reg) throw new Error("Service worker did not register. Reopen the Home Screen app and try again.");
  await reg.showNotification("Split Log — test", {
    body: "If you can read this, this device can show PWA banners. No email involved.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "split-log-debug",
    data: { url: "/" },
  });
}
