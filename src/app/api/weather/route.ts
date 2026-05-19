import { NextRequest, NextResponse } from 'next/server'

// Tenta geocoding su Open-Meteo con un testo candidato
async function tryGeocode(candidate: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=it`,
      { next: { revalidate: 86400 } } // cache 24h
    )
    const data = await res.json()
    if (data.results?.length > 0) {
      return { lat: data.results[0].latitude, lon: data.results[0].longitude }
    }
  } catch {
    // ignora e prova il prossimo candidato
  }
  return null
}

// Estrae candidati città dall'indirizzo italiano
function extractCandidates(address: string): string[] {
  const candidates: string[] = []

  // Normalizza: rimuove provincia tra parentesi "(ve)" -> "" e appiattisce spazi
  const normalized = address.replace(/\s*\([a-zA-Z]{2}\)/g, '').replace(/\s+/g, ' ').trim()

  // 1. CAP pattern: "12345 NomeCittà [PR]"
  const capMatch = normalized.match(/\b\d{5}\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-]+?)(?:\s+[A-Z]{2})?\s*(?:,|$)/)
  if (capMatch) candidates.push(capMatch[1].trim())

  // 2. Ogni segmento separato da virgola, dal fondo (città di solito verso la fine)
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p.length > 3)
  for (const part of parts.reverse()) {
    // Salta segmenti che sembrano vie o iniziano con numero (CAP)
    if (/^(via|corso|piazza|viale|largo|vicolo|strada|loc\.|localit)/i.test(part)) continue
    if (/^\d/.test(part)) continue
    if (!candidates.includes(part)) candidates.push(part)
  }

  return candidates
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'missing address' }, { status: 400 })
  }

  // Prova i candidati in ordine finché uno funziona
  const candidates = extractCandidates(address)
  let coords: { lat: number; lon: number } | null = null

  for (const candidate of candidates) {
    coords = await tryGeocode(candidate)
    if (coords) break
  }

  if (!coords) {
    return NextResponse.json({ error: 'geocoding failed', candidates }, { status: 404 })
  }

  // Fetch meteo
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`,
    { next: { revalidate: 3600 } } // cache 1h
  )
  const weatherData = await weatherRes.json()

  return NextResponse.json(weatherData.daily)
}
