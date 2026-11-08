import type { SupabaseClient } from '@supabase/supabase-js';

// Tabelle che hanno il cestino (eliminazione "morbida" con deleted_at)
export const TRASH_TABLES = [
    'purchases', 'invoices', 'load_notes', 'clients', 'suppliers',
    'inventory', 'jobs', 'workers', 'client_proposals', 'guest_sites',
] as const;

export const TRASH_RETENTION_DAYS = 30;

// Quanti elementi sono nel cestino da piu' di 30 giorni e possono essere eliminati definitivamente
export async function countExpiredTrash(client: SupabaseClient): Promise<number> {
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const results = await Promise.all(
        TRASH_TABLES.map(t =>
            client.from(t).select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null).lt('deleted_at', cutoff)
        )
    );
    return results.reduce((sum, r) => sum + (r.count ?? 0), 0);
}
