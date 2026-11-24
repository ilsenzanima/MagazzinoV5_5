"use client"

import { useCallback, useState } from "react"
import { Download, Printer } from "lucide-react"
import { toast } from "sonner"
import { SelectionBar, BulkButton } from "@/components/ui/row-actions"
import { DocLike, downloadDocuments, printDocuments } from "@/lib/document-actions"

// Selezione dei documenti in tabella
export function useDocSelection() {
    const [ids, setIds] = useState<Set<string>>(new Set())
    const toggle = useCallback((id: string) => setIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
    }), [])
    // Aggiunge o toglie solo queste voci: si puo' filtrare, selezionare, cambiare filtro e selezionare ancora
    const setAll = useCallback((all: string[], on: boolean) => setIds(prev => {
        const next = new Set(prev)
        all.forEach(id => (on ? next.add(id) : next.delete(id)))
        return next
    }), [])
    const clear = useCallback(() => setIds(new Set()), [])
    return { ids, toggle, setAll, clear }
}

// Stampa o scarica un documento senza aprirlo (dal menu della riga)
export async function printOne(doc: DocLike) {
    const t = toast.loading("Preparo la stampa…")
    try {
        const r = await printDocuments([doc])
        if (r.skipped.length > 0) toast.error("Questo tipo di file non si può stampare da qui: scaricalo e aprilo sul PC")
    } finally { toast.dismiss(t) }
}

export async function downloadOne(doc: DocLike) {
    try { await downloadDocuments([doc]) } catch { toast.error("Download non riuscito") }
}

// Barra che compare quando sono selezionati dei documenti: stampa e scarica in blocco
export function DocumentBulkBar({ docs, onClear }: { docs: DocLike[]; onClear: () => void }) {
    const [busy, setBusy] = useState<"print" | "download" | null>(null)
    if (docs.length === 0) return null

    const print = async () => {
        setBusy("print")
        const t = toast.loading(docs.length > 1 ? "Preparo la stampa dei documenti…" : "Preparo la stampa…")
        try {
            const r = await printDocuments(docs)
            if (r.skipped.length > 0) toast.error(`Non stampabili da qui (scaricali e aprili sul PC): ${r.skipped.join(", ")}`)
        } finally { toast.dismiss(t); setBusy(null) }
    }
    const download = async () => {
        setBusy("download")
        try { await downloadDocuments(docs) } catch { toast.error("Download non riuscito") } finally { setBusy(null) }
    }

    return (
        <SelectionBar count={docs.length} singular="documento selezionato" plural="documenti selezionati" onClear={onClear}>
            <BulkButton icon={<Printer />} busy={busy === "print"} disabled={busy !== null} onClick={print}>Stampa</BulkButton>
            <BulkButton icon={<Download />} busy={busy === "download"} disabled={busy !== null} onClick={download}>Scarica{docs.length > 1 ? " (zip)" : ""}</BulkButton>
        </SelectionBar>
    )
}
