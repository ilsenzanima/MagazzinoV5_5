import { auditPurchases, median, AuditLot } from '../purchase-price-audit';

const lot = (over: Partial<AuditLot> & { purchaseId: string; price: number }): AuditLot => ({
    purchaseItemId: 'pi',
    excluded: false,
    itemId: 'promastop',
    itemName: 'Promastop-W',
    itemUnit: 'ML',
    date: '2026-05-01',
    deliveryNoteNumber: null,
    supplierName: null,
    createdBy: 'u1',
    createdByName: 'Anna',
    quantity: 18,
    createdAt: '2026-05-01T10:00:00Z',
    priceChangedAt: null,
    packQuantity: null,
    reviewedAt: null,
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

    it('segnala un prezzo di confezione scritto come prezzo unitario quando è nota la quantità per confezione', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 12.1, packQuantity: 18 }),
            lot({ purchaseId: 'b', price: 12.3, packQuantity: 18 }),
            lot({ purchaseId: 'c', price: 11.9, packQuantity: 18 }),
            lot({ purchaseId: 'd', price: 218.65, packQuantity: 18 }),
        ]);
        const d = item.lots.find(l => l.purchaseId === 'd')!;
        expect(d.packPriceSuspect).toBe(true);
        expect(item.hasPackIssue).toBe(true);
    });

    it('una quantità forzata non multipla della confezione, con prezzo unitario in linea, non è un problema', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 12, packQuantity: 18 }),
            lot({ purchaseId: 'b', price: 12.2, packQuantity: 18 }),
            lot({ purchaseId: 'c', price: 11.9, packQuantity: 18 }),
            lot({ purchaseId: 'd', price: 12.1, quantity: 25, packQuantity: 18 }),
        ]);
        expect(item.lots.find(l => l.purchaseId === 'd')?.qtyNotMultiple).toBe(true);
        expect(item.hasPackIssue).toBe(false);
    });

    it('dopo il controllo dell\'articolo restano segnalati solo i lotti inseriti dopo', () => {
        const base = { reviewedAt: '2026-06-01T00:00:00Z' };
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 10, ...base }),
            lot({ purchaseId: 'b', price: 10, ...base }),
            lot({ purchaseId: 'c', price: 10, ...base }),
            lot({ purchaseId: 'd', price: 30, ...base }),                                  // vecchio: già controllato
        ]);
        expect(item.hasPriceAnomaly).toBe(false);

        const [again] = auditPurchases([
            lot({ purchaseId: 'a', price: 10, ...base }),
            lot({ purchaseId: 'b', price: 10, ...base }),
            lot({ purchaseId: 'c', price: 10, ...base }),
            lot({ purchaseId: 'e', price: 30, createdAt: '2026-07-01T00:00:00Z', ...base }), // nuovo
        ]);
        expect(again.hasPriceAnomaly).toBe(true);
    });

    it('dopo il controllo, un nuovo lotto dell\'autore abituale non fa riapparire gli autori diversi', () => {
        const base = { reviewedAt: '2026-06-01T00:00:00Z' };
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 10, ...base }),
            lot({ purchaseId: 'b', price: 10, ...base }),
            lot({ purchaseId: 'c', price: 10, createdBy: 'u2', createdByName: 'Luca', ...base }),
            lot({ purchaseId: 'n', price: 10, createdAt: '2026-07-01T00:00:00Z', ...base }), // nuovo, stesso autore prevalente
        ]);
        expect(item.hasMultipleAuthors).toBe(false);

        const [again] = auditPurchases([
            lot({ purchaseId: 'a', price: 10, ...base }),
            lot({ purchaseId: 'b', price: 10, ...base }),
            lot({ purchaseId: 'n', price: 10, createdBy: 'u2', createdByName: 'Luca', createdAt: '2026-07-01T00:00:00Z', ...base }),
        ]);
        expect(again.hasMultipleAuthors).toBe(true);
    });

    it('un prezzo modificato dopo il controllo fa tornare segnalato il lotto', () => {
        const base = { reviewedAt: '2026-06-01T00:00:00Z' };
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 10, ...base }),
            lot({ purchaseId: 'b', price: 10, ...base }),
            lot({ purchaseId: 'c', price: 10, ...base }),
            lot({ purchaseId: 'd', price: 30, priceChangedAt: '2026-07-01T00:00:00Z', ...base }),
        ]);
        expect(item.hasPriceAnomaly).toBe(true);
    });

    it('i lotti non calcolare o a quantità 0 non pesano su mediana e segnalazioni ma restano visibili', () => {
        const [item] = auditPurchases([
            lot({ purchaseId: 'a', price: 13.38, quantity: 400 }),
            lot({ purchaseId: 'b', price: 13.38, quantity: 400 }),
            lot({ purchaseId: 'c', price: 13.38, quantity: 400 }),
            lot({ purchaseId: 'x', price: 18, quantity: 10, excluded: true }),
            lot({ purchaseId: 'z', price: 5, quantity: 0 }),
        ]);
        expect(item.hasPriceAnomaly).toBe(false);
        expect(item.medianPrice).toBe(13.38);
        expect(item.lots.find(l => l.purchaseId === 'x')?.ignored).toBe('excluded');
        expect(item.lots.find(l => l.purchaseId === 'z')?.ignored).toBe('zero');
    });
});
