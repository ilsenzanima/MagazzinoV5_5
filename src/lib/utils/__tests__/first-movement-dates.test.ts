import { firstMovementDates } from '../first-movement-dates';

describe('firstMovementDates', () => {
    it('prende la data più vecchia per articolo', () => {
        const map = firstMovementDates([
            { itemId: 'a', date: '2026-03-10T08:00:00Z' },
            { itemId: 'a', date: '2026-01-05' },
            { itemId: 'b', date: '2026-02-01' },
        ]);
        expect(Array.from(map.entries())).toEqual([['a', '2026-01-05'], ['b', '2026-02-01']]);
    });

    it('salta i movimenti senza articolo o senza data valida', () => {
        const map = firstMovementDates([
            { itemId: null, date: '2026-01-01' },
            { itemId: 'a', date: null },
            { itemId: 'b', date: 'oggi' },
        ]);
        expect(map.size).toBe(0);
    });
});
