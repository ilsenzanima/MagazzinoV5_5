import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { deleteFile } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { fileId } = await req.json()
    if (!fileId || typeof fileId !== 'string') {
        return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })
    }

    try {
        await deleteFile(fileId)
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore eliminazione da Google Drive' }, { status: 500 })
    }
}
