"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, Loader2, Trash2, Package, Copy } from "lucide-react";
import { format } from "date-fns";
import { MovementLine, PurchaseItemToImport } from "@/hooks/useMovementForm";
import { InventoryItem, Job } from "@/lib/types";
import { MovementMaterialDialog } from "./MovementMaterialDialog";
import { FieldTip } from "@/components/ui/field-tip";

interface MovementInlineTableProps {
    lines: MovementLine[];
    activeTab: "entry" | "exit" | "sale" | "waste";
    selectedJob?: Job | null;
    jobBatchAvailability: any[];
    inventory: InventoryItem[];
    itemsLoading: boolean;
    onItemSearch: (term: string) => Promise<void>;
    onItemSelect: (
        rowId: string,
        item: InventoryItem,
        prefill?: { pieces?: string; quantity?: string }
    ) => void;
    onReturnBatchSelect: (
        rowId: string,
        batch: any,
        prefill?: { pieces?: string; quantity?: string }
    ) => void;
    onLineChange: (rowId: string, field: string, value: any) => void;
    onRemove: (rowId: string) => void;
    onDuplicate: (rowId: string) => void;
    onPurchaseItemsImport: (items: PurchaseItemToImport[]) => void;
}

export function MovementInlineTable({
    lines,
    activeTab,
    selectedJob,
    jobBatchAvailability,
    inventory,
    itemsLoading,
    onItemSearch,
    onItemSelect,
    onReturnBatchSelect,
    onLineChange,
    onRemove,
    onDuplicate,
    onPurchaseItemsImport,
}: MovementInlineTableProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeRowId, setActiveRowId] = useState<string>("");

    const openDialogForRow = (rowId: string) => {
        setActiveRowId(rowId);
        setDialogOpen(true);
    };

    const isEntryWithJob = activeTab === "entry" && !!selectedJob;
    const showLotto = activeTab === "exit" || activeTab === "sale" || activeTab === "entry";
    const showFittizio = activeTab !== "waste";
    const showKgEccedenza = activeTab === "waste";
    const showPiecesAndQty = activeTab !== "waste";

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Righe Documento
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                            — clicca sulla cella materiale per cercare
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:px-6 sm:pb-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[160px]">Materiale</TableHead>
                                    {showLotto && (
                                        <TableHead className="min-w-[160px]">
                                            <span className="inline-flex items-center">
                                                Lotto
                                                <FieldTip text="L'acquisto da cui viene scalato il materiale, in ordine FIFO (si consuma prima il lotto più vecchio). 'Esaurito' significa che quel lotto non ha più quantità residua." />
                                            </span>
                                        </TableHead>
                                    )}
                                    {showFittizio && (
                                        <TableHead className="w-[72px] text-center">
                                            <span className="inline-flex items-center">
                                                Fittizio
                                                <FieldTip text="Registra il movimento senza scalare da un lotto specifico né spostare merce reale: serve per pareggiare i conti. Si blocca da solo quando tutti i lotti disponibili sono esauriti." />
                                            </span>
                                        </TableHead>
                                    )}
                                    {showPiecesAndQty && (
                                        <TableHead className="w-[88px] text-center">
                                            <span className="inline-flex items-center">
                                                Pezzi
                                                <FieldTip text="Collegato alla Quantità dal coefficiente di moltiplicazione dell'articolo: modificando uno dei due campi, l'altro si ricalcola automaticamente." />
                                            </span>
                                        </TableHead>
                                    )}
                                    {showPiecesAndQty && (
                                        <TableHead className="w-[100px] text-center">Quantità</TableHead>
                                    )}
                                    {showPiecesAndQty && (
                                        <TableHead className="w-[44px] text-center">U.M.</TableHead>
                                    )}
                                    {showKgEccedenza && (
                                        <TableHead className="w-[120px] text-center text-violet-700 dark:text-violet-400">Peso (kg)</TableHead>
                                    )}
                                    {/* Actions: dividi + elimina */}
                                    <TableHead className="w-[72px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((line, index) => {
                                    const isLast = index === lines.length - 1;
                                    const isEmpty = !line.itemId;

                                    // Cantiere batch info for entry lotto badge
                                    const cantiereBatch = line.availableBatches[0];

                                    // Lock fittizio when all lots are exhausted (exit/sale only)
                                    const allBatchesExhausted =
                                        (activeTab === "exit" || activeTab === "sale") &&
                                        line.availableBatches.length > 0 &&
                                        line.availableBatches.every((b) =>
                                            (b.remainingPieces ?? b.remainingQty ?? 0) <= 0.001
                                        );

                                    return (
                                        <TableRow key={line.tempId} className="group">
                                            {/* Materiale */}
                                            <TableCell
                                                className="cursor-pointer select-none py-2"
                                                onClick={() => openDialogForRow(line.tempId)}
                                            >
                                                {line.itemId ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-mono text-[10px] text-muted-foreground leading-none">
                                                            {line.itemCode}
                                                        </div>
                                                        <div className="font-medium text-sm leading-tight">
                                                            {line.itemName}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-muted-foreground py-1">
                                                        <Search className="h-4 w-4 shrink-0" />
                                                        <span className="text-sm">
                                                            {isEntryWithJob
                                                                ? "Cerca in cantiere..."
                                                                : "Cerca materiale..."}
                                                        </span>
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Lotto */}
                                            {showLotto && (
                                                <TableCell className="py-1 px-2">
                                                    {line.batchesLoading ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (activeTab === "exit" || activeTab === "sale") &&
                                                      line.itemId ? (
                                                        line.availableBatches.length === 0 ? (
                                                            <span className="text-xs text-amber-600">
                                                                Nessun lotto — usa Fittizio
                                                            </span>
                                                        ) : (
                                                            <Select
                                                                value={line.purchaseItemId || ""}
                                                                onValueChange={(v) =>
                                                                    onLineChange(
                                                                        line.tempId,
                                                                        "purchaseItemId",
                                                                        v
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Seleziona lotto..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {line.availableBatches.map((batch) => {
                                                                        const isExhausted =
                                                                            (batch.remainingPieces ??
                                                                                batch.remainingQty ??
                                                                                0) <= 0.001;
                                                                        return (
                                                                            <SelectItem
                                                                                key={batch.id}
                                                                                value={batch.id}
                                                                                className={
                                                                                    isExhausted
                                                                                        ? "opacity-60"
                                                                                        : ""
                                                                                }
                                                                            >
                                                                                <span className="font-medium">
                                                                                    {batch.purchaseRef ||
                                                                                        "Nessun Rif."}
                                                                                </span>
                                                                                <span className="text-muted-foreground ml-1 text-xs">
                                                                                    {" "}
                                                                                    {isExhausted
                                                                                        ? "— Esaurito"
                                                                                        : `— Pz: ${batch.remainingPieces ?? batch.remainingQty} / ${batch.remainingQty}`}
                                                                                    {batch.date &&
                                                                                        ` (${format(
                                                                                            new Date(batch.date),
                                                                                            "dd/MM/yy"
                                                                                        )})`}
                                                                                </span>
                                                                            </SelectItem>
                                                                        );
                                                                    })}
                                                                </SelectContent>
                                                            </Select>
                                                        )
                                                    ) : activeTab === "entry" && line.itemId ? (
                                                        line.availableBatches.length > 1 ? (
                                                            <Select
                                                                value={line.purchaseItemId || ""}
                                                                onValueChange={(v) =>
                                                                    onLineChange(
                                                                        line.tempId,
                                                                        "purchaseItemId",
                                                                        v
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="h-8 text-xs">
                                                                    <SelectValue placeholder="Seleziona lotto..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {line.availableBatches.map((batch) => (
                                                                        <SelectItem
                                                                            key={batch.id}
                                                                            value={batch.id}
                                                                        >
                                                                            <span className="font-medium">
                                                                                {batch.purchaseRef || "Nessun Rif."}
                                                                            </span>
                                                                            <span className="text-muted-foreground ml-1 text-xs">
                                                                                {" "}—{" "}
                                                                                {batch.remainingPieces != null
                                                                                    ? `${batch.remainingPieces} pz / `
                                                                                    : ""}
                                                                                {batch.remainingQty != null
                                                                                    ? `${batch.remainingQty} ${line.itemUnit}`
                                                                                    : ""}
                                                                            </span>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : line.purchaseRef ? (
                                                            <div className="space-y-0.5">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] font-mono"
                                                                >
                                                                    {line.purchaseRef}
                                                                </Badge>
                                                                {cantiereBatch && (
                                                                    <div className="text-[10px] text-muted-foreground leading-none">
                                                                        {cantiereBatch.remainingPieces != null
                                                                            ? `${cantiereBatch.remainingPieces} pz`
                                                                            : ""}{" "}
                                                                        {cantiereBatch.remainingQty != null
                                                                            ? `/ ${cantiereBatch.remainingQty} ${line.itemUnit}`
                                                                            : ""}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        )
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </TableCell>
                                            )}

                                            {/* Fittizio */}
                                            {showFittizio && (
                                                <TableCell className="py-1 text-center">
                                                    {line.itemId ? (
                                                        <Checkbox
                                                            checked={line.isFictitious}
                                                            disabled={allBatchesExhausted}
                                                            onCheckedChange={(v) =>
                                                                onLineChange(
                                                                    line.tempId,
                                                                    "isFictitious",
                                                                    v as boolean
                                                                )
                                                            }
                                                        />
                                                    ) : null}
                                                </TableCell>
                                            )}

                                            {/* Pezzi */}
                                            {showPiecesAndQty && (
                                                <TableCell className="py-1 px-1">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.pieces}
                                                        onChange={(e) =>
                                                            onLineChange(line.tempId, "pieces", e.target.value)
                                                        }
                                                        placeholder="0"
                                                        className="h-8 text-center px-1 text-sm"
                                                        disabled={isEmpty}
                                                    />
                                                </TableCell>
                                            )}

                                            {/* Quantità */}
                                            {showPiecesAndQty && (
                                                <TableCell className="py-1 px-1">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            onLineChange(
                                                                line.tempId,
                                                                "quantity",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                        className="h-8 text-center px-1 text-sm"
                                                        disabled={isEmpty}
                                                    />
                                                </TableCell>
                                            )}

                                            {/* U.M. */}
                                            {showPiecesAndQty && (
                                                <TableCell className="py-1 text-center">
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {line.itemUnit || ""}
                                                    </span>
                                                </TableCell>
                                            )}

                                            {/* kg Eccedenza */}
                                            {showKgEccedenza && (
                                                <TableCell className="py-1 px-1">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        step="0.001"
                                                        value={line.kgEccedenza}
                                                        onChange={(e) =>
                                                            onLineChange(line.tempId, "kgEccedenza", e.target.value)
                                                        }
                                                        placeholder="0.000"
                                                        className="h-8 text-center px-1 text-sm border-violet-300 focus:border-violet-500 dark:border-violet-700"
                                                        disabled={isEmpty}
                                                    />
                                                </TableCell>
                                            )}

                                            {/* Actions: Dividi + Elimina */}
                                            <TableCell className="py-1 px-1">
                                                <div className="flex items-center gap-0.5">
                                                    {/* Dividi */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Dividi riga"
                                                        onClick={() => onDuplicate(line.tempId)}
                                                        className={`h-7 w-7 transition-opacity ${
                                                            isEmpty
                                                                ? "opacity-0 pointer-events-none"
                                                                : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                        }`}
                                                        tabIndex={-1}
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </Button>
                                                    {/* Elimina */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Elimina riga"
                                                        onClick={() => onRemove(line.tempId)}
                                                        className={`h-7 w-7 transition-opacity ${
                                                            isLast && isEmpty
                                                                ? "opacity-0 pointer-events-none"
                                                                : "text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                        }`}
                                                        tabIndex={-1}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <MovementMaterialDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                rowId={activeRowId}
                activeTab={activeTab}
                selectedJob={selectedJob}
                jobBatchAvailability={jobBatchAvailability}
                inventory={inventory}
                itemsLoading={itemsLoading}
                onItemSearch={onItemSearch}
                onItemSelect={onItemSelect}
                onReturnBatchSelect={onReturnBatchSelect}
                onPurchaseItemsImport={onPurchaseItemsImport}
            />
        </>
    );
}
