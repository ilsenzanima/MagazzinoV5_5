import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const ALLOWED_PREFIX = 'https://www.googleapis.com/upload/drive/v3/files'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const uploadUrl = req.headers.get('x-drive-upload-url')
    const contentRange = req.headers.get('content-range')
    if (!uploadUrl || !uploadUrl.startsWith(ALLOWED_PREFIX)) {
        return NextResponse.json({ error: 'URL di upload mancante o non valido' }, { status: 400 })
    }
    if (!contentRange) {
        return NextResponse.json({ error: 'Content-Range mancante' }, { status: 400 })
    }

    try {
        const chunk = Buffer.from(await req.arrayBuffer())
        const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Range': contentRange,
                'Content-Length': String(chunk.length),
            },
            body: chunk,
        })

        if (res.status === 308) {
            return NextResponse.json({ done: false })
        }
        if (res.ok) {
            const file = await res.json()
            return NextResponse.json({ done: true, file })
        }
        const text = await res.text().catch(() => '')
        return NextResponse.json({ error: `Upload su Google Drive fallito (${res.status}): ${text}` }, { status: 502 })
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? 'Errore upload su Google Drive' }, { status: 500 })
    }
}
