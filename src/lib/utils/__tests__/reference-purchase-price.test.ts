import { buildReferencePriceMap, type PurchasePriceRow } from '../reference-purchase-price';

const NOW = new Date('2026-10-13T12:00:00Z');

const row = (over: Partial<PurchasePriceRow>): PurchasePriceRow => ({
    itemId: 'a', price: 10, date: '2026-09-01', createdAt: '2026-09-02T10:00:00Z',
    orderType: 'purchase', deletedAt: null, ...over,
});

describe('buildReferencePriceMap', () => {
    it('prende il prezzo più alto degli ultimi 6 mesi', () => {
        const map = buildReferencePriceMap([
            row({ price: 10, date: '2026-09-01' }),
            row({ price: 14, date: '2026-05-01' }),
            row({ price: 30, date: '2026-01-01' }), // più vecchio di 6 mesi: ignorato
        ], NOW);
        expect(map.get('a')).toBe(14);
    });

    it('senza acquisti negli ultimi 6 mesi usa il prezzo dell\'ultimo acquisto, non il massimo', () => {
        const map = buildReferencePriceMap([
            row({ price: 50, date: '2024-01-01' }),
            row({ price: 8, date: '2025-02-01' }),
        ], NOW);
        expect(map.get('a')).toBe(8);
    });

    it('ignora ordini e acquisti cancellati (caso Promastop-W)', () => {
        const map = buildReferencePriceMap([
            row({ price: 218.65, date: '2026-09-07', orderType: 'order' }),
            row({ price: 99, date: '2026-09-10', deletedAt: '2026-09-11T00:00:00Z' }),
            row({ price: 12.147, date: '2026-09-08' }),
        ], NOW);
        expect(map.get('a')).toBe(12.147);
    });

    it('un articolo con soli ordini non compare', () => {
        const map = buildReferencePriceMap([row({ orderType: 'order' })], NOW);
        expect(map.has('a')).toBe(false);
    });

    it('a parità di data vince l\'inserimento più recente; senza data usa la data di inserimento', () => {
        const map = buildReferencePriceMap([
            row({ price: 5, date: '2020-01-01', createdAt: '2026-01-01T00:00:00Z' }),
            row({ price: 6, date: '2020-01-01', createdAt: '2026-01-02T00:00:00Z' }),
        ], NOW);
        expect(map.get('a')).toBe(6);

        const map2 = buildReferencePriceMap([row({ price: 7, date: null, createdAt: '2026-09-20T00:00:00Z' })], NOW);
        expect(map2.get('a')).toBe(7);
    });

    it('tiene separati gli articoli', () => {
        const map = buildReferencePriceMap([row({ itemId: 'a', price: 1 }), row({ itemId: 'b', price: 2 })], NOW);
        expect(Array.from(map.entries())).toEqual([['a', 1], ['b', 2]]);
    });
});
