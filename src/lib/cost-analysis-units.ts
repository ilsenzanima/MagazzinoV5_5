import { costAnalysisVoceUnitsApi, type CostAnalysisVoceUnit } from '@/lib/services/cost-analysis-voce-units'

// Unità di misura opzionali delle voci non di magazzino dell'analisi costi (generiche, trasporto, posa).
// L'elenco si gestisce da Impostazioni → Elenchi. Servono solo a rendere leggibile la voce («€/ora» sul prezzo,
// «ore» sulla quantità) e non cambiano i calcoli. Senza unità la voce è «solo euro».
// Sulla riga si salva il nome dell'unità: se poi viene tolta dall'elenco, le righe già fatte restano leggibili.

const DEFAULTS: CostAnalysisVoceUnit[] = [
    ['ora', 'ore'], ['giorno', 'giorni'], ['mese', 'mesi'], ['pz', 'pz'], ['m', 'm'], ['ml', 'ml'], ['m²', 'm²'], ['kg', 'kg'],
].map(([name, qtyLabel], i) => ({ id: `default-${i}`, name, qtyLabel, sortOrder: i + 1 }))

let cache: CostAnalysisVoceUnit[] | null = null

// Carica l'elenco (una volta sola, finché non viene modificato) e lo tiene per PDF, Excel e tabelle
export async function loadVoceUnits(force = false): Promise<CostAnalysisVoceUnit[]> {
    if (cache && !force) return cache
    try { cache = await costAnalysisVoceUnitsApi.getAll() }
    catch { cache = cache ?? DEFAULTS }
    return cache
}

export const getVoceUnits = () => cache ?? DEFAULTS
export const invalidateVoceUnits = () => { cache = null }

// Suffisso del prezzo: «/ora» (vuoto se la voce è a corpo). Per i materiali l'unità è quella dell'articolo (es. PZ, ML).
export const priceUnitSuffix = (unit: string | null | undefined) => unit ? `/${unit}` : ''

// Suffisso della quantità: «ore», «pz»… Per un'unità non in elenco (materiali, o tolta dall'elenco) resta il nome stesso.
export const qtyUnitSuffix = (unit: string | null | undefined) => {
    if (!unit) return ''
    const found = getVoceUnits().find(u => u.name === unit)
    return found ? (found.qtyLabel || found.name) : unit
}
