"use client"

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItem } from "@/lib/types";
import { inventoryApi } from "@/lib/api";
import { ItemSearchPanel } from "@/components/inventory/ItemSearchPanel";
import { PackQuantityFields } from "@/components/inventory/PackQuantityFields";
import { applyPieces, applyQuantity, LineAmounts } from "@/lib/utils/purchase-line";

export interface NoteLineResult {
    item: InventoryItem;
    pieces: string;
    quantity: string;
}

interface NoteLineDialogProps {
    open: boolean;
    onClose: () => void;
    items: InventoryItem[];
    onSearch: (term: string) => void;
    loading: boolean;
    // `next` = true: dopo l'inserimento il modale si riapre sulla riga successiva
    onConfirm: (result: NoteLineResult, next: boolean) => void;
}

const EMPTY: LineAmounts = { pieces: "", quantity: "", price: "0", total: "0" };

// Riga di una nota di carico in due pagine: 1) materiale, 2) pezzi e quantità (anche a confezioni)
export function NoteLineDialog({ open, onClose, items, onSearch, loading, onConfirm }: NoteLineDialogProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [amounts, setAmounts] = useState<LineAmounts>(EMPTY);
    const [resetKey, setResetKey] = useState(0);

    useEffect(() => {
        if (!open) return;
        setStep(1);
        setItem(null);
        setAmounts(EMPTY);
        setResetKey(k => k + 1);
    }, [open]);

    const coefficient = item?.coefficient && item.coefficient > 0 ? Number(item.coefficient) : 1;
    const packQuantity = item?.packQuantity && item.packQuantity > 0 ? Number(item.packQuantity) : null;
    const unit = item?.unit || "PZ";
    const quantity = parseFloat(amounts.quantity);

    const pickItem = (picked: InventoryItem) => {
        setItem(picked);
        setAmounts(EMPTY);
        setResetKey(k => k + 1);
        setStep(2);
        // L'elenco di ricerca non porta la quantità per confezione: si completa l'articolo dalla sua scheda
        inventoryApi.getById(picked.id)
            .then(full => { if (full) setItem(prev => (prev && prev.id === picked.id ? { ...prev, ...(full as InventoryItem) } : prev)); })
            .catch(() => { /* senza confezione restano pezzi e quantità */ });
    };

    const confirm = (next: boolean) => {
        if (!item || !(quantity > 0)) return;
        onConfirm({ item, pieces: amounts.pieces, quantity: amounts.quantity }, next);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                // Si chiude solo con i pulsanti a schermo, non con un clic fuori
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                className="flex h-[100dvh] max-w-none flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg"
            >
                <DialogHeader>
                    <DialogTitle>Aggiungi materiale alla nota</DialogTitle>
                    <DialogDescription>Passo {step} di 2: {step === 1 ? "scegli il materiale" : "pezzi e quantità"}</DialogDescription>
                    <div className="mt-2 flex gap-1">
                        {[1, 2].map(i => <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />)}
                    </div>
                </DialogHeader>

                {step === 1 && (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ItemSearchPanel active={open && step === 1} onSelect={pickItem} items={items} onSearch={onSearch} loading={loading} />
                    </div>
                )}

                {step === 2 && item && (
                    <div className="flex-1 space-y-4 overflow-y-auto py-2">
                        <div className="flex items-start justify-between gap-3 rounded-md border bg-slate-50 p-3 dark:bg-slate-800/40">
                            <div className="min-w-0">
                                <div className="font-mono text-[11px] text-slate-500">{item.code}</div>
                                <div className="font-medium leading-tight">{item.name}</div>
                                {item.model && <div className="text-sm text-slate-500">{item.model}</div>}
                                <div className="text-xs text-slate-400">{item.type} · {item.brand}</div>
                            </div>
                            <Button variant="outline" size="sm" className="shrink-0" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-1 h-4 w-4" /> Cambia
                            </Button>
                        </div>

                        {packQuantity && (
                            <PackQuantityFields resetSignal={resetKey} packQuantity={packQuantity} coefficient={coefficient} unit={unit}
                                quantity={quantity > 0 ? quantity : 0} autoFocus
                                onQuantityChange={(q) => setAmounts(a => applyQuantity(a, coefficient, q))} />
                        )}

                        {!packQuantity && coefficient !== 1 && <p className="text-[11px] text-slate-500">1 pezzo = {coefficient} {unit}.</p>}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <Label htmlFor="nl-pieces">Pezzi</Label>
                                <Input id="nl-pieces" type="number" inputMode="decimal" min="0" step="0.01" autoFocus={!packQuantity}
                                    value={amounts.pieces}
                                    onChange={e => { setResetKey(k => k + 1); setAmounts(a => applyPieces(a, coefficient, e.target.value)); }}
                                    placeholder="0" />
                            </div>
                            <div className="space-y-1 rounded-md bg-blue-50 p-1 dark:bg-blue-950/30">
                                <Label htmlFor="nl-qty" className="px-1">Quantità ({unit})</Label>
                                <Input id="nl-qty" type="number" inputMode="decimal" min="0" step="0.01"
                                    value={amounts.quantity}
                                    onChange={e => { setResetKey(k => k + 1); setAmounts(a => applyQuantity(a, coefficient, e.target.value)); }}
                                    placeholder="0.00" />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    {step === 1 ? (
                        <Button variant="outline" onClick={onClose}>Annulla</Button>
                    ) : (
                        <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-1 h-4 w-4" /> Indietro</Button>
                    )}
                    {step === 2 && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" disabled={!(quantity > 0)} onClick={() => confirm(true)}>
                                <Plus className="mr-1 h-4 w-4" /> Aggiungi e continua
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700" disabled={!(quantity > 0)} onClick={() => confirm(false)}>
                                <Check className="mr-1 h-4 w-4" /> Aggiungi
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
