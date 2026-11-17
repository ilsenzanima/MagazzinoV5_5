// Scadenza di verifica di un'attrezzatura: etichetta e colore in base ai giorni che mancano
export const isEquipmentType = (type?: string | null) => (type ?? "").trim().toLowerCase() === "attrezzatura"

export const CHECK_WARNING_DAYS = 30

export function checkDateInfo(date?: string | null): { label: string; cls: string; days: number | null } {
    if (!date) return { label: "—", cls: "text-slate-300", days: null }
    const d = new Date(`${date}T12:00:00`)
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const days = Math.round((d.getTime() - today.getTime()) / 86400000)
    const text = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
    if (days < 0) return { label: `${text} · scaduta`, cls: "font-semibold text-red-600", days }
    if (days <= CHECK_WARNING_DAYS) return { label: `${text} · tra ${days} gg`, cls: "font-medium text-amber-600", days }
    return { label: text, cls: "text-slate-600 dark:text-slate-300", days }
}
