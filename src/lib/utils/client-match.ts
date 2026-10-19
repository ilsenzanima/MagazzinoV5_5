// Confronto tra committenti: stessa ragione sociale (senza forma giuridica e punteggiatura) o stessa partita IVA

const LEGAL_FORMS = new Set([
    'srl', 'srls', 'spa', 'snc', 'sas', 'sapa', 'ss', 'scarl', 'scrl', 'soc', 'societa', 'coop', 'cooperativa', 'ditta', 'di',
]);

// Minuscolo, senza accenti né punteggiatura (anche "s.r.l." -> "srl") e senza la forma giuridica
export function normalizeCompanyName(name: string | null | undefined): string {
    const base = String(name ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    return base.split(' ').filter(t => t && !LEGAL_FORMS.has(t)).join(' ');
}

// Solo le cifre, senza il prefisso IT (es. "IT 01234567890" -> "01234567890")
export function vatDigits(vat: string | null | undefined): string {
    const digits = String(vat ?? '').replace(/\D/g, '');
    return digits;
}

export type ClientMatchReason = 'stessa-partita-iva' | 'stesso-nome' | 'nome-simile';

export function clientMatchReason(
    candidate: { name: string; vatNumber?: string | null },
    input: { name: string; vatNumber?: string | null }
): ClientMatchReason | null {
    const vatA = vatDigits(candidate.vatNumber);
    const vatB = vatDigits(input.vatNumber);
    if (vatA.length >= 8 && vatA === vatB) return 'stessa-partita-iva';

    const a = normalizeCompanyName(candidate.name);
    const b = normalizeCompanyName(input.name);
    if (a.length < 3 || b.length < 3) return null;
    if (a === b) return 'stesso-nome';
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (short.length >= 5 && long.startsWith(short + ' ')) return 'nome-simile';
    return null;
}
