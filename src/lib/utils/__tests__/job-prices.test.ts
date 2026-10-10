import { buildJobPriceMap, resolveDisplayPrice } from '../job-prices';

describe('buildJobPriceMap', () => {
    it('tiene solo le righe con articolo e prezzo impostato', () => {
        const map = buildJobPriceMap([
            { itemId: 'a', unitPrice: 12.5 },
            { itemId: 'b', unitPrice: null },
            { itemId: null, unitPrice: 9 },
            { itemId: 'c', unitPrice: 0 },
        ]);
        expect(Array.from(map.entries())).toEqual([['a', 12.5], ['c', 0]]);
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
});
