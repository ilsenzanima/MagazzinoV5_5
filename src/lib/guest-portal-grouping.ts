// Logica di raggruppamento condivisa tra il rendering del portale ospiti
// (src/app/cantiere-ospite/[id]/page.tsx) e il builder dello zip "documentazione
// completa", così le due viste restano sempre coerenti.

export interface ConformitaGroup {
    typeName: string;
    bySupplier: Map<string, any[]>;
}

// Certificati Conformità: raggruppati per tipo di conformità, e come sottocartella per fornitore
export function buildConformitaGroups(job: any): ConformitaGroup[] {
    const conformitaByType = new Map<string, ConformitaGroup>();
    for (const doc of job.documents.associated) {
        const typeKey = doc.typeName || "Generico";
        if (!conformitaByType.has(typeKey)) conformitaByType.set(typeKey, { typeName: typeKey, bySupplier: new Map() });
        const typeGroup = conformitaByType.get(typeKey)!;
        const supplierKey = doc.supplierName || "Sconosciuto";
        if (!typeGroup.bySupplier.has(supplierKey)) typeGroup.bySupplier.set(supplierKey, []);
        typeGroup.bySupplier.get(supplierKey)!.push(doc);
    }
    return Array.from(conformitaByType.values());
}

export interface DdtGroup {
    supplierName: string;
    items: { kind: "doc" | "note"; item: any }[];
}

// DDT e Bolle Consegna: raggruppati per fornitore (le bolle interne sotto "OPI")
export function buildDdtGroups(job: any): DdtGroup[] {
    const ddtBySupplier = new Map<string, { kind: "doc" | "note"; item: any }[]>();
    for (const doc of job.documents.ddt) {
        const key = doc.supplierName || "Sconosciuto";
        if (!ddtBySupplier.has(key)) ddtBySupplier.set(key, []);
        ddtBySupplier.get(key)!.push({ kind: "doc", item: doc });
    }
    for (const note of job.documents.internalNotes) {
        if (!ddtBySupplier.has("OPI")) ddtBySupplier.set("OPI", []);
        ddtBySupplier.get("OPI")!.push({ kind: "note", item: note });
    }
    return Array.from(ddtBySupplier.entries()).map(([supplierName, items]) => ({ supplierName, items }));
}
