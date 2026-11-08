import { NextRequest, NextResponse } from "next/server"
import { createClient as createAdmin } from "@supabase/supabase-js"
import { getAgendaDue, getAutoItems, kindInfo, todayIso } from "@/lib/services/agenda"
import { getMissingDays } from "@/lib/services/attendance-check"
import { configurePush, sendPushToUsers } from "@/lib/push-server"

// Riepilogo giornaliero sul telefono di admin e operativi: voci dell'agenda da ricordare e scadenze di corsi e visite.
// Lo chiama ogni mattina Vercel Cron (vercel.json) con l'intestazione Authorization: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configurata" }, { status: 500 })
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  if (!configurePush()) return NextResponse.json({ error: "Chiavi VAPID mancanti" }, { status: 503 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: staff } = await admin.from("profiles").select("id").in("role", ["admin", "operativo"])
  const userIds = (staff ?? []).map(s => s.id as string)
  if (userIds.length === 0) return NextResponse.json({ sent: 0 })

  const today = todayIso()
  const { reminders } = await getAgendaDue(admin)
  const autos = (await getAutoItems(admin)).filter(i => !i.done && i.auto !== "leave" && (i.endDate ?? i.date) <= addDays(today, 7))
  const lines = [
    ...reminders.map(i => `${kindInfo(i.kind).label}: ${i.title}${(i.endDate ?? i.date) < today ? " (scaduto)" : i.date <= today ? " (oggi)" : ""}`),
    ...autos.map(i => `${i.title}${i.date < today ? " (scaduto)" : ""}`),
  ]

  // Articoli con scorta minima impostata ed esauriti (come nella campanella: solo quelli gia' verificati)
  const { data: stock } = await admin.from("inventory").select("quantity").is("deleted_at", null).gt("min_stock", 0).not("verified_at", "is", null).limit(1000)
  const out = (stock ?? []).filter(i => (Number(i.quantity) || 0) <= 0).length
  if (out > 0) lines.push(out === 1 ? "1 articolo esaurito" : `${out} articoli esauriti`)

  // Giorni con presenze da segnare
  const missing = await getMissingDays(admin).catch(() => [])
  if (missing.length > 0) lines.push(missing.length === 1 ? "1 giorno con presenze da segnare" : `${missing.length} giorni con presenze da segnare`)

  if (lines.length === 0) return NextResponse.json({ sent: 0, lines: 0 })

  const body = lines.slice(0, 4).join("\n") + (lines.length > 4 ? `\n...e altre ${lines.length - 4}` : "")
  const result = await sendPushToUsers(admin, userIds, {
    title: lines.length === 1 ? "Magazzino: 1 cosa da vedere" : `Magazzino: ${lines.length} cose da vedere`,
    body,
    url: "/agenda",
    tag: "agenda-digest",
  })
  return NextResponse.json({ ...result, lines: lines.length })
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
