"use client";

import { ArrowLeft, AlertTriangle, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadNoteItem } from "@/lib/types";

export interface PlanRow {
    key: string;
    batchId: string;
    qty: string;
    fictitious: boolean;
}

export interface NotePlanEntry {
    noteId: string;
    noteLabel: string;
    item: LoadNoteItem;
    // blocked: non importabile; ok: un lotto basta; split: più lotti; short: disponibilità insufficiente
    kind: "blocked" | "ok" | "split" | "short";
    reason?: string;
    decision: "import" | "skip";
    rows: PlanRow[];
    batches: any[];
    available: number;
}

// Valore del lotto per le righe fittizie (nessun lotto reale)
export const NO_BATCH = "none";

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
export const fmtQty = (n: number) => String(round4(n)).replace(".", ",");

// Ore reali prese da ogni lotto dalle righe che verranno importate (i fittizi non scalano nulla)
export const batchUsage = (plan: NotePlanEntry[]) => {
    const usage: Record<string, number> = {};
    for (const e of plan) {
        if (e.kind === "blocked" || e.decision !== "import") continue;
        for (const r of e.rows) {
            const q = parseFloat(r.qty);
            if (!r.fictitious && q > 0) usage[r.batchId] = (usage[r.batchId] ?? 0) + q;
        }
    }
    return usage;
};

interface Props {
    plan: NotePlanEntry[];
    totals: Record<string, number>;
    onChange: (plan: NotePlanEntry[]) => void;
    onBack: () => void;
    onConfirm: () => void;
    linesCount: number;
    allowNone: boolean;
}

export function NoteImportReview({ plan, totals, onChange, onBack, onConfirm, linesCount, allowNone }: Props) {
    const usage = batchUsage(plan);
    const overBatches = new Set(Object.keys(usage).filter((id) => usage[id] > (totals[id] ?? 0) + 0.0001));
    const blocked = plan.filter((e) => e.kind === "blocked");
    const mismatch = plan.some(
        (e) =>
            e.kind !== "blocked" &&
            e.decision === "import" &&
            Math.abs(e.rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0) - Number(e.item.quantity)) > 0.0001
    );

    const update = (itemId: string, patch: Partial<NotePlanEntry>) =>
        onChange(plan.map((e) => (e.item.id === itemId ? { ...e, ...patch } : e)));
    const updateRow = (itemId: string, key: string, patch: Partial<PlanRow>) =>
        onChange(plan.map((e) => (e.item.id === itemId ? { ...e, rows: e.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : e)));
    const removeRow = (itemId: string, key: string) =>
        onChange(plan.map((e) => (e.item.id === itemId ? { ...e, rows: e.rows.filter((r) => r.key !== key) } : e)));
    const addRow = (entry: NotePlanEntry) => {
        const sum = entry.rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
        const missing = Math.max(0, round4(Number(entry.item.quantity) - sum));
        const used = new Set(entry.rows.map((r) => r.batchId));
        const lot = entry.batches.find((b) => !used.has(b.id));
        if (!lot && !allowNone) return;
        update(entry.item.id, {
            rows: [
                ...entry.rows,
                {
                    key: Math.random().toString(36).slice(2),
                    batchId: lot ? lot.id : NO_BATCH,
                    qty: missing ? String(missing) : "",
                    fictitious: !lot,
                },
            ],
        });
    };

    const lotLabel = (b: any) =>
        `${b.purchaseRef || "—"}${b.date ? ` · ${format(new Date(b.date), "dd/MM/yy")}` : ""}${b.isFictitious ? " · fittizio" : ""} · disp. ${fmtQty(totals[b.id] ?? b.remainingQty ?? 0)}`;

    return (
        <>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Torna alla selezione
                </button>

                {blocked.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4" />
                            Non importabili ({blocked.length}): restano in sospeso nella nota, senza spunta
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                            {blocked.map((e) => (
                                <li key={e.item.id} className="flex flex-wrap justify-between gap-x-3">
                                    <span className="font-medium">
                                        {e.item.inventoryName} <span className="font-normal text-muted-foreground">({fmtQty(Number(e.item.quantity))} {e.item.inventoryUnit})</span>
                                    </span>
                                    <span className="text-amber-800 dark:text-amber-300">{e.reason}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {plan.filter((e) => e.kind !== "blocked").map((e) => {
                    const total = Number(e.item.quantity);
                    const sum = e.rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
                    const skipped = e.decision === "skip";
                    return (
                        <div key={e.item.id} className={`rounded-lg border p-3 ${skipped ? "opacity-70" : ""}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                        {e.item.inventoryName}
                                        {e.item.inventoryModel && <span className="font-normal text-muted-foreground"> ({e.item.inventoryModel})</span>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {e.noteLabel} · richiesti {fmtQty(total)} {e.item.inventoryUnit}
                                        {e.kind === "split" && " · da dividere su più lotti"}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="sm" variant={skipped ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => update(e.item.id, { decision: "skip" })}>
                                        Lascia in sospeso
                                    </Button>
                                    <Button size="sm" variant={!skipped ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => update(e.item.id, { decision: "import" })}>
                                        Importa
                                    </Button>
                                </div>
                            </div>

                            {e.kind === "short" && (
                                <div className="mt-2 flex items-start gap-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>
                                        Disponibilità insufficiente: solo {fmtQty(e.available)} su {fmtQty(total)}. Puoi controllare e lasciarla in sospeso, oppure
                                        importarla lo stesso: i pezzi in più sono proposti come fittizi.
                                    </span>
                                </div>
                            )}

                            {!skipped && (
                                <div className="mt-2 space-y-1.5">
                                    {e.rows.map((r) => {
                                        const over = !r.fictitious && overBatches.has(r.batchId);
                                        return (
                                            <div key={r.key} className="flex flex-wrap items-center gap-2">
                                                <Select value={r.batchId} onValueChange={(v) => updateRow(e.item.id, r.key, { batchId: v, fictitious: v === NO_BATCH })}>
                                                    <SelectTrigger className="h-8 min-w-0 flex-1 basis-56 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {allowNone && <SelectItem value={NO_BATCH}>Fittizio (senza lotto)</SelectItem>}
                                                        {e.batches.map((b) => <SelectItem key={b.id} value={b.id}>{lotLabel(b)}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    step="0.01"
                                                    value={r.qty}
                                                    onChange={(ev) => updateRow(e.item.id, r.key, { qty: ev.target.value })}
                                                    onWheel={(ev) => ev.currentTarget.blur()}
                                                    className={`h-8 w-24 text-center ${over ? "border-red-500" : ""}`}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="Togli riga" onClick={() => removeRow(e.item.id, r.key)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                                {over && <span className="basis-full text-xs text-red-600">Oltre la disponibilità del lotto: riduci o sposta il resto su "Fittizio"</span>}
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-center justify-between">
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => addRow(e)}>
                                            <Plus className="mr-1 h-3 w-3" /> Aggiungi lotto
                                        </Button>
                                        <span className={`text-xs ${Math.abs(sum - total) > 0.0001 ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
                                            Totale {fmtQty(sum)} / {fmtQty(total)} {e.item.inventoryUnit}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 shrink-0 border-t pt-3">
                {mismatch && <p className="mb-2 text-xs text-amber-700">Per importare, il totale di ogni riga deve coincidere con la quantità della nota.</p>}
                <Button className="w-full" disabled={linesCount === 0 || overBatches.size > 0 || mismatch} onClick={onConfirm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Importa {linesCount} {linesCount === 1 ? "riga" : "righe"}
                </Button>
            </div>
        </>
    );
}
