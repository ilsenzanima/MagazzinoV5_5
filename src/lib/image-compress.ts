// Comprime le foto caricate come documenti per risparmiare spazio di storage.
// Le immagini sotto la soglia o i file non-immagine (PDF, ecc.) restano invariati.

const MAX_DIMENSION = 1920
const MAX_SIZE_BYTES = 1.5 * 1024 * 1024
const WEBP_QUALITY = 0.8
const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function compressImageIfNeeded(file: File): Promise<File> {
    if (typeof window === 'undefined') return file
    if (!COMPRESSIBLE_TYPES.has(file.type)) return file
    if (file.size <= MAX_SIZE_BYTES) return file

    try {
        const bitmap = await createImageBitmap(file)
        const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
        const width = Math.round(bitmap.width * scale)
        const height = Math.round(bitmap.height * scale)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return file
        ctx.drawImage(bitmap, 0, 0, width, height)

        const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
        if (!blob || blob.size >= file.size) return file

        const newName = file.name.replace(/\.[^.]+$/, '') + '.webp'
        return new File([blob], newName, { type: 'image/webp' })
    } catch {
        return file
    }
}
