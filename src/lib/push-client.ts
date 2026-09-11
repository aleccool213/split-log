export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.getRegistration() ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function notificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function enableNotifications(): Promise<NotificationPermission> {
  if (!notificationSupported()) throw new Error("Notifications are not available in this browser.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await getRegistration();
  return permission;
}

export async function sendDebugNotification(): Promise<void> {
  if (!notificationSupported()) throw new Error("Notifications are not available in this browser.");
  if (Notification.permission !== "granted") {
    throw new Error("Allow notifications first.");
  }
  const reg = await getRegistration();
  if (!reg) throw new Error("Service worker did not register. Try Add to Home Screen, then reopen.");
  await reg.showNotification("Split Log — test", {
    body: "If you can read this, this device can show PWA banners. No email involved.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "split-log-debug",
    data: { url: "/" },
  });
}
