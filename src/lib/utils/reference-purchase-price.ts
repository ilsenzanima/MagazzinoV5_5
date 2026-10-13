export interface PurchasePriceRow {
    itemId: string;
    price: number;
    date: string | null;       // data della bolla (YYYY-MM-DD)
    createdAt: string | null;  // usata se manca la data della bolla e per spareggio
    orderType: string | null;
    deletedAt: string | null;
}

export const RECENT_PRICE_MONTHS = 6;

// Stessa regola della funzione SQL get_max_purchase_prices:
// solo acquisti veri (non ordini, non cancellati); prezzo più alto degli ultimi 6 mesi,
// altrimenti prezzo dell'ultimo acquisto (data bolla più recente).
export const buildReferencePriceMap = (rows: PurchasePriceRow[], now: Date = new Date()): Map<string, number> => {
    const limit = new Date(now);
    limit.setMonth(limit.getMonth() - RECENT_PRICE_MONTHS);
    const limitDay = limit.toISOString().slice(0, 10);

    const dayOf = (r: PurchasePriceRow) => (r.date || r.createdAt || '').slice(0, 10);
    const tieOf = (r: PurchasePriceRow) => r.createdAt || '';

    const recentMax = new Map<string, number>();
    const latest = new Map<string, PurchasePriceRow>();

    for (const r of rows) {
        if (r.orderType !== 'purchase' || r.deletedAt || !Number.isFinite(r.price)) continue;
        const day = dayOf(r);
        if (day >= limitDay) {
            const cur = recentMax.get(r.itemId);
            if (cur === undefined || r.price > cur) recentMax.set(r.itemId, r.price);
        }
        const prev = latest.get(r.itemId);
        if (!prev || day > dayOf(prev) || (day === dayOf(prev) && tieOf(r) > tieOf(prev))) latest.set(r.itemId, r);
    }

    const map = new Map<string, number>();
    for (const [itemId, row] of latest) map.set(itemId, recentMax.get(itemId) ?? row.price);
    return map;
};
