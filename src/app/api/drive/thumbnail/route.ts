import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import sharp from "sharp"
import { downloadFile } from "@/lib/google-drive"

// Miniatura di una foto su Drive (~360px, WebP). Si genera la prima volta che serve
// e si conserva nel bucket privato "thumbnails": dalla volta dopo si legge il file
// piccolo invece dell'originale da 2-3 MB. Vale anche per le foto già caricate.
export const maxDuration = 30

const BUCKET = "thumbnails"
const MAX_SIDE = 360
const CACHE = "private, max-age=2592000, immutable"

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 })

    const fileId = req.nextUrl.searchParams.get("fileId")
    if (!fileId || !/^[\w-]{10,100}$/.test(fileId)) {
        return NextResponse.json({ error: "fileId non valido" }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin = serviceKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } })
        : null
    const path = `${fileId}.webp`
    const respond = (bytes: Uint8Array) =>
        new NextResponse(bytes as unknown as BodyInit, { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } })

    try {
        if (admin) {
            const { data: cached } = await admin.storage.from(BUCKET).download(path)
            if (cached) return respond(new Uint8Array(await cached.arrayBuffer()))
        }

        const { buffer } = await downloadFile(fileId, { onlyMimePrefix: "image/" })
        const thumb = await sharp(buffer)
            .rotate()
            .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 72 })
            .toBuffer()

        if (admin) {
            const { error } = await admin.storage.from(BUCKET).upload(path, thumb, { contentType: "image/webp", upsert: true })
            if (error) console.error("thumbnail upload", fileId, error.message)
        }
        return respond(new Uint8Array(thumb))
    } catch (err: any) {
        // Chi chiama ripiega sull'immagine intera
        const notImage = err?.code === "NOT_AN_IMAGE"
        if (!notImage) console.error("drive/thumbnail error", fileId, err)
        return NextResponse.json({ error: notImage ? "Non è un'immagine" : "Miniatura non disponibile" }, { status: notImage ? 415 : 500 })
    }
}
