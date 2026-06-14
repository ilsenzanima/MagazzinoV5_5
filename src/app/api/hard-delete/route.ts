import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const TABLE_MAP: Record<string, string> = {
    purchases: "purchases",
    invoices: "invoices",
    "load-notes": "load_notes",
    clients: "clients",
    suppliers: "suppliers",
    inventory: "inventory",
    jobs: "jobs",
    workers: "workers",
}

function extractStoragePaths(urls: (string | null | undefined)[]): string[] {
    return urls
        .filter(Boolean)
        .map(u => u!.split('/public/documents/')[1])
        .filter(Boolean) as string[]
}

async function deleteStorageFiles(admin: SupabaseClient, paths: string[]) {
    if (!paths.length) return
    await admin.storage.from('documents').remove(paths)
}

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })

    // Usa service role per bypassare RLS sulla tabella profiles
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eliminare definitivamente' }, { status: 403 })

    const { section, id } = await req.json()
    const table = TABLE_MAP[section]
    if (!table || !id) return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 })

    // Cleanup file storage per acquisti e fatture
    if (section === "purchases") {
        const { data } = await admin.from('purchases').select('document_url, document_urls').eq('id', id).single()
        if (data) {
            const urls = Array.isArray(data.document_urls) && data.document_urls.length
                ? data.document_urls
                : data.document_url ? [data.document_url] : []
            await deleteStorageFiles(admin, extractStoragePaths(urls))
        }
    } else if (section === "invoices") {
        const { data } = await admin.from('invoices').select('document_urls').eq('id', id).single()
        if (data?.document_urls?.length) {
            await deleteStorageFiles(admin, extractStoragePaths(data.document_urls))
        }
    }

    let error: any
    if (section === "purchases") {
        // Usa RPC per evitare che il CASCADE trigger sottragga inventario
        // (l'inventario è già stato corretto al momento del soft-delete)
        const { error: rpcError } = await admin.rpc('hard_delete_purchase', { p_id: id })
        error = rpcError
    } else {
        const { error: delError } = await admin.from(table).delete().eq('id', id)
        error = delError
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
}
