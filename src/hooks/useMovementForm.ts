import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { inventoryApi } from "@/lib/services/inventory";
import { jobsApi } from "@/lib/services/jobs";
import { InventoryItem, Job } from "@/lib/types";
import { createMovement } from "@/app/movements/actions";

export interface MovementLine {
    tempId: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    itemUnit: string;
    itemBrand?: string;
    itemCategory?: string;
    itemDescription?: string;
    quantity: number;
    pieces?: number;
    coefficient?: number;
    purchaseItemId?: string;
    purchaseRef?: string;
    isFictitious?: boolean;
}

interface UseMovementFormProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
}

export function useMovementForm({ initialInventory, initialJobs }: UseMovementFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Data Sources
    const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
    const [jobs, setJobs] = useState<Job[]>(initialJobs);

    // Dialog States
    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);

    // Loading States for Search
    const [jobsLoading, setJobsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);

    // Form State
    const [activeTab, setActiveTab] = useState<'entry' | 'exit' | 'sale'>('entry');
    const [numberPart, setNumberPart] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [causal, setCausal] = useState("");
    const [pickupLocation, setPickupLocation] = useState("");
    const [deliveryLocation, setDeliveryLocation] = useState("");

    // Footer fields
    const [transportMean, setTransportMean] = useState("Mittente");
    const [transportTime, setTransportTime] = useState("");
    const [appearance, setAppearance] = useState("A VISTA");
    const [packagesCount, setPackagesCount] = useState<string>("1");
    const [notes, setNotes] = useState("");

    // Line State
    const [lines, setLines] = useState<MovementLine[]>([]);
    const [currentLine, setCurrentLine] = useState({
        itemId: "",
        quantity: "",
        pieces: "",
        coefficient: 1,
        unit: "PZ",
        purchaseItemId: "",
        isFictitious: false
    });
    const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);

    // Availability State
    const [availableBatches, setAvailableBatches] = useState<any[]>([]); // For Exit
    const [jobInventory, setJobInventory] = useState<any[]>([]); // For Entry (Legacy/Simple)
    const [jobBatchAvailability, setJobBatchAvailability] = useState<any[]>([]); // For Entry (Detailed)

    // Computed
    const yearSuffix = date ? new Date(date).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
    const fullNumber = numberPart ? `${numberPart}/PP${yearSuffix}` : `/PP${yearSuffix}`;

    // Effects
    useEffect(() => {
        // Auto-fill logic
        let jobAddress = "";
        if (selectedJob) {
            if (selectedJob.clientName) {
                jobAddress += `CLIENTE: ${selectedJob.clientName}`;
                if (selectedJob.clientAddress) jobAddress += ` - ${selectedJob.clientAddress}`;
                jobAddress += `\n`;
            }
            let destinationText = "";
            const siteAddr = selectedJob.siteAddress || "";
            const clientAddr = selectedJob.clientAddress || "";
            const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

            if (siteAddr && clientAddr && normalize(siteAddr) === normalize(clientAddr)) {
                destinationText = "Stessa";
            } else {
                destinationText = selectedJob.siteAddress || `${selectedJob.code} - ${selectedJob.description}`;
            }
            jobAddress += `DESTINAZIONE: ${destinationText}`;
        }

        const warehouseAddress = "OPI FIRESAFE S.R.L. MAGAZZINO\nVia A. Malignani, 9 - 33010 - REANA DEL ROJALE (UD)";

        if (activeTab === 'entry') {
            setCausal("Rientro da cantiere");
            setPickupLocation(jobAddress || "DESTINAZIONE");
            setDeliveryLocation(warehouseAddress);
        } else if (activeTab === 'exit') {
            setCausal("Uscita merce per cantiere");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation(jobAddress || "DESTINAZIONE");
        } else if (activeTab === 'sale') {
            setCausal("Vendita");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation("Cliente");
        }

        if (selectedJob) {
            const parts = [];
            if (selectedJob.cig) parts.push(`CIG: ${selectedJob.cig}`);
            if (selectedJob.cup) parts.push(`CUP: ${selectedJob.cup}`);
            if (parts.length > 0) setNotes(parts.join(' '));
            else setNotes("");
        } else {
            setNotes("");
        }
    }, [activeTab, selectedJob]);

    useEffect(() => {
        // Fetch Job Inventory for Return
        if (activeTab === 'entry' && selectedJob) {
            Promise.allSettled([
                inventoryApi.getJobBatchAvailability(selectedJob.id),
                inventoryApi.getJobInventory(selectedJob.id)
            ]).then(([batchResult, inventoryResult]) => {
                if (batchResult.status === 'fulfilled') setJobBatchAvailability(batchResult.value || []);
                if (inventoryResult.status === 'fulfilled') setJobInventory(inventoryResult.value || []);
            });
        } else {
            setJobInventory([]);
            setJobBatchAvailability([]);
        }
    }, [activeTab, selectedJob]);

    // Handlers
    const handleJobSearch = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 50, search: term, status: 'active' });
            setJobs(data);
        } catch (error) {
            console.error("Failed to search jobs", error);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    const handleItemSearch = useCallback(async (term: string) => {
        if (activeTab === 'entry' && selectedJob) return;
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term });
            setInventory(items);
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setItemsLoading(false);
        }
    }, [activeTab, selectedJob]);

    const handleJobSelect = (job: Job) => {
        setSelectedJob(job);
        setIsJobSelectorOpen(false);
    };

    const handleItemSelect = (item: InventoryItem) => {
        setSelectedItemForLine(item);
        setCurrentLine({
            itemId: item.id,
            quantity: "",
            pieces: "",
            coefficient: item.coefficient || 1,
            unit: item.unit,
            purchaseItemId: "",
            isFictitious: false
        });

        if (activeTab === 'exit') {
            inventoryApi.getAvailableBatches(item.id).then(batches => {
                const validBatches = batches.filter((b: any) => {
                    if (b.remainingPieces !== undefined && b.remainingPieces !== null) return b.remainingPieces > 0.001;
                    return b.remainingQty > 0.001;
                });
                setAvailableBatches(validBatches);
                if (validBatches.length > 0) {
                    setCurrentLine(prev => ({ ...prev, purchaseItemId: validBatches[0].id }));
                }
            }).catch(err => {
                console.error("Failed to load batches", err);
                setAvailableBatches([]);
            });
        }
        setIsItemSelectorOpen(false);
    };

    const handleSelectReturnBatch = (batch: any) => {
        const item: InventoryItem = {
            id: batch.itemId,
            code: batch.itemCode,
            name: batch.itemName,
            unit: batch.itemUnit,
            brand: batch.itemBrand,
            type: batch.itemCategory,
            quantity: 0,
            minStock: 0,
            status: 'in_stock',
            description: "",
            coefficient: batch.coefficient,
            supplierCode: "",
            price: 0,
            model: batch.itemModel
        };
        setSelectedItemForLine(item);
        setCurrentLine({
            itemId: item.id,
            quantity: "",
            pieces: "",
            coefficient: batch.coefficient || 1,
            unit: item.unit,
            purchaseItemId: batch.purchaseItemId,
            isFictitious: false
        });
        setAvailableBatches([{
            id: batch.purchaseItemId,
            purchaseRef: batch.purchaseRef,
            remainingQty: batch.quantity,
            remainingPieces: batch.pieces,
            date: new Date().toISOString()
        }]);
    };

    const handleAddLine = () => {
        if (!selectedItemForLine || !currentLine.quantity) return;
        const qty = parseFloat(currentLine.quantity);
        if (qty <= 0) return;

        // Validation logic
        if ((activeTab === 'exit' || activeTab === 'sale') && !currentLine.isFictitious) {
            const batch = availableBatches.find(b => b.id === currentLine.purchaseItemId);
            if (currentLine.purchaseItemId && batch) {
                if (currentLine.pieces && batch.remainingPieces !== undefined) {
                    if (Number(currentLine.pieces) > batch.remainingPieces) {
                        alert(`Quantità eccessiva. Disponibile nel lotto: ${batch.remainingPieces} pezzi`);
                        return;
                    }
                } else if (qty > batch.remainingQty) {
                    alert(`Quantità eccessiva per il lotto selezionato. Disponibile: ${batch.remainingQty}`);
                    return;
                }
            }
        }

        if (activeTab === 'entry' && selectedJob && currentLine.purchaseItemId && !currentLine.isFictitious) {
            const batch = jobBatchAvailability.find(b => b.purchaseItemId === currentLine.purchaseItemId);
            if (batch) {
                if (qty > batch.quantity) {
                    alert(`Quantità eccessiva per il reso. In carico: ${batch.quantity}`);
                    return;
                }
            }
        }

        const newLine: MovementLine = {
            tempId: Date.now().toString(),
            itemId: selectedItemForLine.id,
            itemCode: selectedItemForLine.code,
            itemName: selectedItemForLine.name,
            itemUnit: currentLine.unit,
            itemBrand: selectedItemForLine.brand,
            itemCategory: selectedItemForLine.type,
            itemDescription: selectedItemForLine.description,
            quantity: qty,
            pieces: currentLine.pieces ? parseFloat(currentLine.pieces) : undefined,
            coefficient: currentLine.coefficient,
            purchaseItemId: currentLine.purchaseItemId || undefined,
            isFictitious: currentLine.isFictitious || false,
            purchaseRef: availableBatches.find(b => b.id === currentLine.purchaseItemId)?.purchaseRef
        };

        setLines([...lines, newLine]);
        setSelectedItemForLine(null);
        setCurrentLine({
            itemId: "",
            quantity: "",
            pieces: "",
            coefficient: 1,
            unit: "PZ",
            purchaseItemId: "",
            isFictitious: false
        });
        setAvailableBatches([]);
    };

    const removeLine = (tempId: string) => {
        setLines(lines.filter(l => l.tempId !== tempId));
    };

    const handleSubmit = async () => {
        if (!numberPart) {
            alert("Inserisci il numero del documento");
            return;
        }
        if (lines.length === 0) {
            alert("Inserisci almeno una riga");
            return;
        }

        try {
            setLoading(true);
            await createMovement({
                type: activeTab,
                number: fullNumber,
                date: date,
                jobId: selectedJob?.id,
                causal: causal,
                pickupLocation: pickupLocation,
                deliveryLocation: deliveryLocation,
                transportMean: transportMean,
                transportTime: transportTime,
                appearance: appearance,
                packagesCount: parseInt(packagesCount) || 1,
                notes: notes
            }, lines.map(l => ({
                inventoryId: l.itemId,
                quantity: l.quantity,
                pieces: l.pieces,
                coefficient: l.coefficient,
                purchaseItemId: l.purchaseItemId,
                isFictitious: l.isFictitious,
                price: 0
            })));
        } catch (error: any) {
            if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.includes('NEXT_REDIRECT')) {
                throw error;
            }
            console.error("Create failed", error);
            alert(`Errore durante il salvataggio: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return {
        // State
        loading,
        inventory,
        jobs,
        isJobSelectorOpen, setIsJobSelectorOpen,
        isItemSelectorOpen, setIsItemSelectorOpen,
        jobsLoading,
        itemsLoading,
        activeTab, setActiveTab,
        numberPart, setNumberPart,
        date, setDate,
        selectedJob, setSelectedJob,
        causal, setCausal,
        pickupLocation, setPickupLocation,
        deliveryLocation, setDeliveryLocation,
        transportMean, setTransportMean,
        transportTime, setTransportTime,
        appearance, setAppearance,
        packagesCount, setPackagesCount,
        notes, setNotes,
        lines,
        currentLine, setCurrentLine,
        selectedItemForLine, setSelectedItemForLine,
        availableBatches,
        jobBatchAvailability,
        jobInventory,
        yearSuffix,
        fullNumber,

        // Handlers
        handleJobSearch,
        handleItemSearch,
        handleJobSelect,
        handleItemSelect,
        handleSelectReturnBatch,
        handleAddLine,
        removeLine,
        handleSubmit
    };
}
