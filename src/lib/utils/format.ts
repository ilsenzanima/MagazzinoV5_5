// Formattazione numerica condivisa per l'intero sito: garantisce che ogni importo in
// euro e ogni quantita' usi sempre lo stesso separatore delle migliaia (punto) e
// decimale (virgola), in stile it-IT, invece di ogni pagina reimplementare la propria
// formattazione (toFixed, toLocaleString con opzioni diverse, ecc.).

export function formatCurrency(value: number | null | undefined): string {
    const n = value ?? 0
    // useGrouping va specificato esplicitamente: omesso, in alcune versioni di V8
    // (Node e Chromium/Edge) il separatore delle migliaia non viene applicato ai
    // numeri di 4 cifre (es. "6162,50" invece di "6.162,50") pur comparendo
    // correttamente per quelli di 5+ cifre - un'incoerenza del motore, non un bug
    // applicativo, ma che va neutralizzata qui una volta per tutte.
    return `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`
}

export function formatNumber(
    value: number | null | undefined,
    options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
    const n = value ?? 0
    return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true, ...options })
}
