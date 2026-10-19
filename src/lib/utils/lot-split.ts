// Divisione di una quantità su più lotti, in ordine FIFO a partire dal lotto scelto.

export interface LotAvailability {
    id: string;
    remaining: number;     // quantità residua del lotto
}

export interface LotAllocation {
    lotId: string;
    quantity: number;
}

export interface LotSplitPlan {
    allocations: LotAllocation[];
    missing: number;       // quantità che nessun lotto riesce a coprire
    needsSplit: boolean;   // vero se serve più di un lotto
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// `lots` è già in ordine FIFO. Si parte dal lotto scelto e si prosegue con gli altri nello stesso ordine.
export function planLotSplit(requested: number, lots: LotAvailability[], selectedLotId?: string): LotSplitPlan {
    const usable = lots.filter(l => l.remaining > 0.001);
    const startIndex = Math.max(0, usable.findIndex(l => l.id === selectedLotId));
    const ordered = [...usable.slice(startIndex), ...usable.slice(0, startIndex)];

    const allocations: LotAllocation[] = [];
    let left = requested;
    for (const lot of ordered) {
        if (left <= 0.001) break;
        const take = round2(Math.min(left, lot.remaining));
        allocations.push({ lotId: lot.id, quantity: take });
        left = round2(left - take);
    }
    return { allocations, missing: Math.max(0, round2(left)), needsSplit: allocations.length > 1 };
}
