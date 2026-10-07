import type { SupabaseClient } from "@supabase/supabase-js"

// Tabelle incluse nel backup. Deve restare allineata alle tabelle dello schema "public"
// (escluso guest_login_attempts: è solo un log di tentativi di accesso con indirizzi IP).
// L'ordine segue le dipendenze, quindi è utilizzabile anche per un ripristino.
export const BACKUP_TABLES = [
    'profiles',
    'warehouses',
    'brands',
    'item_types',
    'units',
    'clients',
    'client_contacts',
    'suppliers',
    'supplier_groups',
    'supplier_group_members',
    'supplier_compliance_documents',
    'inventory',
    'inventory_supplier_codes',
    'fictitious_item_prices',
    'jobs',
    'sites',
    'guest_sites',
    'guest_site_jobs',
    'job_logs',
    'job_documents',
    'job_document_folders',
    'job_site_document_folders',
    'job_conformita_document_types',
    'job_site_document_types',
    'job_inventory',
    'job_tasks',
    'job_task_assignments',
    'job_sal_names',
    'job_sal_items',
    'job_sal_costs',
    'job_sal_approvati',
    'job_fatture_committente',
    'job_sal_fattura_links',
    'job_cost_analysis_params',
    'job_cost_analysis_rows',
    'client_proposals',
    'proposal_tasks',
    'proposal_document_folders',
    'proposal_document_types',
    'proposal_cost_analysis_versions',
    'proposal_cost_analysis_params',
    'proposal_cost_analysis_rows',
    'shared_documents',
    'shared_site_documents',
    'shared_supplier_offers',
    'shared_compliance_associations',
    'shared_cost_analysis_documents',
    'compliance_document_types',
    'item_compliance_associations',
    'job_compliance_associations',
    'purchases',
    'purchase_items',
    'purchase_compliance_associations',
    'invoices',
    'delivery_notes',
    'delivery_note_items',
    'load_notes',
    'load_note_items',
    'movements',
    'workers',
    'attendance',
    'attendance_corrections',
    'leave_requests',
    'worker_courses',
    'worker_medical_exams',
] as const

// Colonne con cui ordinare per paginare in modo stabile.
// Per default "id"; alcune tabelle non hanno né "id" né "created_at".
const ORDER_COLUMNS: Record<string, string[]> = {
    job_cost_analysis_params: ['job_id'],
    proposal_cost_analysis_params: ['version_id'],
    supplier_group_members: ['group_id', 'supplier_id'],
}

// Supabase restituisce al massimo 1000 righe per richiesta
const PAGE_SIZE = 1000

export interface TableBackupResult {
    table: string
    rows: any[]
    // Righe realmente presenti nella tabella secondo il database
    expected: number | null
    error: string | null
}

// Scarica TUTTE le righe di una tabella (paginando) e le confronta con il conteggio reale.
export async function fetchAllRows(supabase: SupabaseClient, table: string): Promise<TableBackupResult> {
    const orderColumns = ORDER_COLUMNS[table] ?? ['id']
    const rows: any[] = []

    const { count, error: countError } = await supabase.from(table).select('*', { count: 'exact', head: true })
    const expected = countError ? null : (count ?? 0)

    for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase.from(table).select('*')
        for (const col of orderColumns) query = query.order(col, { ascending: true })
        const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
        if (error) return { table, rows, expected, error: error.message }
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE_SIZE) break
    }

    if (expected !== null && rows.length !== expected) {
        return { table, rows, expected, error: `righe scaricate (${rows.length}) diverse da quelle nel database (${expected})` }
    }
    return { table, rows, expected, error: null }
}
