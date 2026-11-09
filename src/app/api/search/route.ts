import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

interface Hit { cat: string; id: string; title: string; subtitle?: string; href: string }

interface CatDef {
  key: string
  label: string
  staffOnly?: boolean
  table: string
  select: string
  cols: string[]
  order: string
  softDelete?: boolean
  map: (r: any) => Hit | null
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ")

const CATS: CatDef[] = [
  {
    key: "articoli", label: "Articoli", table: "inventory", select: "id,name,code,brand,model",
    cols: ["name", "code", "brand", "model"], order: "name", softDelete: true,
    map: r => ({ cat: "articoli", id: r.id, title: r.name, subtitle: join(r.code, r.brand, r.model), href: `/inventory/${r.id}` }),
  },
  {
    key: "commesse", label: "Commesse", table: "jobs", select: "id,code,name,status",
    cols: ["code", "name", "description"], order: "code", softDelete: true,
    map: r => ({ cat: "commesse", id: r.id, title: join(r.code, r.name), subtitle: r.status === "completed" ? "Completata" : r.status === "active" ? "Attiva" : undefined, href: `/jobs/${r.id}` }),
  },
  {
    key: "operai", label: "Operai", table: "workers", select: "id,first_name,last_name",
    cols: ["first_name", "last_name"], order: "last_name", softDelete: true,
    map: r => ({ cat: "operai", id: r.id, title: `${r.last_name ?? ""} ${r.first_name ?? ""}`.trim(), href: `/workers/${r.id}` }),
  },
  {
    key: "committenti", label: "Committenti", table: "clients", select: "id,name",
    cols: ["name"], order: "name", softDelete: true,
    map: r => ({ cat: "committenti", id: r.id, title: r.name, href: `/clients/${r.id}` }),
  },
  {
    key: "fornitori", label: "Fornitori", staffOnly: true, table: "suppliers", select: "id,name",
    cols: ["name"], order: "name", softDelete: true,
    map: r => ({ cat: "fornitori", id: r.id, title: r.name, href: `/suppliers/${r.id}` }),
  },
  {
    key: "acquisti", label: "Acquisti", staffOnly: true, table: "purchases", select: "id,delivery_note_number",
    cols: ["delivery_note_number"], order: "delivery_note_number", softDelete: true,
    map: r => ({ cat: "acquisti", id: r.id, title: `Bolla ${r.delivery_note_number}`, href: `/purchases/${r.id}` }),
  },
  {
    key: "fatture", label: "Fatture", staffOnly: true, table: "invoices", select: "id,invoice_number,invoice_date",
    cols: ["invoice_number"], order: "invoice_number", softDelete: true,
    map: r => ({ cat: "fatture", id: r.id, title: `Fattura ${r.invoice_number}`, subtitle: r.invoice_date ? new Date(`${r.invoice_date}T12:00:00`).toLocaleDateString("it-IT") : undefined, href: `/invoices/${r.id}` }),
  },
]

// Toglie i caratteri che rompono i filtri di PostgREST
const clean = (s: string) => s.replace(/[,()%*\\"':]/g, " ").trim()

// Ricerca unica per categorie: ogni parola deve comparire in almeno uno dei campi (le regole di accesso restano quelle del database)
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase: any = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const staff = profile?.role === "admin" || profile?.role === "operativo"
  const allowed = CATS.filter(c => !c.staffOnly || staff)
  const categories = allowed.map(c => ({ key: c.key, label: c.label }))

  const q = req.nextUrl.searchParams.get("q") ?? ""
  const only = req.nextUrl.searchParams.get("cat")
  const words = clean(q).split(/\s+/).filter(Boolean).slice(0, 4)
  if (words.length === 0) return NextResponse.json({ categories, results: [] })

  const targets = only ? allowed.filter(c => c.key === only) : allowed
  const limit = only ? 20 : 5

  const lists = await Promise.all(targets.map(async def => {
    let query = supabase.from(def.table).select(def.select).limit(limit).order(def.order, { ascending: true })
    if (def.softDelete) query = query.is("deleted_at", null)
    for (const w of words) query = query.or(def.cols.map(c => `${c}.ilike.%${w}%`).join(","))
    const { data, error } = await query
    if (error) return [] as Hit[]
    return (data ?? []).map(def.map).filter((h: Hit | null): h is Hit => !!h)
  }))

  return NextResponse.json({ categories, results: lists.flat() })
}
