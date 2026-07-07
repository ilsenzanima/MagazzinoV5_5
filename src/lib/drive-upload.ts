// Carica un file su Google Drive senza il limite di ~4.5MB per richiesta delle
// funzioni serverless di Vercel: il file viene inviato a pezzi (chunk) al nostro
// endpoint di relay, che li inoltra a una sessione di upload "resumable" su Drive.

const CHUNK_SIZE = 4 * 1024 * 1024 // multiplo di 256KB, richiesto da Drive

export interface DriveUploadResult {
    fileId: string
    name: string
    webViewLink: string
}

const folderPromiseCache: Record<string, Promise<string> | undefined> = {}

/**
 * Assicura che il percorso di cartelle esista su Google Drive.
 * Ritorna una promessa con l'id della cartella finale.
 * Utilizza una cache locale per evitare race conditions ed evitare di creare cartelle duplicate
 * quando più file dello stesso cantiere/commessa vengono caricati simultaneamente.
 */
export function ensureFolderOnDrive(folderPath: string[]): Promise<string> {
    const key = folderPath.join('/')
    if (folderPromiseCache[key]) {
        return folderPromiseCache[key]
    }

    const promise = (async () => {
        const res = await fetch('/api/drive/upload-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath }),
        })
        const data = await res.json()
        if (!res.ok) {
            delete folderPromiseCache[key]
            throw new Error(data.error || 'Errore nella creazione della cartella su Google Drive')
        }
        return data.folderId
    })()

    folderPromiseCache[key] = promise
    return promise
}

export async function uploadFileToDrive(file: File, folderPath: string[] | string): Promise<DriveUploadResult> {
    let folderId: string
    if (typeof folderPath === 'string') {
        folderId = folderPath
    } else {
        folderId = await ensureFolderOnDrive(folderPath)
    }

    const sessionRes = await fetch('/api/drive/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            folderId,
        }),
    })
    const session = await sessionRes.json()
    if (!sessionRes.ok) throw new Error(session.error || 'Errore upload su Google Drive')

    const total = file.size
    let start = 0
    let uploadedFile: any = null

    do {
        const end = Math.min(start + CHUNK_SIZE, total)
        const chunk = file.slice(start, end)
        const chunkRes = await fetch('/api/drive/upload-chunk', {
            method: 'POST',
            headers: {
                'X-Drive-Upload-Url': session.uploadUrl,
                'Content-Range': `bytes ${start}-${Math.max(end - 1, 0)}/${total}`,
            },
            body: chunk,
        })
        const chunkResult = await chunkRes.json()
        if (!chunkRes.ok) throw new Error(chunkResult.error || 'Errore upload su Google Drive')
        if (chunkResult.done) uploadedFile = chunkResult.file
        start = end
    } while (start < total)

    if (!uploadedFile) throw new Error('Upload su Google Drive incompleto')
    return { fileId: uploadedFile.id, name: uploadedFile.name, webViewLink: uploadedFile.webViewLink }
}
