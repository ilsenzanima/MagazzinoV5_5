// Unità di misura delle voci (generiche, trasporto, posa) dell'analisi costi.
// Servono solo a rendere leggibile la voce: «€/ora» sul prezzo, «ore» sulla quantità. Non cambiano i calcoli.
// Il valore vuoto è «solo euro» (a corpo).

export interface VoceUnit { value: string; label: string; qty: string }

export const VOCE_UNITS: VoceUnit[] = [
    { value: '', label: '€ (a corpo)', qty: '' },
    { value: 'ora', label: '€/ora', qty: 'ore' },
    { value: 'giorno', label: '€/giorno', qty: 'giorni' },
    { value: 'mese', label: '€/mese', qty: 'mesi' },
    { value: 'pz', label: '€/pz', qty: 'pz' },
    { value: 'm', label: '€/m', qty: 'm' },
    { value: 'ml', label: '€/m lineare', qty: 'ml' },
    { value: 'mq', label: '€/m²', qty: 'm²' },
    { value: 'kg', label: '€/kg', qty: 'kg' },
]

// Suffisso del prezzo: «/ora» (vuoto se a corpo). Per i materiali l'unità è quella dell'articolo (es. PZ, ML).
export const priceUnitSuffix = (unit: string | null | undefined) => unit ? `/${unit}` : ''

// Suffisso della quantità: «ore», «pz»… Per un'unità non in elenco (materiali) resta quella dell'articolo.
export const qtyUnitSuffix = (unit: string | null | undefined) => {
    if (!unit) return ''
    return VOCE_UNITS.find(u => u.value === unit)?.qty ?? unit
}
