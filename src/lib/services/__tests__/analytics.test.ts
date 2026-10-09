jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { buildConsumptionAnalytics, buildMonthKeys } from '../analytics';

// Data fissa per rendere i test deterministici: 15 ottobre 2026
const NOW = new Date(2026, 9, 15, 12, 0, 0);

const row = (itemId: string, quantity: number, date: Date, extra: Record<string, any> = {}) => ({
    item_id: itemId,
    item_code: `COD-${itemId}`,
    item_name: `Articolo ${itemId}`,
    item_unit: 'PZ',
    quantity,
    date: date.toISOString(),
    ...extra,
});

describe('buildMonthKeys', () => {
    it('restituisce 12 mesi dal più vecchio al corrente, attraversando l\'anno', () => {
        const keys = buildMonthKeys(NOW);
        expect(keys).toHaveLength(12);
        expect(keys[0]).toBe('2025-11');
        expect(keys[11]).toBe('2026-10');
    });
});

describe('buildConsumptionAnalytics', () => {
    it('somma i consumi per mese usando il valore assoluto delle uscite', () => {
        const rows = [
            row('a', -5, new Date(2026, 9, 2)),
            row('a', -3, new Date(2026, 9, 10)),
            row('a', -4, new Date(2026, 8, 20)),
        ];
        const { months, items } = buildConsumptionAnalytics(rows, [], NOW);
        const a = items.find(i => i.id === 'a')!;
        expect(a.monthly[months.indexOf('2026-10')]).toBe(8);
        expect(a.monthly[months.indexOf('2026-09')]).toBe(4);
    });

    it('ignora i movimenti più vecchi di 12 mesi, nel futuro oltre il mese corrente e con quantità zero', () => {
        const rows = [
            row('a', -10, new Date(2025, 9, 31)),
            row('b', 0, new Date(2026, 9, 1)),
            row('c', -2, new Date(2026, 10, 3)),
        ];
        expect(buildConsumptionAnalytics(rows, [], NOW).items).toHaveLength(0);
    });

    it('usa valori di ripiego quando mancano nome, codice o unità', () => {
        const rows = [row('a', -1, new Date(2026, 9, 1), { item_name: null, item_code: null, item_unit: null })];
        const [item] = buildConsumptionAnalytics(rows, [], NOW).items;
        expect(item.name).toBe('Articolo senza nome');
        expect(item.code).toBe('');
        expect(item.unit).toBe('N/D');
    });

    it('segnala nella previsione gli articoli che finiscono entro 60 giorni, dal più urgente', () => {
        // a: 90 consumati in 90 giorni = 1 al giorno, 30 in magazzino -> 30 giorni
        // b: 90 consumati, 10 in magazzino -> 10 giorni
        // c: 9 consumati (0,1 al giorno), 30 in magazzino -> 300 giorni, non segnalato
        const rows = [
            row('a', -90, new Date(2026, 8, 1)),
            row('b', -90, new Date(2026, 8, 1)),
            row('c', -9, new Date(2026, 8, 1)),
        ];
        const stock = [
            { id: 'a', quantity: 30 },
            { id: 'b', quantity: 10 },
            { id: 'c', quantity: 30 },
        ];
        const { forecast } = buildConsumptionAnalytics(rows, stock, NOW);
        expect(forecast.map(f => f.id)).toEqual(['b', 'a']);
        expect(Math.round(forecast[0].daysLeft)).toBe(10);
        expect(Math.round(forecast[1].daysLeft)).toBe(30);
    });

    it('non prevede articoli già esauriti o senza consumi recenti', () => {
        const rows = [
            row('a', -50, new Date(2026, 8, 1)),
            // consumo vecchio di oltre 90 giorni: conta per il grafico ma non per la previsione
            row('b', -50, new Date(2026, 2, 1)),
        ];
        const stock = [
            { id: 'a', quantity: 0 },
            { id: 'b', quantity: 5 },
        ];
        expect(buildConsumptionAnalytics(rows, stock, NOW).forecast).toHaveLength(0);
    });
});
