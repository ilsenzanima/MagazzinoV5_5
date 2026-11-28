import { isElsewhere, locateLot, shortWarehouseName, stockByLot } from "../lot-warehouse";

// Lotto da 360 dopo un trasferimento di 100 da "a" a "b"
const stock = stockByLot([
    { purchase_item_id: "l1", warehouse_id: "a", warehouse_name: "X S.R.L. MAGAZZINO", quantity: "260", pieces: "260" },
    { purchase_item_id: "l1", warehouse_id: "b", warehouse_name: "X S.R.L. SEDE OPERATIVA", quantity: "100", pieces: "100" },
]).get("l1");

describe("lot-warehouse", () => {
    it("dopo un trasferimento parziale ogni magazzino ha solo la sua quantità", () => {
        expect(locateLot(stock, "a")).toEqual({ quantity: 260, pieces: 260, away: [{ name: "SEDE OPERATIVA", quantity: 100 }] });
        expect(locateLot(stock, "b")?.quantity).toBe(100);
        expect(isElsewhere(locateLot(stock, "a"))).toBe(false);
    });

    it("segnala come altrove un lotto che nel magazzino di partenza non c'è", () => {
        expect(isElsewhere(locateLot(stock, "c"))).toBe(true);
    });

    it("rende disponibile quanto la bolla in modifica ha già preso", () => {
        expect(locateLot(stock, "b", { quantity: 20, pieces: 20 })?.quantity).toBe(120);
    });

    it("non limita senza magazzino di partenza o senza sede del lotto", () => {
        expect(locateLot(stock, "")).toBeNull();
        expect(locateLot(undefined, "a")).toBeNull();
    });

    it("accorcia il nome del magazzino", () => {
        expect(shortWarehouseName("OPI FIRESAFE S.R.L. SEDE OPERATIVA")).toBe("SEDE OPERATIVA");
        expect(shortWarehouseName("Cervignano")).toBe("Cervignano");
    });
});
