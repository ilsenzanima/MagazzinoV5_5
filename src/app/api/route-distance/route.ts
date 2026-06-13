import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from") // "lon,lat"
    const to = searchParams.get("to")     // "lon,lat"

    if (!from || !to) {
        return NextResponse.json({ error: "Missing from/to params" }, { status: 400 })
    }

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=false`
        const res = await fetch(url, { next: { revalidate: 0 } })
        const data = await res.json()

        if (data.code !== "Ok" || !data.routes?.length) {
            return NextResponse.json({ error: "Percorso non trovato" }, { status: 404 })
        }

        const route = data.routes[0]
        return NextResponse.json({
            distanceKm: Math.round(route.distance / 100) / 10,
            durationMin: Math.round(route.duration / 60),
        })
    } catch {
        return NextResponse.json({ error: "Errore nel calcolo del percorso" }, { status: 500 })
    }
}
