// Controllo acquisti (strumento Admin): per ogni articolo segnala i lotti con prezzo unitario molto
// diverso dagli altri e gli articoli i cui acquisti sono stati inseriti da persone diverse.

export interface AuditLot {
    purchaseId: string;
    itemId: string;
    itemName: string;
    itemUnit: string | null;
    price: number;
    date: string | null;            // data bolla (YYYY-MM-DD) o, se manca, data di inserimento
    deliveryNoteNumber: string | null;
    supplierName: string | null;
    createdBy: string | null;
    createdByName: string | null;
    quantity: number | null;
    createdAt: string | null;       // data di inserimento (ISO), per distinguere i lotti nuovi da quelli già controllati
    packQuantity: number | null;    // quantità normale per confezione dell'articolo
    reviewedAt: string | null;      // articolo controllato da un admin (ISO)
}

export interface AuditLotResult extends AuditLot {
    medianOthers: number | null;    // mediana dei prezzi degli altri lotti dello stesso articolo
    deviation: number | null;       // scarto relativo: (prezzo - mediana) / mediana
    priceAnomaly: boolean;
    differentAuthor: boolean;       // inserito da una persona diversa dall'autore prevalente
    packPriceSuspect: boolean;      // il prezzo è circa (prezzo tipico × quantità per confezione): prezzo di confezione?
    qtyNotMultiple: boolean;        // la quantità non è multipla della confezione
    isNew: boolean;                 // inserito dopo il controllo dell'articolo (o articolo mai controllato)
}

export interface AuditItemResult {
    itemId: string;
    itemName: string;
    itemUnit: string | null;
    lots: AuditLotResult[];
    authors: { id: string | null; name: string; count: number }[];
    medianPrice: number | null;
    packQuantity: number | null;
    reviewedAt: string | null;
    hasPriceAnomaly: boolean;       // solo lotti nuovi, cioè non coperti dal controllo
    hasMultipleAuthors: boolean;
    hasPackIssue: boolean;          // solo lotti nuovi
}

export const DEFAULT_ANOMALY_THRESHOLD = 0.5; // +50% / -33% rispetto alla mediana degli altri lotti
export const MIN_OTHER_LOTS = 2;              // servono almeno 2 altri lotti per fidarsi della mediana

const PACK_PRICE_TOLERANCE = 0.15;

export const median = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const auditPurchases = (
    lots: AuditLot[],
    threshold: number = DEFAULT_ANOMALY_THRESHOLD
): AuditItemResult[] => {
    const byItem = new Map<string, AuditLot[]>();
    for (const lot of lots) {
        if (!Number.isFinite(lot.price) || lot.price <= 0) continue; // prezzi vuoti o a zero non fanno statistica
        const list = byItem.get(lot.itemId);
        if (list) list.push(lot);
        else byItem.set(lot.itemId, [lot]);
    }

    const results: AuditItemResult[] = [];
    for (const [itemId, itemLots] of byItem) {
        const authorCounts = new Map<string, { id: string | null; name: string; count: number }>();
        for (const lot of itemLots) {
            const key = lot.createdBy ?? '-';
            const cur = authorCounts.get(key);
            if (cur) cur.count += 1;
            else authorCounts.set(key, { id: lot.createdBy, name: lot.createdByName || 'Sconosciuto', count: 1 });
        }
        const authors = Array.from(authorCounts.values()).sort((a, b) => b.count - a.count);
        const mainAuthor = authors[0]?.id ?? null;
        const hasMultipleAuthors = authors.length > 1;

        const lotResults: AuditLotResult[] = itemLots.map((lot, index) => {
            const others = itemLots.filter((_, i) => i !== index).map(l => l.price);
            const med = others.length >= MIN_OTHER_LOTS ? median(others) : null;
            const deviation = med && med > 0 ? (lot.price - med) / med : null;
            const priceAnomaly =
                deviation !== null && (deviation >= threshold || deviation <= -(1 - 1 / (1 + threshold)));

            const pack = lot.packQuantity && lot.packQuantity > 0 ? lot.packQuantity : null;
            const packPriceSuspect =
                pack !== null && pack > 1 && med !== null && med > 0 &&
                lot.price / med >= pack * (1 - PACK_PRICE_TOLERANCE) &&
                lot.price / med <= pack * (1 + PACK_PRICE_TOLERANCE);
            const qtyNotMultiple =
                pack !== null && lot.quantity !== null && lot.quantity > 0 &&
                Math.abs(lot.quantity / pack - Math.round(lot.quantity / pack)) > 1e-6;

            const isNew = !lot.reviewedAt || !lot.createdAt || lot.createdAt > lot.reviewedAt;
            return {
                ...lot,
                medianOthers: med,
                deviation,
                priceAnomaly,
                differentAuthor: hasMultipleAuthors && lot.createdBy !== mainAuthor,
                packPriceSuspect,
                qtyNotMultiple,
                isNew,
            };
        });

        lotResults.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        // Una quantità non multipla della confezione conta solo se il prezzo unitario non la giustifica
        // (ordini forzati a quantità diverse hanno comunque un prezzo unitario in linea).
        const packIssueOf = (l: AuditLotResult) =>
            l.packPriceSuspect ||
            (l.qtyNotMultiple && (l.deviation === null || Math.abs(l.deviation) > threshold / 2));

        results.push({
            itemId,
            itemName: itemLots[0].itemName,
            itemUnit: itemLots[0].itemUnit,
            lots: lotResults,
            authors,
            medianPrice: median(itemLots.map(l => l.price)),
            packQuantity: itemLots[0].packQuantity,
            reviewedAt: itemLots[0].reviewedAt,
            hasPriceAnomaly: lotResults.some(l => l.isNew && l.priceAnomaly),
            hasMultipleAuthors: hasMultipleAuthors && lotResults.some(l => l.isNew),
            hasPackIssue: lotResults.some(l => l.isNew && packIssueOf(l)),
        });
    }

    return results.sort((a, b) => a.itemName.localeCompare(b.itemName, 'it'));
};
