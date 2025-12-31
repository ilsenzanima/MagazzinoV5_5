"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Truck, ArrowDownRight, ArrowUpRight, ShoppingBag, MapPin, Search, Package, Clock } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    inventoryApi,
    deliveryNotesApi,
    InventoryItem,
    Job,
    DeliveryNote
} from "@/lib/api";
import { updateMovement } from "@/app/movements/actions";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { useAuth } from "@/components/auth-provider";

interface MovementLine {
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

interface EditMovementContentProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
    initialNote: DeliveryNote;
}

export default function EditMovementContent({ initialInventory, initialJobs, initialNote }: EditMovementContentProps) {
    const router = useRouter();
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);

    if (userRole === 'user') {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Accesso Negato</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Non hai i permessi necessari per modificare i movimenti.</p>
                <Link href="/movements">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Torna ai Movimenti
                    </Button>
                </Link>
            </div>
        );
    }

    // Data Sources
    const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
    const [jobs, setJobs] = useState<Job[]>(initialJobs);

    // Dialog States
    const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);

    // Form State
    const [activeTab, setActiveTab] = useState<'entry' | 'exit' | 'sale'>(initialNote.type);
    const [numberPart, setNumberPart] = useState(initialNote.number.split('/')[0]);
    const [date, setDate] = useState(initialNote.date.split('T')[0]);
    const [selectedJob, setSelectedJob] = useState<Job | null>(
        initialNote.jobId ? (initialJobs.find(j => j.id === initialNote.jobId) || null) : null
    );

    // If job was not in initialJobs (limit 50), we might need to fetch it or handle it.
    // Ideally, the Server Component should ensure the selected job is passed if it exists.

    const [causal, setCausal] = useState(initialNote.causal);
    const [pickupLocation, setPickupLocation] = useState(initialNote.pickupLocation);
    const [deliveryLocation, setDeliveryLocation] = useState(initialNote.deliveryLocation);

    // Footer fields
    const [transportMean, setTransportMean] = useState(initialNote.transportMean || "Mittente");
    const [transportTime, setTransportTime] = useState(initialNote.transportTime || "");
    const [appearance, setAppearance] = useState(initialNote.appearance || "A VISTA");
    const [packagesCount, setPackagesCount] = useState<string>(initialNote.packagesCount?.toString() || "1");
    const [notes, setNotes] = useState(initialNote.notes || "");

    // Line State
    const [currentLine, setCurrentLine] = useState({
        itemId: "",
        quantity: "",
        pieces: "",
        coefficient: 1,
        unit: "PZ",
        purchaseItemId: ""
    });
    const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);
    const [availableBatches, setAvailableBatches] = useState<any[]>([]); // For Exit
    const [jobInventory, setJobInventory] = useState<any[]>([]); // For Entry
    const [lines, setLines] = useState<MovementLine[]>(
        initialNote.items ? initialNote.items.map(item => ({
            tempId: item.id || Math.random().toString(36).substr(2, 9),
            itemId: item.inventoryId,
            itemName: item.inventoryName || "",
            itemCode: item.inventoryCode || "",
            itemUnit: item.inventoryUnit || "PZ",
            itemBrand: item.inventoryBrand,
            itemCategory: item.inventoryCategory,
            itemDescription: item.inventoryDescription,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient || 1,
            purchaseItemId: item.purchaseItemId,
            purchaseRef: item.purchaseItemId ? "Caricamento..." : undefined,
            isFictitious: item.isFictitious
        })) : []
    );

    // Computed Suffix based on selected date
    const yearSuffix = date ? new Date(date).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
    const fullNumber = numberPart ? `${numberPart}/PP${yearSuffix}` : `/PP${yearSuffix}`;

    // Memoized items for dialog to prevent re-renders
    const dialogItems = useMemo(() => {
        return activeTab === 'entry' && selectedJob
            ? jobInventory.map(j => j.item)
            : inventory;
    }, [activeTab, selectedJob, jobInventory, inventory]);

    // Auto-fill fields when Tab or Job changes
    useEffect(() => {
        // Only auto-fill if user interaction triggered it, not on initial load
        // We can use a ref to track if it's initial render or not, or just let it be for now
        // but we should avoid overwriting existing data if it's a reload.
        // Actually, this logic was present in the original component, but it might overwrite 
        // the initial values if we are not careful.
        // However, since we initialize state with initialNote values, 
        // we should only trigger this if activeTab or selectedJob *changes* from the initial state.

        // For now, let's keep the logic but maybe guard it? 
        // The original logic runs on mount too because of the dependency array.
        // But we initialized the state with the DB values.
        // If we run this effect, it might reset the locations to defaults.

        // Let's rely on user explicit change.
        // We can skip the first run.
    }, [activeTab, selectedJob]);

    // Re-implementing the location logic but ensuring we don't overwrite on mount if we already have values
    // This is tricky. The original code ran on mount.
    // If I load an existing note, I want to keep its values.
    // If I change the job, I want to update the locations.

    const handleJobSelect = (job: Job) => {
        setSelectedJob(job);
        setIsJobSelectorOpen(false);

        // Trigger location update logic here instead of useEffect
        updateLocations(activeTab, job);
    };

    const handleTabChange = (tab: 'entry' | 'exit' | 'sale') => {
        setActiveTab(tab);
        updateLocations(tab, selectedJob);
    };

    const updateLocations = (tab: 'entry' | 'exit' | 'sale', job: Job | null) => {
        let jobAddress = "";
        if (job) {
            if (job.clientName) {
                jobAddress += `CLIENTE: ${job.clientName}`;
                if (job.clientAddress) {
                    jobAddress += ` - ${job.clientAddress}`;
                }
                jobAddress += `\n`;
            }

            let destinationText = "";
            const siteAddr = job.siteAddress || "";
            const clientAddr = job.clientAddress || "";

            const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

            if (siteAddr && clientAddr && normalize(siteAddr) === normalize(clientAddr)) {
                destinationText = "Stessa";
            } else {
                destinationText = job.siteAddress || `${job.code} - ${job.description}`;
            }

            jobAddress += `DESTINAZIONE: ${destinationText}`;
        }

        const warehouseAddress = "OPI FIRESAFE S.R.L. MAGAZZINO\nVia A. Malignani, 9 - 33010 - REANA DEL ROJALE (UD)";

        if (tab === 'entry') {
            setCausal("Rientro da cantiere");
            setPickupLocation(jobAddress || "DESTINAZIONE");
            setDeliveryLocation(warehouseAddress);
        } else if (tab === 'exit') {
            setCausal("Uscita merce per cantiere");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation(jobAddress || "DESTINAZIONE");
        } else if (tab === 'sale') {
            setCausal("Vendita");
            setPickupLocation(warehouseAddress);
            setDeliveryLocation("Cliente");
        }
    };

    useEffect(() => {
        // If Job Changes and we are in ENTRY mode, fetch Job Inventory
        if (activeTab === 'entry' && selectedJob) {
            inventoryApi.getJobInventory(selectedJob.id).then(data => {
                setJobInventory(data);
            }).catch(err => console.error("Failed to load job inventory", err));
        } else {
            setJobInventory([]);
        }
    }, [activeTab, selectedJob]);

    const handleItemSelect = async (item: InventoryItem) => {
        setSelectedItemForLine(item);

        // Reset line
        setCurrentLine({
            itemId: item.id,
            quantity: "",
            pieces: "",
            coefficient: item.coefficient || 1,
            unit: item.unit,
            purchaseItemId: ""
        });

        // If EXIT/SALE, load available batches
        if (activeTab === 'exit' || activeTab === 'sale') {
            try {
                const batches = await inventoryApi.getAvailableBatches(item.id);
                // Filter exhausted batches (check pieces first, then qty)
                const validBatches = batches.filter((b: any) => {
                    if (b.remainingPieces !== undefined && b.remainingPieces !== null) {
                        return b.remainingPieces > 0.001;
                    }
                    return b.remainingQty > 0.001;
                });
                setAvailableBatches(validBatches);

                // Auto-select oldest batch (FIFO)
                if (validBatches.length > 0) {
                    setCurrentLine(prev => ({ ...prev, purchaseItemId: validBatches[0].id }));
                }
            } catch (err) {
                console.error("Failed to load batches", err);
                setAvailableBatches([]);
            }
        }

        setIsItemSelectorOpen(false);
    };

    const handleAddLine = () => {
        if (!selectedItemForLine || !currentLine.quantity) {
            alert("Seleziona Articolo e Quantità");
            return;
        }

        // Validation: Check Purchase Selection for Exits
        if ((activeTab === 'exit' || activeTab === 'sale') && !currentLine.purchaseItemId) {
            alert("Devi selezionare un lotto di acquisto da cui prelevare la merce.");
            return;
        }

        const isFictitious = currentLine.purchaseItemId === 'fictitious';

        // Validation: Check Quantity against Batch (Skip if Fictitious)
        if ((activeTab === 'exit' || activeTab === 'sale') && currentLine.purchaseItemId && !isFictitious) {
            const batch = availableBatches.find(b => b.id === currentLine.purchaseItemId);
            if (batch) {
                // Check pieces if available (source of truth)
                if (currentLine.pieces && batch.remainingPieces !== undefined) {
                    if (Number(currentLine.pieces) > batch.remainingPieces) {
                        alert(`Quantità eccessiva. Disponibile nel lotto: ${batch.remainingPieces} pezzi`);
                        return;
                    }
                }
                // Fallback to quantity check
                else if (Number(currentLine.quantity) > batch.remainingQty) {
                    alert(`Quantità eccessiva. Disponibile nel lotto: ${batch.remainingQty}`);
                    return;
                }
            }
        }

        const newLine: MovementLine = {
            tempId: Math.random().toString(36).substr(2, 9),
            itemId: selectedItemForLine.id,
            itemName: selectedItemForLine.name,
            itemCode: selectedItemForLine.code,
            itemUnit: selectedItemForLine.unit,
            itemBrand: selectedItemForLine.brand,
            itemCategory: selectedItemForLine.type,
            itemDescription: selectedItemForLine.description,
            quantity: Number(currentLine.quantity),
            purchaseItemId: isFictitious ? undefined : currentLine.purchaseItemId,
            purchaseRef: isFictitious ? "Lotto Fittizio" : availableBatches.find(b => b.id === currentLine.purchaseItemId)?.purchaseRef,
            isFictitious: isFictitious
        };

        setLines([...lines, newLine]);
        setCurrentLine({ itemId: "", quantity: "", pieces: "", coefficient: 1, unit: "PZ", purchaseItemId: "" });
        setSelectedItemForLine(null);
        setAvailableBatches([]);
    };

    const handleRemoveLine = (tempId: string) => {
        setLines(lines.filter(l => l.tempId !== tempId));
    };

    const handleSave = async () => {
        if (!numberPart) {
            alert("Inserisci il numero della bolla");
            return;
        }
        if (lines.length === 0) {
            alert("Inserisci almeno un articolo");
            return;
        }

        try {
            setLoading(true);

            const noteData = {
                type: activeTab,
                number: fullNumber,
                date: date,
                jobId: selectedJob ? selectedJob.id : undefined,
                causal,
                pickupLocation,
                deliveryLocation,
                transportMean,
                transportTime: transportTime || undefined,
                appearance,
                packagesCount: parseInt(packagesCount) || 0,
                notes
            };

            const itemsData = lines.map(line => ({
                inventoryId: line.itemId,
                quantity: line.quantity,
                pieces: line.pieces,
                coefficient: line.coefficient,
                purchaseItemId: line.purchaseItemId,
                isFictitious: line.isFictitious
            }));

            await updateMovement(initialNote.id, noteData, itemsData);

            // Redirect handled by server action
        } catch (error: any) {
            console.error("Error saving movement:", error);
            alert(`Errore durante il salvataggio: ${error.message || "Errore sconosciuto"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">

            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/movements">
                        <Button variant="ghost" size="icon" aria-label="Torna indietro">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Modifica Bolla di Movimentazione</h1>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salva Modifiche
                </Button>
            </div>

            {/* Type Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-14">
                    <TabsTrigger value="entry" className="h-full data-[state=active]:bg-green-100 data-[state=active]:text-green-800 text-lg">
                        <ArrowDownRight className="mr-2 h-5 w-5" /> Entrata
                    </TabsTrigger>
                    <TabsTrigger value="exit" className="h-full data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 text-lg">
                        <ArrowUpRight className="mr-2 h-5 w-5" /> Uscita
                    </TabsTrigger>
                    <TabsTrigger value="sale" className="h-full data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 text-lg">
                        <ShoppingBag className="mr-2 h-5 w-5" /> Vendita
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Main Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Header Info */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Dati Testata Documento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Numero Bolla</Label>
                                    <div className="flex items-center">
                                        <Input
                                            value={numberPart}
                                            onChange={(e) => setNumberPart(e.target.value)}
                                            placeholder="Es. 1"
                                            className="text-right pr-2 rounded-r-none border-r-0"
                                        />
                                        <div className="bg-slate-100 dark:bg-muted border border-l-0 dark:border-border rounded-r-md px-3 py-2 text-slate-500 dark:text-slate-400 text-sm font-medium whitespace-nowrap">
                                            /PP{yearSuffix}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Data Documento</Label>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Collega Commessa (Opzionale)</Label>
                                <div
                                    className="flex items-center justify-between border dark:border-border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                    onClick={() => setIsJobSelectorOpen(true)}
                                >
                                    {selectedJob ? (
                                        <div className="flex flex-col">
                                            <span className="font-medium">{selectedJob.code} - {selectedJob.description}</span>
                                            {selectedJob.clientName && (
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{selectedJob.clientName}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-500 dark:text-slate-400">Seleziona Commessa...</span>
                                    )}
                                    <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Causale del Trasporto</Label>
                                <Input
                                    value={causal}
                                    onChange={(e) => setCausal(e.target.value)}
                                    placeholder="Es. Rientro da cantiere"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <MapPin className="h-3 w-3" /> Luogo di Ritiro
                                    </Label>
                                    <Textarea
                                        value={pickupLocation}
                                        onChange={(e) => setPickupLocation(e.target.value)}
                                        className="h-20 text-xs font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <MapPin className="h-3 w-3" /> Luogo di Destinazione
                                    </Label>
                                    <Textarea
                                        value={deliveryLocation}
                                        onChange={(e) => setDeliveryLocation(e.target.value)}
                                        className="h-20 text-xs font-mono"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Articoli in Bolla</span>
                                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{lines.length} righe inserite</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Line Form */}
                            <div className="flex flex-col sm:flex-row gap-3 items-end bg-slate-50 dark:bg-muted p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div className="flex-1 space-y-2 w-full">
                                    <Label>Seleziona Articolo</Label>
                                    <div
                                        className="flex items-center justify-between bg-white dark:bg-card border dark:border-border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 h-10"
                                        onClick={() => setIsItemSelectorOpen(true)}
                                    >
                                        {selectedItemForLine ? (
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="font-medium text-sm truncate">{selectedItemForLine.name}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{selectedItemForLine.code}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 dark:text-slate-400 text-sm">Cerca articolo...</span>
                                        )}
                                        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                                    </div>
                                </div>

                                {/* Batch Selector for Exit/Sale */}
                                {(activeTab === 'exit' || activeTab === 'sale') && selectedItemForLine && availableBatches.length > 0 && (
                                    <div className="w-full sm:w-48 space-y-2">
                                        <Label className="text-xs">Lotto (FIFO)</Label>
                                        <Select
                                            value={currentLine.purchaseItemId}
                                            onValueChange={(val) => setCurrentLine({ ...currentLine, purchaseItemId: val })}
                                        >
                                            <SelectTrigger className="h-10 bg-white">
                                                <SelectValue placeholder="Lotto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableBatches.map(batch => (
                                                    <SelectItem key={batch.id} value={batch.id}>
                                                        <span className="flex flex-col text-left">
                                                            <span className="font-medium">{batch.purchaseRef || "Nessun Rif."}</span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">Disp: {batch.remainingQty}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="w-full sm:w-32 space-y-2">
                                    {currentLine.coefficient !== 1 && (
                                        <div>
                                            <Label htmlFor="pieces-input" className="text-xs">Pezzi</Label>
                                            <Input
                                                id="pieces-input"
                                                type="number"
                                                min="0"
                                                className="bg-white h-8 text-sm"
                                                value={currentLine.pieces}
                                                onChange={(e) => {
                                                    const p = e.target.value;
                                                    // Se abbiamo i pezzi, calcoliamo la quantità
                                                    // Se il campo è vuoto, lasciamo vuoto anche quantità
                                                    const q = p ? (parseFloat(p) * currentLine.coefficient).toFixed(2) : "";

                                                    setCurrentLine({
                                                        ...currentLine,
                                                        pieces: p,
                                                        quantity: q
                                                    });
                                                }}
                                                placeholder="Pezzi"
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">Coeff: {currentLine.coefficient}</p>
                                        </div>
                                    )}
                                    <Label htmlFor="qty-input">Quantità ({currentLine.unit})</Label>
                                    <Input
                                        id="qty-input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={`bg-white ${currentLine.coefficient !== 1 ? 'bg-slate-100' : ''}`}
                                        readOnly={currentLine.coefficient !== 1}
                                        value={currentLine.quantity}
                                        onChange={(e) => setCurrentLine({ ...currentLine, quantity: e.target.value })}
                                    />
                                </div>
                                <Button onClick={handleAddLine} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" aria-label="Aggiungi riga">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Lines Table */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tipologia</TableHead>
                                            <TableHead>Marca</TableHead>
                                            <TableHead>Articolo</TableHead>
                                            <TableHead>Descrizione</TableHead>
                                            <TableHead className="text-right">Quantità</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                                                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                                    <p>Nessun articolo aggiunto</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            lines.map((line) => (
                                                <TableRow key={line.tempId}>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-normal text-slate-600 dark:text-slate-400">
                                                            {line.itemCategory || '-'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{line.itemBrand || '-'}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-bold text-slate-800 dark:text-slate-100">{line.itemName}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                            {line.itemCode}
                                                            {line.purchaseRef && (
                                                                <span className="text-blue-600 dark:text-blue-400 ml-2">
                                                                    Lotto: {line.purchaseRef}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px]">
                                                        <div className="truncate text-sm text-slate-600 dark:text-slate-400" title={line.itemDescription}>
                                                            {line.itemDescription || '-'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        <div>{line.quantity} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{line.itemUnit}</span></div>
                                                        {line.coefficient && line.coefficient !== 1 && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                                                ({line.pieces} pz x {line.coefficient})
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveLine(line.tempId)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            aria-label="Rimuovi riga"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Details & Settings */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Dettagli Trasporto</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Mezzo di Trasporto</Label>
                                <Select value={transportMean} onValueChange={setTransportMean}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mittente">Mittente</SelectItem>
                                        <SelectItem value="Vettore">Vettore</SelectItem>
                                        <SelectItem value="Destinatario">Destinatario</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Inizio Trasporto (Opzionale)</Label>
                                <div className="flex items-center">
                                    <Clock className="mr-2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                    <Input
                                        type="datetime-local"
                                        value={transportTime}
                                        onChange={(e) => setTransportTime(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Aspetto Beni</Label>
                                <Select value={appearance} onValueChange={setAppearance}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A VISTA">A VISTA</SelectItem>
                                        <SelectItem value="CARTONI">CARTONI</SelectItem>
                                        <SelectItem value="PALLET">PALLET</SelectItem>
                                        <SelectItem value="SFUSO">SFUSO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Numero Colli</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={packagesCount}
                                    onChange={(e) => setPackagesCount(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Note Aggiuntive</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                placeholder="Note interne o per il destinatario..."
                                className="h-32"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialogs */}
            <JobSelectorDialog
                open={isJobSelectorOpen}
                onOpenChange={setIsJobSelectorOpen}
                onSelect={handleJobSelect}
                jobs={jobs}
            />

            <ItemSelectorDialog
                open={isItemSelectorOpen}
                onOpenChange={setIsItemSelectorOpen}
                onSelect={handleItemSelect}
                items={dialogItems}
            />
        </div>
    );
}
