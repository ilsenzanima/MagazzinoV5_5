import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { downloadFile, getFileMetadata, isOfficeMimeType, ensureFileLinkShareable } from "@/lib/google-drive"

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
    if (!fileId) return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })

    try {
        // I documenti Office (Word/Excel/PowerPoint) non si aprono in modo
        // leggibile come download grezzo: li mostriamo invece con il viewer
        // di Google Drive, in sola lettura (il file resta condiviso solo
        // in lettura, non modificabile dal link).
        const { mimeType: previewMimeType } = await getFileMetadata(fileId)
        if (isOfficeMimeType(previewMimeType)) {
            await ensureFileLinkShareable(fileId)
            return NextResponse.redirect(`https://drive.google.com/file/d/${fileId}/view`)
        }

        const { buffer, mimeType, name } = await downloadFile(fileId)
        // Il nome richiesto dal client spesso non ha estensione (es. nome
        // personalizzato del documento): usiamo il nome reale del file su
        // Drive, che la conserva sempre, a meno che il nome richiesto non
        // abbia già un'estensione esplicita.
        const hasExtension = !!requestedName && /\.[a-zA-Z0-9]{2,5}$/.test(requestedName)
        const fileName = hasExtension ? requestedName! : name
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore download da Google Drive' }, { status: 500 })
    }
}
