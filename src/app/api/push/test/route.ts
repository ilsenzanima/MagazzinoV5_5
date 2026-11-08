import { NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { configurePush, sendPushToUsers } from "@/lib/push-server"

// Notifica di prova sui dispositivi dell'utente collegato
export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  if (!configurePush()) return NextResponse.json({ error: "Le notifiche push non sono ancora configurate sul server (chiavi VAPID mancanti)" }, { status: 503 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const result = await sendPushToUsers(admin, [user.id], {
    title: "Magazzino",
    body: "Notifica di prova: le notifiche funzionano.",
    url: "/settings/notifications",
    tag: "test",
  })
  if (result.sent === 0) return NextResponse.json({ error: "Nessun dispositivo registrato per questo utente" }, { status: 404 })
  return NextResponse.json({ ok: true, ...result })
}
