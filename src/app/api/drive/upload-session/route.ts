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

    const { fileName, mimeType, folderPath, folderId: clientFolderId } = await req.json()
    
    if (!clientFolderId && (!Array.isArray(folderPath) || folderPath.some((s: any) => typeof s !== 'string'))) {
        return NextResponse.json({ error: 'folderPath o folderId mancante/non valido' }, { status: 400 })
    }

    try {
        const folderId = clientFolderId || (await ensureFolderPath(folderPath))
        
        // Se non viene specificato fileName, il client vuole solo pre-risolvere o creare la cartella
        if (!fileName) {
            return NextResponse.json({ folderId })
        }

        const uploadUrl = await createResumableUploadSession(
            folderId,
            fileName,
            typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream'
        )
        return NextResponse.json({ uploadUrl, folderId })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? "Errore nell'avvio dell'upload su Google Drive" }, { status: 500 })
    }
}
