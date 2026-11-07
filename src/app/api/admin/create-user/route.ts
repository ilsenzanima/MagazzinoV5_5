import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const ROLES = ["user", "operativo", "admin"]

// Crea un nuovo utente. Solo un admin puo' farlo: la registrazione libera non esiste piu'.
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY non configurata" }, { status: 500 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ error: "Solo gli admin possono creare utenti" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const fullName = String(body.fullName || "").trim()
    const role = String(body.role || "user")

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email non valida" }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: "La password deve essere di almeno 6 caratteri" }, { status: 400 })
    if (!ROLES.includes(role)) return NextResponse.json({ error: "Ruolo non valido" }, { status: 400 })

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
    })
    if (error || !data.user) return NextResponse.json({ error: error?.message || "Errore durante la creazione dell'utente" }, { status: 400 })

    // Il profilo nasce con ruolo "user" (trigger sul database): si applica il ruolo scelto
    if (role !== "user") {
        const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", data.user.id)
        if (roleError) return NextResponse.json({ error: "Utente creato, ma il ruolo non e' stato impostato: " + roleError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.user.id })
}
