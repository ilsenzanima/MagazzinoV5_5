// Un lotto si preleva solo dal magazzino in cui si trova, e solo per la quantità che c'è lì:
// qui si divide il residuo tra magazzino di partenza e altri magazzini.

export interface WarehouseQty {
    warehouseId: string;
    warehouseName?: string | null;
    quantity: number;
    pieces?: number | null;
}

export interface LotLocation {
    quantity: number;                               // disponibile nel magazzino di partenza
    pieces: number;
    away: { name: string; quantity: number }[];     // quantità dello stesso lotto negli altri magazzini
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

// "OPI FIRESAFE S.R.L. SEDE OPERATIVA" -> "SEDE OPERATIVA"
export const shortWarehouseName = (name?: string | null) =>
    (name || "").replace(/^.*\bS\.?R\.?L\.?\s+/i, "").trim() || name || "altro magazzino";

// Righe di purchase_item_warehouse_stock raggruppate per lotto
export const stockByLot = (rows: any[]) => {
    const map = new Map<string, WarehouseQty[]>();
    for (const r of rows) {
        map.set(r.purchase_item_id, [
            ...(map.get(r.purchase_item_id) ?? []),
            {
                warehouseId: r.warehouse_id,
                warehouseName: r.warehouse_name,
                quantity: Number(r.quantity ?? 0),
                pieces: r.pieces != null ? Number(r.pieces) : null,
            },
        ]);
    }
    return map;
};

// null = nessun limite (vecchie bolle senza magazzino di partenza, o sede del lotto non nota).
// "own" è quanto la bolla in modifica ha già preso da questo lotto: torna disponibile.
export const locateLot = (
    stock: WarehouseQty[] | undefined,
    fromWarehouseId?: string | null,
    own: { quantity: number; pieces: number } = { quantity: 0, pieces: 0 }
): LotLocation | null => {
    if (!fromWarehouseId || !stock?.length) return null;
    const here = stock.filter((s) => s.warehouseId === fromWarehouseId);
    return {
        quantity: round4(here.reduce((sum, s) => sum + s.quantity, own.quantity)),
        pieces: round4(here.reduce((sum, s) => sum + (s.pieces ?? 0), own.pieces)),
        away: stock
            .filter((s) => s.warehouseId !== fromWarehouseId && s.quantity > 0.001)
            .map((s) => ({ name: shortWarehouseName(s.warehouseName), quantity: round4(s.quantity) })),
    };
};

// Il lotto ha materiale, ma tutto in altri magazzini
export const isElsewhere = (location: LotLocation | null) =>
    !!location && location.quantity <= 0.001 && location.away.length > 0;
