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
        // Il frame ha dimensioni reali ma e' invisibile: con 0x0 Chrome non carica il visualizzatore PDF e non stampa nulla
        frame.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;"
        let finished = false
        const cleanup = () => { frame.remove(); URL.revokeObjectURL(url) }
        // Il frame resta finche' la finestra di stampa e' aperta (alcuni browser la mostrano senza bloccare la pagina):
        // si toglie alla chiusura dell'anteprima, con un limite di sicurezza
        const done = () => { if (finished) return; finished = true; setTimeout(cleanup, 500); resolve() }
        frame.onload = () => {
            // Al PDF serve un attimo perche' il visualizzatore sia pronto
            setTimeout(() => {
                try {
                    const w = frame.contentWindow!
                    w.addEventListener("afterprint", done)
                    w.focus()
                    w.print()
                    // Se il browser non segnala la chiusura, si prosegue comunque dopo un po'
                    setTimeout(done, 120_000)
                } catch (e) { cleanup(); reject(e) }
            }, kind === "pdf" ? 700 : 200)
        }
        // Per le immagini il frame si considera caricato solo dopo l'immagine, quindi si stampa a immagine pronta
        // (pagina in un blob e non in srcdoc: i blob sono già consentiti dalla politica di sicurezza del sito)
        if (kind === "image") {
            const page = new Blob([`<html><body style="margin:0"><img loading="eager" src="${url}" style="max-width:100%;max-height:100vh;display:block;margin:auto"></body></html>`], { type: "text/html" })
            frame.src = URL.createObjectURL(page)
        } else frame.src = url
        document.body.appendChild(frame)
    })
}

export interface PrintResult { printed: number; skipped: string[] }

// Stampa uno o più documenti senza aprirli: PDF e immagini direttamente, Word/Excel/PowerPoint dopo la conversione
// in PDF fatta sul server. Più documenti vengono uniti in un solo PDF: una sola finestra di stampa, un solo annulla.
// I formati che non si possono stampare vengono elencati in `skipped`.
export async function printDocuments(docs: DocLike[]): Promise<PrintResult> {
    const result: PrintResult = { printed: 0, skipped: [] }
    const parts: Blob[] = []
    const imageParts = new Map<number, DocLike>()
    for (const d of docs) {
        const ext = extOf(d)
        try {
            if (ext === "pdf") {
                parts.push(await fetchBlob(await documentUrl(d)))
            } else if (IMAGES.has(ext)) {
                imageParts.set(parts.length, d)
                parts.push(new Blob())
            } else if (OFFICE.has(ext) && isDriveFile(d.fileUrl)) {
                parts.push(await fetchBlob(`/api/drive/pdf?fileId=${encodeURIComponent(d.fileUrl)}`))
            } else {
                result.skipped.push(d.name)
                continue
            }
        } catch (e) {
            console.error("Stampa non riuscita", d.name, e)
            result.skipped.push(d.name)
        }
    }
    if (parts.length === 0) return result

    let toPrint: Blob
    if (parts.length === 1 && imageParts.size === 0) {
        toPrint = parts[0]
    } else {
        const { PDFDocument } = await import("pdf-lib")
        const out = await PDFDocument.create()
        let added = 0
        for (let i = 0; i < parts.length; i++) {
            try {
                const img = imageParts.get(i)
                if (img) {
                    const j = await photoToJpeg(img)
                    const jpg = await out.embedJpg(await (await fetch(j.data)).arrayBuffer())
                    const landscape = j.w > j.h
                    const [pw, ph] = landscape ? [842, 595] : [595, 842]
                    const k = Math.min((pw - 40) / j.w, (ph - 40) / j.h)
                    const page = out.addPage([pw, ph])
                    page.drawImage(jpg, { x: (pw - j.w * k) / 2, y: (ph - j.h * k) / 2, width: j.w * k, height: j.h * k })
                } else {
                    const src = await PDFDocument.load(await parts[i].arrayBuffer(), { ignoreEncryption: true })
                    const pages = await out.copyPages(src, src.getPageIndices())
                    pages.forEach(pg => out.addPage(pg))
                }
                added++
            } catch (e) {
                console.error("Documento non unito alla stampa", i, e)
                result.skipped.push(imageParts.get(i)?.name ?? `documento ${i + 1}`)
            }
        }
        if (added === 0) return result
        result.printed = added
        toPrint = new Blob([await out.save() as BlobPart], { type: "application/pdf" })
    }
    try {
        await printBlob(toPrint, "pdf")
        if (result.printed === 0) result.printed = parts.length
    } catch (e) {
        console.error("Stampa non riuscita", e)
        result.skipped.push(...docs.map(d => d.name))
        result.printed = 0
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

// Stampa un PDF gia' pronto (es. la bolla) senza scaricarlo
export const printPdfBlob = (blob: Blob) => printBlob(blob, "pdf")
