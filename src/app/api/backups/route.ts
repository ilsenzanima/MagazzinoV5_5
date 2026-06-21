import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const BUCKET = "backups"

async function requireAdmin() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: NextResponse.json({ error: "Non autenticato" }, { status: 401 }) }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return { error: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY non configurata" }, { status: 500 }) }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Solo gli admin possono accedere ai backup" }, { status: 403 }) }

    return { admin }
}

// GET /api/backups -> elenco cartelle di backup disponibili nello storage
// GET /api/backups?folder=<timestamp> -> contenuto completo (tutte le tabelle) di un backup
export async function GET(req: NextRequest) {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error
    const { admin } = auth

    const folder = req.nextUrl.searchParams.get("folder")

    if (folder) {
        // Evita path traversal: il nome cartella è sempre un timestamp ISO sanificato
        if (!/^[0-9A-Za-z_-]+$/.test(folder)) {
            return NextResponse.json({ error: "Nome backup non valido" }, { status: 400 })
        }

        const { data: files, error } = await admin.storage.from(BUCKET).list(folder)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const tables: Record<string, unknown[]> = {}
        let totalRecords = 0

        for (const file of files ?? []) {
            if (!file.name.endsWith(".json") || file.name === "_summary.json") continue
            const tableName = file.name.replace(".json", "")
            const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(`${folder}/${file.name}`)
            if (downloadError || !blob) continue
            const data = JSON.parse(await blob.text())
            tables[tableName] = data
            totalRecords += Array.isArray(data) ? data.length : 0
        }

        return NextResponse.json({ timestamp: folder, tables, totalRecords })
    }

    const { data, error } = await admin.storage.from(BUCKET).list("", { limit: 200 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const folders = (data ?? [])
        .filter(item => item.id === null)
        .map(item => item.name)
        .sort()
        .reverse()

    return NextResponse.json({ folders })
}
