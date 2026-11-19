import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { convertOfficeToPdf } from "@/lib/google-drive"

// PDF di un documento Word/Excel/PowerPoint su Drive, per la stampa senza aprire il file
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
    if (!fileId) return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })

    try {
        const pdf = await convertOfficeToPdf(fileId)
        return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' } })
    } catch (err: any) {
        console.error('drive/pdf error', fileId, err)
        return NextResponse.json({ error: err.message ?? 'Conversione in PDF non riuscita' }, { status: 500 })
    }
}
