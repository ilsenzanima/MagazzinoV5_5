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

const STREET_PREFIXES = new Set([
    'via', 'viale', 'v', 'piazza', 'piazzale', 'pza', 'pzza', 'p', 'corso', 'c', 'so', 'largo', 'strada', 'str', 'vicolo', 'loc', 'localita',
]);

function plain(text: string | null | undefined): string {
    return String(text ?? '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\./g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// Via senza «via/viale/piazza...» (es. "Via G. Garibaldi" -> "g garibaldi")
export function normalizeStreet(street: string | null | undefined): string {
    return plain(street).split(' ').filter(t => t && !STREET_PREFIXES.has(t)).join(' ');
}

// Primo numero del civico ("10/A" -> "10")
export function civicNumber(value: string | null | undefined): string {
    return (String(value ?? '').match(/\d+/) ?? [''])[0];
}

export interface ClientAddress {
    street?: string | null;
    streetNumber?: string | null;
    postalCode?: string | null;
    city?: string | null;
}

// Stesso indirizzo: stessa via e stesso civico, nello stesso comune (o con lo stesso CAP)
export function sameAddress(a: ClientAddress, b: ClientAddress): boolean {
    const streetA = normalizeStreet(a.street);
    const streetB = normalizeStreet(b.street);
    if (streetA.length < 4 || streetA !== streetB) return false;
    const numberA = civicNumber(a.streetNumber);
    if (!numberA || numberA !== civicNumber(b.streetNumber)) return false;
    const cityA = plain(a.city);
    const cityB = plain(b.city);
    const capA = String(a.postalCode ?? '').trim();
    const capB = String(b.postalCode ?? '').trim();
    return (!!cityA && cityA === cityB) || (!!capA && capA === capB);
}

export type ClientMatchReason = 'stessa-partita-iva' | 'stesso-nome' | 'stesso-indirizzo' | 'nome-simile';

export function clientMatchReason(
    candidate: { name: string; vatNumber?: string | null } & ClientAddress,
    input: { name: string; vatNumber?: string | null } & ClientAddress
): ClientMatchReason | null {
    const vatA = vatDigits(candidate.vatNumber);
    const vatB = vatDigits(input.vatNumber);
    if (vatA.length >= 8 && vatA === vatB) return 'stessa-partita-iva';

    const a = normalizeCompanyName(candidate.name);
    const b = normalizeCompanyName(input.name);
    if (a.length >= 3 && b.length >= 3 && a === b) return 'stesso-nome';
    if (sameAddress(candidate, input)) return 'stesso-indirizzo';
    if (a.length < 3 || b.length < 3) return null;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (short.length >= 5 && long.startsWith(short + ' ')) return 'nome-simile';
    return null;
}
