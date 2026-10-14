import { auditPurchases, median, AuditLot } from '../purchase-price-audit';

const lot = (over: Partial<AuditLot> & { purchaseId: string; price: number }): AuditLot => ({
    itemId: 'promastop',
    itemName: 'Promastop-W',
    itemUnit: 'ML',
    date: '2026-05-01',
    deliveryNoteNumber: null,
    supplierName: null,
    createdBy: 'u1',
    createdByName: 'Anna',
    ...over,
});

describe('median', () => {
    it('gestisce pari, dispari e vuoto', () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([1, 2, 3, 4])).toBe(2.5);
        expect(median([])).toBeNull();
    });
});

describe('auditPurchases', () => {
    it('segnala il lotto con prezzo molto diverso dagli altri (caso Promastop-W)', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 12.1 }),
            lot({ purchaseId: 'b', price: 12.3 }),
            lot({ purchaseId: 'c', price: 11.9 }),
            lot({ purchaseId: 'd', price: 218.65 }),
        ]);
        expect(item.hasPriceAnomaly).toBe(true);
        expect(item.lots.filter(l => l.priceAnomaly).map(l => l.purchaseId)).toEqual(['d']);
    });

    it('segnala anche un prezzo molto più basso', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 12 }),
            lot({ purchaseId: 'b', price: 12 }),
            lot({ purchaseId: 'c', price: 12 }),
            lot({ purchaseId: 'd', price: 4 }),
        ]);
        expect(item.lots.find(l => l.purchaseId === 'd')?.priceAnomaly).toBe(true);
    });

    it('non segnala nulla con meno di 2 altri lotti o prezzi in linea', () => {
        const [few] = auditPurchases([
            lot({ purchaseId: 'a', price: 10 }),
            lot({ purchaseId: 'b', price: 100 }),
        ]);
        expect(few.hasPriceAnomaly).toBe(false);

        const [ok] = auditPurchases([
            lot({ purchaseId: 'a', price: 10 }),
            lot({ purchaseId: 'b', price: 11 }),
            lot({ purchaseId: 'c', price: 10.5 }),
        ]);
        expect(ok.hasPriceAnomaly).toBe(false);
    });

    it('individua gli autori diversi e marca i lotti dell\'autore non prevalente', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 10 }),
            lot({ purchaseId: 'b', price: 10 }),
            lot({ purchaseId: 'c', price: 10, createdBy: 'u2', createdByName: 'Luca' }),
        ]);
        expect(item.hasMultipleAuthors).toBe(true);
        expect(item.authors.map(a => [a.name, a.count])).toEqual([['Anna', 2], ['Luca', 1]]);
        expect(item.lots.filter(l => l.differentAuthor).map(l => l.purchaseId)).toEqual(['c']);
    });

    it('ignora prezzi a zero o non validi', () => {
        const res = auditPurchases([
            lot({ purchaseId: 'a', price: 0 }),
            lot({ purchaseId: 'b', price: NaN }),
        ]);
        expect(res).toEqual([]);
    });
});
