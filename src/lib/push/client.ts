"use client";

export type PushSupport = "ok" | "install" | "unsupported";

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** iOS only allows Web Push from an app added to the Home Screen (iOS 16.4+). */
export function pushSupport(): PushSupport {
  if (isIOS() && !isStandalone()) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

function base64UrlToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function post(path: string, body: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

export async function saveSubscription(sub: PushSubscription) {
  await post("/api/push/subscribe", { subscription: sub.toJSON(), timeZone: deviceTimeZone() });
  try {
    localStorage.setItem("centauri-push-tz", deviceTimeZone());
  } catch {}
}

/** Must run from a tap: asks for permission, subscribes and saves the subscription. */
export async function enablePush(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in Settings › Notifications › Centauri.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  await saveSubscription(sub);
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await post("/api/push/subscribe", { endpoint: sub.endpoint }, "DELETE").catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(sub: PushSubscription) {
  await post("/api/push/test", { endpoint: sub.endpoint });
}

/** Keeps the saved time zone current when travelling. Cheap no-op when nothing changed. */
export async function refreshPushTimeZone() {
  try {
    const sub = await currentSubscription();
    if (!sub || localStorage.getItem("centauri-push-tz") === deviceTimeZone()) return;
    await saveSubscription(sub);
  } catch {}
}
