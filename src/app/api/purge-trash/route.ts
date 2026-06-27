import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { deleteFile } from "@/lib/google-drive"

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

    const adminCheck = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
    const { data: profile } = await adminCheck.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eseguire il purge' }, { status: 403 })

    const admin = adminCheck
    const cutoff = THIRTY_DAYS_AGO()
    const results: Record<string, number> = {}

    // Purchases — elimina anche i file
    {
        const { data } = await admin.from('purchases').select('id, document_url, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const allUrls = data.flatMap(r =>
                Array.isArray(r.document_urls) && r.document_urls.length ? r.document_urls : r.document_url ? [r.document_url] : []
            )
            await deleteStorageFiles(admin, extractStoragePaths(allUrls))
            await deleteDriveFiles(extractDriveFileIds(allUrls))
            await admin.from('purchases').delete().in('id', data.map(r => r.id))
            results.acquisti = data.length
        }
    }

    // Invoices — elimina anche i file
    {
        const { data } = await admin.from('invoices').select('id, document_urls')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const allUrls = data.flatMap(r => r.document_urls ?? [])
            await deleteStorageFiles(admin, extractStoragePaths(allUrls))
            await deleteDriveFiles(extractDriveFileIds(allUrls))
            await admin.from('invoices').delete().in('id', data.map(r => r.id))
            results.fatture = data.length
        }
    }

    // Jobs — elimina anche i file collegati (documenti cantiere, condivisi, SAL, fatture committente)
    {
        const { data } = await admin.from('jobs').select('id')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const jobIds = data.map(r => r.id)
            const [jobDocs, sharedDocs, supplierOffers, salCosts, salApprovati, fattureCommittente] = await Promise.all([
                admin.from('job_documents').select('file_url').in('job_id', jobIds),
                admin.from('shared_documents').select('file_url').in('job_id', jobIds),
                admin.from('shared_supplier_offers').select('file_url').in('job_id', jobIds),
                admin.from('job_sal_costs').select('document_urls').in('job_id', jobIds),
                admin.from('job_sal_approvati').select('document_url').in('job_id', jobIds),
                admin.from('job_fatture_committente').select('document_url').in('job_id', jobIds),
            ])
            const allUrls = [
                ...(jobDocs.data ?? []).map(r => r.file_url),
                ...(sharedDocs.data ?? []).map(r => r.file_url),
                ...(supplierOffers.data ?? []).map(r => r.file_url),
                ...(salCosts.data ?? []).flatMap(r => r.document_urls ?? []),
                ...(salApprovati.data ?? []).map(r => r.document_url),
                ...(fattureCommittente.data ?? []).map(r => r.document_url),
            ]
            await deleteStorageFiles(admin, extractStoragePaths(allUrls))
            await deleteDriveFiles(extractDriveFileIds(allUrls))
            await admin.from('jobs').delete().in('id', jobIds)
            results.commesse = jobIds.length
        }
    }

    // Proposte — elimina anche i file collegati (documenti condivisi, offerte fornitori)
    {
        const { data } = await admin.from('client_proposals').select('id')
            .not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        if (data?.length) {
            const proposalIds = data.map(r => r.id)
            const [sharedDocs, supplierOffers] = await Promise.all([
                admin.from('shared_documents').select('file_url').in('proposal_id', proposalIds),
                admin.from('shared_supplier_offers').select('file_url').in('proposal_id', proposalIds),
            ])
            const allUrls = [
                ...(sharedDocs.data ?? []).map(r => r.file_url),
                ...(supplierOffers.data ?? []).map(r => r.file_url),
            ]
            await deleteStorageFiles(admin, extractStoragePaths(allUrls))
            await deleteDriveFiles(extractDriveFileIds(allUrls))
            await admin.from('client_proposals').delete().in('id', proposalIds)
            results.proposte = proposalIds.length
        }
    }

    // Record senza file
    const tableLabels: Record<string, string> = {
        clients: 'committenti', suppliers: 'fornitori', inventory: 'inventario',
        workers: 'operai', load_notes: 'note_carico'
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
