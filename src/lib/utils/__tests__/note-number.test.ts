import { buildNoteNumber, numberDigits, transferSequence } from "../note-number";

describe("note-number", () => {
    it("numera i trasferimenti con la T e almeno due cifre", () => {
        expect(buildNoteNumber("1", "26", true)).toBe("T01/PP26");
        expect(buildNoteNumber("t5", "26", true)).toBe("T05/PP26");
        expect(buildNoteNumber("120", "27", true)).toBe("T120/PP27");
        expect(numberDigits("9", true)).toBe("09");
    });

    it("lascia invariate le altre bolle", () => {
        expect(buildNoteNumber("182", "26", false)).toBe("182/PP26");
        expect(buildNoteNumber("", "26", false)).toBe("/PP26");
    });

    it("legge il progressivo solo dai numeri di trasferimento", () => {
        expect(transferSequence("T07/PP26")).toBe(7);
        expect(transferSequence("181/PP26")).toBeNull();
    });
});
