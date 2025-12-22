"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Truck, ArrowDownRight, ArrowUpRight, ShoppingBag, MapPin, Briefcase, Search, Clock, Package } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  inventoryApi, 
  jobsApi, 
  deliveryNotesApi,
  InventoryItem, 
  Job 
} from "@/lib/api";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";

interface MovementLine {
  tempId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  itemUnit: string;
  quantity: number;
  pieces?: number;
  coefficient?: number;
  purchaseItemId?: string; // Add this
  purchaseRef?: string; // For display
}

export default function NewMovementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Data Sources
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Dialog States
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);

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
  const [jobInventory, setJobInventory] = useState<any[]>([]); // For Entry
  const [lines, setLines] = useState<MovementLine[]>([]);

  // Computed Suffix based on selected date
  const yearSuffix = date ? new Date(date).getFullYear().toString().slice(-2) : new Date().getFullYear().toString().slice(-2);
  const fullNumber = numberPart ? `${numberPart}/PP${yearSuffix}` : `/PP${yearSuffix}`;

  useEffect(() => {
    loadData();
  }, []);

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
  }, [activeTab, selectedJob]);

  const loadData = async () => {
    try {
      setInitialLoading(true);
      const [inventoryData, jobsData] = await Promise.all([
        inventoryApi.getAll(),
        jobsApi.getAll()
      ]);
      setInventory(inventoryData);
      setJobs(jobsData.filter(j => j.status === 'active'));
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setInitialLoading(false);
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

  const handleJobSelect = (job: Job) => {
    setSelectedJob(job);
    setIsJobSelectorOpen(false);
  };

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
            setAvailableBatches(batches);
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

    // Validation: Check Quantity against Batch
    if ((activeTab === 'exit' || activeTab === 'sale') && currentLine.purchaseItemId) {
        const batch = availableBatches.find(b => b.id === currentLine.purchaseItemId);
        if (batch && Number(currentLine.quantity) > batch.remainingQty) {
            alert(`Quantità eccessiva. Disponibile nel lotto: ${batch.remainingQty}`);
            return;
        }
    }

    // Validation: Check Quantity against Job Inventory (for Entry)
    if (activeTab === 'entry' && selectedJob) {
         // Logic to check if we are returning more than available at job
         // (Handled by backend trigger, but good to have UI warning if we had full data)
    }

    const newLine: MovementLine = {
      tempId: Math.random().toString(36).substr(2, 9),
      itemId: selectedItemForLine.id,
      itemName: selectedItemForLine.name,
      itemCode: selectedItemForLine.code,
      itemUnit: selectedItemForLine.unit,
      quantity: Number(currentLine.quantity),
      purchaseItemId: currentLine.purchaseItemId,
      purchaseRef: availableBatches.find(b => b.id === currentLine.purchaseItemId)?.purchaseRef
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
      console.time('handleSave');
      
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
        quantity: line.quantity
      }));

      console.time('api_call');
      await deliveryNotesApi.create(noteData, itemsData);
      console.timeEnd('api_call');
      
      console.time('redirect');
      router.push('/movements');
      console.timeEnd('redirect');
      console.timeEnd('handleSave');
    } catch (error) {
      console.error("Error saving movement:", error);
      alert("Errore durante il salvataggio");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/movements">
              <Button variant="ghost" size="icon" aria-label="Torna indietro">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Nuova Bolla di Movimentazione</h1>
          </div>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva Bolla
          </Button>
        </div>

        {/* Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
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
                                    <div className="bg-slate-100 border border-l-0 rounded-r-md px-3 py-2 text-slate-500 text-sm font-medium whitespace-nowrap">
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
                                className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50"
                                onClick={() => setIsJobSelectorOpen(true)}
                            >
                                {selectedJob ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium">{selectedJob.code} - {selectedJob.description}</span>
                                        {selectedJob.clientName && (
                                            <span className="text-xs text-slate-500">{selectedJob.clientName}</span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-500">Seleziona Commessa...</span>
                                )}
                                <Search className="h-4 w-4 text-slate-400" />
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
                                <Label className="flex items-center gap-2 text-slate-500">
                                    <MapPin className="h-3 w-3" /> Luogo di Ritiro
                                </Label>
                                <Textarea 
                                    value={pickupLocation} 
                                    onChange={(e) => setPickupLocation(e.target.value)} 
                                    className="h-20 text-xs font-mono"
                                />
                             </div>
                             <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-500">
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
                            <span className="text-sm font-normal text-slate-500">{lines.length} righe inserite</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add Line Form */}
                        <div className="flex flex-col sm:flex-row gap-3 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex-1 space-y-2 w-full">
                                <Label>Seleziona Articolo</Label>
                                <div 
                                    className="flex items-center justify-between bg-white border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 h-10"
                                    onClick={() => setIsItemSelectorOpen(true)}
                                >
                                    {selectedItemForLine ? (
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="font-mono text-xs font-bold bg-slate-100 px-1 rounded">{selectedItemForLine.code}</span>
                                            <span className="text-sm truncate">{selectedItemForLine.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-500">Cerca articolo...</span>
                                    )}
                                    <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                </div>
                            </div>
                            <div className="w-full sm:w-32 space-y-2">
                                {(activeTab === 'exit' || activeTab === 'sale') && availableBatches.length > 0 && (
                                    <div className="mb-2 w-full">
                                        <Label htmlFor="batch-select" className="text-red-600 font-bold">Lotto Acquisto *</Label>
                                        <Select 
                                            value={currentLine.purchaseItemId} 
                                            onValueChange={(v) => setCurrentLine({...currentLine, purchaseItemId: v})}
                                        >
                                            <SelectTrigger id="batch-select" className="w-full sm:w-[200px]">
                                                <SelectValue placeholder="Seleziona..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableBatches.map(batch => (
                                                    <SelectItem key={batch.id} value={batch.id}>
                                                        {batch.purchaseRef} ({new Date(batch.date).toLocaleDateString()}) - Disp: {batch.remainingQty}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {currentLine.coefficient !== 1 && (
                                    <div className="mb-2">
                                        <Label htmlFor="pieces-input">Pezzi</Label>
                                        <Input 
                                            id="pieces-input"
                                            type="number" 
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            value={currentLine.pieces}
                                            onChange={(e) => {
                                                const p = e.target.value;
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
                                    onChange={(e) => setCurrentLine({...currentLine, quantity: e.target.value})}
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
                                        <TableHead>Codice</TableHead>
                                        <TableHead>Descrizione</TableHead>
                                        <TableHead className="text-right">Quantità</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                                                <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                                <p>Nessun articolo aggiunto</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        lines.map((line) => (
                                            <TableRow key={line.tempId}>
                                                <TableCell className="font-mono text-xs">
                                                    {line.itemCode}
                                                    {line.purchaseRef && (
                                                        <div className="text-[10px] text-blue-600 mt-1">
                                                            Lotto: {line.purchaseRef}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">{line.itemName}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {line.quantity} <span className="text-xs font-normal text-slate-500">{line.itemUnit}</span>
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

            {/* Right Column: Footer Info */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Dati Trasporto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Trasporto a mezzo</Label>
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
                                    onChange={(e) => setTransportTime(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Aspetto Esteriore Beni</Label>
                            <Input 
                                value={appearance} 
                                onChange={(e) => setAppearance(e.target.value)} 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Numero Colli</Label>
                            <Input 
                                type="number" 
                                min="0"
                                value={packagesCount} 
                                onChange={(e) => setPackagesCount(e.target.value)} 
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Annotazioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            placeholder="Note aggiuntive (es. CIG, Riferimenti...)"
                            className="min-h-[100px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </CardContent>
                </Card>

                <div className="text-xs text-slate-400 text-center">
                    Il salvataggio creerà il documento e aggiornerà automaticamente le giacenze di magazzino.
                </div>
            </div>

        </div>

        {/* Dialogs */}
        <JobSelectorDialog 
            open={isJobSelectorOpen} 
            onOpenChange={setIsJobSelectorOpen} 
            jobs={jobs}
            onSelect={handleJobSelect}
        />

        <ItemSelectorDialog
            open={isItemSelectorOpen}
            onOpenChange={setIsItemSelectorOpen}
            items={activeTab === 'entry' && selectedJob ? jobInventory.map(j => j.item) : inventory}
            onSelect={handleItemSelect}
        />
      </div>
    </DashboardLayout>
  );
}
