import { NextRequest, NextResponse } from "next/server"

// Called by GitHub Actions with PURGE_SECRET header
// Just delegates to the main purge endpoint
export async function GET(req: NextRequest) {
    const secret = req.headers.get('x-purge-secret')
    if (!secret || secret !== process.env.PURGE_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const origin = req.nextUrl.origin
    const res = await fetch(`${origin}/api/purge-trash`, {
        method: 'POST',
        headers: { 'x-purge-secret': process.env.PURGE_SECRET! }
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
}
