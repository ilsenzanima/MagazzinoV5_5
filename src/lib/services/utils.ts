import { supabase } from '@/lib/supabase';

export async function getSoftDeletePayload() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    return {
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deleted_by_name: profile?.full_name || user.email || 'Utente sconosciuto',
    };
}

export async function getVerifiedPayload() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    return {
        verified_at: new Date().toISOString(),
        verified_by: user.id,
        verified_by_name: profile?.full_name || user.email || 'Utente sconosciuto',
    };
}

/**
 * Elimina un file da Google Drive dato il suo fileId. Ignora silenziosamente
 * i valori che non sono fileId Drive (URL legacy Supabase Storage con '/').
 * Best-effort: non blocca l'operazione DB se l'eliminazione su Drive fallisce.
 */
export async function deleteDriveFileIfApplicable(url: string | null | undefined): Promise<void> {
    if (!url || url.includes('/')) return;
    try {
        await fetch('/api/drive/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: url }),
        });
    } catch (err) {
        console.error('Errore eliminazione file Drive', err);
    }
}

/**
 * Esegue una query Supabase paginandola per superare il limite di default
 * di PostgREST (1000 righe per richiesta). `queryFactory` deve costruire una
 * query nuova ad ogni chiamata (senza `.range()`), a cui viene applicato il range.
 */
export async function fetchAllRows<T>(
    queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    pageSize: number = 1000
): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await queryFactory(from, from + pageSize - 1);
        if (error) throw error;
        const page = data || [];
        rows.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
    }
    return rows;
}

export function fetchWithTimeout<T>(promise: PromiseLike<T>, ms: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Richiesta scaduta (timeout)"));
        }, ms);
        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
}

/**
 * Parse search term into individual words for fuzzy matching.
 * Returns empty array if no valid search words.
 * Example: "af panel " -> ["af", "panel"]
 */
export function parseSearchWords(search: string): string[] {
    if (!search) return [];
    return search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
}
