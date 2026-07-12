import type { PlannedZipEntry } from "./documentation-zip-types";

// Costruisce lo zip "documentazione completa" (usato sia dal portale ospiti che dalla
// scheda commessa interna): scarica/genera i byte di ogni file pianificato, li inserisce
// nelle cartelle previste, aggiunge il PDF di copertina alla radice e avvia il download.
export async function buildAndDownloadDocumentationZip(params: {
    entries: PlannedZipEntry[];
    coverPdfBlob: Blob;
    coverPdfFileName: string;
    zipFileName: string;
    onProgress?: (done: number, total: number) => void;
}): Promise<void> {
    const { entries, coverPdfBlob, coverPdfFileName, zipFileName, onProgress } = params;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    zip.file(coverPdfFileName, coverPdfBlob);

    let done = 0;
    const total = entries.length;
    onProgress?.(done, total);

    // Sequenziale (non in parallelo): evita di aprire decine di richieste concorrenti
    // verso Google Drive/Supabase Storage per commesse con molti documenti.
    for (const entry of entries) {
        try {
            const blob = await entry.getBlob();
            const folder = entry.pathSegments.length > 0 ? zip.folder(entry.pathSegments.join("/")) : zip;
            folder!.file(entry.fileName, blob);
        } catch (err) {
            console.error(`Impossibile scaricare "${entry.fileName}"`, err);
        } finally {
            done += 1;
            onProgress?.(done, total);
        }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipFileName;
    a.click();
    URL.revokeObjectURL(url);
}
