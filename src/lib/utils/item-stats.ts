// Statistiche di un articolo: acquisti per anno, andamento del prezzo, utilizzo mensile.

export interface PurchaseStatRow {
    date: string;                 // data della bolla o, in mancanza, di inserimento
    quantity: number;
    returnedQuantity?: number;    // restituito al fornitore
    price: number | null;         // 0 o assente = prezzo non ancora noto (attesa fattura)
    excluded: boolean;            // escluso dai prezzi di riferimento
}

export interface YearStat {
    year: number;
    purchases: number;
    quantity: number;
    avgPrice: number | null;      // media pesata sulla quantità, solo righe con prezzo e non escluse
    minPrice: number | null;
    maxPrice: number | null;
    spent: number;                // quantità × prezzo delle righe con prezzo
    withoutPrice: number;         // acquisti senza prezzo
}

export interface UsageRow {
    date: string;
    type: string;
    quantity: number;
    isFictitious?: boolean;
}

// Dal 2026 le bolle di movimentazione tengono traccia di quello che esce
export const USAGE_START_YEAR = 2026;
const USAGE_TYPES = ['exit', 'sale', 'waste'];

const round2 = (n: number) => Math.round(n * 100) / 100;
const yearOf = (date: string) => Number(date.slice(0, 4));
const hasPrice = (r: PurchaseStatRow) => r.price != null && r.price > 0;
const netQty = (r: PurchaseStatRow) => Math.max(0, r.quantity - (r.returnedQuantity || 0));

export function yearlyPurchases(rows: PurchaseStatRow[]): YearStat[] {
    const byYear = new Map<number, PurchaseStatRow[]>();
    for (const r of rows) {
        const y = yearOf(r.date);
        if (!y) continue;
        byYear.set(y, [...(byYear.get(y) || []), r]);
    }
    return Array.from(byYear.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([year, list]) => {
            const priced = list.filter(r => hasPrice(r) && !r.excluded);
            const pricedQty = priced.reduce((s, r) => s + netQty(r), 0);
            const prices = priced.map(r => r.price as number);
            return {
                year,
                purchases: list.length,
                quantity: round2(list.reduce((s, r) => s + netQty(r), 0)),
                avgPrice: pricedQty > 0 ? round2(priced.reduce((s, r) => s + netQty(r) * (r.price as number), 0) / pricedQty) : null,
                minPrice: prices.length ? Math.min(...prices) : null,
                maxPrice: prices.length ? Math.max(...prices) : null,
                spent: round2(list.filter(hasPrice).reduce((s, r) => s + netQty(r) * (r.price as number), 0)),
                withoutPrice: list.filter(r => !hasPrice(r)).length,
            };
        });
}

// Punti del grafico del prezzo, in ordine di data
export function pricePoints(rows: PurchaseStatRow[]): { date: string; price: number }[] {
    return rows
        .filter(r => hasPrice(r) && !r.excluded)
        .map(r => ({ date: r.date.slice(0, 10), price: r.price as number }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

// Uscite per mese (gennaio = 0) di un anno; i movimenti fittizi non spostano merce
export function monthlyUsage(rows: UsageRow[], year: number): number[] {
    const months = new Array(12).fill(0);
    for (const r of rows) {
        if (!USAGE_TYPES.includes(r.type) || r.isFictitious) continue;
        if (yearOf(r.date) !== year) continue;
        const m = Number(r.date.slice(5, 7)) - 1;
        if (m >= 0 && m < 12) months[m] += Math.abs(r.quantity);
    }
    return months.map(round2);
}

export function usageYears(rows: UsageRow[]): number[] {
    const years = new Set<number>([USAGE_START_YEAR]);
    for (const r of rows) {
        const y = yearOf(r.date);
        if (y >= USAGE_START_YEAR && USAGE_TYPES.includes(r.type)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
}
