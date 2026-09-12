import { VAPID_PUBLIC_KEY } from "@/lib/push-vapid";

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return navigator.serviceWorker.getRegistration();
  }
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
  return typeof window !== "undefined" && typeof Notification !== "undefined";
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
      hint: "Open the Home Screen Split Log icon. Safari tabs cannot allow notifications.",
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
      hint: "Reopen the Home Screen icon (not Safari). Notification API is still hidden.",
    };
  }
  return {
    kind: "unsupported",
    label: "Not available",
    hint: "This browser has no Notifications API.",
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export type BrowserSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function ensurePermission(): Promise<NotificationPermission> {
  const env = pushEnvironment();
  if (env.kind === "needs-install") throw new Error(env.hint);
  if (!hasNotificationApi()) throw new Error("Notifications are not available in this browser.");
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") {
    throw new Error(
      "iOS blocked Split Log. Settings → Notifications → Split Log → Allow Notifications. Then force-quit the PWA and open the Home Screen icon again.",
    );
  }
  const next = await Notification.requestPermission();
  if (next !== "granted") {
    throw new Error(
      next === "denied"
        ? "You tapped Don’t Allow. iOS will not ask again until you enable it in Settings → Notifications → Split Log."
        : "Permission was dismissed. Tap Allow + subscribe again and choose Allow on the iOS sheet.",
    );
  }
  return next;
}

export async function subscribePush(publicKey = VAPID_PUBLIC_KEY): Promise<BrowserSub> {
  await ensurePermission();
  const reg = await getRegistration();
  if (!reg?.pushManager) throw new Error("Push manager missing. Reopen the Home Screen app.");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push subscription was incomplete.");
  }
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export async function enableNotifications(): Promise<NotificationPermission> {
  const permission = await ensurePermission();
  await getRegistration();
  return permission;
}

export async function sendDebugNotification(): Promise<void> {
  await ensurePermission();
  const reg = await getRegistration();
  if (!reg) throw new Error("Service worker did not register. Reopen the Home Screen app and try again.");
  await reg.showNotification("Split Log — local test", {
    body: "Local banner from the open app. Use Send server test to hit the locked-phone path.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "split-log-debug",
    data: { url: "/" },
  });
}
