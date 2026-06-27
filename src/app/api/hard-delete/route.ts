import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { deleteFile } from "@/lib/google-drive"

const TABLE_MAP: Record<string, string> = {
    purchases: "purchases",
    invoices: "invoices",
    "load-notes": "load_notes",
    clients: "clients",
    suppliers: "suppliers",
    inventory: "inventory",
    jobs: "jobs",
    workers: "workers",
    proposals: "client_proposals",
}

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
    await admin.storage.from('documents').remove(paths)
}

async function deleteDriveFiles(fileIds: string[]) {
    await Promise.allSettled(fileIds.map(id => deleteFile(id)))
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

    // Cleanup file allegati (storage legacy + Google Drive)
    if (section === "purchases") {
        const { data } = await admin.from('purchases').select('document_url, document_urls').eq('id', id).single()
        if (data) {
            const urls = Array.isArray(data.document_urls) && data.document_urls.length
                ? data.document_urls
                : data.document_url ? [data.document_url] : []
            await deleteStorageFiles(admin, extractStoragePaths(urls))
            await deleteDriveFiles(extractDriveFileIds(urls))
        }
    } else if (section === "invoices") {
        const { data } = await admin.from('invoices').select('document_urls').eq('id', id).single()
        if (data?.document_urls?.length) {
            await deleteStorageFiles(admin, extractStoragePaths(data.document_urls))
            await deleteDriveFiles(extractDriveFileIds(data.document_urls))
        }
    } else if (section === "jobs") {
        const [jobDocs, sharedDocs, salCosts, salApprovati, fattureCommittente] = await Promise.all([
            admin.from('job_documents').select('file_url').eq('job_id', id),
            admin.from('shared_documents').select('file_url').eq('job_id', id),
            admin.from('job_sal_costs').select('document_urls').eq('job_id', id),
            admin.from('job_sal_approvati').select('document_url').eq('job_id', id),
            admin.from('job_fatture_committente').select('document_url').eq('job_id', id),
        ])
        const allUrls = [
            ...(jobDocs.data ?? []).map(r => r.file_url),
            ...(sharedDocs.data ?? []).map(r => r.file_url),
            ...(salCosts.data ?? []).flatMap(r => r.document_urls ?? []),
            ...(salApprovati.data ?? []).map(r => r.document_url),
            ...(fattureCommittente.data ?? []).map(r => r.document_url),
        ]
        await deleteStorageFiles(admin, extractStoragePaths(allUrls))
        await deleteDriveFiles(extractDriveFileIds(allUrls))
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
