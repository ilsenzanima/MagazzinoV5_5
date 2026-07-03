import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { ensureFolderPath, createResumableUploadSession } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { fileName, mimeType, folderPath } = await req.json()
    if (typeof fileName !== 'string' || !fileName) {
        return NextResponse.json({ error: 'fileName mancante' }, { status: 400 })
    }
    if (!Array.isArray(folderPath) || folderPath.some((s: any) => typeof s !== 'string')) {
        return NextResponse.json({ error: 'folderPath deve essere un array di stringhe' }, { status: 400 })
    }

    try {
        const folderId = await ensureFolderPath(folderPath)
        const uploadUrl = await createResumableUploadSession(
            folderId,
            fileName,
            typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream'
        )
        return NextResponse.json({ uploadUrl })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? "Errore nell'avvio dell'upload su Google Drive" }, { status: 500 })
    }
}
