import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { downloadFile } from "@/lib/google-drive"

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
    const fileName = req.nextUrl.searchParams.get('fileName') ?? 'documento'
    if (!fileId) return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })

    try {
        const buffer = await downloadFile(fileId)
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore download da Google Drive' }, { status: 500 })
    }
}
