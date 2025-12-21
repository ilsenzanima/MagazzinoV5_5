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
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react";
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

interface PurchaseLine {
  tempId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  isJob: boolean;
  jobId?: string;
  jobCode?: string;
}

export default function NewPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Data Sources
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Form State - Header
  const [formData, setFormData] = useState({
    supplierId: "",
    deliveryNoteNumber: "",
    deliveryNoteDate: new Date().toISOString().split('T')[0],
  });

  // Form State - Current Line
  const [currentLine, setCurrentLine] = useState({
    itemId: "",
    quantity: "",
    price: "",
    isJob: false,
    jobId: ""
  });

  // Form State - Lines List
  const [lines, setLines] = useState<PurchaseLine[]>([]);

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
      quantity: parseFloat(currentLine.quantity),
      price: parseFloat(currentLine.price),
      isJob: currentLine.isJob,
      jobId: currentLine.isJob ? currentLine.jobId : undefined,
      jobCode: selectedJob?.code
    };

    setLines([...lines, newLine]);
    
    // Reset current line but keep job selection if desired (resetting for now)
    setCurrentLine({
      itemId: "",
      quantity: "",
      price: "",
      isJob: false,
      jobId: ""
    });
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

      // 1. Create Purchase Header
      const purchase = await purchasesApi.create({
        supplierId: formData.supplierId,
        deliveryNoteNumber: formData.deliveryNoteNumber,
        deliveryNoteDate: formData.deliveryNoteDate,
        status: 'completed' // Or 'draft', assuming completed for now as per requirement implied
      });

      // 2. Create Purchase Lines
      for (const line of lines) {
        await purchasesApi.addItem({
          purchaseId: purchase.id,
          itemId: line.itemId,
          quantity: line.quantity,
          price: line.price,
          jobId: line.jobId
        });
        
        // TODO: Here we should trigger movements or stock updates logic
        // The user said: "La logica di funzionamento... lo vediamo quando avremo finito"
        // So I just save the purchase data for now.
      }

      router.push('/purchases');
    } catch (error) {
      console.error("Failed to save purchase", error);
      alert("Errore durante il salvataggio");
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
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                <Select 
                                    value={currentLine.itemId} 
                                    onValueChange={(v) => setCurrentLine({...currentLine, itemId: v})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Cerca materiale..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {inventory.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.name} ({item.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label>Quantità</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={currentLine.quantity}
                                    onChange={(e) => setCurrentLine({...currentLine, quantity: e.target.value})}
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
                                    <Select 
                                        value={currentLine.jobId} 
                                        onValueChange={(v) => setCurrentLine({...currentLine, jobId: v})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Scegli cantiere..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {jobs.map((job) => (
                                                <SelectItem key={job.id} value={job.id}>
                                                    {job.code} - {job.description}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        <Button type="button" onClick={handleAddLine} className="w-full md:w-auto">
                            <Plus className="mr-2 h-4 w-4" /> Aggiungi Riga
                        </Button>
                    </div>

                    {/* Lines Table */}
                    {lines.length > 0 && (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Materiale</TableHead>
                                        <TableHead className="text-right">Q.tà</TableHead>
                                        <TableHead className="text-right">Prezzo</TableHead>
                                        <TableHead>Destinazione</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((line) => (
                                        <TableRow key={line.tempId}>
                                            <TableCell className="font-medium">{line.itemName}</TableCell>
                                            <TableCell className="text-right">{line.quantity}</TableCell>
                                            <TableCell className="text-right">€ {line.price.toFixed(5)}</TableCell>
                                            <TableCell>
                                                {line.isJob ? (
                                                    <span className="text-blue-600 font-medium">
                                                        Commessa: {line.jobCode || 'N/D'}
                                                    </span>
                                                ) : (
                                                    <span className="text-green-600 font-medium">
                                                        Magazzino
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => removeLine(line.tempId)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-slate-50 font-medium">
                                        <TableCell>TOTALE</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell className="text-right">
                                            € {lines.reduce((acc, l) => acc + (l.quantity * l.price), 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                        <TableCell></TableCell>
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
    </DashboardLayout>
  );
}
