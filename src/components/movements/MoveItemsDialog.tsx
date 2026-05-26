"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { deliveryNotesApi } from "@/lib/api"
import { moveItemsToDeliveryNote } from "@/app/movements/actions"
import { notify } from "@/lib/notify"
import { useRouter } from "next/navigation"

interface MoveItemsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceNoteId: string
    sourceJobId?: string
    sourceType: string
    selectedItemIds: string[]
    onSuccess: () => void
}

export default function MoveItemsDialog({
    open,
    onOpenChange,
    sourceNoteId,
    sourceJobId,
    sourceType,
    selectedItemIds,
    onSuccess,
}: MoveItemsDialogProps) {
    const router = useRouter()
    const [targetNoteId, setTargetNoteId] = useState<string>("")
    const [availableNotes, setAvailableNotes] = useState<{ id: string; number: string; date: string }[]>([])
    const [loadingNotes, setLoadingNotes] = useState(false)
    const [moving, setMoving] = useState(false)

    useEffect(() => {
        if (!open || !sourceJobId) return

        setTargetNoteId("")
        setLoadingNotes(true)

        deliveryNotesApi.getByJobAndType(sourceJobId, sourceType, sourceNoteId)
            .then(setAvailableNotes)
            .catch(() => notify.error("Errore nel caricamento delle bolle"))
            .finally(() => setLoadingNotes(false))
    }, [open, sourceJobId, sourceType, sourceNoteId])

    const handleMove = async () => {
        if (!targetNoteId) return

        setMoving(true)
        try {
            const result = await moveItemsToDeliveryNote(sourceNoteId, targetNoteId, selectedItemIds)

            if (!result.success) {
                notify.error(result.error || "Errore durante lo spostamento")
                return
            }

            notify.success(`${selectedItemIds.length} articol${selectedItemIds.length === 1 ? "o spostato" : "i spostati"} con successo`)
            onOpenChange(false)
            onSuccess()
            router.refresh()
        } catch {
            notify.error("Errore imprevisto durante lo spostamento")
        } finally {
            setMoving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Sposta articoli su un'altra bolla</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Stai spostando <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedItemIds.length} articol{selectedItemIds.length === 1 ? "o" : "i"}</span> su un'altra bolla della stessa commessa.
                    </p>

                    {!sourceJobId ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            Questa bolla non è associata a una commessa. Lo spostamento non è disponibile.
                        </p>
                    ) : loadingNotes ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Caricamento bolle...
                        </div>
                    ) : availableNotes.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nessuna altra bolla disponibile per questa commessa con lo stesso tipo di movimento.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Bolla di destinazione
                            </label>
                            <Select value={targetNoteId} onValueChange={setTargetNoteId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona una bolla..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableNotes.map(note => (
                                        <SelectItem key={note.id} value={note.id}>
                                            {note.number} — {format(new Date(note.date), "dd MMM yyyy", { locale: it })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={moving}
                    >
                        Annulla
                    </Button>
                    <Button
                        onClick={handleMove}
                        disabled={!targetNoteId || moving || !sourceJobId}
                        className="bg-[#003366] hover:bg-[#002244]"
                    >
                        {moving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Sposta
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
