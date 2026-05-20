import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { inventoryApi } from "@/lib/services/inventory";
import { jobsApi } from "@/lib/services/jobs";
import { warehousesApi } from "@/lib/services/warehouses";
import { InventoryItem, Job, Warehouse, DeliveryNote } from "@/lib/types";
import { createMovement, updateMovement } from "@/app/movements/actions";
import { notify } from "@/lib/notify";

export interface PurchaseItemToImport {
    purchaseItemId: string;
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

export interface MovementLine {
    id?: string;
    tempId: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    itemUnit: string;
    itemBrand?: string;
    itemCategory?: string;
    itemDescription?: string;
    coefficient: number;
    quantity: string;
    pieces: string;
    kgEccedenza: string;
    purchaseItemId?: string;
    purchaseRef?: string;
    isFictitious: boolean;
    availableBatches: any[];
    batchesLoading: boolean;
}

const emptyLine = (): MovementLine => ({
    tempId: Math.random().toString(36).substr(2, 9),
    itemId: "",
    itemName: "",
    itemCode: "",
    itemUnit: "PZ",
    coefficient: 1,
    quantity: "",
    pieces: "",
    kgEccedenza: "",
    isFictitious: false,
    availableBatches: [],
    batchesLoading: false,
});

const ensureTrailingEmpty = (lines: MovementLine[]): MovementLine[] => {
    const last = lines[lines.length - 1];
    if (!last || last.itemId || last.quantity || last.pieces) {
        return [...lines, emptyLine()];
    }
    return lines;
};

interface UseMovementFormProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
    initialNote?: DeliveryNote;
}

