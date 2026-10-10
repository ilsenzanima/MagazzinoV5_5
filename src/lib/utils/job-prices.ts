// Prezzi "di commessa": il prezzo unitario impostato nell'Analisi Costi di una commessa
// sostituisce il prezzo di acquisto (stessa regola della scheda Costi, JobCostiSAL).
// Gli articoli che non compaiono nell'analisi mantengono il prezzo di acquisto.

export interface JobPriceRow {
    itemId: string | null;
    unitPrice: number | null;
}

// articolo -> prezzo unitario di commessa (solo righe con un prezzo impostato)
export const buildJobPriceMap = (rows: JobPriceRow[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const row of rows) {
        if (row.itemId && row.unitPrice !== null) map.set(row.itemId, row.unitPrice);
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
