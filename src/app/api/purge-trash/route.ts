import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

function extractStoragePaths(urls: (string | null | undefined)[]): string[] {
    return urls
        .filter(Boolean)
        .map(u => u!.split('/public/documents/')[1])
        .filter(Boolean) as string[]
}

async function deleteStorageFiles(admin: ReturnType<typeof createClient>, paths: string[]) {
    if (!paths.length) return
    for (let i = 0; i < paths.length; i += 200) {
        await admin.storage.from('documents').remove(paths.slice(i, i + 200))
    }
}

export async function POST(req: NextRequest) {
    // Verifica sessione admin
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eseguire il purge' }, { status: 403 })

    // Usa service role per bypass RLS e accesso storage
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    const cutoff = THIRTY_DAYS_AGO()
    const results: Record<string, number> = {}

    // Purchases — elimina anche i file
    {
        const { data } = await admin.from('purchases').select('id, document_url, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const paths = extractStoragePaths(data.flatMap(r =>
                Array.isArray(r.document_urls) && r.document_urls.length ? r.document_urls : r.document_url ? [r.document_url] : []
            ))
            await deleteStorageFiles(admin, paths)
            await admin.from('purchases').delete().in('id', data.map(r => r.id))
            results.acquisti = data.length
        }
    }

    // Invoices — elimina anche i file
    {
        const { data } = await admin.from('invoices').select('id, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await deleteStorageFiles(admin, extractStoragePaths(data.flatMap(r => r.document_urls ?? [])))
            await admin.from('invoices').delete().in('id', data.map(r => r.id))
            results.fatture = data.length
        }
    }

    // Record senza file
    const tableLabels: Record<string, string> = {
        clients: 'committenti', suppliers: 'fornitori', inventory: 'inventario',
        jobs: 'commesse', workers: 'operai', load_notes: 'note_carico'
    }
    for (const [table, label] of Object.entries(tableLabels)) {
        const { data } = await admin.from(table).select('id')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await admin.from(table).delete().in('id', data.map(r => r.id))
            results[label] = data.length
        }
    }

    const total = Object.values(results).reduce((s, n) => s + n, 0)
    return NextResponse.json({ purged: results, total })
}
