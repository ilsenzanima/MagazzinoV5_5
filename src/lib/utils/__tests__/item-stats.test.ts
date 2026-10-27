import { yearlyPurchases, pricePoints, monthlyUsage, usageYears } from '../item-stats';

const rows = [
    { date: '2026-03-10', quantity: 100, price: 1, excluded: false },
    { date: '2026-05-10', quantity: 300, price: 2, excluded: false },
    { date: '2026-06-01', quantity: 50, price: null, excluded: false },
    { date: '2025-02-01', quantity: 10, price: 5, excluded: true },
    { date: '2025-04-01', quantity: 20, returnedQuantity: 5, price: 4, excluded: false },
];

describe('yearlyPurchases', () => {
    const years = yearlyPurchases(rows);
    it('ordina dal piu recente', () => expect(years.map(y => y.year)).toEqual([2026, 2025]));
    it('prezzo medio pesato sulle sole righe con prezzo', () => {
        expect(years[0].avgPrice).toBe(1.75);       // (100*1 + 300*2) / 400
        expect(years[0].quantity).toBe(450);
        expect(years[0].withoutPrice).toBe(1);
        expect(years[0].spent).toBe(700);
    });
    it('esclude dal prezzo medio le righe escluse ma le conta negli acquisti', () => {
        expect(years[1].purchases).toBe(2);
        expect(years[1].avgPrice).toBe(4);
        expect(years[1].minPrice).toBe(4);
    });
    it('toglie i resi dal fornitore', () => expect(years[1].quantity).toBe(25));  // 10 + (20-5)
});

describe('pricePoints', () => {
    it('salta righe senza prezzo ed escluse', () => expect(pricePoints(rows).map(p => p.price)).toEqual([4, 1, 2]));
});

describe('monthlyUsage', () => {
    const mv = [
        { date: '2026-03-02T10:00:00Z', type: 'exit', quantity: -30 },
        { date: '2026-03-20T10:00:00Z', type: 'sale', quantity: 10 },
        { date: '2026-03-21T10:00:00Z', type: 'exit', quantity: 99, isFictitious: true },
        { date: '2026-04-01T10:00:00Z', type: 'entry', quantity: 5 },
        { date: '2025-12-31T10:00:00Z', type: 'exit', quantity: 7 },
    ];
    it('somma le uscite del mese, senza fittizi ne entrate', () => {
        const m = monthlyUsage(mv, 2026);
        expect(m[2]).toBe(40);
        expect(m[3]).toBe(0);
    });
    it('parte dal 2026', () => expect(usageYears(mv)).toEqual([2026]));
});
