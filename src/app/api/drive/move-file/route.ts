import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { moveFile } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { fileId, newParentId } = await req.json()
    if (!fileId || typeof fileId !== 'string') {
        return NextResponse.json({ error: 'fileId mancante' }, { status: 400 })
    }
    if (!newParentId || typeof newParentId !== 'string') {
        return NextResponse.json({ error: 'newParentId mancante' }, { status: 400 })
    }

    try {
        await moveFile(fileId, newParentId)
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore spostamento file su Google Drive' }, { status: 500 })
    }
}
