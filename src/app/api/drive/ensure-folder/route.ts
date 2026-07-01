import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { ensureFolderPath } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { segments } = await req.json()
    if (!Array.isArray(segments) || segments.length === 0 || segments.some((s: any) => typeof s !== 'string')) {
        return NextResponse.json({ error: 'segments deve essere un array non vuoto di stringhe' }, { status: 400 })
    }

    try {
        const folderId = await ensureFolderPath(segments)
        return NextResponse.json({ folderId })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore creazione cartella su Google Drive' }, { status: 500 })
    }
}
