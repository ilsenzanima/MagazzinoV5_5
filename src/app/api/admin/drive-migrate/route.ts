import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import {
    createDriveClient,
    resolveFilePath,
    ensureFolderPathWith,
    createRootFolder,
    downloadFileWith,
    uploadFileWith,
} from "@/lib/google-drive"

export const maxDuration = 300

interface Target {
    table: string
    id: string
    column: string
    isArray: boolean
    index?: number
    fileId: string
}

async function collectTargets(admin: SupabaseClient): Promise<Target[]> {
    const targets: Target[] = []

    const pushSimple = (table: string, column: string, rows: any[] | null) => {
        for (const row of rows ?? []) {
            const v = row[column]
            if (v && !String(v).includes('/')) {
                targets.push({ table, id: row.id, column, isArray: false, fileId: v })
            }
        }
    }

    const pushArray = (table: string, column: string, rows: any[] | null) => {
        for (const row of rows ?? []) {
            const arr: string[] = row[column] ?? []
            arr.forEach((v, index) => {
                if (v && !v.includes('/')) {
                    targets.push({ table, id: row.id, column, isArray: true, index, fileId: v })
                }
            })
        }
    }

    const [purchases, invoices, jobDocs, sharedDocs, supplierOffers, salCosts, salApprovati, fattureCommittente, compliance] = await Promise.all([
        admin.from('purchases').select('id, document_url, document_urls'),
        admin.from('invoices').select('id, document_urls'),
        admin.from('job_documents').select('id, file_url'),
        admin.from('shared_documents').select('id, file_url'),
        admin.from('shared_supplier_offers').select('id, file_url'),
        admin.from('job_sal_costs').select('id, document_urls'),
        admin.from('job_sal_approvati').select('id, document_url'),
        admin.from('job_fatture_committente').select('id, document_url'),
        admin.from('supplier_compliance_documents').select('id, file_url'),
    ])

    for (const row of purchases.data ?? []) {
        if (row.document_urls?.length) {
            row.document_urls.forEach((v: string, index: number) => {
                if (v && !v.includes('/')) targets.push({ table: 'purchases', id: row.id, column: 'document_urls', isArray: true, index, fileId: v })
            })
        } else if (row.document_url && !row.document_url.includes('/')) {
            targets.push({ table: 'purchases', id: row.id, column: 'document_url', isArray: false, fileId: row.document_url })
        }
    }
    pushArray('invoices', 'document_urls', invoices.data)
    pushSimple('job_documents', 'file_url', jobDocs.data)
    pushSimple('shared_documents', 'file_url', sharedDocs.data)
    pushSimple('shared_supplier_offers', 'file_url', supplierOffers.data)
    pushArray('job_sal_costs', 'document_urls', salCosts.data)
    pushSimple('job_sal_approvati', 'document_url', salApprovati.data)
    pushSimple('job_fatture_committente', 'document_url', fattureCommittente.data)
    pushSimple('supplier_compliance_documents', 'file_url', compliance.data)

    return targets
}

export async function GET(req: NextRequest) {
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
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo gli admin possono eseguire questa operazione' }, { status: 403 })

    const oldRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
    const newRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN_NEW
    const oldRootId = process.env.GOOGLE_DRIVE_FOLDER_ID
    const newRootId = process.env.GOOGLE_DRIVE_FOLDER_ID_NEW
    if (!oldRefreshToken || !oldRootId) return NextResponse.json({ error: 'GOOGLE_DRIVE_REFRESH_TOKEN / GOOGLE_DRIVE_FOLDER_ID non configurati' }, { status: 500 })
    if (!newRefreshToken) return NextResponse.json({ error: 'GOOGLE_DRIVE_REFRESH_TOKEN_NEW non configurato' }, { status: 500 })

    const oldDrive = createDriveClient(oldRefreshToken)
    const newDrive = createDriveClient(newRefreshToken)

    if (!newRootId) {
        const createdId = await createRootFolder(newDrive, 'Magazzino')
        return NextResponse.json({
            step: 'setup',
            message: 'Cartella radice creata sulla nuova credenziale. Imposta questo valore come GOOGLE_DRIVE_FOLDER_ID_NEW su Vercel, fai redeploy, poi richiama questa route per avviare la migrazione.',
            newRootFolderId: createdId,
        })
    }

    const offset = Number(req.nextUrl.searchParams.get('offset') ?? '0')
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '30')

    const allTargets = await collectTargets(admin)
    const batch = allTargets.slice(offset, offset + limit)

    const results: any[] = []
    const updatesByRow = new Map<string, { table: string; id: string; patch: Record<string, any> }>()

    for (const target of batch) {
        try {
            const { name, mimeType, segments } = await resolveFilePath(oldDrive, target.fileId, oldRootId)
            const buffer = await downloadFileWith(oldDrive, target.fileId)
            const folderId = await ensureFolderPathWith(newDrive, newRootId, segments)
            const newFileId = await uploadFileWith(newDrive, folderId, name, mimeType, buffer)

            const key = `${target.table}:${target.id}`
            if (target.isArray) {
                if (!updatesByRow.has(key)) {
                    const { data: row } = await admin.from(target.table).select(`${target.column}`).eq('id', target.id).single()
                    updatesByRow.set(key, { table: target.table, id: target.id, patch: { [target.column]: [...((row as any)?.[target.column] ?? [])] } })
                }
                updatesByRow.get(key)!.patch[target.column][target.index!] = newFileId
            } else {
                updatesByRow.set(key, { table: target.table, id: target.id, patch: { [target.column]: newFileId } })
            }

            results.push({ ...target, oldFileId: target.fileId, newFileId, path: segments.join('/'), ok: true })
        } catch (e: any) {
            results.push({ ...target, ok: false, error: e?.message })
        }
    }

    for (const update of updatesByRow.values()) {
        await admin.from(update.table).update(update.patch).eq('id', update.id)
    }

    return NextResponse.json({
        step: 'migrate',
        total: allTargets.length,
        offset,
        limit,
        processed: batch.length,
        nextOffset: offset + batch.length < allTargets.length ? offset + batch.length : null,
        results,
    })
}
