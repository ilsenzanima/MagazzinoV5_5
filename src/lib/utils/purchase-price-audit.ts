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
}

export interface AuditLotResult extends AuditLot {
    medianOthers: number | null;    // mediana dei prezzi degli altri lotti dello stesso articolo
    deviation: number | null;       // scarto relativo: (prezzo - mediana) / mediana
    priceAnomaly: boolean;
    differentAuthor: boolean;       // inserito da una persona diversa dall'autore prevalente
}

export interface AuditItemResult {
    itemId: string;
    itemName: string;
    itemUnit: string | null;
    lots: AuditLotResult[];
    authors: { id: string | null; name: string; count: number }[];
    medianPrice: number | null;
    hasPriceAnomaly: boolean;
    hasMultipleAuthors: boolean;
}

export const DEFAULT_ANOMALY_THRESHOLD = 0.5; // +50% / -33% rispetto alla mediana degli altri lotti
export const MIN_OTHER_LOTS = 2;              // servono almeno 2 altri lotti per fidarsi della mediana

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
            return {
                ...lot,
                medianOthers: med,
                deviation,
                priceAnomaly,
                differentAuthor: hasMultipleAuthors && lot.createdBy !== mainAuthor,
            };
        });

        lotResults.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        results.push({
            itemId,
            itemName: itemLots[0].itemName,
            itemUnit: itemLots[0].itemUnit,
            lots: lotResults,
            authors,
            medianPrice: median(itemLots.map(l => l.price)),
            hasPriceAnomaly: lotResults.some(l => l.priceAnomaly),
            hasMultipleAuthors,
        });
    }

    return results.sort((a, b) => a.itemName.localeCompare(b.itemName, 'it'));
};
