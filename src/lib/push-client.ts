// Notifiche push sul dispositivo (lato browser)

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on" | "not-configured";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  // Su iPhone/iPad le notifiche funzionano solo se l'app e' aggiunta alla schermata Home
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (!publicKey) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function enablePush(): Promise<void> {
  if (!publicKey) throw new Error("Notifiche non configurate sul server");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permesso negato");
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Registrazione non riuscita");
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const res = await fetch("/api/push/test", { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Invio non riuscito");
}
