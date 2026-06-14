import { NextRequest, NextResponse } from "next/server"

// Called by Vercel Cron at 02:00 UTC daily
// Vercel automatically sets VERCEL_CRON_SECRET in the Authorization header
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delegate to the main purge route
    const origin = req.nextUrl.origin
    const res = await fetch(`${origin}/api/purge-trash`, {
        method: 'POST',
        headers: { 'x-purge-secret': process.env.PURGE_SECRET! }
    })
    const data = await res.json()
    return NextResponse.json(data)
}
