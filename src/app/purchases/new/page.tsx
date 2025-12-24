"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Search, X, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  suppliersApi, 
  inventoryApi, 
  jobsApi, 
  purchasesApi,
  Supplier, 
  InventoryItem, 
  Job 
} from "@/lib/api";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { useAuth } from "@/components/auth-provider";

interface PurchaseLine {
  tempId: string;
  itemId: string;
  itemName: string;
  itemBrand?: string;
  itemCategory?: string;
  itemDescription?: string;
  quantity: number;
  pieces?: number;
  coefficient: number;
  unit: string;
  price: number;
  isJob: boolean;
  jobId?: string;
  jobCode?: string;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  if (userRole === 'user') {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-full py-20">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
                <p className="text-slate-500 mb-6">Non hai i permessi necessari per registrare nuovi acquisti.</p>
                <Link href="/purchases">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Torna agli Acquisti
                    </Button>
                </Link>
            </div>
        </DashboardLayout>
    );
  }

  // Data Sources
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Form State - Header
  const [formData, setFormData] = useState({
    supplierId: "",
    deliveryNoteNumber: "",
    deliveryNoteDate: new Date().toISOString().split('T')[0],
    jobId: ""
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form State - Current Line
  const [currentLine, setCurrentLine] = useState({
    itemId: "",
    quantity: "",
    pieces: "",
    coefficient: 1,
    unit: "PZ",
    price: "",
    isJob: false,
    jobId: ""
  });

  // Form State - Lines List
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  // Dialog States
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [isHeaderJobSelectorOpen, setIsHeaderJobSelectorOpen] = useState(false);
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);
  const [selectedJobForLine, setSelectedJobForLine] = useState<Job | null>(null);
  const [selectedHeaderJob, setSelectedHeaderJob] = useState<Job | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setInitialLoading(true);
      const [suppliersData, inventoryData, jobsData] = await Promise.all([
        suppliersApi.getAll(),
        inventoryApi.getAll(),
        jobsApi.getAll()
      ]);
      setSuppliers(suppliersData);
      setInventory(inventoryData);
      setJobs(jobsData.filter(j => j.status === 'active')); // Only active jobs
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleItemSelect = (item: InventoryItem) => {
    setSelectedItemForLine(item);
    setCurrentLine({
        ...currentLine, 
        itemId: item.id,
        coefficient: item.coefficient ? Number(item.coefficient) : 1,
        unit: item.unit || 'PZ',
        pieces: "",
        quantity: "" 
    });
    setIsItemSelectorOpen(false);
  };

  const handleJobSelect = (job: Job) => {
    setSelectedJobForLine(job);
    setCurrentLine({
        ...currentLine,
        jobId: job.id
    });
    setIsJobSelectorOpen(false);
  };

  const handleHeaderJobSelect = (job: Job) => {
    setSelectedHeaderJob(job);
    setFormData({
        ...formData,
        jobId: job.id
    });
    // Update current line to match header job if it's not set or if we want to enforce it
    setCurrentLine(prev => ({
        ...prev,
        isJob: true,
        jobId: job.id
    }));
    setSelectedJobForLine(job);
    setIsHeaderJobSelectorOpen(false);
  };

  const handleCurrentLineQuantityChange = (quantityStr: string) => {
    const quantity = parseFloat(quantityStr);
    
    if (isNaN(quantity)) {
        setCurrentLine(prev => ({ ...prev, quantity: quantityStr, pieces: "" }));
        return;
    }

    let piecesStr = currentLine.pieces;
    if (currentLine.coefficient && currentLine.coefficient !== 1) {
        piecesStr = (quantity / currentLine.coefficient).toFixed(2);
    } else {
        // If coefficient is 1, default pieces to quantity
        piecesStr = quantity.toString();
    }

    setCurrentLine(prev => ({ 
        ...prev, 
        quantity: quantityStr, 
        pieces: piecesStr 
    }));
  };

  const handleCurrentLinePiecesChange = (piecesStr: string) => {
    const pieces = parseFloat(piecesStr);
    
    if (isNaN(pieces)) {
        setCurrentLine(prev => ({ ...prev, pieces: piecesStr, quantity: "" }));
        return;
    }

    const quantity = (pieces * currentLine.coefficient).toFixed(2);
    setCurrentLine(prev => ({ 
        ...prev, 
        pieces: piecesStr, 
        quantity: quantity 
    }));
  };

  const handleAddLine = () => {
    if (!currentLine.itemId || !currentLine.quantity || !currentLine.price) {
      alert("Compila tutti i campi obbligatori (Articolo, Quantità, Prezzo)");
      return;
    }

    if (currentLine.isJob && !currentLine.jobId) {
      alert("Seleziona una commessa");
      return;
    }

    const selectedItem = inventory.find(i => i.id === currentLine.itemId);
    const selectedJob = jobs.find(j => j.id === currentLine.jobId);

    const newLine: PurchaseLine = {
      tempId: Math.random().toString(36).substr(2, 9),
      itemId: currentLine.itemId,
      itemName: selectedItem?.name || "Articolo sconosciuto",
      itemBrand: selectedItem?.brand,
      itemCategory: selectedItem?.type,
      itemDescription: selectedItem?.description,
      quantity: parseFloat(currentLine.quantity),
      pieces: currentLine.pieces ? parseFloat(currentLine.pieces) : (currentLine.coefficient === 1 ? parseFloat(currentLine.quantity) : undefined),
      coefficient: currentLine.coefficient,
      unit: currentLine.unit,
      price: parseFloat(currentLine.price),
      isJob: currentLine.isJob,
      jobId: currentLine.isJob ? currentLine.jobId : undefined,
      jobCode: selectedJob?.code
    };

    setLines([...lines, newLine]);
    
    // Reset current line but keep job selection if header job is set
    setCurrentLine({
      itemId: "",
      quantity: "",
      pieces: "",
      coefficient: 1,
      unit: "PZ",
      price: "",
      isJob: !!formData.jobId,
      jobId: formData.jobId || ""
    });
    setSelectedItemForLine(null);
    if (!formData.jobId) {
        setSelectedJobForLine(null);
    }
  };

  const updateLine = (tempId: string, updates: Partial<PurchaseLine>) => {
    setLines(lines.map(line => {
      if (line.tempId === tempId) {
        return { ...line, ...updates };
      }
      return line;
    }));
  };

  const handleLineQuantityChange = (tempId: string, quantityStr: string) => {
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity)) {
      updateLine(tempId, { quantity: 0 });
      return;
    }

    const line = lines.find(l => l.tempId === tempId);
    if (!line) return;

    let updates: Partial<PurchaseLine> = { quantity };
    
    // Reverse calculation: if coefficient exists and > 0, calculate pieces
    if (line.coefficient && line.coefficient !== 1) {
      updates.pieces = parseFloat((quantity / line.coefficient).toFixed(2));
    } else {
        // If coeff is 1, pieces might be same as quantity or ignored. 
        // Based on user request "se modifico la quantita e inserisce i pezzi", let's update pieces too if applicable.
        updates.pieces = quantity; 
    }

    updateLine(tempId, updates);
  };

  const handleLinePiecesChange = (tempId: string, piecesStr: string) => {
    const pieces = parseFloat(piecesStr);
    if (isNaN(pieces)) {
        updateLine(tempId, { pieces: 0, quantity: 0 });
        return;
    }

    const line = lines.find(l => l.tempId === tempId);
    if (!line) return;

    const quantity = parseFloat((pieces * line.coefficient).toFixed(2));
    updateLine(tempId, { pieces, quantity });
  };

  const handleLinePriceChange = (tempId: string, priceStr: string) => {
    const price = parseFloat(priceStr);
    if (!isNaN(price)) {
      updateLine(tempId, { price });
    }
  };

  const removeLine = (tempId: string) => {
    setLines(lines.filter(l => l.tempId !== tempId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || !formData.deliveryNoteNumber || !formData.deliveryNoteDate) {
      alert("Compila i dati della bolla (Fornitore, Numero, Data)");
      return;
    }

    if (lines.length === 0) {
      alert("Inserisci almeno una riga nell'acquisto");
      return;
    }

    try {
      setLoading(true);

      let documentUrl = undefined;
      if (selectedFile) {
          documentUrl = await purchasesApi.uploadDocument(selectedFile);
      }

      // 1. Create Purchase Header
      const purchase = await purchasesApi.create({
        supplierId: formData.supplierId,
        deliveryNoteNumber: formData.deliveryNoteNumber,
        deliveryNoteDate: formData.deliveryNoteDate,
        status: 'draft',
        notes: '',
        jobId: formData.jobId || undefined,
        documentUrl: documentUrl
      });

      // 2. Create Purchase Lines
      for (const line of lines) {
        await purchasesApi.addItem({
          purchaseId: purchase.id,
          itemId: line.itemId,
          quantity: line.quantity,
          pieces: line.pieces,
          coefficient: line.coefficient,
          price: line.price,
          jobId: line.jobId
        });
        
        // Note: Stock updates are handled automatically by DB triggers (handle_purchase_item_change)
        // and Cost Calculation is handled by stock_movements_view.
      }

      // Warning about stock update is handled by the UI info below
      router.push('/purchases');
    } catch (error: any) {
      console.error("Failed to save purchase", error);
      alert(`Errore durante il salvataggio: ${error.message || error.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
        <DashboardLayout>
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-10">
        <div className="mb-6">
          <Link href="/purchases" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna agli Acquisti
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Registrazione Acquisto / Bolla</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header Data */}
            <Card>
                <CardHeader>
                    <CardTitle>Dati Bolla</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="supplier">Fornitore *</Label>
                        <Select 
                            value={formData.supplierId} 
                            onValueChange={(v) => setFormData({...formData, supplierId: v})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona Fornitore" />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bolla">Numero Bolla *</Label>
                        <Input 
                            id="bolla" 
                            value={formData.deliveryNoteNumber}
                            onChange={(e) => setFormData({...formData, deliveryNoteNumber: e.target.value})}
                            placeholder="Es. 123/A"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Data Bolla *</Label>
                        <Input 
                            id="date" 
                            type="date"
                            value={formData.deliveryNoteDate}
                            onChange={(e) => setFormData({...formData, deliveryNoteDate: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Commessa (Generale)</Label>
                        <div 
                            className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 bg-white h-10"
                            onClick={() => setIsHeaderJobSelectorOpen(true)}
                        >
                            {selectedHeaderJob ? (
                                <div className="flex flex-col overflow-hidden">
                                    <span className="font-medium text-sm truncate">{selectedHeaderJob.code}</span>
                                    {selectedHeaderJob.clientName && (
                                        <span className="text-[10px] text-slate-500 truncate">{selectedHeaderJob.clientName}</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm text-slate-500 truncate">Seleziona per intero acquisto...</span>
                            )}
                            {selectedHeaderJob ? (
                                <X 
                                    className="h-4 w-4 text-slate-400 hover:text-red-500 flex-shrink-0 ml-1" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedHeaderJob(null);
                                        setFormData({...formData, jobId: ""});
                                        // Reset line job if it matches header
                                        setCurrentLine(prev => ({
                                            ...prev,
                                            isJob: false,
                                            jobId: ""
                                        }));
                                        if (selectedJobForLine?.id === selectedHeaderJob.id) {
                                            setSelectedJobForLine(null);
                                        }
                                    }}
                                />
                            ) : (
                                <Search className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 md:col-span-4 border-t pt-2">
                        <Label>Documento Allegato (PDF, Immagine)</Label>
                        <Input 
                            type="file" 
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="cursor-pointer"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Add Items Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Materiali in Bolla</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add Line Form */}
                    <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-4 space-y-2">
                                <Label>Materiale</Label>
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
                            
                            {/* Logic for Pieces/Quantity */}
                            <div className="md:col-span-2 space-y-2">
                                <Label>Pezzi</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={currentLine.pieces}
                                    onChange={(e) => handleCurrentLinePiecesChange(e.target.value)}
                                    placeholder="Pezzi"
                                />
                                <p className="text-xs text-muted-foreground">Coeff: {currentLine.coefficient}</p>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label>Quantità ({currentLine.unit})</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={currentLine.quantity}
                                    onChange={(e) => handleCurrentLineQuantityChange(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label>Prezzo Unit.</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.00001"
                                    value={currentLine.price}
                                    onChange={(e) => setCurrentLine({...currentLine, price: e.target.value})}
                                    placeholder="0.00000"
                                />
                            </div>
                            <div className="md:col-span-4 flex items-center gap-2 pb-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="isJob" 
                                        checked={currentLine.isJob}
                                        onCheckedChange={(c) => setCurrentLine({...currentLine, isJob: c as boolean})}
                                    />
                                    <Label htmlFor="isJob" className="cursor-pointer">Per Commessa?</Label>
                                </div>
                            </div>
                        </div>

                        {currentLine.isJob && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label>Seleziona Commessa</Label>
                                    <div 
                                        className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 bg-white"
                                        onClick={() => setIsJobSelectorOpen(true)}
                                    >
                                        {selectedJobForLine ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium">{selectedJobForLine.code} - {selectedJobForLine.description}</span>
                                                {selectedJobForLine.clientName && (
                                                    <span className="text-xs text-slate-500">{selectedJobForLine.clientName}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500">Seleziona Commessa...</span>
                                        )}
                                        <Search className="h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button type="button" onClick={handleAddLine} className="w-full md:w-auto">
                            <Plus className="mr-2 h-4 w-4" /> Aggiungi Riga
                        </Button>
                    </div>

                    {/* Lines Table */}
                    {lines.length > 0 && (
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[250px]">Materiale</TableHead>
                                        <TableHead className="w-[100px] text-center">Pezzi</TableHead>
                                        <TableHead className="w-[80px] text-center">Coeff.</TableHead>
                                        <TableHead className="w-[120px] text-right">Q.tà Tot.</TableHead>
                                        <TableHead className="w-[120px] text-right">Prezzo Unit.</TableHead>
                                        <TableHead className="w-[120px] text-right">Totale Riga</TableHead>
                                        <TableHead className="w-[150px]">Destinazione</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((line) => (
                                        <TableRow key={line.tempId}>
                                            <TableCell>
                                                <div className="font-medium">{line.itemName}</div>
                                                <div className="text-xs text-slate-500">{line.itemCategory} - {line.itemBrand}</div>
                                                {line.itemDescription && <div className="text-xs text-slate-400 truncate max-w-[200px]">{line.itemDescription}</div>}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    className="h-8 w-20 mx-auto text-center"
                                                    value={line.pieces || ""}
                                                    onChange={(e) => handleLinePiecesChange(line.tempId, e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-center text-sm text-slate-500">
                                                {line.coefficient}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Input 
                                                        type="number" 
                                                        min="0"
                                                        step="0.01"
                                                        className="h-8 w-24 text-right"
                                                        value={line.quantity}
                                                        onChange={(e) => handleLineQuantityChange(line.tempId, e.target.value)}
                                                    />
                                                    <span className="text-xs text-slate-500 w-6">{line.unit}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span className="text-xs text-slate-400">€</span>
                                                    <Input 
                                                        type="number" 
                                                        min="0"
                                                        step="0.00001"
                                                        className="h-8 w-24 text-right"
                                                        value={line.price}
                                                        onChange={(e) => handleLinePriceChange(line.tempId, e.target.value)}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                € {(line.quantity * line.price).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                {line.isJob ? (
                                                    <span className="text-blue-600 font-medium text-sm block truncate max-w-[140px]" title={line.jobCode}>
                                                        {line.jobCode}
                                                    </span>
                                                ) : (
                                                    <span className="text-green-600 font-medium text-sm">
                                                        Magazzino
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => removeLine(line.tempId)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-slate-50 font-bold">
                                        <TableCell colSpan={5} className="text-right pr-4 text-lg">TOTALE BOLLA</TableCell>
                                        <TableCell className="text-right text-lg">
                                            € {lines.reduce((acc, l) => acc + (l.quantity * l.price), 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
                <Link href="/purchases">
                    <Button variant="outline" type="button">Annulla</Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-blue-600 w-32">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salva</>}
                </Button>
            </div>
        </form>
      </div>

      <ItemSelectorDialog 
        open={isItemSelectorOpen}
        onOpenChange={setIsItemSelectorOpen}
        onSelect={handleItemSelect}
        items={inventory}
      />

      <JobSelectorDialog 
        open={isJobSelectorOpen}
        onOpenChange={setIsJobSelectorOpen}
        onSelect={handleJobSelect}
        jobs={jobs}
      />

      <JobSelectorDialog 
        open={isHeaderJobSelectorOpen}
        onOpenChange={setIsHeaderJobSelectorOpen}
        onSelect={handleHeaderJobSelect}
        jobs={jobs}
      />
    </DashboardLayout>
  );
}
