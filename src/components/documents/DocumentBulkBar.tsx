"use client"

import { useCallback, useState } from "react"
import { Download, Loader2, Printer, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/30">
            <span className="font-medium text-blue-800 dark:text-blue-200">{docs.length} {docs.length === 1 ? "documento selezionato" : "documenti selezionati"}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={print}>
                    {busy === "print" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}Stampa
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={download}>
                    {busy === "download" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Scarica{docs.length > 1 ? " (zip)" : ""}
                </Button>
                <Button size="sm" variant="ghost" onClick={onClear} aria-label="Deseleziona"><X className="h-4 w-4" /></Button>
            </div>
        </div>
    )
}
