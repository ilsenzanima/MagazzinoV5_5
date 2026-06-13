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
