import { supabase } from "@/lib/supabase"

// Azioni sui documenti caricati senza aprirli: scaricare (uno o più file, in zip se sono più di uno) e stampare.

export interface DocLike {
    id?: string
    name: string
    fileUrl: string
    fileType?: string | null
}

const isDriveFile = (fileUrl: string) => !!fileUrl && !fileUrl.includes("/")
const extOf = (d: DocLike) => (d.fileType || d.name.split(".").pop() || "").toLowerCase().replace(".", "")
const OFFICE = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"])
const IMAGES = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"])

// Nome file con estensione (il nome del documento a volte non ce l'ha)
export const fileNameFor = (d: DocLike) => {
    const ext = extOf(d)
    const name = d.name.trim() || "documento"
    return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name
}

async function documentUrl(d: DocLike): Promise<string> {
    if (isDriveFile(d.fileUrl)) return `/api/drive/download?fileId=${encodeURIComponent(d.fileUrl)}&download=1`
    const path = d.fileUrl.split("/public/documents/")[1]
    if (!path) return d.fileUrl
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600)
    return data?.signedUrl || d.fileUrl
}

async function fetchBlob(url: string): Promise<Blob> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download non riuscito (${res.status})`)
    return res.blob()
}

const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// Uno o più documenti sul PC: un file va giù com'è, più file in un unico zip
export async function downloadDocuments(docs: DocLike[]): Promise<void> {
    if (docs.length === 0) return
    if (docs.length === 1) {
        saveBlob(await fetchBlob(await documentUrl(docs[0])), fileNameFor(docs[0]))
        return
    }
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const used = new Set<string>()
    for (const d of docs) {
        let name = fileNameFor(d)
        for (let n = 2; used.has(name); n++) name = fileNameFor(d).replace(/(\.[^.]*)?$/, ` (${n})$1`)
        used.add(name)
        zip.file(name, await fetchBlob(await documentUrl(d)))
    }
    saveBlob(await zip.generateAsync({ type: "blob" }), "documenti.zip")
}

// Stampa un blob (PDF o immagine) in un frame nascosto, senza aprire nulla a schermo
function printBlob(blob: Blob, kind: "pdf" | "image"): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob)
        const frame = document.createElement("iframe")
        frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
        const done = () => { setTimeout(() => { frame.remove(); URL.revokeObjectURL(url) }, 1000); resolve() }
        frame.onload = () => {
            try {
                const w = frame.contentWindow!
                w.focus()
                w.print()
                // I browser che non aspettano la chiusura della finestra di stampa: si dà tempo prima del file seguente
                setTimeout(done, 800)
            } catch (e) { frame.remove(); URL.revokeObjectURL(url); reject(e) }
        }
        // Per le immagini il frame si considera caricato solo dopo l'immagine, quindi si stampa a immagine pronta
        if (kind === "image") frame.srcdoc = `<html><body style="margin:0"><img src="${url}" style="max-width:100%;max-height:100vh;display:block;margin:auto"></body></html>`
        else frame.src = url
        document.body.appendChild(frame)
    })
}

export interface PrintResult { printed: number; skipped: string[] }

// Stampa uno o più documenti senza aprirli: PDF e immagini direttamente, Word/Excel/PowerPoint dopo la conversione
// in PDF fatta sul server. I formati che non si possono stampare vengono elencati in `skipped`.
export async function printDocuments(docs: DocLike[]): Promise<PrintResult> {
    const result: PrintResult = { printed: 0, skipped: [] }
    for (const d of docs) {
        const ext = extOf(d)
        try {
            if (ext === "pdf") {
                await printBlob(await fetchBlob(await documentUrl(d)), "pdf")
            } else if (IMAGES.has(ext)) {
                await printBlob(await fetchBlob(await documentUrl(d)), "image")
            } else if (OFFICE.has(ext) && isDriveFile(d.fileUrl)) {
                await printBlob(await fetchBlob(`/api/drive/pdf?fileId=${encodeURIComponent(d.fileUrl)}`), "pdf")
            } else {
                result.skipped.push(d.name)
                continue
            }
            result.printed++
        } catch (e) {
            console.error("Stampa non riuscita", d.name, e)
            result.skipped.push(d.name)
        }
    }
    return result
}
