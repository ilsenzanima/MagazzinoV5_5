import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function currentUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const adminClient = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

// Registra il dispositivo dell'utente collegato
export async function POST(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  const sub = await req.json()
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: "Dati non validi" }, { status: 400 })

  const admin = adminClient()
  // Lo stesso dispositivo puo' essere passato da un utente all'altro: si riparte dall'endpoint
  await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
  const { error } = await admin.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Toglie il dispositivo
export async function DELETE(req: NextRequest) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  const { endpoint } = await req.json()
  if (!endpoint) return NextResponse.json({ error: "Dati non validi" }, { status: 400 })
  await adminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id)
  return NextResponse.json({ ok: true })
}
