// Vuoto di presenze (in giorni) oltre il quale il lavoro si considera interrotto: la barra si spezza
export const GAP_DAYS = 7

const daysBetween = (a: string, b: string) =>
    Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000)

// Giorni di presenza (AAAA-MM-GG, ordinati) uniti in tratti continui finché il vuoto tra uno e l'altro non supera gapDays
export function presenceSegments(dates: string[], gapDays: number = GAP_DAYS): { start: string; end: string }[] {
    if (dates.length === 0) return []
    const out: { start: string; end: string }[] = []
    let start = dates[0]
    let prev = dates[0]
    for (const d of dates.slice(1)) {
        if (daysBetween(prev, d) > gapDays) { out.push({ start, end: prev }); start = d }
        prev = d
    }
    out.push({ start, end: prev })
    return out
}
