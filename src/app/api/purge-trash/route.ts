import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { deleteFile, markFolderDeleted } from "@/lib/google-drive"

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

function extractStoragePaths(urls: (string | null | undefined)[]): string[] {
    return urls
        .filter(Boolean)
        .filter(u => u!.includes('/public/documents/'))
        .map(u => u!.split('/public/documents/')[1])
        .filter(Boolean) as string[]
}

function extractDriveFileIds(urls: (string | null | undefined)[]): string[] {
    return urls.filter(Boolean).filter(u => !u!.includes('/')) as string[]
}

async function deleteStorageFiles(admin: SupabaseClient, paths: string[]) {
    if (!paths.length) return
    for (let i = 0; i < paths.length; i += 200) {
        await admin.storage.from('documents').remove(paths.slice(i, i + 200))
    }
}

async function deleteDriveFiles(fileIds: string[]) {
    await Promise.allSettled(fileIds.map(id => deleteFile(id)))
}

async function deleteAllFiles(admin: SupabaseClient, urls: (string | null | undefined)[]) {
    await deleteStorageFiles(admin, extractStoragePaths(urls))
    await deleteDriveFiles(extractDriveFileIds(urls))
}

// URL dei file delle proposte: restano quelli ancora usati da una commessa (job_id valorizzato)
async function proposalFileUrls(admin: SupabaseClient, proposalIds: string[]) {
    if (!proposalIds.length) return []
    const [sharedDocs, sharedSiteDocs, supplierOffers] = await Promise.all([
        admin.from('shared_documents').select('file_url, job_id').in('proposal_id', proposalIds),
        admin.from('shared_site_documents').select('file_url, job_id').in('proposal_id', proposalIds),
        admin.from('shared_supplier_offers').select('file_url, job_id').in('proposal_id', proposalIds),
    ])
    const own = <T extends { job_id: string | null }>(rows: T[] | null) => (rows ?? []).filter(r => !r.job_id)
    return [
        ...own(sharedDocs.data).map((r: any) => r.file_url),
        ...own(sharedSiteDocs.data).map((r: any) => r.file_url),
        ...own(supplierOffers.data).map((r: any) => r.file_url),
    ]
}

