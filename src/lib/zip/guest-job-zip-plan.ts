import { buildConformitaGroups, buildDdtGroups } from "@/lib/guest-portal-grouping";
import {
    buildFileName,
    dedupeFileName,
    sanitizePathSegment,
    type CoverPdfEntry,
    type CoverPdfGroup,
    type CoverPdfSection,
    type PlannedZipEntry,
    type ZipPlan,
} from "./documentation-zip-types";

// Scarica i byte reali di un documento del portale ospiti: per i file Google Drive usa
// sempre il proxy /api/guest/drive-image (funziona per qualsiasi tipo di file, non solo
// immagini, nonostante il nome), per i file Supabase Storage il fileUrl è già una signed
// URL con i byte diretti.
function guestDocDownloadUrl(doc: any): string {
    if (doc.rawFileId) return `/api/guest/drive-image?fileId=${encodeURIComponent(doc.rawFileId)}`;
    return doc.fileUrl;
}

async function fetchBlob(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
}

// Aggiunge un documento standard al gruppo di zip/PDF corrente, gestendo dedup dei nomi
// file e restituendo la entry per l'indice del PDF. `fetchDocBlob` astrae come recuperare
// i byte del documento (diverso tra portale ospiti e scheda commessa interna).
function addDocEntry(
    doc: any,
    pathSegments: string[],
    usedNames: Set<string>,
    entries: PlannedZipEntry[],
    fetchDocBlob: (doc: any) => Promise<Blob>
): CoverPdfEntry {
    const fileName = dedupeFileName(buildFileName(doc.name, doc.fileType), usedNames);
    entries.push({
        pathSegments,
        fileName,
        getBlob: () => fetchDocBlob(doc),
    });
    return {
        name: doc.name,
        relativePath: [...pathSegments, fileName].join("/"),
        notes: doc.notes || null,
    };
}

// Costruisce il piano di zip (documenti + sezioni per il PDF di copertina) a partire dalla
// stessa struttura dati usata per renderizzare la commessa (job.documents.custom/associated/
// ddt/internalNotes). `fetchDocBlob` recupera i byte reali di un documento: diverso tra
// portale ospiti (proxy pubblico) e scheda commessa interna (sessione Supabase autenticata).
export function buildJobZipPlan(job: any, fetchDocBlob: (doc: any) => Promise<Blob>): ZipPlan {
    const entries: PlannedZipEntry[] = [];
    const sections: CoverPdfSection[] = [];

    // --- Documenti Cantiere ---
    const customGroups: any[] = job.documents.custom || [];
    const customCoverGroups: CoverPdfGroup[] = [];
    for (const typeGroup of customGroups) {
        for (const folder of typeGroup.folders) {
            const pathSegments = folder.folderName
                ? ["Documenti Cantiere", sanitizePathSegment(typeGroup.typeName), sanitizePathSegment(folder.folderName)]
                : ["Documenti Cantiere", sanitizePathSegment(typeGroup.typeName)];
            const usedNames = new Set<string>();
            const coverEntries = folder.documents.map((doc: any) => addDocEntry(doc, pathSegments, usedNames, entries, fetchDocBlob));
            if (coverEntries.length > 0) {
                customCoverGroups.push({
                    label: folder.folderName ? `${typeGroup.typeName} / ${folder.folderName}` : typeGroup.typeName,
                    folderRelativePath: pathSegments.join("/"),
                    entries: coverEntries,
                });
            }
        }
    }
    sections.push({ title: "Documenti Cantiere", groups: customCoverGroups });

    // --- Certificati Conformità ---
    const conformitaGroups = buildConformitaGroups(job);
    const conformitaCoverGroups: CoverPdfGroup[] = [];
    for (const typeGroup of conformitaGroups) {
        for (const [supplierName, docs] of Array.from(typeGroup.bySupplier.entries())) {
            const pathSegments = ["Certificati Conformità", sanitizePathSegment(typeGroup.typeName), sanitizePathSegment(supplierName)];
            const usedNames = new Set<string>();
            const coverEntries = docs.map((doc: any) => addDocEntry(doc, pathSegments, usedNames, entries, fetchDocBlob));
            if (coverEntries.length > 0) {
                conformitaCoverGroups.push({
                    label: `${typeGroup.typeName} / ${supplierName}`,
                    folderRelativePath: pathSegments.join("/"),
                    entries: coverEntries,
                });
            }
        }
    }
    sections.push({ title: "Certificati Conformità", groups: conformitaCoverGroups });

    // --- DDT e Bolle Consegna ---
    const ddtGroups = buildDdtGroups(job);
    const ddtCoverGroups: CoverPdfGroup[] = [];
    for (const group of ddtGroups) {
        const pathSegments = ["DDT e Bolle Consegna", sanitizePathSegment(group.supplierName)];
        const usedNames = new Set<string>();
        const coverEntries: CoverPdfEntry[] = [];
        for (const { kind, item } of group.items) {
            if (kind === "doc") {
                coverEntries.push(addDocEntry(item, pathSegments, usedNames, entries, fetchDocBlob));
            } else {
                // Bolla interna OPI: nessun file caricato, il PDF viene generato al volo
                // con lo stesso layout istituzionale usato per il download singolo.
                const dateLabel = new Date(item.date).toLocaleDateString("it-IT").replace(/\//g, "-");
                const fileName = dedupeFileName(buildFileName(`DDT ${item.number} DEL ${dateLabel}`, "pdf"), usedNames);
                entries.push({
                    pathSegments,
                    fileName,
                    getBlob: async () => {
                        const { generateDeliveryNotePdfBlob } = await import("@/lib/pdf/delivery-note-pdf");
                        const noteData = {
                            id: item.id,
                            number: item.number,
                            date: item.date,
                            type: item.type,
                            causal: item.causal,
                            pickupLocation: item.pickupLocation,
                            deliveryLocation: item.deliveryLocation,
                            notes: item.notes,
                        };
                        const itemsData = item.items.map((it: any) => ({
                            id: it.id,
                            quantity: it.quantity,
                            pieces: it.pieces,
                            coefficient: it.coefficient,
                            inventoryName: it.name,
                            inventoryModel: it.model,
                            inventoryCode: it.code,
                            inventoryUnit: it.unit,
                        }));
                        return generateDeliveryNotePdfBlob(noteData as any, itemsData);
                    },
                });
                coverEntries.push({
                    name: `DDT ${item.number} DEL ${dateLabel}`,
                    relativePath: [...pathSegments, fileName].join("/"),
                });
            }
        }
        if (coverEntries.length > 0) {
            ddtCoverGroups.push({
                label: group.supplierName,
                folderRelativePath: pathSegments.join("/"),
                entries: coverEntries,
            });
        }
    }
    sections.push({ title: "DDT e Bolle Consegna", groups: ddtCoverGroups });

    return { entries, sections };
}

// Wrapper specifico per il portale ospiti: recupera i byte via il proxy pubblico
// /api/guest/drive-image (Drive) o la signed URL già presente in fileUrl (Storage).
export function buildGuestJobZipPlan(job: any): ZipPlan {
    return buildJobZipPlan(job, (doc) => fetchBlob(guestDocDownloadUrl(doc)));
}
