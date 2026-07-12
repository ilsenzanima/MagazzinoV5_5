import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { downloadFile, getFileMetadata, isOfficeMimeType, ensureFileLinkShareable, officeNativePreviewUrl } from "@/lib/google-drive"

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const fileId = req.nextUrl.searchParams.get('fileId')
    const requestedName = req.nextUrl.searchParams.get('fileName')
    const forceDownload = req.nextUrl.searchParams.get('download') === '1'
    if (!fileId) return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })

    try {
        // I documenti Office vengono aperti nell'anteprima nativa di Google Docs/Sheets/Slides
        // in sola lettura, a meno che non sia richiesto il download diretto (download=1). Il
        // viewer generico di Drive (file/d/{id}/view) a volte fallisce con "Impossibile
        // visualizzare l'anteprima del file" su questi formati, specie se caricati di recente.
        if (!forceDownload) {
            const { mimeType: previewMimeType } = await getFileMetadata(fileId)
            if (isOfficeMimeType(previewMimeType)) {
                await ensureFileLinkShareable(fileId)
                const nativeUrl = officeNativePreviewUrl(fileId, previewMimeType)
                return NextResponse.redirect(nativeUrl || `https://drive.google.com/file/d/${fileId}/view`)
            }
        }

        const { buffer, mimeType, name } = await downloadFile(fileId)
        const hasExtension = !!requestedName && /\.[a-zA-Z0-9]{2,5}$/.test(requestedName)
        const fileName = hasExtension ? requestedName! : name
        const disposition = forceDownload ? 'attachment' : 'inline'
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileName)}"`,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore download da Google Drive' }, { status: 500 })
    }
}