// URL dei file di una commessa: restano quelli ancora usati dall'offerta di origine (proposal_id valorizzato)
async function jobFileUrls(admin: SupabaseClient, jobId: string) {
    const [jobDocs, sharedDocs, sharedSiteDocs, supplierOffers, salCosts, salApprovati, fattureCommittente] = await Promise.all([
        admin.from('job_documents').select('file_url').eq('job_id', jobId),
        admin.from('shared_documents').select('file_url, proposal_id').eq('job_id', jobId),
        admin.from('shared_site_documents').select('file_url, proposal_id').eq('job_id', jobId),
        admin.from('shared_supplier_offers').select('file_url, proposal_id').eq('job_id', jobId),
        admin.from('job_sal_costs').select('document_urls').eq('job_id', jobId),
        admin.from('job_sal_approvati').select('document_url').eq('job_id', jobId),
        admin.from('job_fatture_committente').select('document_url').eq('job_id', jobId),
    ])
    const own = <T extends { proposal_id: string | null }>(rows: T[] | null) => (rows ?? []).filter(r => !r.proposal_id)
    return [
        ...(jobDocs.data ?? []).map((r: any) => r.file_url),
        ...own(sharedDocs.data).map((r: any) => r.file_url),
        ...own(sharedSiteDocs.data).map((r: any) => r.file_url),
        ...own(supplierOffers.data).map((r: any) => r.file_url),
        ...(salCosts.data ?? []).flatMap((r: any) => r.document_urls ?? []),
        ...(salApprovati.data ?? []).map((r: any) => r.document_url),
        ...(fattureCommittente.data ?? []).map((r: any) => r.document_url),
    ]
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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurata' }, { status: 500 })

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eseguire il purge' }, { status: 403 })

    const cutoff = THIRTY_DAYS_AGO()
    const results: Record<string, number> = {}
    const skipped: { section: string; id: string; reason: string }[] = []

    // Elimina una riga alla volta: i file si cancellano solo DOPO che la riga e' stata eliminata davvero.
    // Se la riga e' protetta da dati collegati (FK) viene saltata e resta nel cestino con i suoi file.
    const purge = async (opts: {
        table: string
        label: string
        ids: string[]
        urls?: (id: string) => Promise<(string | null | undefined)[]>
        useRpc?: string
        after?: (id: string) => Promise<void>
    }) => {
        for (const id of opts.ids) {
            try {
                const urls = opts.urls ? await opts.urls(id) : []
                const { error } = opts.useRpc
                    ? await admin.rpc(opts.useRpc, { p_id: id })
                    : await admin.from(opts.table).delete().eq('id', id)
                if (error) {
                    skipped.push({ section: opts.label, id, reason: error.code === '23503' ? 'ha dati collegati da preservare' : error.message })
                    continue
                }
                if (urls.length) await deleteAllFiles(admin, urls)
                if (opts.after) await opts.after(id).catch(() => {})
                results[opts.label] = (results[opts.label] ?? 0) + 1
            } catch (e: any) {
                skipped.push({ section: opts.label, id, reason: e?.message ?? 'errore' })
            }
        }
    }

    const expired = async (table: string, cols = 'id') => {
        const { data } = await admin.from(table).select(cols).not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        return (data ?? []) as any[]
    }

    // Acquisti: via RPC, cosi' il trigger non sottrae di nuovo le quantita' dall'inventario (gia' corretto al soft-delete)
    {
        const rows = await expired('purchases', 'id, document_url, document_urls')
        const byId = new Map(rows.map(r => [r.id, r]))
        await purge({
            table: 'purchases', label: 'acquisti', ids: rows.map(r => r.id), useRpc: 'hard_delete_purchase',
            urls: async id => {
                const r = byId.get(id)
                return Array.isArray(r.document_urls) && r.document_urls.length ? r.document_urls : r.document_url ? [r.document_url] : []
            },
        })
    }

    // Fatture
    {
        const rows = await expired('invoices', 'id, document_urls')
        const byId = new Map(rows.map(r => [r.id, r]))
        await purge({ table: 'invoices', label: 'fatture', ids: rows.map(r => r.id), urls: async id => byId.get(id).document_urls ?? [] })
    }

    // Commesse (+ cartella Drive)
    {
        const rows = await expired('jobs', 'id, code, name')
        const byId = new Map(rows.map(r => [r.id, r]))
        await purge({
            table: 'jobs', label: 'commesse', ids: rows.map(r => r.id),
            urls: id => jobFileUrls(admin, id),
            after: async id => { const j = byId.get(id); await markFolderDeleted(['Cantieri', `${j.code} ${j.name}`]) },
        })
    }

    // Proposte (+ cartella Drive)
    {
        const rows = await expired('client_proposals')
        await purge({
            table: 'client_proposals', label: 'proposte', ids: rows.map(r => r.id),
            urls: id => proposalFileUrls(admin, [id]),
            after: async id => { await markFolderDeleted(['Proposte', id]) },
        })
    }

    // Committenti: le loro proposte muoiono in cascata, quindi si puliscono i loro file
    {
        const rows = await expired('clients')
        const proposalsOf = new Map<string, string[]>()
        await purge({
            table: 'clients', label: 'committenti', ids: rows.map(r => r.id),
            urls: async id => {
                const { data } = await admin.from('client_proposals').select('id').eq('client_id', id)
                const ids = (data ?? []).map((p: any) => p.id)
                proposalsOf.set(id, ids)
                return proposalFileUrls(admin, ids)
            },
            after: async id => { await Promise.allSettled((proposalsOf.get(id) ?? []).map(pid => markFolderDeleted(['Proposte', pid]))) },
        })
    }

    // Record senza file
    for (const [table, label] of Object.entries({
        suppliers: 'fornitori', inventory: 'inventario', workers: 'operai', load_notes: 'note_carico', guest_sites: 'cantieri_ospiti',
    })) {
        const rows = await expired(table)
        await purge({ table, label, ids: rows.map(r => r.id) })
    }

    const total = Object.values(results).reduce((s, n) => s + n, 0)
    return NextResponse.json({ purged: results, total, skipped })
}
