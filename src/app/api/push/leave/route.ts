import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { configurePush, sendPushToUsers } from "@/lib/push-server"

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })

// Avvisa admin e operativi sul telefono quando qualcuno invia una richiesta di permesso o ferie
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })
  if (!configurePush()) return NextResponse.json({ sent: 0 })

  const { workerId, startDate, endDate, hours } = await req.json()
  if (!workerId || !startDate) return NextResponse.json({ error: "Dati non validi" }, { status: 400 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  // La richiesta deve esistere davvero (evita avvisi inventati)
  const { data: request } = await admin.from("leave_requests").select("id").eq("worker_id", workerId).eq("date", startDate).order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (!request) return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 })

  const { data: worker } = await admin.from("workers").select("first_name, last_name").eq("id", workerId).maybeSingle()
  const name = worker ? `${worker.last_name ?? ""} ${worker.first_name ?? ""}`.trim() : "Un operaio"
  const { data: staff } = await admin.from("profiles").select("id").in("role", ["admin", "operativo"])
  const targets = (staff ?? []).map(s => s.id as string).filter(id => id !== user.id)

  const days = endDate && endDate !== startDate ? `dal ${fmt(startDate)} al ${fmt(endDate)}` : `il ${fmt(startDate)}`
  const h = Number(hours)
  const result = await sendPushToUsers(admin, targets, {
    title: "Nuova richiesta di permesso",
    body: `${name}: ${h > 0 && h < 8 ? `${h} ore` : "ferie / permesso"} ${days}`,
    url: "/agenda",
    tag: `leave-${request.id}`,
  })
  return NextResponse.json(result)
}
