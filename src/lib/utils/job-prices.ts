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

// Prezzo da mostrare per una riga: di commessa se richiesto e disponibile, altrimenti quello di acquisto
export const resolveDisplayPrice = (
    item: { inventoryId: string; price?: number },
    jobPrices: Map<string, number>,
    useJobPrices: boolean
): number => {
    if (useJobPrices) {
        const jobPrice = jobPrices.get(item.inventoryId);
        if (jobPrice !== undefined) return jobPrice;
    }
    return item.price || 0;
};
