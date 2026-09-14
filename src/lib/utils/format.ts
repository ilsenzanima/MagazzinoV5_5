// Formattazione numerica condivisa per l'intero sito: garantisce che ogni importo in
// euro e ogni quantita' usi sempre lo stesso separatore delle migliaia (punto) e
// decimale (virgola), in stile it-IT, invece di ogni pagina reimplementare la propria
// formattazione (toFixed, toLocaleString con opzioni diverse, ecc.).

export function formatCurrency(value: number | null | undefined): string {
    const n = value ?? 0
    return `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(
    value: number | null | undefined,
    options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
    const n = value ?? 0
    return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2, ...options })
}
