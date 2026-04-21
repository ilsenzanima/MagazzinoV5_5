import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { inventoryApi } from "@/lib/services/inventory";
import { jobsApi } from "@/lib/services/jobs";
import { warehousesApi } from "@/lib/services/warehouses";
import { InventoryItem, Job, Warehouse, DeliveryNote } from "@/lib/types";
import { createMovement, updateMovement } from "@/app/movements/actions";
import { notify } from "@/lib/notify";

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
        initialNote?.type || "entry"
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
                    purchaseItemId: item.purchaseItemId,
                    purchaseRef: item.purchaseNumber || (item.purchaseItemId ? "Lotto" : undefined),
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
            setCausal("Trasporto rifiuti cantiere");
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
                if (batchResult.status === "fulfilled") setJobBatchAvailability(batchResult.value || []);
                if (inventoryResult.status === "fulfilled") setJobInventory(inventoryResult.value || []);
            });
        } else {
            setJobInventory([]);
            setJobBatchAvailability([]);
        }
    }, [activeTab, selectedJob]);

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
                        quantity: prefill?.quantity || "",
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
                    setLines((prev) =>
                        prev.map((line) => {
                            if (line.tempId !== rowId) return line;
                            return {
                                ...line,
                                batchesLoading: false,
                                availableBatches: validBatches,
                                purchaseItemId: validBatches.length > 0 ? validBatches[0].id : undefined,
                                purchaseRef: validBatches.length > 0 ? validBatches[0].purchaseRef : undefined,
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
                        availableBatches: [
                            {
                                id: batch.purchaseItemId,
                                purchaseRef: batch.purchaseRef,
                                remainingQty: batch.quantity,
                                remainingPieces: batch.pieces,
                                date: new Date().toISOString(),
                            },
                        ],
                        batchesLoading: false,
                    };
                });
                return ensureTrailingEmpty(updated);
            });
        },
        []
    );

    const handleInlineLineChange = useCallback((rowId: string, field: string, value: any) => {
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
                }

                return { ...line, ...updates };
            });
            return ensureTrailingEmpty(updated);
        });
    }, []);

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

    const handleSubmit = async () => {
        if (!numberPart) {
            notify.warning("Inserisci il numero del documento");
            return;
        }

        const validLines = lines.filter((l) => l.itemId && l.quantity && parseFloat(l.quantity) > 0);
        if (validLines.length === 0) {
            notify.warning("Inserisci almeno una riga");
            return;
        }

        for (const line of validLines) {
            if ((activeTab === "exit" || activeTab === "sale") && !line.isFictitious) {
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
                const batch = jobBatchAvailability.find((b) => b.purchaseItemId === line.purchaseItemId);
                if (batch) {
                    const qty = parseFloat(line.quantity);
                    if (!isNaN(qty) && qty > batch.quantity) {
                        notify.warning(
                            `Quantità eccessiva per il reso di "${line.itemName}". In carico: ${batch.quantity}`
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
            const wasteNote = `Trasporto di materiale prodotto nel cantiere di ${siteAddr} verso la sede di Cervignano del Friuli (UD) in via Monfalcone n.33 per deposito temporaneo.`;
            finalNotes = finalNotes ? `${finalNotes}\n${wasteNote}` : wasteNote;
        }

        const noteData = {
            type: activeTab === "waste" ? "exit" : activeTab,
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
            coefficient: l.coefficient,
            purchaseItemId: l.purchaseItemId,
            isFictitious: activeTab === "waste" ? true : l.isFictitious,
            price: 0,
        }));

        try {
            setLoading(true);
            if (isEditing && editingId) {
                const result = await updateMovement(editingId, noteData, itemsData);
                if (result && !result.success) throw new Error(result.error);
                router.push("/movements");
                router.refresh();
            } else {
                await createMovement(noteData, itemsData);
            }
        } catch (error: any) {
            if (
                error?.message?.includes("NEXT_REDIRECT") ||
                error?.digest?.includes("NEXT_REDIRECT")
            ) {
                throw error;
            }
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
        handleSubmit,
    };
}
