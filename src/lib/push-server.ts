import webpush from "web-push"
import type { SupabaseClient } from "@supabase/supabase-js"

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

let configured = false

// Chiavi VAPID dalle variabili d'ambiente; false se mancano (le notifiche push non sono attive)
export function configurePush(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv)
  configured = true
  return true
}

// Invia la notifica a tutti i dispositivi degli utenti indicati; elimina i dispositivi che non esistono piu'
export async function sendPushToUsers(admin: SupabaseClient, userIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!configurePush() || userIds.length === 0) return { sent: 0, removed: 0 }
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds)
  let sent = 0
  const dead: string[] = []
  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 12 })
      sent++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id)
      else console.error("Push non inviata", e?.statusCode, e?.body)
    }
  }))
  if (dead.length) await admin.from("push_subscriptions").delete().in("id", dead)
  return { sent, removed: dead.length }
}
