// Tipi condivisi tra il builder dello zip "documentazione completa" (portale ospiti
// e scheda commessa interna) e il generatore del PDF di copertina/indice, in modo
// che i percorsi relativi usati nei link del PDF corrispondano esattamente ai
// percorsi dei file dentro lo zip.

export interface PlannedZipEntry {
    // Segmenti di cartella, nell'ordine in cui vanno annidati (es. ["Documenti Cantiere", "Planimetrie"])
    pathSegments: string[];
    // Nome del file finale, con estensione (es. "Planimetria Piano 1.pdf")
    fileName: string;
    // Recupera i byte del file (fetch da URL o generazione al volo, es. PDF bolla interna)
    getBlob: () => Promise<Blob>;
}

export interface CoverPdfEntry {
    name: string;
    // Percorso relativo al file dentro lo zip (dalla root, dove risiede anche il PDF di copertina)
    relativePath: string;
    notes?: string | null;
}

export interface CoverPdfGroup {
    label: string;
    // Percorso relativo alla cartella del gruppo (per il link "Apri cartella")
    folderRelativePath: string;
    entries: CoverPdfEntry[];
}

export interface CoverPdfSection {
    title: string;
    groups: CoverPdfGroup[];
}

export interface ZipPlan {
    entries: PlannedZipEntry[];
    sections: CoverPdfSection[];
}

export interface CoverPdfJobInfo {
    code: string;
    name: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}

// Rimuove caratteri non ammessi nei nomi di file/cartella su Windows/macOS
export function sanitizePathSegment(raw: string): string {
    const cleaned = (raw || "")
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned || "Senza nome";
}

// Aggiunge l'estensione da fileType se il nome non la include già, ed evita doppie estensioni
export function buildFileName(name: string, fileType?: string | null): string {
    const base = sanitizePathSegment(name || "Documento");
    const ext = (fileType || "pdf").toLowerCase().replace(".", "");
    if (base.toLowerCase().endsWith(`.${ext}`)) return base;
    return `${base}.${ext}`;
}

// Un'estensione plausibile è corta e alfanumerica (pdf, jpg, docx...). Per i documenti
// caricati su Google Drive senza una colonna file_type dedicata (es. certificati fornitore,
// DDT fisici), il codice altrove deriva "l'estensione" spezzando l'URL sul punto: se l'URL è
// un bare Drive fileId (nessun punto), il risultato è l'intero fileId (30+ caratteri opachi),
// non un'estensione vera. Usare questo controllo per capire quando NON fidarsi del valore e
// derivare l'estensione reale dal Content-Type del file scaricato.
export function isPlausibleExtension(ext?: string | null): boolean {
    return !!ext && /^[a-z0-9]{1,5}$/i.test(ext);
}

const MIME_TO_EXTENSION: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
};

// Ricava un'estensione plausibile dal Content-Type reale del file scaricato. Fallback "pdf"
// perché la maggior parte dei documenti non tipizzati (certificati, DDT) sono PDF nella pratica.
export function extensionFromMimeType(mimeType?: string | null): string {
    if (!mimeType) return "pdf";
    return MIME_TO_EXTENSION[mimeType.split(";")[0].trim().toLowerCase()] || "pdf";
}

// Deduplica i nomi file all'interno della stessa cartella (JSZip sovrascriverebbe silenziosamente altrimenti)
export function dedupeFileName(fileName: string, usedNames: Set<string>): string {
    if (!usedNames.has(fileName)) {
        usedNames.add(fileName);
        return fileName;
    }
    const dotIndex = fileName.lastIndexOf(".");
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    const ext = dotIndex > 0 ? fileName.slice(dotIndex) : "";
    let i = 2;
    let candidate = `${base} (${i})${ext}`;
    while (usedNames.has(candidate)) {
        i += 1;
        candidate = `${base} (${i})${ext}`;
    }
    usedNames.add(candidate);
    return candidate;
}
