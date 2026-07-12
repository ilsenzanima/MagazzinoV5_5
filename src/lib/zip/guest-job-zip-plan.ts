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

// Aggiunge un documento standard (con fileUrl/rawFileId) al gruppo di zip/PDF corrente,
// gestendo dedup dei nomi file e restituendo la entry per l'indice del PDF.
function addDocEntry(
    doc: any,
    pathSegments: string[],
    usedNames: Set<string>,
    entries: PlannedZipEntry[]
): CoverPdfEntry {
    const fileName = dedupeFileName(buildFileName(doc.name, doc.fileType), usedNames);
    entries.push({
        pathSegments,
        fileName,
        getBlob: () => fetchBlob(guestDocDownloadUrl(doc)),
    });
    return {
        name: doc.name,
        relativePath: [...pathSegments, fileName].join("/"),
        notes: doc.notes || null,
    };
}

export function buildGuestJobZipPlan(job: any): ZipPlan {
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
            const coverEntries = folder.documents.map((doc: any) => addDocEntry(doc, pathSegments, usedNames, entries));
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
            const coverEntries = docs.map((doc: any) => addDocEntry(doc, pathSegments, usedNames, entries));
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
                coverEntries.push(addDocEntry(item, pathSegments, usedNames, entries));
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
