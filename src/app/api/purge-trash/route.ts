import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Uses service role key to bypass RLS and delete from storage
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

function extractStoragePaths(urls: (string | null | undefined)[]): string[] {
    return urls
        .filter(Boolean)
        .map(u => u!.split('/public/documents/')[1])
        .filter(Boolean) as string[]
}

async function deleteStorageFiles(paths: string[]) {
    if (!paths.length) return
    // Supabase storage.remove handles up to 1000 files per call
    for (let i = 0; i < paths.length; i += 200) {
        await supabaseAdmin.storage.from('documents').remove(paths.slice(i, i + 200))
    }
}

export async function POST(req: Request) {
    // Simple shared secret to prevent unauthorized calls
    const auth = req.headers.get('x-purge-secret')
    if (auth !== process.env.PURGE_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cutoff = THIRTY_DAYS_AGO()
    const results: Record<string, number> = {}

    // ── Purchases ─────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('purchases')
            .select('id, document_url, document_urls')
            .not('deleted_at', 'is', null)
            .lt('deleted_at', cutoff)

        if (data?.length) {
            const paths: string[] = []
            for (const r of data) {
                const urls = Array.isArray(r.document_urls) && r.document_urls.length
                    ? r.document_urls
                    : r.document_url ? [r.document_url] : []
                paths.push(...extractStoragePaths(urls))
            }
            await deleteStorageFiles(paths)
            await supabaseAdmin.from('purchases').delete().in('id', data.map(r => r.id))
            results.purchases = data.length
        }
    }

    // ── Invoices ──────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('invoices')
            .select('id, document_urls')
            .not('deleted_at', 'is', null)
            .lt('deleted_at', cutoff)

        if (data?.length) {
            const paths = extractStoragePaths(data.flatMap(r => r.document_urls ?? []))
            await deleteStorageFiles(paths)
            await supabaseAdmin.from('invoices').delete().in('id', data.map(r => r.id))
            results.invoices = data.length
        }
    }

    // ── Clients ───────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('clients').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('clients').delete().in('id', data.map(r => r.id))
            results.clients = data.length
        }
    }

    // ── Suppliers ─────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('suppliers').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('suppliers').delete().in('id', data.map(r => r.id))
            results.suppliers = data.length
        }
    }

    // ── Inventory ─────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('inventory').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('inventory').delete().in('id', data.map(r => r.id))
            results.inventory = data.length
        }
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('jobs').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('jobs').delete().in('id', data.map(r => r.id))
            results.jobs = data.length
        }
    }

    // ── Workers ───────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('workers').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('workers').delete().in('id', data.map(r => r.id))
            results.workers = data.length
        }
    }

    // ── Load Notes ────────────────────────────────────────────────────────────
    {
        const { data } = await supabaseAdmin
            .from('load_notes').select('id').not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            await supabaseAdmin.from('load_notes').delete().in('id', data.map(r => r.id))
            results.load_notes = data.length
        }
    }

    const total = Object.values(results).reduce((s, n) => s + n, 0)
    return NextResponse.json({ purged: results, total })
}
