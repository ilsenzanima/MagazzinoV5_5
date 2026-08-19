"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Search,
    Loader2,
    Package,
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    PlusCircle,
    ChevronDown,
    ChevronRight,
    ShoppingCart,
} from "lucide-react";
import { InventoryItem, Job, LoadNote, LoadNoteItem, Purchase } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes";
import { inventoryApi } from "@/lib/services/inventory";
import { purchasesApi } from "@/lib/services/purchases";
import { PurchaseItemToImport } from "@/hooks/useMovementForm";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { HelpTip } from "@/components/ui/help-tip";
import { notify } from "@/lib/notify";

interface MovementMaterialDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rowId: string;
    activeTab: "entry" | "exit" | "sale" | "waste" | "transfer";
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
    onPurchaseItemsImport: (items: PurchaseItemToImport[]) => void;
}

interface CombinedPurchaseItem {
    id: string;
    itemId: string;
    itemName?: string;
    itemCode?: string;
    itemUnit?: string;
    coefficient: number;
    purchaseRef?: string;
    remainingQty: number;
    remainingPieces?: number;
    batchDate?: string;
}

interface PurchaseDetail {
    loading: boolean;
    items: CombinedPurchaseItem[];
}

export function MovementMaterialDialog({
    open,
    onOpenChange,
    rowId,
    activeTab,
    selectedJob,
    jobBatchAvailability,
    inventory,
    itemsLoading,
    onItemSearch,
    onItemSelect,
    onReturnBatchSelect,
    onPurchaseItemsImport,
}: MovementMaterialDialogProps) {
    const isEntryWithJob = activeTab === "entry" && !!selectedJob;
    const defaultDialogTab = isEntryWithJob ? "cantiere" : "magazzino";

    const [dialogTab, setDialogTab] = useState(defaultDialogTab);
    const [searchTerm, setSearchTerm] = useState("");

    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [notesLoading, setNotesLoading] = useState(false);
    const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
    const [noteItemLoading, setNoteItemLoading] = useState<string | null>(null);

    // Purchase tab state
    const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
    const [purchaseDateFilter, setPurchaseDateFilter] = useState("");
    const [purchasesData, setPurchasesData] = useState<Purchase[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<Set<string>>(new Set());
    const [purchaseDetailsMap, setPurchaseDetailsMap] = useState<Record<string, PurchaseDetail>>({});
    const [selectedPurchaseItemIds, setSelectedPurchaseItemIds] = useState<Set<string>>(new Set());

    const showPurchaseTab = activeTab === "exit" || activeTab === "sale";

    useEffect(() => {
        if (open) {
            setDialogTab(isEntryWithJob ? "cantiere" : "magazzino");
            setSearchTerm("");
            setPurchaseSearchTerm("");
            setPurchaseDateFilter("");
            setPurchasesData([]);
            setExpandedPurchaseIds(new Set());
            setPurchaseDetailsMap({});
            setSelectedPurchaseItemIds(new Set());
        }
    }, [open, isEntryWithJob]);

    useEffect(() => {
        if (open && dialogTab === "note") {
            fetchNotes();
        }
    }, [open, dialogTab, selectedJob?.id]);

    useEffect(() => {
        if (!open || dialogTab !== "acquisti") return;
        const delay = purchaseSearchTerm ? 500 : 0;
        const handler = setTimeout(async () => {
            setPurchasesLoading(true);
            try {
                const { data } = await purchasesApi.getPaginated({
                    page: 1,
                    limit: 20,
                    search: purchaseSearchTerm,
                });
                setPurchasesData(data);
            } catch (error) {
                console.error("Failed to fetch purchases", error);
                notify.error("Errore nel caricamento degli acquisti");
            } finally {
                setPurchasesLoading(false);
            }
        }, delay);
        return () => clearTimeout(handler);
    }, [open, dialogTab, purchaseSearchTerm]);

    // Debounced search for Magazzino tab
    useEffect(() => {
        if (dialogTab !== "magazzino") return;
        const handler = setTimeout(() => {
            onItemSearch(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, dialogTab, onItemSearch]);

    const fetchNotes = async () => {
        setNotesLoading(true);
        try {
            const allNotes = await loadNotesService.getAll({
                status: "pending",
                jobId: selectedJob?.id,
            });
            setNotes(
                allNotes.sort((a, b) => {
                    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                    if (dateDiff !== 0) return dateDiff;
                    return (a.jobDescription || "").localeCompare(b.jobDescription || "");
                })
            );
        } catch (error) {
            console.error("Failed to fetch notes", error);
            notify.error("Errore nel caricamento delle note di carico");
        } finally {
            setNotesLoading(false);
        }
    };

    const filteredBatches = useMemo(() => {
        const sorted = [...jobBatchAvailability].sort((a, b) =>
            a.itemName.localeCompare(b.itemName)
        );
        if (!searchTerm.trim()) return sorted;
        const words = searchTerm.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
        return sorted.filter((b) => {
            const target = `${b.itemName} ${b.itemCode} ${b.itemModel || ""}`.toLowerCase();
            return words.every((w) => target.includes(w));
        });
    }, [jobBatchAvailability, searchTerm]);

    const handleSelectBatch = (batch: any) => {
        onReturnBatchSelect(rowId, batch);
        onOpenChange(false);
    };

    const handleSelectItem = (item: InventoryItem) => {
        onItemSelect(rowId, item);
        onOpenChange(false);
    };

    const handleUseNoteItem = async (noteItem: LoadNoteItem) => {
        setNoteItemLoading(noteItem.id);
        try {
            let inventoryItem = inventory.find((inv) => inv.id === noteItem.inventoryId);
            if (!inventoryItem && noteItem.inventoryId) {
                inventoryItem = await inventoryApi.getById(noteItem.inventoryId);
            }
            if (!inventoryItem) return;

            const prefill = {
                pieces: noteItem.pieces?.toString(),
                quantity: noteItem.quantity?.toString(),
            };

            // Auto-check the item in the note
            const parentNote = notes.find((n) => n.items.some((i) => i.id === noteItem.id));
            if (parentNote) {
                toggleCheck(parentNote.id, noteItem.id);
            }

            if (isEntryWithJob) {
                const matchingBatch = jobBatchAvailability.find(
                    (b) => b.itemId === inventoryItem!.id
                );
                if (matchingBatch) {
                    onReturnBatchSelect(rowId, matchingBatch, prefill);
                    onOpenChange(false);
                    return;
                }
            }

            onItemSelect(rowId, inventoryItem, prefill);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to use note item", error);
            notify.error("Errore durante l'utilizzo dell'articolo della nota");
        } finally {
            setNoteItemLoading(null);
        }
    };

    const toggleCheck = async (noteId: string, itemId: string, currentChecked?: boolean) => {
        // Use the passed current state, or fall back to local set
        const isChecked = currentChecked ?? checkedItems.has(itemId);
        const newChecked = !isChecked;
        const next = new Set(checkedItems);
        newChecked ? next.add(itemId) : next.delete(itemId);
        setCheckedItems(next);
        // Also update the notes array so item.isChecked reflects the new state immediately
        setNotes(prev => prev.map(n =>
            n.id === noteId
                ? { ...n, items: n.items.map(i => i.id === itemId ? { ...i, isChecked: newChecked } : i) }
                : n
        ));
        try {
            await loadNotesService.toggleItemCheck(noteId, itemId, newChecked);
        } catch (error) {
            console.error("Failed to toggle item check", error);
            notify.error("Errore nell'aggiornamento dello stato dell'articolo");
        }
    };

    const toggleExpanded = (noteId: string) => {
        const next = new Set(expandedNoteIds);
        next.has(noteId) ? next.delete(noteId) : next.add(noteId);
        setExpandedNoteIds(next);
    };

    const fetchPurchaseDetails = async (purchaseId: string, fallbackRef: string) => {
        setPurchaseDetailsMap((prev) => ({
            ...prev,
            [purchaseId]: { loading: true, items: prev[purchaseId]?.items || [] },
        }));
        try {
            const [items, availability] = await Promise.all([
                purchasesApi.getItems(purchaseId),
                purchasesApi.getPurchaseBatchAvailability(purchaseId),
            ]);
            const availMap = new Map(availability.map((a: any) => [a.id, a]));
            const combined: CombinedPurchaseItem[] = items.map((item) => {
                const avail = availMap.get(item.id) as any;
                return {
                    id: item.id,
                    itemId: item.itemId,
                    itemName: item.itemName,
                    itemCode: item.itemCode,
                    itemUnit: item.itemUnit,
                    coefficient: item.coefficient || 1,
                    purchaseRef: avail?.purchaseRef || fallbackRef,
                    remainingQty: avail?.remainingQty ?? 0,
                    remainingPieces: avail?.remainingPieces,
                    batchDate: avail?.date,
                };
            });
            setPurchaseDetailsMap((prev) => ({
                ...prev,
                [purchaseId]: { loading: false, items: combined },
            }));
        } catch (error) {
            console.error("Failed to fetch purchase details", error);
            notify.error("Errore nel caricamento dei dettagli dell'acquisto");
            setPurchaseDetailsMap((prev) => ({
                ...prev,
                [purchaseId]: { loading: false, items: [] },
            }));
        }
    };

    const togglePurchaseExpanded = (purchaseId: string, fallbackRef: string) => {
        const next = new Set(expandedPurchaseIds);
        if (next.has(purchaseId)) {
            next.delete(purchaseId);
        } else {
            next.add(purchaseId);
            if (!purchaseDetailsMap[purchaseId]) {
                fetchPurchaseDetails(purchaseId, fallbackRef);
            }
        }
        setExpandedPurchaseIds(next);
    };

    const togglePurchaseItem = (itemId: string) => {
        const next = new Set(selectedPurchaseItemIds);
        next.has(itemId) ? next.delete(itemId) : next.add(itemId);
        setSelectedPurchaseItemIds(next);
    };

    const handleImportSelected = () => {
        const itemsToImport: PurchaseItemToImport[] = [];
        for (const detail of Object.values(purchaseDetailsMap)) {
            for (const item of detail.items) {
                if (selectedPurchaseItemIds.has(item.id)) {
                    itemsToImport.push({
                        purchaseItemId: item.id,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        itemCode: item.itemCode,
                        itemUnit: item.itemUnit,
                        coefficient: item.coefficient,
                        purchaseRef: item.purchaseRef,
                        remainingQty: item.remainingQty,
                        remainingPieces: item.remainingPieces,
                        batchDate: item.batchDate,
                    });
                }
            }
        }
        if (itemsToImport.length === 0) return;
        onPurchaseItemsImport(itemsToImport);
        onOpenChange(false);
    };

    const filteredPurchases = useMemo(() => {
        if (!purchaseDateFilter) return purchasesData;
        return purchasesData.filter((p) => p.deliveryNoteDate.startsWith(purchaseDateFilter));
    }, [purchasesData, purchaseDateFilter]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
                    <DialogTitle>Seleziona Materiale</DialogTitle>
                </DialogHeader>

                <Tabs
                    value={dialogTab}
                    onValueChange={setDialogTab}
                    className="flex flex-col flex-1 overflow-hidden"
                >
                    <div className="px-6 pt-4 shrink-0">
                        <TabsList className="w-full">
                            {isEntryWithJob ? (
                                <>
                                    <TabsTrigger value="cantiere" className="flex-1">
                                        <Package className="h-4 w-4 mr-2" />
                                        In Cantiere
                                        <HelpTip
                                            title="In Cantiere"
                                            description="Materiale già portato in questo cantiere in precedenza, disponibile per un reso. Se compare come 'Fittizio' significa che era stato scaricato senza aggancio a un lotto specifico."
                                        />
                                    </TabsTrigger>
                                    <TabsTrigger value="note" className="flex-1">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Note di Carico
                                        <HelpTip
                                            title="Note di Carico"
                                            description="Importa materiale già elencato in una nota di carico registrata, senza doverlo ricercare manualmente."
                                        />
                                    </TabsTrigger>
                                </>
                            ) : activeTab === "exit" || activeTab === "sale" ? (
                                <>
                                    <TabsTrigger value="magazzino" className="flex-1">
                                        <Search className="h-4 w-4 mr-2" />
                                        Magazzino
                                        <HelpTip
                                            title="Magazzino"
                                            description="Cerca tra tutti gli articoli disponibili a magazzino, indipendentemente dal cantiere."
                                        />
                                    </TabsTrigger>
                                    <TabsTrigger value="note" className="flex-1">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Note di Carico
                                        <HelpTip
                                            title="Note di Carico"
                                            description="Importa materiale già elencato in una nota di carico registrata, senza doverlo ricercare manualmente."
                                        />
                                    </TabsTrigger>
                                    <TabsTrigger value="acquisti" className="flex-1">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Da Acquisto
                                        <HelpTip
                                            title="Da Acquisto"
                                            description="Importa una o più righe direttamente da una bolla d'acquisto già registrata, invece di cercare gli articoli uno per uno."
                                        />
                                    </TabsTrigger>
                                </>
                            ) : (
                                <>
                                    <TabsTrigger value="magazzino" className="flex-1">
                                        <Search className="h-4 w-4 mr-2" />
                                        Magazzino
                                        <HelpTip
                                            title="Magazzino"
                                            description="Cerca tra tutti gli articoli disponibili a magazzino, indipendentemente dal cantiere."
                                        />
                                    </TabsTrigger>
                                    <TabsTrigger value="note" className="flex-1">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Note di Carico
                                        <HelpTip
                                            title="Note di Carico"
                                            description="Importa materiale già elencato in una nota di carico registrata, senza doverlo ricercare manualmente."
                                        />
                                    </TabsTrigger>
                                </>
                            )}
                        </TabsList>
                    </div>

                    {/* ---- IN CANTIERE (entry + job) ---- */}
                    {isEntryWithJob && (
                        <TabsContent
                            value="cantiere"
                            className="flex-1 overflow-hidden flex flex-col px-6 pb-6 mt-4"
                        >
                            <Input
                                placeholder="Cerca per nome o codice..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                className="mb-3 shrink-0"
                            />
                            <div className="flex-1 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Articolo</TableHead>
                                            <TableHead>Rif. Acquisto</TableHead>
                                            <TableHead className="text-right">In Cantiere</TableHead>
                                            <TableHead className="w-[90px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBatches.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center py-8 text-muted-foreground"
                                                >
                                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                    <p className="text-sm">Nessun articolo trovato</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredBatches.map((batch, idx) => (
                                                <TableRow
                                                    key={idx}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => handleSelectBatch(batch)}
                                                >
                                                    <TableCell className="py-2">
                                                        <div className="text-sm font-medium flex flex-wrap items-center gap-1.5">
                                                            <span>
                                                                {batch.itemName}
                                                                {batch.itemModel && (
                                                                    <span className="text-muted-foreground font-normal ml-1">
                                                                        ({batch.itemModel})
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {batch.isFictitious && (
                                                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] h-5 px-1.5 font-normal">
                                                                    Fittizio
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono">
                                                            {batch.itemCode}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                                        <div>{batch.purchaseRef || "-"}</div>
                                                        {batch.purchaseDate && (
                                                            <div className="text-[10px]">
                                                                (
                                                                {new Date(batch.purchaseDate).toLocaleDateString(
                                                                    "it-IT"
                                                                )}
                                                                )
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right">
                                                        <div className="text-sm font-bold">
                                                            {batch.quantity} {batch.itemUnit}
                                                        </div>
                                                        {batch.pieces != null && (
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {batch.pieces} pz
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className="h-7 text-xs"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectBatch(batch);
                                                            }}
                                                        >
                                                            Seleziona
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    )}

                    {/* ---- MAGAZZINO (non-entry) ---- */}
                    {!isEntryWithJob && (
                        <TabsContent
                            value="magazzino"
                            className="flex-1 overflow-hidden flex flex-col px-6 pb-6 mt-4"
                        >
                            <div className="relative mb-3 shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cerca per codice, nome, variante, marca..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Codice</TableHead>
                                            <TableHead>Descrizione</TableHead>
                                            <TableHead className="text-right">Giacenza</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {itemsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8">
                                                    <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        ) : inventory.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={4}
                                                    className="text-center py-8 text-muted-foreground"
                                                >
                                                    <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                    <p className="text-sm">Nessun articolo trovato</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            inventory.map((item) => (
                                                <TableRow
                                                    key={item.id}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => handleSelectItem(item)}
                                                >
                                                    <TableCell className="font-mono text-xs py-2">
                                                        {item.code}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="font-medium text-sm">
                                                            {item.name}
                                                            {item.model && (
                                                                <span className="text-muted-foreground font-normal ml-1">
                                                                    ({item.model})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.brand}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                item.quantity <= 0
                                                                    ? "text-red-600 border-red-200"
                                                                    : item.quantity <= item.minStock
                                                                    ? "text-amber-600 border-amber-200"
                                                                    : ""
                                                            }
                                                        >
                                                            {item.quantity} {item.unit}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectItem(item);
                                                            }}
                                                        >
                                                            <PlusCircle className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    )}

                    {/* ---- NOTE DI CARICO ---- */}
                    <TabsContent
                        value="note"
                        className="flex-1 overflow-hidden flex flex-col px-6 pb-6 mt-4"
                    >
                        {notesLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : notes.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Nessuna nota attiva trovata</p>
                                {selectedJob && (
                                    <p className="text-xs mt-1 text-muted-foreground">
                                        Filtrate per commessa selezionata
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {notes.map((note) => {
                                    const isExpanded = expandedNoteIds.has(note.id);
                                    const uncheckedCount = note.items.filter(
                                        (i) => !checkedItems.has(i.id) && !i.isChecked
                                    ).length;

                                    return (
                                        <Collapsible
                                            key={note.id}
                                            open={isExpanded}
                                            onOpenChange={() => toggleExpanded(note.id)}
                                        >
                                            <CollapsibleTrigger asChild>
                                                <div className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                                                    <div
                                                        className={`flex-shrink-0 p-1.5 rounded ${
                                                            note.noteType === "uscita"
                                                                ? "bg-amber-500/10 text-amber-600"
                                                                : "bg-green-500/10 text-green-600"
                                                        }`}
                                                    >
                                                        {note.noteType === "uscita" ? (
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        ) : (
                                                            <ArrowDownRight className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(new Date(note.date), "d MMM", {
                                                                    locale: it,
                                                                })}
                                                            </span>
                                                            {uncheckedCount > 0 && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] px-1.5 py-0"
                                                                >
                                                                    {uncheckedCount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="font-medium text-sm truncate">
                                                            {note.jobDescription ||
                                                                note.notes ||
                                                                "Appunto generico"}
                                                        </div>
                                                    </div>
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    )}
                                                </div>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                                <div className="ml-4 pl-4 border-l-2 border-muted mt-1 space-y-1">
                                                    {note.notes && (
                                                        <div className="text-xs italic text-muted-foreground py-1 px-2">
                                                            "{note.notes}"
                                                        </div>
                                                    )}
                                                    {note.items.map((item) => {
                                                        const isChecked =
                                                            checkedItems.has(item.id) || item.isChecked;
                                                        const isLoading = noteItemLoading === item.id;
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`flex items-center gap-2 p-2 rounded border text-sm transition-colors ${
                                                                    isChecked
                                                                        ? "bg-muted/30 border-transparent opacity-60"
                                                                        : "bg-background hover:border-primary/50"
                                                                }`}
                                                            >
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    onCheckedChange={() =>
                                                                        toggleCheck(note.id, item.id, isChecked)
                                                                    }
                                                                />
                                                                <div
                                                                    className={`flex-1 min-w-0 ${
                                                                        isChecked
                                                                            ? "line-through text-muted-foreground"
                                                                            : ""
                                                                    }`}
                                                                >
                                                                    <span className="font-medium">
                                                                        {item.inventoryName}
                                                                    </span>
                                                                    {item.inventoryModel && (
                                                                        <span className="text-xs text-muted-foreground ml-1">
                                                                            ({item.inventoryModel})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className={`text-xs font-semibold whitespace-nowrap ${
                                                                        isChecked ? "text-muted-foreground" : ""
                                                                    }`}
                                                                >
                                                                    {item.quantity} {item.inventoryUnit}
                                                                </div>
                                                                {!isChecked && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-7 w-7 text-primary flex-shrink-0"
                                                                        title="Usa in DDT"
                                                                        disabled={isLoading}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleUseNoteItem(item);
                                                                        }}
                                                                    >
                                                                        {isLoading ? (
                                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                                        ) : (
                                                                            <PlusCircle className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>
                    {/* ---- DA ACQUISTO (solo uscita e vendita) ---- */}
                    {showPurchaseTab && <TabsContent
                        value="acquisti"
                        className="flex-1 overflow-hidden flex flex-col px-6 pb-6 mt-4"
                    >
                        <div className="flex gap-2 mb-3 shrink-0">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Cerca per numero bolla o fornitore..."
                                    className="pl-9"
                                    value={purchaseSearchTerm}
                                    onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <Input
                                type="date"
                                className="w-[150px]"
                                value={purchaseDateFilter}
                                onChange={(e) => setPurchaseDateFilter(e.target.value)}
                                title="Filtra per data"
                            />
                        </div>

                        {purchasesLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredPurchases.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Nessun acquisto trovato</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                {filteredPurchases.map((purchase) => {
                                    const isExpanded = expandedPurchaseIds.has(purchase.id);
                                    const detail = purchaseDetailsMap[purchase.id];
                                    const selectedCount =
                                        detail?.items.filter((i) =>
                                            selectedPurchaseItemIds.has(i.id)
                                        ).length || 0;

                                    return (
                                        <Collapsible
                                            key={purchase.id}
                                            open={isExpanded}
                                            onOpenChange={() =>
                                                togglePurchaseExpanded(
                                                    purchase.id,
                                                    purchase.deliveryNoteNumber
                                                )
                                            }
                                        >
                                            <CollapsibleTrigger asChild>
                                                <div className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                                                    <div className="flex-shrink-0 p-1.5 rounded bg-blue-500/10 text-blue-600">
                                                        <ShoppingCart className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold">
                                                                {purchase.deliveryNoteNumber}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(
                                                                    new Date(purchase.deliveryNoteDate),
                                                                    "d MMM yyyy",
                                                                    { locale: it }
                                                                )}
                                                            </span>
                                                            {selectedCount > 0 && (
                                                                <Badge
                                                                    variant="secondary"
                                                                    className="text-[10px] px-1.5 py-0"
                                                                >
                                                                    {selectedCount}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="font-medium text-sm truncate">
                                                            {purchase.supplierName || "—"}
                                                        </div>
                                                    </div>
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    )}
                                                </div>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                                <div className="ml-4 pl-4 border-l-2 border-muted mt-1 space-y-1">
                                                    {!detail || detail.loading ? (
                                                        <div className="flex justify-center py-4">
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                        </div>
                                                    ) : detail.items.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground py-2 px-2">
                                                            Nessuna voce trovata
                                                        </p>
                                                    ) : (
                                                        detail.items.map((item) => {
                                                            const isSelected =
                                                                selectedPurchaseItemIds.has(item.id);
                                                            const isExhausted =
                                                                item.remainingQty <= 0 &&
                                                                (item.remainingPieces == null ||
                                                                    item.remainingPieces <= 0);

                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    className={`flex items-center gap-2 p-2 rounded border text-sm transition-colors ${
                                                                        isExhausted
                                                                            ? "opacity-40 cursor-not-allowed bg-muted/20"
                                                                            : isSelected
                                                                            ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 cursor-pointer"
                                                                            : "bg-background hover:border-primary/50 cursor-pointer"
                                                                    }`}
                                                                    onClick={() =>
                                                                        !isExhausted &&
                                                                        togglePurchaseItem(item.id)
                                                                    }
                                                                >
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        disabled={isExhausted}
                                                                        onCheckedChange={() =>
                                                                            !isExhausted &&
                                                                            togglePurchaseItem(item.id)
                                                                        }
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="font-medium">
                                                                            {item.itemName}
                                                                        </span>
                                                                        {item.itemCode && (
                                                                            <span className="font-mono text-[10px] text-muted-foreground ml-1">
                                                                                ({item.itemCode})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs font-semibold whitespace-nowrap">
                                                                        {item.remainingPieces != null &&
                                                                        item.remainingPieces > 0
                                                                            ? `${item.remainingPieces} pz / `
                                                                            : ""}
                                                                        {item.remainingQty}{" "}
                                                                        {item.itemUnit || ""}
                                                                        {isExhausted && (
                                                                            <span className="text-muted-foreground ml-1 font-normal">
                                                                                (esaurito)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}
                            </div>
                        )}

                        {selectedPurchaseItemIds.size > 0 && (
                            <div className="shrink-0 pt-3 border-t mt-3">
                                <Button className="w-full" onClick={handleImportSelected}>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Importa selezionati ({selectedPurchaseItemIds.size})
                                </Button>
                            </div>
                        )}
                    </TabsContent>}
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
