"use client"

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Info, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItem } from "@/lib/types";
import { ItemSearchPanel } from "@/components/inventory/ItemSearchPanel";
import { NewItemDialog } from "@/components/inventory/NewItemDialog";
import { costAnalysisApi } from "@/lib/services/cost-analysis";
import {
    LineAmounts, applyPacks, applyPieces, applyPrice, applyQuantity, applyTotal, checkPrice, packsFromQuantity,
} from "@/lib/utils/purchase-line";

export interface PurchaseLineResult {
    item: InventoryItem;
    amounts: LineAmounts;
}

interface PurchaseLineDialogProps {
    open: boolean;
    onClose: () => void;
    asOfDate: string;                     // data della bolla/ordine: serve al prezzo di riferimento
    items: InventoryItem[];
    onSearch: (term: string) => void;
    loading: boolean;
    // `next` = true: dopo l'inserimento si passa subito alla riga successiva
    onConfirm: (result: PurchaseLineResult, next: boolean) => void;
}

const EMPTY_AMOUNTS: LineAmounts = { pieces: "", quantity: "", price: "0", total: "0" };

// Inserimento di una riga in due pagine: 1) materiale, 2) quantità e prezzo
export function PurchaseLineDialog({ open, onClose, asOfDate, items, onSearch, loading, onConfirm }: PurchaseLineDialogProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [amounts, setAmounts] = useState<LineAmounts>(EMPTY_AMOUNTS);
    const [packsInput, setPacksInput] = useState("");
    const [reference, setReference] = useState<number | null | undefined>(undefined); // undefined = in caricamento
    const [creatingTerm, setCreatingTerm] = useState<string | null>(null);

    // Ogni apertura riparte dalla scelta del materiale
    useEffect(() => {
        if (!open) return;
        setStep(1);
        setItem(null);
        setAmounts(EMPTY_AMOUNTS);
        setPacksInput("");
        setReference(undefined);
        setCreatingTerm(null);
    }, [open]);

    const coefficient = item?.coefficient && item.coefficient > 0 ? Number(item.coefficient) : 1;
    const packQuantity = item?.packQuantity && item.packQuantity > 0 ? Number(item.packQuantity) : null;
    const unit = item?.unit || "PZ";

    const pickItem = (picked: InventoryItem) => {
        setItem(picked);
        setAmounts(EMPTY_AMOUNTS);
        setPacksInput("");
        setReference(undefined);
        setStep(2);
        costAnalysisApi.getReferencePricesAsOf([{ itemId: picked.id, asOf: asOfDate }])
            .then(map => setReference(map.get(picked.id) ?? null))
            .catch(() => setReference(null));
    };

    const quantityNum = parseFloat(amounts.quantity);
    const priceNum = parseFloat(amounts.price);
    const canAdd = !!item && quantityNum > 0;

    const check = useMemo(() => checkPrice({ price: priceNum, reference, packQuantity, unit }),
        [priceNum, reference, packQuantity, unit]);

    const setPieces = (v: string) => { setAmounts(a => applyPieces(a, coefficient, v)); setPacksInput(""); };
    const setQuantity = (v: string) => { setAmounts(a => applyQuantity(a, coefficient, v)); setPacksInput(""); };
    const setPacks = (v: string) => {
        setPacksInput(v);
        if (packQuantity) setAmounts(a => applyPacks(a, coefficient, packQuantity, v));
    };
    const packsShown = packsInput !== "" ? packsInput : (packsFromQuantity(amounts.quantity, packQuantity)?.toString() ?? "");

    const confirm = (next: boolean) => {
        if (!item || !canAdd) return;
        onConfirm({ item, amounts }, next);
    };

    return (
        <>
            <Dialog open={open && creatingTerm === null} onOpenChange={(v) => { if (!v) onClose(); }}>
                <DialogContent className="flex h-[100dvh] max-w-none flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Aggiungi materiale</DialogTitle>
                        <DialogDescription>
                            Passo {step} di 2: {step === 1 ? "scegli il materiale" : "quantità e prezzo"}
                        </DialogDescription>
                        <div className="mt-2 flex gap-1">
                            {[1, 2].map(i => (
                                <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />
                            ))}
                        </div>
                    </DialogHeader>

                    {step === 1 && (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <ItemSearchPanel
                                active={open && step === 1}
                                onSelect={pickItem}
                                items={items}
                                onSearch={onSearch}
                                loading={loading}
                                onCreateNew={(term) => setCreatingTerm(term)}
                            />
                        </div>
                    )}

                    {step === 2 && item && (
                        <div className="flex-1 space-y-4 overflow-y-auto py-2">
                            <div className="flex items-start justify-between gap-3 rounded-md border bg-slate-50 p-3 dark:bg-slate-800/40">
                                <div className="min-w-0">
                                    <div className="font-mono text-[11px] text-slate-500">{item.code}</div>
                                    <div className="font-medium leading-tight">{item.name}</div>
                                    {item.model && <div className="text-sm text-slate-500">{item.model}</div>}
                                    <div className="text-xs text-slate-400">{item.type} · {item.brand} · giacenza {item.quantity} {item.unit}</div>
                                </div>
                                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setStep(1)}>
                                    <ArrowLeft className="mr-1 h-4 w-4" /> Cambia
                                </Button>
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                                {coefficient !== 1 && <p>1 pezzo = {coefficient} {unit}</p>}
                                {packQuantity && <p>1 confezione = {packQuantity} {unit}</p>}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                {packQuantity && (
                                    <div className="space-y-1">
                                        <Label htmlFor="pl-packs">Confezioni</Label>
                                        <Input id="pl-packs" type="number" inputMode="decimal" min="0" step="1"
                                            value={packsShown} onChange={e => setPacks(e.target.value)} placeholder="0" autoFocus />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <Label htmlFor="pl-pieces">Pezzi</Label>
                                    <Input id="pl-pieces" type="number" inputMode="decimal" min="0" step="0.01"
                                        value={amounts.pieces} onChange={e => setPieces(e.target.value)} placeholder="0"
                                        autoFocus={!packQuantity} />
                                </div>
                                <div className="space-y-1 rounded-md bg-blue-50 p-1 dark:bg-blue-950/30">
                                    <Label htmlFor="pl-qty" className="px-1">Quantità ({unit})</Label>
                                    <Input id="pl-qty" type="number" inputMode="decimal" min="0" step="0.01"
                                        value={amounts.quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="pl-price">Prezzo unitario (€ per {unit})</Label>
                                    <Input id="pl-price" type="number" inputMode="decimal" min="0" step="0.00001"
                                        value={amounts.price} onChange={e => setAmounts(a => applyPrice(a, e.target.value))} placeholder="0" />
                                </div>
                                <div className="space-y-1 rounded-md bg-blue-50 p-1 dark:bg-blue-950/30">
                                    <Label htmlFor="pl-total" className="px-1">Totale riga (€)</Label>
                                    <Input id="pl-total" type="number" inputMode="decimal" min="0" step="0.01"
                                        value={amounts.total} onChange={e => setAmounts(a => ({ ...a, total: e.target.value }))}
                                        onBlur={() => setAmounts(a => applyTotal(a, a.total))} placeholder="0.00" />
                                    <p className="px-1 text-[11px] text-slate-500">Se conosci il totale della bolla, scrivilo qui: il prezzo unitario si ricalcola.</p>
                                </div>
                            </div>

                            {/* Riferimento a confezione: stessa quantità e stesso prezzo letti «a confezione» */}
            {packQuantity && (
                <div className="rounded-md border border-dashed p-3 text-sm">
                    <p className="font-medium">Confezione: {packQuantity} {unit}</p>
                    <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
                        {packsShown !== "" && <li>Stai inserendo {packsShown} confezioni = {amounts.quantity || 0} {unit}</li>}
                        {reference ? <li>Riferimento: € {(reference * packQuantity).toFixed(2)} a confezione (€ {reference.toFixed(4)} per {unit})</li> : null}
                        {priceNum > 0 && <li>Con questo prezzo: € {(priceNum * packQuantity).toFixed(2)} a confezione</li>}
                    </ul>
                </div>
            )}

            {/* Confronto con il prezzo di riferimento */}
                            <div className="rounded-md border p-3 text-sm">
                                {reference === undefined ? (
                                    <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cerco il prezzo di riferimento...</p>
                                ) : reference === null ? (
                                    <p className="flex items-center gap-2 text-slate-500"><Info className="h-4 w-4" /> Nessun prezzo di riferimento recente per questo materiale.</p>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-slate-600 dark:text-slate-300">
                                            Prezzo di riferimento: <span className="font-medium">€ {reference.toFixed(4)}</span> per {unit}
                                            <span className="text-xs text-slate-400"> (più alto degli ultimi 6 mesi)</span>
                                        </p>
                                        {check.kind === "ok" && (
                                            <p className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" /> {check.message}</p>
                                        )}
                                        {(check.kind === "higher" || check.kind === "lower" || check.kind === "pack") && (
                                            <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {check.message}</span>
                                                {check.kind === "pack" && check.suggestedPrice !== undefined && (
                                                    <Button size="sm" variant="outline"
                                                        onClick={() => setAmounts(a => applyPrice(a, String(check.suggestedPrice)))}>
                                                        Usa € {check.suggestedPrice} per {unit}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        {step === 1 ? (
                            <Button variant="outline" onClick={onClose}>Annulla</Button>
                        ) : (
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-1 h-4 w-4" /> Indietro
                            </Button>
                        )}
                        {step === 2 && (
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" disabled={!canAdd} onClick={() => confirm(true)}>
                                    <Plus className="mr-1 h-4 w-4" /> Aggiungi e continua
                                </Button>
                                <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canAdd} onClick={() => confirm(false)}>
                                    <Check className="mr-1 h-4 w-4" /> Aggiungi
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Materiale mancante: procedura guidata; dopo la creazione (o scelta di un articolo uguale) si passa alle quantità */}
            <NewItemDialog
                open={open && creatingTerm !== null}
                initialName={creatingTerm ?? ""}
                onClose={() => setCreatingTerm(null)}
                onCreated={(created) => { setCreatingTerm(null); pickItem(created); }}
            />
        </>
    );
}
