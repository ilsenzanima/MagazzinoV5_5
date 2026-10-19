import { planLotSplit } from '../lot-split';

const lots = [
    { id: 'A', remaining: 18 },
    { id: 'B', remaining: 60 },
    { id: 'C', remaining: 10 },
];

describe('divisione sui lotti', () => {
    it('un solo lotto basta', () => {
        expect(planLotSplit(10, lots, 'A')).toEqual({ allocations: [{ lotId: 'A', quantity: 10 }], missing: 0, needsSplit: false });
    });

    it('parte dal lotto scelto e prosegue in ordine FIFO', () => {
        const plan = planLotSplit(24, lots, 'A');
        expect(plan.allocations).toEqual([{ lotId: 'A', quantity: 18 }, { lotId: 'B', quantity: 6 }]);
        expect(plan.needsSplit).toBe(true);
        expect(plan.missing).toBe(0);
    });

    it('dal lotto scelto in poi, poi quelli prima', () => {
        const plan = planLotSplit(75, lots, 'B');
        expect(plan.allocations).toEqual([{ lotId: 'B', quantity: 60 }, { lotId: 'C', quantity: 10 }, { lotId: 'A', quantity: 5 }]);
    });

    it('segnala la quantità che nessun lotto copre', () => {
        const plan = planLotSplit(100, lots, 'A');
        expect(plan.missing).toBe(12);
        expect(plan.allocations.reduce((s, a) => s + a.quantity, 0)).toBe(88);
    });

    it('ignora i lotti esauriti', () => {
        expect(planLotSplit(5, [{ id: 'X', remaining: 0 }, { id: 'Y', remaining: 8 }], 'X').allocations).toEqual([{ lotId: 'Y', quantity: 5 }]);
    });
});
