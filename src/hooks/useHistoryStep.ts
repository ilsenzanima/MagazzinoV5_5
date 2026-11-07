"use client"

import { useCallback, useEffect, useState } from "react"

// Una vista interna a una pagina (es. il dettaglio di un'analisi costi aperto dentro la commessa) diventa
// un passo della cronologia del browser: «indietro» (tasto del mouse, gesto del telefono, freccia del browser)
// la chiude e torna alla lista invece di uscire dalla pagina; «avanti» la riapre.
// Uso: const [openId, openStep, closeStep] = useHistoryStep<string>("magCostVersion")
export function useHistoryStep<T>(key: string): [T | null, (value: T) => void, () => void] {
    const [value, setValue] = useState<T | null>(null)

    useEffect(() => {
        const saved = (window.history.state as Record<string, T> | null)?.[key]
        if (saved !== undefined && saved !== null) setValue(saved)
        const onPop = (e: PopStateEvent) => setValue(((e.state as Record<string, T> | null)?.[key]) ?? null)
        window.addEventListener("popstate", onPop)
        return () => {
            window.removeEventListener("popstate", onPop)
            // Uscendo dalla scheda la vista non deve restare scritta nella voce corrente della cronologia
            const st = window.history.state as Record<string, unknown> | null
            if (st && key in st) {
                const { [key]: _removed, ...rest } = st
                window.history.replaceState(rest, "")
            }
        }
    }, [key])

    const open = useCallback((v: T) => {
        window.history.pushState({ ...(window.history.state ?? {}), [key]: v }, "")
        setValue(v)
    }, [key])

    const close = useCallback(() => {
        if ((window.history.state as Record<string, unknown> | null)?.[key] !== undefined) window.history.back()
        else setValue(null)
    }, [key])

    return [value, open, close]
}
