import type { SupabaseClient } from "@supabase/supabase-js";
import { jobDocumentsApi, deliveryNotesApi, purchasesApi } from "@/lib/api";
import { jobDocumentFoldersApi } from "@/lib/services/job-document-folders";
import { jobComplianceApi, complianceApi } from "@/lib/services/compliance";
import { suppliersApi } from "@/lib/services/suppliers";
import { mapDbToPurchase } from "@/lib/services/purchases";

// Ricostruisce, lato scheda commessa interna (utente già autenticato), la stessa struttura
// dati del portale ospiti (job.documents.custom/associated/ddt/internalNotes) così il piano
// dello zip (buildJobZipPlan) può essere riusato identico tra le due viste.
export async function fetchInternalJobDocumentTree(jobId: string, supabase: SupabaseClient) {
    const [allDocs, folders, supplierList, associations, ddtComplianceDocs, exitNotes, saleNotes, directPurchases, manuallyAssociatedDb] =
        await Promise.all([
            jobDocumentsApi.getByJobId(jobId),
            jobDocumentFoldersApi.getByJobId(jobId),
            suppliersApi.getAll(),
            jobComplianceApi.getByJobId(jobId),
            complianceApi.getByJobIdFromDDT(jobId),
            deliveryNotesApi.getByJobId(jobId, "exit"),
            deliveryNotesApi.getByJobId(jobId, "sale"),
            purchasesApi.getByJobId(jobId),
            supabase
                .from("purchases")
                .select("*, suppliers(name)")
                .like("notes", `%[associated_job:${jobId}]%`)
                .is("deleted_at", null),
        ]);

    const supplierNameById = new Map<string, string>((supplierList || []).map((s: any) => [s.id, s.name]));

    // --- Documenti Cantiere: job_documents con category "conformita", per tipo/cartella ---
    const conformitaDocs = (allDocs || []).filter((d: any) => d.category === "conformita");
    const folderNameById = new Map<string, string>((folders || []).map((f: any) => [f.id, f.name]));

    const typeOrder: string[] = [];
    const typeGroups = new Map<
        string,
        { typeId: string | null; typeName: string; folderOrder: string[]; folders: Map<string, { folderId: string | null; folderName: string | null; documents: any[] }> }
    >();
    for (const doc of conformitaDocs) {
        const typeKey = doc.conformitaDocumentTypeId || "__untyped__";
        if (!typeGroups.has(typeKey)) {
            typeGroups.set(typeKey, {
                typeId: doc.conformitaDocumentTypeId || null,
                typeName: doc.conformitaDocumentTypeName || "Generico",
                folderOrder: [],
                folders: new Map(),
            });
            typeOrder.push(typeKey);
        }
        const typeGroup = typeGroups.get(typeKey)!;
        const folderKey = doc.folderId || "__root__";
        if (!typeGroup.folders.has(folderKey)) {
            typeGroup.folders.set(folderKey, {
                folderId: doc.folderId || null,
                folderName: doc.folderId ? folderNameById.get(doc.folderId) || "Cartella" : null,
                documents: [],
            });
            typeGroup.folderOrder.push(folderKey);
        }
        typeGroup.folders.get(folderKey)!.documents.push({
            id: doc.id,
            name: doc.name,
            notes: doc.notes || null,
            fileUrl: doc.fileUrl,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
        });
    }
    const custom = typeOrder.map((typeKey) => {
        const g = typeGroups.get(typeKey)!;
        return { typeId: g.typeId, typeName: g.typeName, folders: g.folderOrder.map((fk) => g.folders.get(fk)!) };
    });

    // --- Certificati Conformità: associazioni dirette (shared_compliance_associations) ---
    const associated = (associations || [])
        .map((a: any) => {
            const doc = a.document;
            if (!doc) return null;
            return {
                id: a.id,
                name: a.customName || doc.name,
                notes: a.customNotes || doc.notes || null,
                fileUrl: doc.fileUrl,
                fileType: (doc.fileUrl || "").split(".").pop()?.toLowerCase() || "pdf",
                fileSize: doc.fileSize,
                supplierName: supplierNameById.get(doc.supplierId) || "Sconosciuto",
                typeName: doc.documentTypeName || "Generico",
            };
        })
        .filter(Boolean);

    // --- DDT e Bolle Consegna ---
    const ddt: any[] = [];

    // Certificati di conformità legati a DDT associati manualmente (stessa fonte di "Conf. Ass. DDT")
    for (const doc of ddtComplianceDocs || []) {
        ddt.push({
            id: doc.id,
            name: doc.name,
            notes: doc.purchaseNumber
                ? `DDT Fornitore: ${doc.purchaseNumber}${doc.notes ? `. Note: ${doc.notes}` : ""}`
                : doc.notes || null,
            fileUrl: doc.fileUrl,
            fileType: (doc.fileUrl || "").split(".").pop()?.toLowerCase() || "pdf",
            fileSize: doc.fileSize,
            supplierName: supplierNameById.get(doc.supplierId) || "Sconosciuto",
        });
    }

    // File fisici dei DDT: acquisti collegati direttamente alla commessa (non associati manualmente)
    const cantierePurchases = (directPurchases || []).filter((p: any) => !p.notes?.includes(`[associated_job:${jobId}]`));
    cantierePurchases
        .filter((p: any) => p.orderType !== "order")
        .forEach((p: any) => {
            (p.documentUrls || []).forEach((url: string, index: number) => {
                const formattedDate = p.deliveryNoteDate ? new Date(p.deliveryNoteDate).toLocaleDateString("it-IT") : "";
                ddt.push({
                    id: `${p.id}-doc-${index + 1}`,
                    name: `DDT ${p.deliveryNoteNumber}${formattedDate ? ` DEL ${formattedDate}` : ""}`,
                    notes: null,
                    fileUrl: url,
                    fileType: (url || "").split(".").pop()?.toLowerCase() || "pdf",
                    fileSize: null,
                    supplierName: p.supplierName || "Sconosciuto",
                });
            });
        });

    // File fisici dei DDT associati manualmente da DDT/Bolle
    const manuallyAssociatedPurchases = (manuallyAssociatedDb.data || []).map((p: any) => mapDbToPurchase(p));
    manuallyAssociatedPurchases
        .filter((p: any) => p.orderType !== "order")
        .forEach((p: any) => {
            (p.documentUrls || []).forEach((url: string, index: number) => {
                const formattedDate = p.deliveryNoteDate ? new Date(p.deliveryNoteDate).toLocaleDateString("it-IT") : "";
                ddt.push({
                    id: `${p.id}-assoc-${index + 1}`,
                    name: `DDT ${p.deliveryNoteNumber}${formattedDate ? ` DEL ${formattedDate}` : ""}`,
                    notes: null,
                    fileUrl: url,
                    fileType: (url || "").split(".").pop()?.toLowerCase() || "pdf",
                    fileSize: null,
                    supplierName: p.supplierName || "Sconosciuto",
                });
            });
        });

    // --- Bolle interne OPI ---
    const internalNotes = [...(exitNotes || []), ...(saleNotes || [])].map((note: any) => ({
        id: note.id,
        number: note.number,
        date: note.date,
        type: note.type,
        causal: note.causal,
        pickupLocation: note.pickupLocation,
        deliveryLocation: note.deliveryLocation,
        notes: note.notes,
        items: (note.items || []).map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            name: item.inventoryName,
            model: item.inventoryModel,
            code: item.inventoryCode,
            unit: item.inventoryUnit,
        })),
    }));

    return { documents: { custom, associated, ddt, internalNotes } };
}
