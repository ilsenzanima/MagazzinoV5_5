"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Job } from "@/lib/types";
import type { MovementLine } from "@/hooks/useMovementForm";
import { inventoryApi } from "@/lib/services/inventory";
import { planLotSplit } from "@/lib/utils/lot-split";

type MovementTab = "entry" | "exit" | "sale" | "waste" | "transfer";

interface MovementLineDialogProps {
    open: boolean;
    onClose: () => void;
    line?: MovementLine;
    activeTab: MovementTab;
    selectedJob?: Job | null;
    jobBatchAvailability: any[];
    onLineChange: (rowId: string, field: string, value: any) => void;
    onSplit: (rowId: string, patches: Partial<MovementLine>[]) => void;
    onBack: () => void;                  // torna alla scelta del materiale
    onNext: () => void;                  // «Aggiungi e continua»
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Pagina 2 dell'inserimento di una riga di movimento: lotto, quantità (anche a confezioni) ed eventuale divisione sui lotti
export function MovementLineDialog({
    open, onClose, line, activeTab, selectedJob, jobBatchAvailability, onLineChange, onSplit, onBack, onNext,
}: MovementLineDialogProps) {
    const [packsInput, setPacksInput] = useState("");   // confezioni intere
    const [extraInput, setExtraInput] = useState("");     // pezzi in più (o in meno, con il segno meno)
    const [packQuantity, setPackQuantity] = useState<number | null>(null);

    const itemId = line?.itemId;
    useEffect(() => {
        setPacksInput("");
        setExtraInput("");
        setPackQuantity(null);
        if (!open || !itemId) return;
        let cancelled = false;
        inventoryApi.getPackQuantities([itemId])
            .then(map => { if (!cancelled) setPackQuantity(map.get(itemId) ?? null); })
            .catch(() => { /* senza confezione il campo calcolatrice usa solo pezzi e unità */ });
        return () => { cancelled = true; };
    }, [open, itemId]);

    const isWaste = activeTab === "waste";
    const isReturnFromJob = activeTab === "entry" && !!selectedJob;
    const isTransfer = activeTab === "transfer";
    const coefficient = line?.coefficient && line.coefficient > 0 ? line.coefficient : 1;
    const unit = line?.itemUnit || "PZ";

    // Lotti da cui si può prelevare / rendere. Per il reso da cantiere: anche i lotti fittizi dello stesso articolo.
    const lots = useMemo(() => {
        if (!line) return [] as { id: string; label: string; remaining: number; isFictitious: boolean; purchaseRef?: string; date?: string }[];
        if (isReturnFromJob) {
            return jobBatchAvailability
                .filter(b => b.itemId === line.itemId)
                .sort((a, b) => Number(!!a.isFictitious) - Number(!!b.isFictitious))
                .map(b => ({
                    id: b.purchaseItemId as string,
                    label: b.purchaseRef || "Nessun Rif.",
                    remaining: Number(b.quantity ?? 0),
                    isFictitious: !!b.isFictitious,
                    purchaseRef: b.purchaseRef,
                    date: b.date,
                }));
        }
        return line.availableBatches.map((b: any) => ({
            id: b.id as string,
            label: b.purchaseRef || "Nessun Rif.",
            remaining: Number(b.remainingQty ?? 0),
            isFictitious: false,
            purchaseRef: b.purchaseRef,
            date: b.date,
        }));
    }, [line, isReturnFromJob, jobBatchAvailability]);

    if (!line) return null;

    const quantity = parseFloat(line.quantity);
    const selectedLot = lots.find(l => l.id === line.purchaseItemId);
    const checksRemaining = !isTransfer && !isWaste && !line.isFictitious && !!selectedLot;
    const exceeds = checksRemaining && quantity > selectedLot!.remaining + 0.001;
    const plan = exceeds
        ? planLotSplit(quantity, lots.filter(l => !l.isFictitious || isReturnFromJob).map(l => ({ id: l.id, remaining: l.remaining })), line.purchaseItemId)
        : null;

    // Confezioni e pezzi di rettifica: la quantità è confezioni x quantità per confezione + pezzi x coefficiente
    const applyPackFields = (packsText: string, extraText: string) => {
        setPacksInput(packsText);
        setExtraInput(extraText);
        const packs = parseFloat(packsText.replace(",", "."));
        const extra = parseFloat(extraText.replace(",", "."));
        if (isNaN(packs) && isNaN(extra)) { onLineChange(line.tempId, "quantity", ""); return; }
        const total = (isNaN(packs) ? 0 : packs) * (packQuantity ?? 0) + (isNaN(extra) ? 0 : extra) * coefficient;
        onLineChange(line.tempId, "quantity", total > 0 ? String(round2(total)) : "");
    };
    const packsNumber = parseFloat(packsInput.replace(",", "."));
    const extraNumber = parseFloat(extraInput.replace(",", "."));
    const packBreakdown = packQuantity && (packsInput !== "" || extraInput !== "")
        ? `${isNaN(packsNumber) ? 0 : packsNumber} conf × ${packQuantity} ${unit}${isNaN(extraNumber) || extraNumber === 0 ? "" : ` ${extraNumber < 0 ? "−" : "+"} ${Math.abs(extraNumber)} pz × ${coefficient} ${unit}`}`
        : "";

    const applySplit = () => {
        if (!plan) return;
        const patches: Partial<MovementLine>[] = plan.allocations.map(a => {
            const lot = lots.find(l => l.id === a.lotId)!;
            return {
                purchaseItemId: lot.id,
                purchaseRef: lot.purchaseRef,
                isFictitious: lot.isFictitious,
                quantity: String(a.quantity),
                pieces: coefficient !== 1 ? (a.quantity / coefficient).toFixed(2) : String(a.quantity),
                availableBatches: isReturnFromJob
                    ? lots.filter(l => l.isFictitious === lot.isFictitious).map(l => ({
                        id: l.id, purchaseRef: l.purchaseRef, remainingQty: l.remaining, date: l.date,
                    }))
                    : line.availableBatches,
            };
        });
        onSplit(line.tempId, patches);
        onClose();
    };

    const canConfirm = isWaste ? parseFloat(line.kgEccedenza) > 0 : quantity > 0;
    const packsText = packQuantity && quantity > 0 ? round2(quantity / packQuantity) : null;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent
                // Come gli altri modali di inserimento: si chiude solo con i pulsanti a schermo
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                className="flex h-[100dvh] max-w-none flex-col rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg"
            >
                <DialogHeader>
                    <DialogTitle>
                        {isReturnFromJob ? "Reso da cantiere" : isWaste ? "Eccedenza" : isTransfer ? "Trasferimento" : activeTab === "sale" ? "Vendita" : activeTab === "entry" ? "Entrata" : "Uscita"}
                    </DialogTitle>
                    <DialogDescription>Passo 2 di 2: {isWaste ? "peso" : "lotto e quantità"}</DialogDescription>
                    <div className="mt-2 flex gap-1">
                        <div className="h-1.5 flex-1 rounded bg-blue-600" />
                        <div className="h-1.5 flex-1 rounded bg-blue-600" />
                    </div>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto py-2">
                    <div className="flex items-start justify-between gap-3 rounded-md border bg-slate-50 p-3 dark:bg-slate-800/40">
                        <div className="min-w-0">
                            <div className="font-mono text-[11px] text-slate-500">{line.itemCode}</div>
                            <div className="font-medium leading-tight">{line.itemName}</div>
                            {selectedJob && <div className="text-xs text-slate-400">Commessa {selectedJob.code}</div>}
                        </div>
                        <Button variant="outline" size="sm" className="shrink-0" onClick={onBack}>
                            <ArrowLeft className="mr-1 h-4 w-4" /> Cambia
                        </Button>
                    </div>

                    {isWaste ? (
                        <div className="space-y-1">
                            <Label htmlFor="ml-kg">Peso (kg)</Label>
                            <Input id="ml-kg" type="number" inputMode="decimal" min="0" step="0.001" autoFocus
                                value={line.kgEccedenza} onChange={e => onLineChange(line.tempId, "kgEccedenza", e.target.value)}
                                placeholder="0.000" />
                            <p className="text-[11px] text-slate-500">Le eccedenze sono sempre movimenti fittizi: pezzi e confezioni non servono.</p>
                        </div>
                    ) : (
                        <>
                            {/* Lotto */}
                            {line.batchesLoading ? (
                                <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carico i lotti...</p>
                            ) : lots.length === 0 ? (
                                <p className="rounded bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                                    Nessun lotto disponibile{activeTab === "exit" || activeTab === "sale" ? ": usa «Fittizio»" : ""}.
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    <Label>{isReturnFromJob ? "Lotto in cantiere" : "Lotto (in ordine FIFO)"}</Label>
                                    <Select value={line.purchaseItemId || ""} onValueChange={(v) => {
                                        onLineChange(line.tempId, "purchaseItemId", v);
                                        const lot = lots.find(l => l.id === v);
                                        if (isReturnFromJob && lot && lot.isFictitious !== line.isFictitious) {
                                            onLineChange(line.tempId, "isFictitious", lot.isFictitious);
                                        }
                                    }}>
                                        <SelectTrigger><SelectValue placeholder="Seleziona lotto..." /></SelectTrigger>
                                        <SelectContent>
                                            {lots.map(l => (
                                                <SelectItem key={l.id} value={l.id}>
                                                    <span className="font-medium">{l.label}</span>
                                                    <span className="ml-1 text-xs text-muted-foreground">
                                                        {l.isFictitious ? "· fittizio " : ""}— {isReturnFromJob ? "in cantiere" : "rimasti"} {l.remaining} {unit}
                                                        {packQuantity ? ` · ${round2(l.remaining / packQuantity)} conf.` : ""}
                                                        {l.date ? ` (${format(new Date(l.date), "dd/MM/yy")})` : ""}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Confezioni + pezzi di rettifica (solo per gli articoli con la confezione) */}
                            {packQuantity ? (
                                <div className="space-y-1 rounded-md border border-dashed p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="ml-packs">Confezioni</Label>
                                            <Input id="ml-packs" type="number" inputMode="decimal" min="0" step="1" autoFocus
                                                value={packsInput} onChange={e => applyPackFields(e.target.value, extraInput)} placeholder="0" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="ml-extra">Pezzi in più o in meno</Label>
                                            <Input id="ml-extra" type="number" inputMode="decimal" step="1"
                                                value={extraInput} onChange={e => applyPackFields(packsInput, e.target.value)} placeholder="es. 3 oppure -1" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        1 confezione = {packQuantity} {unit}{coefficient !== 1 ? `; 1 pezzo = ${coefficient} ${unit}` : ""}.
                                        Per «2 scatole + 3 pezzi» scrivi 2 e 3; per «3 scatole meno 1 pezzo» scrivi 3 e -1.
                                    </p>
                                    {packBreakdown && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            {packBreakdown} → <span className="font-medium">{quantity > 0 ? `${quantity} ${unit}` : "—"}</span>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                coefficient !== 1 && <p className="text-[11px] text-slate-500">1 pezzo = {coefficient} {unit}.</p>
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="ml-pieces">Pezzi</Label>
                                    <Input id="ml-pieces" type="number" inputMode="decimal" min="0" step="0.01"
                                        value={line.pieces} onChange={e => { setPacksInput(""); setExtraInput(""); onLineChange(line.tempId, "pieces", e.target.value); }} placeholder="0"
                                        autoFocus={!packQuantity} />
                                </div>
                                <div className="space-y-1 rounded-md bg-blue-50 p-1 dark:bg-blue-950/30">
                                    <Label htmlFor="ml-qty" className="px-1">Quantità ({unit})</Label>
                                    <Input id="ml-qty" type="number" inputMode="decimal" min="0" step="0.01"
                                        value={line.quantity} onChange={e => { setPacksInput(""); setExtraInput(""); onLineChange(line.tempId, "quantity", e.target.value); }} placeholder="0.00" />
                                    {packsText !== null && (
                                        <p className="px-1 text-[11px] text-slate-500">
                                            = {packsText} confezioni{Number.isInteger(packsText) ? "" : " (una è aperta)"}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {(activeTab === "exit" || activeTab === "sale" || activeTab === "entry") && (
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox checked={line.isFictitious} onCheckedChange={(v) => onLineChange(line.tempId, "isFictitious", v === true)} />
                                    {activeTab === "entry" ? "Fittizio (solo in bolla, non in giacenza)" : "Fittizio (non scalare da magazzino)"}
                                </label>
                            )}

                            {/* Oltre il residuo: divisione sui lotti */}
                            {exceeds && plan && (
                                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                    <p className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            {isReturnFromJob ? "In cantiere per questo lotto" : "Nel lotto scelto"} {selectedLot!.remaining < 0.001 ? "non resta nulla" : `restano ${selectedLot!.remaining} ${unit}`}, ne servono {quantity}.
                                        </span>
                                    </p>
                                    {plan.missing <= 0.001 ? (
                                        <>
                                            <p className="text-xs">
                                                Proposta: {plan.allocations.map(a => {
                                                    const lot = lots.find(l => l.id === a.lotId)!;
                                                    return `${a.quantity} ${unit} dal lotto ${lot.label}${lot.isFictitious ? " (fittizio)" : ""}`;
                                                }).join(" + ")}
                                            </p>
                                            <Button size="sm" variant="outline" onClick={applySplit}>Dividi sui lotti (crea {plan.allocations.length} righe)</Button>
                                        </>
                                    ) : (
                                        <p className="text-xs">
                                            Anche sommando tutti i lotti mancano {plan.missing} {unit}. {isReturnFromJob ? "Riduci la quantità del reso." : "Usa «Fittizio» per la parte restante."}
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" /> Indietro</Button>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" disabled={!canConfirm} onClick={onNext}>
                            <Plus className="mr-1 h-4 w-4" /> Aggiungi e continua
                        </Button>
                        <Button className="bg-[#003366] hover:bg-[#002244]" disabled={!canConfirm} onClick={onClose}>
                            <Check className="mr-1 h-4 w-4" /> Fine
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
