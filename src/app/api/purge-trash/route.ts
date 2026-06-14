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

async function runPurge() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata nelle variabili d'ambiente Vercel")
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const cutoff = THIRTY_DAYS_AGO()
    const results: Record<string, number> = {}

    // ── Purchases ─────────────────────────────────────────────────────────────
    {
        const { data } = await admin.from('purchases').select('id, document_url, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const paths = extractStoragePaths(data.flatMap(r =>
                Array.isArray(r.document_urls) && r.document_urls.length ? r.document_urls : r.document_url ? [r.document_url] : []
            ))
            await deleteStorageFiles(admin, paths)
            await admin.from('purchases').delete().in('id', data.map(r => r.id))
            results.purchases = data.length
        }
    }

    // ── Invoices ──────────────────────────────────────────────────────────────
    {
        const { data } = await admin.from('invoices').select('id, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await deleteStorageFiles(admin, extractStoragePaths(data.flatMap(r => r.document_urls ?? [])))
            await admin.from('invoices').delete().in('id', data.map(r => r.id))
            results.invoices = data.length
        }
    }

    // ── Record-only (no files) ─────────────────────────────────────────────────
    for (const table of ['clients', 'suppliers', 'inventory', 'jobs', 'workers', 'load_notes'] as const) {
        const { data } = await admin.from(table).select('id')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await admin.from(table).delete().in('id', data.map(r => r.id))
            results[table] = data.length
        }
    }

    const total = Object.values(results).reduce((s, n) => s + n, 0)
    return { purged: results, total }
}

export async function POST(req: NextRequest) {
    // Auth method 1: PURGE_SECRET header (GitHub Actions cron)
    const secret = req.headers.get('x-purge-secret')
    if (secret && process.env.PURGE_SECRET && secret === process.env.PURGE_SECRET) {
        try {
            const result = await runPurge()
            return NextResponse.json(result)
        } catch (e: any) {
            return NextResponse.json({ error: e.message }, { status: 500 })
        }
    }

    // Auth method 2: Supabase session (pulsante manuale admin)
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

    try {
        const result = await runPurge()
        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
