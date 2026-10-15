import { buildJobPriceMap, resolveDisplayPrice, movementUnitPrice, lotKey } from '../job-prices';

describe('buildJobPriceMap', () => {
    it('usa il prezzo impostato; se manca, il prezzo massimo d\'acquisto bloccato', () => {
        const map = buildJobPriceMap([
            { itemId: 'a', unitPrice: 12.5, maxPurchasePrice: 15 },  // il prezzo impostato vince
            { itemId: 'b', unitPrice: null, maxPurchasePrice: 9 },   // solo prezzo massimo d'acquisto
            { itemId: 'c', unitPrice: 0, maxPurchasePrice: 4 },      // zero impostato è un prezzo valido
        ]);
        expect(Array.from(map.entries())).toEqual([['a', 12.5], ['b', 9], ['c', 0]]);
    });

    it('salta le righe senza articolo o senza nessun prezzo', () => {
        const map = buildJobPriceMap([
            { itemId: null, unitPrice: 9, maxPurchasePrice: 9 },
            { itemId: 'd', unitPrice: null, maxPurchasePrice: null },
        ]);
        expect(map.size).toBe(0);
    });
});

describe('resolveDisplayPrice', () => {
    const prices = new Map([['a', 20], ['z', 0]]);

    it('con l\'interruttore spento usa sempre il prezzo di acquisto', () => {
        expect(resolveDisplayPrice({ inventoryId: 'a', price: 10 }, prices, false)).toBe(10);
    });

    it('con l\'interruttore acceso usa il prezzo di commessa se c\'è', () => {
        expect(resolveDisplayPrice({ inventoryId: 'a', price: 10 }, prices, true)).toBe(20);
    });

    it('con l\'interruttore acceso mantiene il prezzo di acquisto per gli articoli fuori analisi', () => {
        expect(resolveDisplayPrice({ inventoryId: 'b', price: 10 }, prices, true)).toBe(10);
    });

    it('un prezzo di commessa a zero è un prezzo valido e non ricade su quello di acquisto', () => {
        expect(resolveDisplayPrice({ inventoryId: 'z', price: 10 }, prices, true)).toBe(0);
    });

    it('senza nessun prezzo restituisce zero', () => {
        expect(resolveDisplayPrice({ inventoryId: 'b' }, prices, true)).toBe(0);
    });

    it('una riga prelevata da un lotto non calcolare resta al prezzo del lotto', () => {
        const excluded = new Set(['lot-x']);
        expect(resolveDisplayPrice({ inventoryId: 'a', price: 18, purchaseItemId: 'lot-x' }, prices, true, excluded)).toBe(18);
        expect(resolveDisplayPrice({ inventoryId: 'a', price: 10, purchaseItemId: 'lot-y' }, prices, true, excluded)).toBe(20);
    });
});

describe('movementUnitPrice', () => {
    const prices = new Map([['a', 13.38]]);
    const excluded = new Set([lotKey('p-18', 'a')]);

    it('usa il prezzo di commessa dell\'articolo', () => {
        expect(movementUnitPrice({ itemId: 'a', itemPrice: 12, purchaseId: 'p-x' }, prices, excluded)).toBe(13.38);
    });

    it('un lotto non calcolare resta al prezzo del lotto: solo i suoi pezzi, il resto va a prezzo di commessa', () => {
        expect(movementUnitPrice({ itemId: 'a', itemPrice: 18, purchaseId: 'p-18' }, prices, excluded)).toBe(18);
        expect(movementUnitPrice({ itemId: 'a', itemPrice: 12.9, purchaseId: 'p-other' }, prices, excluded)).toBe(13.38);
    });

    it('senza prezzo di commessa usa il prezzo del lotto, e senza nulla zero', () => {
        expect(movementUnitPrice({ itemId: 'b', itemPrice: 7 }, prices)).toBe(7);
        expect(movementUnitPrice({ itemId: 'b' }, prices)).toBe(0);
    });
});
