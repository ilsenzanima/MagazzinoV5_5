import { deliveryNotesApi, DeliveryNote, DeliveryNoteItem } from "@/lib/api"
import { mergePdfBlobs, printPdfBlob, saveBlob } from "@/lib/document-actions"

// Stampa e scarica dei PDF delle bolle di movimentazione, una o più alla volta

export async function loadFullNote(movement: DeliveryNote) {
    const fullNote = await deliveryNotesApi.getById(movement.id)
    const grouped = new Map<string, DeliveryNoteItem>()
    fullNote.items?.forEach(item => {
        const existing = grouped.get(item.inventoryId)
        grouped.set(item.inventoryId, existing ? { ...existing, quantity: existing.quantity + item.quantity } : { ...item })
    })
    return { fullNote, items: Array.from(grouped.values()) }
}

async function buildFiles(list: DeliveryNote[]) {
    const { generateDeliveryNotePdfFile } = await import("@/lib/pdf/delivery-note-pdf")
    const files: { blob: Blob; filename: string }[] = []
    for (const m of list) {
        const { fullNote, items } = await loadFullNote(m)
        files.push(await generateDeliveryNotePdfFile(fullNote, items))
    }
    return files
}

export async function printMovements(list: DeliveryNote[]): Promise<void> {
    if (list.length === 0) return
    const files = await buildFiles(list)
    const blob = files.length === 1 ? files[0].blob : await mergePdfBlobs(files.map(f => f.blob))
    // Non si attende la chiusura della finestra di stampa: il pulsante non deve restare bloccato se si annulla
    void printPdfBlob(blob).catch(e => console.error("Stampa non riuscita", e))
}

export async function downloadMovements(list: DeliveryNote[]): Promise<void> {
    if (list.length === 0) return
    const files = await buildFiles(list)
    if (files.length === 1) { saveBlob(files[0].blob, files[0].filename); return }
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const used = new Set<string>()
    for (const f of files) {
        let name = f.filename
        for (let i = 2; used.has(name); i++) name = f.filename.replace(/(\.[^.]*)?$/, ` (${i})$1`)
        used.add(name)
        zip.file(name, f.blob)
    }
    saveBlob(await zip.generateAsync({ type: "blob" }), "bolle.zip")
}
