import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { ensureFolderPath, uploadFile } from "@/lib/google-drive"

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file')
    const folderPathRaw = formData.get('folderPath')

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'File mancante' }, { status: 400 })
    }
    if (typeof folderPathRaw !== 'string') {
        return NextResponse.json({ error: 'folderPath mancante' }, { status: 400 })
    }

    let folderPath: string[]
    try {
        folderPath = JSON.parse(folderPathRaw)
        if (!Array.isArray(folderPath) || folderPath.some(s => typeof s !== 'string')) {
            throw new Error('formato non valido')
        }
    } catch {
        return NextResponse.json({ error: 'folderPath deve essere un array JSON di stringhe' }, { status: 400 })
    }

    try {
        const folderId = await ensureFolderPath(folderPath)
        const buffer = Buffer.from(await file.arrayBuffer())
        const result = await uploadFile(folderId, file.name, file.type || 'application/octet-stream', buffer)
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore upload su Google Drive' }, { status: 500 })
    }
}
