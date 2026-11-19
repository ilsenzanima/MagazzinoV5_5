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
        // (pagina in un blob e non in srcdoc: i blob sono già consentiti dalla politica di sicurezza del sito)
        if (kind === "image") {
            const page = new Blob([`<html><body style="margin:0"><img src="${url}" style="max-width:100%;max-height:100vh;display:block;margin:auto"></body></html>`], { type: "text/html" })
            frame.src = URL.createObjectURL(page)
        } else frame.src = url
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

// Foto ridimensionata (lato lungo max 1800 px) e ricompressa in JPEG: PDF leggeri anche con molte foto
async function photoToJpeg(d: DocLike): Promise<{ data: string; w: number; h: number }> {
    // Senza download=1 il server serve l'originale, o un JPEG per i file HEIC che i browser non leggono
    const url = isDriveFile(d.fileUrl) ? `/api/drive/download?fileId=${encodeURIComponent(d.fileUrl)}` : await documentUrl(d)
    const blob = await fetchBlob(url)
    const bmp = await createImageBitmap(blob)
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k)
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    return { data: canvas.toDataURL("image/jpeg", 0.85), w, h }
}

// Un PDF con le foto scelte, una per pagina A4 (orizzontale o verticale secondo la foto)
export async function photosToPdf(docs: DocLike[]): Promise<{ blob: Blob; failed: string[] }> {
    const { jsPDF } = await import("jspdf")
    let pdf: InstanceType<typeof jsPDF> | null = null
    const failed: string[] = []
    for (const d of docs) {
        try {
            const img = await photoToJpeg(d)
            const landscape = img.w > img.h
            const orientation = landscape ? "l" : "p"
            if (!pdf) pdf = new jsPDF({ orientation, unit: "mm", format: "a4" })
            else pdf.addPage("a4", orientation)
            const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight()
            const m = 10
            const k = Math.min((pw - 2 * m) / img.w, (ph - 2 * m) / img.h)
            const w = img.w * k, h = img.h * k
            pdf.addImage(img.data, "JPEG", (pw - w) / 2, (ph - h) / 2, w, h)
        } catch (e) {
            console.error("Foto non inserita nel PDF", d.name, e)
            failed.push(d.name)
        }
    }
    if (!pdf) throw new Error("Nessuna foto utilizzabile")
    return { blob: pdf.output("blob"), failed }
}

export async function downloadPhotosPdf(docs: DocLike[], fileName = "foto.pdf") {
    const r = await photosToPdf(docs)
    saveBlob(r.blob, fileName)
    return r.failed
}

// Stampa le foto come un unico lavoro di stampa (una per pagina)
export async function printPhotos(docs: DocLike[]) {
    const r = await photosToPdf(docs)
    await printBlob(r.blob, "pdf")
    return r.failed
}
