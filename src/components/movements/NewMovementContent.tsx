"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Truck, ArrowDownRight, ArrowUpRight, ShoppingBag, MapPin, Briefcase, Search, Clock, Package } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  inventoryApi, 
  jobsApi, 
  deliveryNotesApi,
  InventoryItem, 
  Job 
} from "@/lib/api";
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

interface NewMovementContentProps {
  initialInventory: InventoryItem[];
  initialJobs: Job[];
}

export default function NewMovementContent({ initialInventory, initialJobs }: NewMovementContentProps) {
  const router = useRouter();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);

  if (userRole === 'user') {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
            <p className="text-slate-500 mb-6">Non hai i permessi necessari per creare nuovi movimenti.</p>
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
  const [jobInventory, setJobInventory] = useState<any[]>([]); // For Entry (Legacy/Simple)
  const [jobBatchAvailability, setJobBatchAvailability] = useState<any[]>([]); // For Entry (Detailed)
  const [lines, setLines] = useState<MovementLine[]>([]);

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
    // Determine job address
    let jobAddress = "";
    if (selectedJob) {
        if (selectedJob.clientName) {
            jobAddress += `CLIENTE: ${selectedJob.clientName}`;
            if (selectedJob.clientAddress) {
                jobAddress += ` - ${selectedJob.clientAddress}`;
            }
            jobAddress += `\n`;
        }
        
        // Determine destination text
        let destinationText = "";
        const siteAddr = selectedJob.siteAddress || "";
        const clientAddr = selectedJob.clientAddress || "";
        
        // Simple string comparison for "Stessa" check
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

    // Auto-fill Notes with CIG/CUP
    if (selectedJob) {
        const parts = [];
        if (selectedJob.cig) parts.push(`CIG: ${selectedJob.cig}`);
        if (selectedJob.cup) parts.push(`CUP: ${selectedJob.cup}`);
        
        if (parts.length > 0) {
            setNotes(parts.join(' '));
        } else {
            setNotes("");
        }
    } else {
        setNotes("");
    }
  }, [activeTab, selectedJob]);

  const handleJobSearch = useCallback(async (term: string) => {
    setJobsLoading(true);
    try {
        const { data } = await jobsApi.getPaginated({ 
            page: 1, 
            limit: 50, 
            search: term,
            status: 'active'
        });
        setJobs(data);
    } catch (error) {
        console.error("Failed to search jobs", error);
    } finally {
        setJobsLoading(false);
    }
  }, []);

  const handleItemSearch = useCallback(async (term: string) => {
    // If we are in entry mode with a job selected, we don't use server search 
    // because we are showing job inventory which is already fully loaded
    if (activeTab === 'entry' && selectedJob) return;

    setItemsLoading(true);
    try {
        const { items } = await inventoryApi.getPaginated({ 
            page: 1, 
            limit: 50, 
            search: term 
        });
        setInventory(items);
    } catch (error) {
        console.error("Failed to search items", error);
    } finally {
        setItemsLoading(false);
    }
  }, [activeTab, selectedJob]);

  useEffect(() => {
    // If Job Changes and we are in ENTRY mode, fetch Job Inventory
    if (activeTab === 'entry' && selectedJob) {
        // Fetch detailed batch availability
        inventoryApi.getJobBatchAvailability(selectedJob.id).then(data => {
            setJobBatchAvailability(data);
        }).catch(err => console.error("Failed to load job batches", err));

        // Keep fetching legacy job inventory just in case (optional, maybe used for dialogItems)
        inventoryApi.getJobInventory(selectedJob.id).then(data => {
            setJobInventory(data);
        }).catch(err => console.error("Failed to load job inventory", err));
    } else {
        setJobInventory([]);
        setJobBatchAvailability([]);
    }
  }, [activeTab, selectedJob]);

  const handleSelectReturnBatch = (batch: any) => {
    // Construct a temporary InventoryItem
     const item: InventoryItem = {
         id: batch.itemId,
         code: batch.itemCode,
         name: batch.itemName,
         unit: batch.itemUnit,
         brand: batch.itemBrand,
         type: batch.itemCategory,
         quantity: 0, // Not relevant here
         minStock: 0,
         description: "",
         coefficient: batch.coefficient,
         supplierCode: "",
         price: 0,
         model: batch.itemModel
     };
    
    setSelectedItemForLine(item);
    
    // Set current line with batch info
    setCurrentLine({
        itemId: item.id,
        quantity: "",
        pieces: "",
        coefficient: batch.coefficient || 1,
        unit: item.unit,
        purchaseItemId: batch.purchaseItemId
    });

    // Mock availableBatches so validation and UI display works
    setAvailableBatches([{
        id: batch.purchaseItemId,
        purchaseRef: batch.purchaseRef,
        remainingQty: batch.quantity,
        remainingPieces: batch.pieces,
        date: new Date().toISOString()
    }]);
  };

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
        purchaseItemId: ""
    });
    
    // If Exit, fetch batches
    if (activeTab === 'exit') {
        inventoryApi.getAvailableBatches(item.id).then(batches => {
            // Filter exhausted batches
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
        }).catch(err => {
            console.error("Failed to load batches", err);
            setAvailableBatches([]);
        });
    }
    
    setIsItemSelectorOpen(false);
  };

  const handleAddLine = () => {
    if (!selectedItemForLine || !currentLine.quantity) return;

    // Validation
    const qty = parseFloat(currentLine.quantity);
    if (qty <= 0) return;

    // Check availability for EXIT
    if (activeTab === 'exit') {
        const batch = availableBatches.find(b => b.id === currentLine.purchaseItemId);
        if (currentLine.purchaseItemId && batch) {
            if (qty > batch.remainingQty) {
                alert(`Quantità eccessiva per il lotto selezionato. Disponibile: ${batch.remainingQty}`);
                return;
            }
        } else if (availableBatches.length > 0) {
            // If batches exist but none selected, warn user
             // alert("Seleziona un lotto di provenienza");
             // return;
             // Allowing generic exit for now if needed
        }
    }

    // Check availability for ENTRY (Return from Job)
    if (activeTab === 'entry' && selectedJob && currentLine.purchaseItemId) {
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
        isFictitious: false // Default
    };

    setLines([...lines, newLine]);
    
    // Reset Line
    setSelectedItemForLine(null);
    setCurrentLine({
        itemId: "",
        quantity: "",
        pieces: "",
        coefficient: 1,
        unit: "PZ",
        purchaseItemId: ""
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
        
        await deliveryNotesApi.create({
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
            // Price is not handled in UI yet, defaulting to 0 or fetching from inventory?
            // Backend/API might handle price retrieval if not provided
            price: 0 
        })));

        router.push('/movements');
    } catch (error: any) {
        console.error("Create failed", error);
        alert(`Errore durante il salvataggio: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };

  return (
      <div className="space-y-6 pb-20 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/movements">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nuovo Movimento</h1>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="bg-[#003366] hover:bg-[#002244]">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva Documento
          </Button>
        </div>

        {/* Tabs - Type Selection */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="entry" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                    <ArrowDownRight className="mr-2 h-4 w-4" />
                    Entrata / Reso
                </TabsTrigger>
                <TabsTrigger value="exit" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Uscita
                </TabsTrigger>
                <TabsTrigger value="sale" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Vendita
                </TabsTrigger>
            </TabsList>

            {/* Main Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Header Info */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                Testata Documento
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Numero</Label>
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="N." 
                                            value={numberPart}
                                            onChange={e => setNumberPart(e.target.value)}
                                            className="w-24"
                                        />
                                        <span className="text-slate-500 font-mono text-sm">/PP{yearSuffix}</span>
                                    </div>
                                </div>
                                <div>
                                    <Label>Data</Label>
                                    <Input 
                                        type="date" 
                                        value={date}
                                        onChange={e => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Commessa Selector */}
                            <div className="space-y-2">
                                <Label>Commessa di Riferimento</Label>
                                <div className="flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        className={`w-full justify-start text-left font-normal ${!selectedJob && "text-muted-foreground"}`}
                                        onClick={() => setIsJobSelectorOpen(true)}
                                    >
                                        <Briefcase className="mr-2 h-4 w-4" />
                                        {selectedJob ? (
                                            <span className="truncate">
                                                <span className="font-bold text-slate-900">{selectedJob.code}</span>
                                                <span className="mx-2">-</span>
                                                {selectedJob.description}
                                            </span>
                                        ) : (
                                            "Seleziona Commessa..."
                                        )}
                                    </Button>
                                    {selectedJob && (
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)}>
                                            <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Causale</Label>
                                <Input 
                                    value={causal}
                                    onChange={e => setCausal(e.target.value)}
                                    placeholder="Es. Rifornimento cantiere, Reso, Vendita..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        Luogo Ritiro
                                    </Label>
                                    <Textarea 
                                        value={pickupLocation}
                                        onChange={e => setPickupLocation(e.target.value)}
                                        rows={3}
                                        className="text-xs"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        Destinazione
                                    </Label>
                                    <Textarea 
                                        value={deliveryLocation}
                                        onChange={e => setDeliveryLocation(e.target.value)}
                                        rows={3}
                                        className="text-xs"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Entry Mode: Return from Job Specifics */}
                    {activeTab === 'entry' && selectedJob && jobBatchAvailability.length > 0 && (
                         <Card className="bg-slate-50 border-blue-100">
                             <CardHeader className="pb-2">
                                 <CardTitle className="text-sm font-medium text-blue-800">Materiale in Carico sulla Commessa</CardTitle>
                             </CardHeader>
                             <CardContent>
                                 <div className="max-h-60 overflow-y-auto">
                                     <Table>
                                         <TableHeader>
                                             <TableRow>
                                                 <TableHead className="text-xs">Articolo</TableHead>
                                                 <TableHead className="text-xs">Rif. Acq.</TableHead>
                                                 <TableHead className="text-xs text-right">Q.tà</TableHead>
                                                 <TableHead></TableHead>
                                             </TableRow>
                                         </TableHeader>
                                         <TableBody>
                                             {jobBatchAvailability.map((batch, idx) => (
                                                 <TableRow key={idx} className="hover:bg-white">
                                                     <TableCell className="py-2">
                                                         <div className="text-xs font-medium">{batch.itemCode}</div>
                                                         <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{batch.itemName}</div>
                                                     </TableCell>
                                                     <TableCell className="py-2 text-xs text-slate-500">
                                                         {batch.purchaseRef || "-"}
                                                     </TableCell>
                                                     <TableCell className="py-2 text-xs text-right font-bold">
                                                         {batch.quantity} {batch.itemUnit}
                                                     </TableCell>
                                                     <TableCell className="py-2">
                                                         <Button size="sm" variant="secondary" className="h-6 text-xs" onClick={() => handleSelectReturnBatch(batch)}>
                                                             Seleziona
                                                         </Button>
                                                     </TableCell>
                                                 </TableRow>
                                             ))}
                                         </TableBody>
                                     </Table>
                                 </div>
                             </CardContent>
                         </Card>
                    )}

                    {/* Items Input */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Inserimento Righe
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    className="flex-1 justify-start text-left"
                                    onClick={() => setIsItemSelectorOpen(true)}
                                >
                                    {selectedItemForLine ? (
                                        <span className="truncate">
                                            <span className="font-bold">{selectedItemForLine.code}</span>
                                            <span className="mx-2">-</span>
                                            {selectedItemForLine.name}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">Seleziona Articolo...</span>
                                    )}
                                </Button>
                            </div>
                            
                            {/* If Exit, Show Batches */}
                            {activeTab === 'exit' && selectedItemForLine && availableBatches.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs">Seleziona Lotto (FIFO)</Label>
                                    <Select 
                                        value={currentLine.purchaseItemId} 
                                        onValueChange={(val) => setCurrentLine({...currentLine, purchaseItemId: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleziona lotto..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableBatches.map(batch => (
                                                <SelectItem key={batch.id} value={batch.id}>
                                                    {batch.purchaseRef || "Nessun Rif."} - Disp: {batch.remainingQty} ({format(new Date(batch.date), 'dd/MM/yy')})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantità</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0" 
                                        value={currentLine.quantity}
                                        onChange={e => setCurrentLine({...currentLine, quantity: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>U.M.</Label>
                                    <Input value={currentLine.unit} readOnly className="bg-slate-50" />
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={handleAddLine} className="w-full">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Aggiungi
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lines List */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Codice</TableHead>
                                    <TableHead>Descrizione</TableHead>
                                    <TableHead className="text-right">Q.tà</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                                            Nessuna riga inserita
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    lines.map(line => (
                                        <TableRow key={line.tempId}>
                                            <TableCell className="font-medium text-xs">{line.itemCode}</TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium truncate max-w-[200px]">{line.itemName}</div>
                                                <div className="text-xs text-slate-500">{line.itemDescription}</div>
                                                {line.purchaseRef && (
                                                    <Badge variant="outline" className="text-[10px] mt-1">
                                                        Lotto: {line.purchaseRef}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                {line.quantity} {line.itemUnit}
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeLine(line.tempId)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Right Column: Footer Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500">Dati Trasporto</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Trasporto a Mezzo</Label>
                                <Select value={transportMean} onValueChange={setTransportMean}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Mittente">Mittente</SelectItem>
                                        <SelectItem value="Destinatario">Destinatario</SelectItem>
                                        <SelectItem value="Vettore">Vettore</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Inizio Trasporto (Ora)</Label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input 
                                        type="time" 
                                        className="pl-9"
                                        value={transportTime}
                                        onChange={e => setTransportTime(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Aspetto Beni</Label>
                                <Select value={appearance} onValueChange={setAppearance}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A VISTA">A VISTA</SelectItem>
                                        <SelectItem value="IMBALLATO">IMBALLATO</SelectItem>
                                        <SelectItem value="SCATOLA">SCATOLA</SelectItem>
                                        <SelectItem value="PALLET">PALLET</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>N. Colli</Label>
                                <Input 
                                    type="number" 
                                    min="1"
                                    value={packagesCount}
                                    onChange={e => setPackagesCount(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-slate-500">Note</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea 
                                placeholder="Annotazioni aggiuntive..." 
                                className="min-h-[100px]"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Tabs>

        <JobSelectorDialog 
            open={isJobSelectorOpen} 
            onOpenChange={setIsJobSelectorOpen}
            onSelect={handleJobSelect}
            jobs={jobs}
            onSearch={handleJobSearch}
            loading={jobsLoading}
        />

        <ItemSelectorDialog 
            open={isItemSelectorOpen} 
            onOpenChange={setIsItemSelectorOpen}
            onSelect={handleItemSelect}
            items={dialogItems}
            onSearch={handleItemSearch}
            loading={itemsLoading}
        />
      </div>
  );
}
