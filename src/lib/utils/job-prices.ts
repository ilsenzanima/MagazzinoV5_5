// Prezzi "di commessa": per ogni articolo dell'Analisi Costi di una commessa vale il prezzo unitario
// impostato; se non è impostato, vale il prezzo massimo d'acquisto registrato per l'articolo, che la
// commessa blocca (stessa regola di effectiveUnitPrice in cost-analysis.ts). Con più lotti
// dello stesso articolo a prezzi diversi, la commessa usa quindi sempre il prezzo più alto.
// Gli articoli che non compaiono nell'analisi mantengono il prezzo di acquisto del lotto.

export interface JobPriceRow {
    itemId: string | null;
    unitPrice: number | null;
    maxPurchasePrice: number | null;
}

// articolo -> prezzo unitario di commessa (solo righe che hanno almeno uno dei due prezzi)
export const buildJobPriceMap = (rows: JobPriceRow[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows) {
        const price = row.unitPrice ?? row.maxPurchasePrice;
        if (row.itemId && price !== null) map.set(row.itemId, price);
    }
    return map;
};

// Un lotto («riga d'acquisto») si identifica con acquisto + articolo: le viste dei movimenti espongono
// questi due valori, non l'id della riga d'acquisto.
export const lotKey = (purchaseId: string | null | undefined, itemId: string | null | undefined): string =>
    `${purchaseId ?? ''}|${itemId ?? ''}`;

// Prezzo unitario di una riga di movimento nei costi di commessa: prezzo di commessa dell'articolo,
// salvo che la riga provenga da un lotto «non calcolare» (resta al prezzo del lotto) o l'articolo
// non abbia un prezzo di commessa (resta il prezzo del lotto).
export const movementUnitPrice = (
    m: { itemId: string; itemPrice?: number | null; purchaseId?: string | null },
    jobPrices: Map<string, number>,
    excludedLotKeys?: Set<string>
): number => {
    if (excludedLotKeys?.has(lotKey(m.purchaseId, m.itemId))) return m.itemPrice ?? 0;
    return jobPrices.get(m.itemId) ?? m.itemPrice ?? 0;
};

// Prezzo da mostrare per una riga: di commessa se richiesto e disponibile, altrimenti quello di acquisto
// Un lotto segnato «non calcolare» ha un prezzo corretto solo per i suoi pezzi: le righe prelevate da quel
// lotto restano al prezzo del lotto, il resto dell'articolo usa il prezzo di commessa.
export const resolveDisplayPrice = (
    item: { inventoryId: string; price?: number; purchaseItemId?: string },
    jobPrices: Map<string, number>,
    useJobPrices: boolean,
    excludedLotIds?: Set<string>
): number => {
    if (useJobPrices && !(item.purchaseItemId && excludedLotIds?.has(item.purchaseItemId))) {
        const jobPrice = jobPrices.get(item.inventoryId);
        if (jobPrice !== undefined) return jobPrice;
    }
    return item.price || 0;
};