export function useMovementForm({ initialInventory, initialJobs, initialNote }: UseMovementFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const isEditing = !!initialNote;
    const editingId = initialNote?.id;

    const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
    const [jobs, setJobs] = useState<Job[]>(initialJobs);
    const [primaryWarehouse, setPrimaryWarehouse] = useState<Warehouse | null>(null);

    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"entry" | "exit" | "sale" | "waste">(
        initialNote?.type || "exit"
    );
    const [numberPart, setNumberPart] = useState(initialNote?.number.split("/")[0] || "");
    const [date, setDate] = useState(
        initialNote?.date.split("T")[0] || new Date().toISOString().split("T")[0]
    );
    const [selectedJob, setSelectedJob] = useState<Job | null>(
        initialNote?.jobId ? initialJobs.find((j) => j.id === initialNote.jobId) || null : null
    );
    const [causal, setCausal] = useState(initialNote?.causal || "");
    const [pickupLocation, setPickupLocation] = useState(initialNote?.pickupLocation || "");
    const [deliveryLocation, setDeliveryLocation] = useState(initialNote?.deliveryLocation || "");

    const [transportMean, setTransportMean] = useState(initialNote?.transportMean || "Mittente");
    const [transportTime, setTransportTime] = useState(initialNote?.transportTime || "");
    const [appearance, setAppearance] = useState(initialNote?.appearance || "A VISTA");
    const [packagesCount, setPackagesCount] = useState<string>(
        initialNote?.packagesCount?.toString() || "1"
    );
    const [notes, setNotes] = useState(initialNote?.notes || "");

    const [lines, setLines] = useState<MovementLine[]>(() => {
        if (initialNote?.items && initialNote.items.length > 0) {
            return ensureTrailingEmpty(
                initialNote.items.map((item) => ({
                    id: item.id,
                    tempId: item.id || Math.random().toString(36).substr(2, 9),
                    itemId: item.inventoryId,
                    itemName: item.inventoryName || "",
                    itemCode: item.inventoryCode || "",
                    itemUnit: item.inventoryUnit || "PZ",
                    itemBrand: item.inventoryBrand,
                    itemCategory: item.inventoryCategory,
                    itemDescription: item.inventoryDescription,
                    coefficient: item.coefficient || 1,
                    quantity: item.quantity.toString(),
                    pieces: item.pieces?.toString() || "",
                    kgEccedenza: item.kgEccedenza?.toString() || "",
                    purchaseItemId: item.purchaseItemId,
                    purchaseRef: item.purchaseNumber || undefined,
                    isFictitious: item.isFictitious || false,
                    availableBatches: [],
                    batchesLoading: false,
                }))
            );
        }
        return [emptyLine()];
    });

    const [jobInventory, setJobInventory] = useState<any[]>([]);
    const [jobBatchAvailability, setJobBatchAvailability] = useState<any[]>([]);

    const yearSuffix = date
        ? new Date(date).getFullYear().toString().slice(-2)
        : new Date().getFullYear().toString().slice(-2);
    const fullNumber = numberPart ? `${numberPart}/PP${yearSuffix}` : `/PP${yearSuffix}`;

    useEffect(() => {
        warehousesApi.getPrimary().then(setPrimaryWarehouse).catch(console.error);
    }, []);

    useEffect(() => {
        let jobAddress = "";
        if (selectedJob) {
            if (selectedJob.clientName) {
                jobAddress += `CLIENTE: ${selectedJob.clientName}`;
                if (selectedJob.clientAddress) jobAddress += ` - ${selectedJob.clientAddress}`;
                jobAddress += `\n`;
            }
            const siteAddr = selectedJob.siteAddress || "";
            const clientAddr = selectedJob.clientAddress || "";
            const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
            const destinationText =
                siteAddr && clientAddr && normalize(siteAddr) === normalize(clientAddr)
                    ? "Stessa"
                    : selectedJob.siteAddress || `${selectedJob.code} - ${selectedJob.description}`;
            jobAddress += `DESTINAZIONE: ${destinationText}`;
        }

        const warehouseAddress = primaryWarehouse?.address
            ? `${primaryWarehouse.name}\n${primaryWarehouse.address}`
            : "OPI FIRESAFE S.R.L. MAGAZZINO\nVia A. Malignani, 9 - 33010 - REANA DEL ROJALE (UD)";

        if (activeTab === "entry") {
            setCausal("Rientro da cantiere");
            setPickupLocation(jobAddress || "DESTINAZIONE");
            setDeliveryLocation(warehouseAddress);
            setTransportTime("17:00");
        } else if (activeTab === "exit") {
            setCausal("Uscita merce per cantiere");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation(jobAddress || "DESTINAZIONE");
            setTransportTime("08:00");
        } else if (activeTab === "sale") {
            setCausal("Vendita");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation("Cliente");
            setTransportTime("08:00");
        } else if (activeTab === "waste") {
            setCausal("Trasporto eccedenze cantiere");
            setPickupLocation(jobAddress || "CANTIERE");
            setDeliveryLocation(
                "OPI FIRESAFE S.R.L. DEPOSITO TEMPORANEO\nVia Monfalcone, 33 - 33052 - Cervignano del Friuli (UD)"
            );
            setTransportTime("08:00");
        }

        if (selectedJob) {
            const parts: string[] = [];
            if (selectedJob.cig) parts.push(`CIG: ${selectedJob.cig}`);
            if (selectedJob.cup) parts.push(`CUP: ${selectedJob.cup}`);
            setNotes(parts.length > 0 ? parts.join(" ") : "");
        } else {
            setNotes("");
        }
    }, [activeTab, selectedJob, primaryWarehouse]);

    useEffect(() => {
        if (activeTab === "entry" && selectedJob) {
            Promise.allSettled([
                inventoryApi.getJobBatchAvailability(selectedJob.id),
                inventoryApi.getJobInventory(selectedJob.id),
            ]).then(([batchResult, inventoryResult]) => {
                if (batchResult.status === "fulfilled") {
                    const batches = batchResult.value || [];
                    setJobBatchAvailability(batches);
                    if (isEditing && batches.length > 0) {
                        setLines((prev) =>
                            prev.map((line) => {
                                if (!line.itemId || line.availableBatches.length > 0) return line;
                                const itemBatches = batches
                                    .filter((b: any) => b.itemId === line.itemId)
                                    .map((b: any) => {
                                        const totalQty = (initialNote?.items ?? [])
                                            .filter((item) => item.purchaseItemId === b.purchaseItemId)
                                            .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
                                        const totalPieces = (initialNote?.items ?? [])
                                            .filter((item) => item.purchaseItemId === b.purchaseItemId)
                                            .reduce((sum, item) => sum + (item.pieces ?? 0), 0);
                                        return {
                                            id: b.purchaseItemId,
                                            purchaseRef: b.purchaseRef,
                                            remainingQty: (b.quantity ?? 0) + totalQty,
                                            remainingPieces: b.pieces != null ? b.pieces + totalPieces : b.pieces,
                                            date: b.date,
                                        };
                                    });
                                return itemBatches.length > 0 ? { ...line, availableBatches: itemBatches } : line;
                            })
                        );
                    }
                }
                if (inventoryResult.status === "fulfilled") setJobInventory(inventoryResult.value || []);
            });
        } else {
            setJobInventory([]);
            setJobBatchAvailability([]);
        }
    }, [activeTab, selectedJob, isEditing]);

    // When editing exit/sale: load available batches for each existing line
    const exitSaleBatchesLoaded = useRef(false);
    useEffect(() => {
        if (!isEditing || exitSaleBatchesLoaded.current) return;
        if (activeTab !== "exit" && activeTab !== "sale") return;
        exitSaleBatchesLoaded.current = true;

        const itemLines = lines.filter((l) => l.itemId && l.availableBatches.length === 0);
        if (itemLines.length === 0) return;

        setLines((prev) =>
            prev.map((l) =>
                l.itemId && l.availableBatches.length === 0 ? { ...l, batchesLoading: true } : l
            )
        );

        itemLines.forEach(async (line) => {
            try {
                const batches: any[] = await inventoryApi.getAvailableBatches(line.itemId);
                // Add back quantities that this bolla originally consumed from each lot
                const adjustedBatches = batches.map((b) => {
                    const totalQty = (initialNote?.items ?? [])
                        .filter((item) => item.purchaseItemId === b.id)
                        .reduce((sum, item) => sum + (item.quantity ?? 0), 0);
                    const totalPieces = (initialNote?.items ?? [])
                        .filter((item) => item.purchaseItemId === b.id)
                        .reduce((sum, item) => sum + (item.pieces ?? 0), 0);
                    if (totalQty === 0 && totalPieces === 0) return b;
                    return {
                        ...b,
                        remainingQty: (b.remainingQty ?? 0) + totalQty,
                        remainingPieces: b.remainingPieces != null ? b.remainingPieces + totalPieces : b.remainingPieces,
                    };
                });
                const validBatches = adjustedBatches.filter((b) => {
                    if (b.remainingPieces !== undefined && b.remainingPieces !== null)
                        return b.remainingPieces > 0.001;
                    return b.remainingQty > 0.001;
                });
                // Ensure the currently-selected batch is always present even if exhausted
                if (line.purchaseItemId && !validBatches.find((b) => b.id === line.purchaseItemId)) {
                    const found = adjustedBatches.find((b) => b.id === line.purchaseItemId);
                    if (found) {
                        validBatches.unshift(found);
                    } else {
                        // Batch not returned by API (fully exhausted server-side):
                        // reconstruct from initialNote items, then fallback to direct DB query
                        const originalItems = (initialNote?.items ?? []).filter(
                            (item) => item.purchaseItemId === line.purchaseItemId
                        );
                        const totalQty = originalItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
                        const totalPieces = originalItems.reduce((s, i) => s + (i.pieces ?? 0), 0);
                        let purchaseRef = originalItems[0]?.purchaseNumber ?? null;
                        if (!purchaseRef && line.purchaseItemId) {
                            const info = await inventoryApi.getPurchaseItemRef(line.purchaseItemId);
                            purchaseRef = info?.purchaseRef ?? null;
                        }
                        validBatches.unshift({
                            id: line.purchaseItemId,
                            purchaseRef,
                            remainingQty: totalQty,
                            remainingPieces: totalPieces > 0 ? totalPieces : null,
                        });
                    }
                }
                setLines((prev) =>
                    prev.map((l) =>
                        l.tempId === line.tempId
                            ? { ...l, batchesLoading: false, availableBatches: validBatches }
                            : l
                    )
                );
            } catch {
                setLines((prev) =>
                    prev.map((l) =>
                        l.tempId === line.tempId ? { ...l, batchesLoading: false } : l
                    )
                );
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing, activeTab]);

    useEffect(() => {
        const completedCount = lines.filter((l) => l.itemId && l.quantity).length;
        setPackagesCount((completedCount > 0 ? completedCount : 1).toString());
    }, [lines]);

    const handleJobSearch = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 50, search: term, status: "active" });
            setJobs(data);
        } catch (error) {
            console.error("Failed to search jobs", error);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    const handleItemSearch = useCallback(async (term: string) => {
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term });
            setInventory(items);
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const handleJobSelect = (job: Job) => {
        setSelectedJob(job);
        setIsJobSelectorOpen(false);
    };

    const handleInlineItemSelect = useCallback(
        async (
            rowId: string,
            item: InventoryItem,
            prefill?: { pieces?: string; quantity?: string }
        ) => {
            const tab = activeTab;
            setLines((prev) => {
                const updated = prev.map((line) => {
                    if (line.tempId !== rowId) return line;
                    return {
                        ...line,
                        itemId: item.id,
                        itemName: item.name,
                        itemCode: item.code,
                        itemUnit: item.unit,
                        itemBrand: item.brand,
                        itemCategory: item.type,
                        itemDescription: item.description,
                        coefficient: item.coefficient || 1,
                        quantity: tab === "waste" ? "1" : (prefill?.quantity || ""),
                        pieces: prefill?.pieces || "",
                        purchaseItemId: undefined,
                        purchaseRef: undefined,
                        isFictitious: tab === "waste",
                        availableBatches: [],
                        batchesLoading: tab === "exit" || tab === "sale",
                    };
                });
                return ensureTrailingEmpty(updated);
            });

            if (tab === "exit" || tab === "sale") {
                try {
                    const batches = await inventoryApi.getAvailableBatches(item.id);
                    const validBatches = batches.filter((b: any) => {
                        if (b.remainingPieces !== undefined && b.remainingPieces !== null)
                            return b.remainingPieces > 0.001;
                        return b.remainingQty > 0.001;
                    });
                    // All lots exhausted: show them anyway and auto-flag as fittizio
                    const allExhausted = validBatches.length === 0 && batches.length > 0;
                    const batchesToShow = allExhausted ? batches : validBatches;
                    setLines((prev) =>
                        prev.map((line) => {
                            if (line.tempId !== rowId) return line;
                            return {
                                ...line,
                                batchesLoading: false,
                                availableBatches: batchesToShow,
                                purchaseItemId: batchesToShow.length > 0 ? batchesToShow[0].id : undefined,
                                purchaseRef: batchesToShow.length > 0 ? batchesToShow[0].purchaseRef : undefined,
                                isFictitious: allExhausted ? true : line.isFictitious,
                            };
                        })
                    );
                } catch (err) {
                    console.error("Failed to load batches", err);
                    setLines((prev) =>
                        prev.map((line) => {
                            if (line.tempId !== rowId) return line;
                            return { ...line, batchesLoading: false, availableBatches: [] };
                        })
                    );
                }
            }
        },
        [activeTab]
    );

    const handleInlineReturnBatchSelect = useCallback(
        (rowId: string, batch: any, prefill?: { pieces?: string; quantity?: string }) => {
            const allItemBatches = jobBatchAvailability
                .filter((b) => b.itemId === batch.itemId)
                .map((b) => ({
                    id: b.purchaseItemId,
                    purchaseRef: b.purchaseRef,
                    remainingQty: b.quantity,
                    remainingPieces: b.pieces,
                    date: b.date,
                }));

            const batchesForLine =
                allItemBatches.length > 0
                    ? allItemBatches
                    : [
                          {
                              id: batch.purchaseItemId,
                              purchaseRef: batch.purchaseRef,
                              remainingQty: batch.quantity,
                              remainingPieces: batch.pieces,
                              date: undefined,
                          },
                      ];

            setLines((prev) => {
                const updated = prev.map((line) => {
                    if (line.tempId !== rowId) return line;
                    return {
                        ...line,
                        itemId: batch.itemId,
                        itemName: batch.itemName,
                        itemCode: batch.itemCode,
                        itemUnit: batch.itemUnit,
                        itemBrand: batch.itemBrand,
                        coefficient: batch.coefficient || 1,
                        quantity: prefill?.quantity || "",
                        pieces: prefill?.pieces || "",
                        purchaseItemId: batch.purchaseItemId,
                        purchaseRef: batch.purchaseRef,
                        isFictitious: false,
                        availableBatches: batchesForLine,
                        batchesLoading: false,
                    };
                });
                return ensureTrailingEmpty(updated);
            });
        },
        [jobBatchAvailability]
    );

    const handleInlineLineChange = useCallback((rowId: string, field: string, value: any) => {
        // Capture item info for async batch reload (needed for isFictitious toggle)
        let itemIdForBatchReload: string | undefined;

        setLines((prev) => {
            const updated = prev.map((line) => {
                if (line.tempId !== rowId) return line;

                const updates: Partial<MovementLine> = { [field]: value };

                if (field === "pieces") {
                    const pieces = parseFloat(value);
                    const coef = line.coefficient || 1;
                    if (!isNaN(pieces) && coef > 0) {
                        updates.quantity = (pieces * coef).toFixed(2);
                    } else if (value === "") {
                        updates.quantity = "";
                    }
                } else if (field === "quantity") {
                    const quantity = parseFloat(value);
                    const coef = line.coefficient || 1;
                    if (!isNaN(quantity) && coef > 0) {
                        updates.pieces = coef !== 1 ? (quantity / coef).toFixed(2) : value;
                    } else if (value === "") {
                        updates.pieces = "";
                    }
                } else if (field === "purchaseItemId") {
                    const batch = line.availableBatches.find((b: any) => b.id === value);
                    updates.purchaseRef = batch?.purchaseRef;
                } else if (
                    field === "isFictitious" &&
                    (activeTab === "exit" || activeTab === "sale") &&
                    line.itemId
                ) {
                    // Mark as loading — batch list will be refreshed after state update
                    itemIdForBatchReload = line.itemId;
                    updates.batchesLoading = true;
                }

                return { ...line, ...updates };
            });
            return ensureTrailingEmpty(updated);
        });

        // Async batch reload when the fittizio flag is toggled on exit/sale lines
        if (itemIdForBatchReload) {
            const itemId = itemIdForBatchReload;

            if (value === true) {
                // Show ALL lots (including exhausted) so the user can pick one for price attribution.
                // Sorted: available first, then most recent first.
                inventoryApi
                    .getAllBatchesForItem(itemId)
                    .then((allBatches) => {
                        setLines((prev) =>
                            prev.map((l) => {
                                if (l.tempId !== rowId) return l;
                                // Keep the existing selection if it's still in the list
                                const keepExisting = allBatches.find((b) => b.id === l.purchaseItemId);
                                const preferred = keepExisting ?? allBatches[0];
                                return {
                                    ...l,
                                    batchesLoading: false,
                                    availableBatches: allBatches,
                                    purchaseItemId: preferred?.id,
                                    purchaseRef: preferred?.purchaseRef,
                                };
                            })
                        );
                    })
                    .catch(() => {
                        setLines((prev) =>
                            prev.map((l) =>
                                l.tempId === rowId ? { ...l, batchesLoading: false } : l
                            )
                        );
                    });
            } else {
                // Restore to available-only lots (FIFO order)
                inventoryApi
                    .getAvailableBatches(itemId)
                    .then((batches) => {
                        const validBatches = batches.filter((b: any) => {
                            if (b.remainingPieces !== undefined && b.remainingPieces !== null)
                                return b.remainingPieces > 0.001;
                            return b.remainingQty > 0.001;
                        });
                        setLines((prev) =>
                            prev.map((l) => {
                                if (l.tempId !== rowId) return l;
                                const preferred = validBatches[0];
                                return {
                                    ...l,
                                    batchesLoading: false,
                                    availableBatches: validBatches,
                                    purchaseItemId: preferred?.id,
                                    purchaseRef: preferred?.purchaseRef,
                                };
                            })
                        );
                    })
                    .catch(() => {
                        setLines((prev) =>
                            prev.map((l) =>
                                l.tempId === rowId ? { ...l, batchesLoading: false } : l
                            )
                        );
                    });
            }
        }
    }, [activeTab]);

    const handleInlineLineRemove = useCallback((rowId: string) => {
        setLines((prev) => {
            if (prev.length === 1) return [emptyLine()];
            const updated = prev.filter((l) => l.tempId !== rowId);
            return ensureTrailingEmpty(updated);
        });
    }, []);

    const handleInlineLineDuplicate = useCallback((rowId: string) => {
        setLines((prev) => {
            const rowIndex = prev.findIndex((l) => l.tempId === rowId);
            if (rowIndex === -1) return prev;
            const row = prev[rowIndex];
            if (!row.itemId) return prev;

            const newRow: MovementLine = {
                ...row,
                id: undefined,
                tempId: Math.random().toString(36).substr(2, 9),
                quantity: "",
                pieces: "",
                purchaseItemId: undefined,
                purchaseRef: undefined,
            };

            const newLines = [...prev];
            newLines.splice(rowIndex + 1, 0, newRow);
            const last = newLines[newLines.length - 1];
            if (last.itemId || last.quantity || last.pieces) {
                newLines.push(emptyLine());
            }
            return newLines;
        });
    }, []);

    const handlePurchaseItemsImport = useCallback(
        (items: PurchaseItemToImport[]) => {
            const tab = activeTab;
            setLines((prev) => {
                const filledLines = prev.filter((l) => l.itemId || l.quantity || l.pieces);
                const newLines: MovementLine[] = items.map((item) => ({
                    tempId: Math.random().toString(36).substr(2, 9),
                    itemId: item.itemId,
                    itemName: item.itemName || "",
                    itemCode: item.itemCode || "",
                    itemUnit: item.itemUnit || "PZ",
                    coefficient: item.coefficient || 1,
                    quantity: tab === "waste" ? "1" : item.remainingQty.toString(),
                    pieces: tab !== "waste" ? (item.remainingPieces?.toString() || "") : "",
                    kgEccedenza: "",
                    purchaseItemId: item.purchaseItemId,
                    purchaseRef: item.purchaseRef,
                    isFictitious: tab === "waste",
                    availableBatches: [
                        {
                            id: item.purchaseItemId,
                            purchaseRef: item.purchaseRef,
                            remainingQty: item.remainingQty,
                            remainingPieces: item.remainingPieces,
                            date: item.batchDate,
                        },
                    ],
                    batchesLoading: false,
                }));
                return ensureTrailingEmpty([...filledLines, ...newLines]);
            });
        },
        [activeTab]
    );

    const handleSubmit = async () => {
        if (!numberPart) {
            notify.warning("Inserisci il numero del documento");
            return;
        }

        const validLines = lines.filter((l) => {
            if (!l.itemId) return false;
            if (activeTab === "waste") return !!l.kgEccedenza && parseFloat(l.kgEccedenza) > 0;
            return !!l.quantity && parseFloat(l.quantity) > 0;
        });
        if (validLines.length === 0) {
            notify.warning(
                activeTab === "waste"
                    ? "Inserisci il peso (kg) per almeno un articolo"
                    : "Inserisci almeno una riga"
            );
            return;
        }

        for (const line of validLines) {
            if ((activeTab === "exit" || activeTab === "sale") && !line.isFictitious) {
                // Validazione: il lotto deve essere selezionato per movimenti di uscita/vendita non fittizi
                if (!line.purchaseItemId) {
                    notify.warning(
                        `Seleziona un lotto di riferimento per "${line.itemName || 'articolo'}"`
                    );
                    return;
                }
                const batch = line.availableBatches.find((b: any) => b.id === line.purchaseItemId);
                if (line.purchaseItemId && batch) {
                    const pieces = parseFloat(line.pieces);
                    const qty = parseFloat(line.quantity);
                    if (!isNaN(pieces) && batch.remainingPieces !== undefined && pieces > batch.remainingPieces) {
                        notify.warning(
                            `Quantità eccessiva per "${line.itemName}". Disponibile: ${batch.remainingPieces} pezzi`
                        );
                        return;
                    } else if (!isNaN(qty) && qty > batch.remainingQty) {
                        notify.warning(
                            `Quantità eccessiva per "${line.itemName}". Disponibile: ${batch.remainingQty}`
                        );
                        return;
                    }
                }
            }
            if (activeTab === "entry" && selectedJob && line.purchaseItemId && !line.isFictitious) {
                const batch = line.availableBatches.find((b: any) => b.id === line.purchaseItemId);
                if (batch) {
                    const qty = parseFloat(line.quantity);
                    if (!isNaN(qty) && qty > batch.remainingQty) {
                        notify.warning(
                            `Quantità eccessiva per il reso di "${line.itemName}". In carico: ${batch.remainingQty}`
                        );
                        return;
                    }
                }
            }
        }

        let finalNotes = notes;
        if (activeTab === "waste") {
            const siteAddr =
                selectedJob?.siteAddress ||
                selectedJob?.clientAddress ||
                pickupLocation ||
                "cantiere";
            const wasteNote = `Materiali eccedenti provenienti dal cantiere di ${siteAddr} e diretti alla sede di via Monfalcone n.33 – 33052 Cervignano del Friuli (UD) per deposito temporaneo.`;
            finalNotes = finalNotes ? `${finalNotes}\n${wasteNote}` : wasteNote;
        }

        const noteData = {
            type: activeTab,
            number: fullNumber,
            date,
            jobId: selectedJob?.id,
            causal,
            pickupLocation,
            deliveryLocation,
            transportMean,
            transportTime,
            appearance,
            packagesCount: parseInt(packagesCount) || 1,
            notes: finalNotes,
        };

        const itemsData = validLines.map((l) => ({
            id: l.id,
            inventoryId: l.itemId,
            quantity: parseFloat(l.quantity),
            pieces: l.pieces ? parseFloat(l.pieces) : undefined,
            kgEccedenza: l.kgEccedenza ? parseFloat(l.kgEccedenza) : undefined,
            coefficient: l.coefficient,
            purchaseItemId: l.purchaseItemId,
            isFictitious: l.isFictitious,
            price: 0,
        }));

        try {
            setLoading(true);
            if (isEditing && editingId) {
                const result = await updateMovement(editingId, noteData, itemsData);
                if (result && !result.success) throw new Error(result.error);
            } else {
                const result = await createMovement(noteData, itemsData);
                if (!result.success) throw new Error(result.error);
            }
            router.push("/movements");
            router.refresh();
        } catch (error: any) {
            console.error(isEditing ? "Update failed" : "Create failed", error);
            alert(`Errore durante il salvataggio: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        isEditing,
        inventory,
        jobs,
        isJobSelectorOpen,
        setIsJobSelectorOpen,
        jobsLoading,
        itemsLoading,
        activeTab,
        setActiveTab,
        numberPart,
        setNumberPart,
        date,
        setDate,
        selectedJob,
        setSelectedJob,
        causal,
        setCausal,
        pickupLocation,
        setPickupLocation,
        deliveryLocation,
        setDeliveryLocation,
        transportMean,
        setTransportMean,
        transportTime,
        setTransportTime,
        appearance,
        setAppearance,
        packagesCount,
        setPackagesCount,
        notes,
        setNotes,
        lines,
        jobBatchAvailability,
        jobInventory,
        yearSuffix,
        fullNumber,
        handleJobSearch,
        handleItemSearch,
        handleJobSelect,
        handleInlineItemSelect,
        handleInlineReturnBatchSelect,
        handleInlineLineChange,
        handleInlineLineRemove,
        handleInlineLineDuplicate,
        handlePurchaseItemsImport,
        handleSubmit,
    };
}
