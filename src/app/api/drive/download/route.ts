import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { downloadFile, getDriveThumbnail, getFileMetadata, isOfficeMimeType, mimeTypeFromFileName, convertOfficeToPdf } from "@/lib/google-drive"

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
        // I documenti Office (Word, Excel, PowerPoint) si aprono come PDF: Drive ne fa una copia temporanea convertita
        // e la elimina subito. L'anteprima di Google Docs/Sheets su questi file spesso non si apre («Impossibile aprire
        // il file») e richiedeva di rendere il file visibile a chiunque abbia il link. Se la conversione non riesce
        // il file viene scaricato com'e', per aprirlo sul PC.
        let downloadInstead = forceDownload
        if (!forceDownload) {
            const meta = await getFileMetadata(fileId)
            const officeType = isOfficeMimeType(meta.mimeType) ? meta.mimeType : (mimeTypeFromFileName(meta.name) ?? meta.mimeType)
            if (isOfficeMimeType(officeType)) {
                try {
                    const pdf = await convertOfficeToPdf(fileId)
                    const pdfName = meta.name.replace(/\.[^.]+$/, '') + '.pdf'
                    return new NextResponse(new Uint8Array(pdf), {
                        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(pdfName)}` },
                    })
                } catch (convErr) {
                    console.error('drive/download: conversione in PDF non riuscita, scarico il file originale', fileId, convErr)
                    downloadInstead = true
                }
            }
        }

        const { buffer, mimeType: driveMimeType, name } = await downloadFile(fileId)
        // File caricati con tipo vuoto: il tipo si ricava dall'estensione, cosi' il browser sa cos'e'
        const mimeType = driveMimeType === 'application/octet-stream' ? (mimeTypeFromFileName(name) ?? driveMimeType) : driveMimeType

        // HEIC/HEIF non si vedono nei browser (tranne Safari): per la visualizzazione si serve
        // la versione grande (JPEG) generata da Drive. Il download diretto resta l'originale.
        if (!forceDownload && (/^image\/hei[cf]/i.test(mimeType) || /\.hei[cf]$/i.test(name))) {
            const big = await getDriveThumbnail(fileId, 2048).catch(() => null)
            if (big) {
                return new NextResponse(new Uint8Array(big), {
                    headers: { 'Content-Type': 'image/jpeg', 'Content-Disposition': 'inline' },
                })
            }
        }
        const hasExtension = !!requestedName && /\.[a-zA-Z0-9]{2,5}$/.test(requestedName)
        const fileName = hasExtension ? requestedName! : name
        const disposition = downloadInstead ? 'attachment' : 'inline'
        // Versione solo ASCII del nome (per i browser vecchi): lettere accentate, virgolette e barre diventano «_»
        const asciiName = Array.from(fileName).map(c => (c >= ' ' && c <= '~' && c !== '"' && c !== '\\') ? c : '_').join('')
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': mimeType,
                // Nome con spazi e lettere accentate salvato correttamente (prima compariva come «Nome%20file.xlsx»)
                'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            },
        })
    } catch (err: any) {
        console.error('drive/download error', fileId, err)
        return NextResponse.json({ error: err.message ?? 'Errore download da Google Drive' }, { status: 500 })
    }
}
