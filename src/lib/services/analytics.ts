import { supabase } from '@/lib/supabase';
import { fetchAllRows } from './utils';

export const ANALYTICS_MONTHS = 12;
const FORECAST_WINDOW_DAYS = 90;
export const FORECAST_ALERT_DAYS = 60;

// Una riga di consumo: uscita di magazzino (quantity negativa nella vista)
export interface ConsumptionRow {
    item_id: string;
    item_code: string | null;
    item_name: string | null;
    item_unit: string | null;
    quantity: number | string;
    date: string;
}

export interface StockRow {
    id: string;
    quantity: number | string | null;
}

export interface ItemConsumption {
    id: string;
    code: string;
    name: string;
    unit: string;
    // Consumo per mese, dal più vecchio al più recente (stessa lunghezza di `months`)
    monthly: number[];
    last90Days: number;
}

export interface DepletionForecast {
    id: string;
    code: string;
    name: string;
    unit: string;
    stock: number;
    dailyRate: number;
    daysLeft: number;
}

export interface ConsumptionAnalytics {
    // Chiavi 'yyyy-MM' dal mese più vecchio al corrente
    months: string[];
    items: ItemConsumption[];
    forecast: DepletionForecast[];
}

const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const buildMonthKeys = (now: Date, count: number = ANALYTICS_MONTHS): string[] => {
    const keys: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
        keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    }
    return keys;
};

// Funzione pura (testabile): trasforma i movimenti grezzi in consumi per articolo e previsioni.
export const buildConsumptionAnalytics = (
    rows: ConsumptionRow[],
    stock: StockRow[],
    now: Date = new Date()
): ConsumptionAnalytics => {
    const months = buildMonthKeys(now);
    const monthIndex = new Map(months.map((m, i) => [m, i]));
    const windowStart = now.getTime() - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const items = new Map<string, ItemConsumption>();

    for (const row of rows) {
        const date = new Date(row.date);
        if (isNaN(date.getTime())) continue;
        const idx = monthIndex.get(monthKey(date));
        if (idx === undefined) continue;

        // Le uscite sono negative nella vista: il consumo è il valore assoluto
        const qty = Math.abs(Number(row.quantity) || 0);
        if (qty === 0) continue;

        let item = items.get(row.item_id);
        if (!item) {
            item = {
                id: row.item_id,
                code: row.item_code || '',
                name: row.item_name || 'Articolo senza nome',
                unit: row.item_unit || 'N/D',
                monthly: new Array(months.length).fill(0),
                last90Days: 0,
            };
            items.set(row.item_id, item);
        }
        item.monthly[idx] += qty;
        const time = date.getTime();
        if (time >= windowStart && time <= now.getTime()) item.last90Days += qty;
    }

    const stockById = new Map(stock.map(s => [s.id, Number(s.quantity) || 0]));
    const forecast: DepletionForecast[] = [];
    items.forEach(item => {
        const current = stockById.get(item.id);
        if (current === undefined || current <= 0 || item.last90Days <= 0) return;
        const dailyRate = item.last90Days / FORECAST_WINDOW_DAYS;
        const daysLeft = current / dailyRate;
        if (daysLeft > FORECAST_ALERT_DAYS) return;
        forecast.push({
            id: item.id,
            code: item.code,
            name: item.name,
            unit: item.unit,
            stock: current,
            dailyRate,
            daysLeft,
        });
    });
    forecast.sort((a, b) => a.daysLeft - b.daysLeft);

    return { months, items: Array.from(items.values()), forecast };
};

export const analyticsApi = {
    getConsumptionAnalytics: async (): Promise<ConsumptionAnalytics> => {
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth() - (ANALYTICS_MONTHS - 1), 1).toISOString();

        const [rows, stock] = await Promise.all([
            // Solo uscite verso commessa/vendita: i resi al fornitore non sono consumi
            fetchAllRows<ConsumptionRow>((from, to) =>
                supabase
                    .from('stock_movements_view')
                    .select('item_id, item_code, item_name, item_unit, quantity, date')
                    .in('type', ['exit', 'sale'])
                    .gte('date', since)
                    .order('date', { ascending: true })
                    .range(from, to)
            ),
            fetchAllRows<StockRow>((from, to) =>
                supabase
                    .from('inventory')
                    .select('id, quantity')
                    .is('deleted_at', null)
                    .order('id', { ascending: true })
                    .range(from, to)
            ),
        ]);

        return buildConsumptionAnalytics(rows.filter(r => r.item_id), stock, now);
    },
};
