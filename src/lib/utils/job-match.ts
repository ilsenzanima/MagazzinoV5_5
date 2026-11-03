// Confronto tra commesse: stesso cantiere (nome o indirizzo) dello stesso committente, ignorando maiuscole e punteggiatura
import { sameFreeTextAddress } from './client-match';

export type JobMatchReason = 'stesso-nome' | 'stesso-indirizzo' | 'nome-simile';

// Minuscolo, senza accenti né punteggiatura ("I.C.I. Soc. Coop." -> "i c i soc coop")
export function normalizeJobName(name: string | null | undefined): string {
    return String(name ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// "nome simile": uno contiene l'altro (es. "Castello di Colloredo" e "Castello di Colloredo mese luglio 26")
// oppure condividono parole significative (3, o 2 se sono almeno la metà di quelle del nome più corto)
function similarName(a: string, b: string): boolean {
    if (a.length < 6 || b.length < 6) return false;
    if (a.includes(b) || b.includes(a)) return true;
    const words = (t: string) => new Set(t.split(' ').filter(w => w.length >= 4));
    const wa = words(a);
    const wb = words(b);
    let common = 0;
    wa.forEach(w => { if (wb.has(w)) common++; });
    return common >= 3 || (common >= 2 && common / Math.min(wa.size, wb.size) >= 0.5);
}

export function jobMatchReason(
    candidate: { name: string; siteAddress?: string | null },
    input: { name: string; siteAddress?: string | null }
): JobMatchReason | null {
    const a = normalizeJobName(candidate.name);
    const b = normalizeJobName(input.name);
    if (a && a === b) return 'stesso-nome';
    if (sameFreeTextAddress(candidate.siteAddress, input.siteAddress)) return 'stesso-indirizzo';
    if (a && b && similarName(a, b)) return 'nome-simile';
    return null;
}
