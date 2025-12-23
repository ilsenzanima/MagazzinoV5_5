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
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, Save, Search } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  suppliersApi, 
  inventoryApi, 
  jobsApi, 
  purchasesApi,
  Supplier, 
  InventoryItem, 
  Job,
  Purchase,
  PurchaseItem
} from "@/lib/api";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  
  // Data Sources for Add Item
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  // Add Item State
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    itemId: "",
    quantity: "",
    pieces: "",
    coefficient: 1,
    price: "",
    isJob: false,
    jobId: ""
  });

  // Dialog States
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);
  const [selectedJobForLine, setSelectedJobForLine] = useState<Job | null>(null);

  // Edit Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ price: string, quantity: string, pieces: string }>({ price: "", quantity: "", pieces: "" });

  useEffect(() => {
    if (id) {
        loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [purchaseData, itemsData, inventoryData, jobsData] = await Promise.all([
        purchasesApi.getById(id),
        purchasesApi.getItems(id),
        inventoryApi.getAll(),
        jobsApi.getAll()
      ]);
      
      setPurchase(purchaseData);
      setItems(itemsData);
      setInventory(inventoryData);
      setJobs(jobsData.filter(j => j.status === 'active'));
    } catch (error) {
      console.error("Failed to load purchase details", error);
      alert("Errore nel caricamento dell'acquisto");
    } finally {
      setLoading(false);
    }
  };

  const handleNewItemQuantityChange = (quantityStr: string) => {
    const quantity = parseFloat(quantityStr);
    
    if (isNaN(quantity)) {
        setNewItem(prev => ({ ...prev, quantity: quantityStr, pieces: "" }));
        return;
    }

    let piecesStr = newItem.pieces;
    if (newItem.coefficient && newItem.coefficient !== 1) {
        piecesStr = (quantity / newItem.coefficient).toFixed(2);
    } else {
        // If coefficient is 1, pieces = quantity
        piecesStr = quantity.toString();
    }

    setNewItem(prev => ({ 
        ...prev, 
        quantity: quantityStr, 
        pieces: piecesStr 
    }));
  };

  const handleNewItemPiecesChange = (piecesStr: string) => {
    const pieces = parseFloat(piecesStr);
    
    if (isNaN(pieces)) {
        setNewItem(prev => ({ ...prev, pieces: piecesStr, quantity: "" }));
        return;
    }

    const quantity = (pieces * newItem.coefficient).toFixed(2);
    setNewItem(prev => ({ 
        ...prev, 
        pieces: piecesStr, 
        quantity: quantity 
    }));
  };

  const handleAddItem = async () => {
    if (!newItem.itemId || !newItem.quantity) {
      alert("Compila i campi obbligatori (Articolo, Quantità)");
      return;
    }

    if (newItem.isJob && !newItem.jobId) {
      alert("Seleziona una commessa");
      return;
    }

    try {
      setAddingItem(true);
      const priceVal = newItem.price ? parseFloat(newItem.price) : 0;
      const piecesVal = newItem.pieces ? parseFloat(newItem.pieces) : undefined;
      
      await purchasesApi.addItem({
        purchaseId: id,
        itemId: newItem.itemId,
        quantity: parseFloat(newItem.quantity),
        pieces: piecesVal,
        coefficient: newItem.coefficient,
        price: priceVal,
        jobId: newItem.isJob ? newItem.jobId : undefined
      });

      // Reload items
      const updatedItems = await purchasesApi.getItems(id);
      setItems(updatedItems);

      // Reset form
      setNewItem({
        itemId: "",
        quantity: "",
        pieces: "",
        coefficient: 1,
        price: "",
        isJob: false,
        jobId: ""
      });
    } catch (error) {
      console.error("Failed to add item", error);
      alert("Errore durante l'aggiunta dell'articolo");
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa riga?")) return;
    
    try {
      await purchasesApi.deleteItem(itemId);
      setItems(items.filter(i => i.id !== itemId));
    } catch (error) {
      console.error("Failed to delete item", error);
      alert("Errore durante l'eliminazione");
    }
  };

  const startEditing = (item: PurchaseItem) => {
    setEditingItemId(item.id);
    setEditValues({
      price: item.price.toString(),
      quantity: item.quantity.toString(),
      pieces: item.pieces?.toString() || ""
    });
  };

  const handleEditPiecesChange = (piecesStr: string, coefficient: number) => {
    const pieces = parseFloat(piecesStr);
    let quantityStr = editValues.quantity;

    if (!isNaN(pieces)) {
        quantityStr = (pieces * coefficient).toFixed(2);
    }
    
    setEditValues({
        ...editValues,
        pieces: piecesStr,
        quantity: quantityStr
    });
  };

  const handleEditQuantityChange = (quantityStr: string, coefficient: number) => {
    const quantity = parseFloat(quantityStr);
    let piecesStr = editValues.pieces;

    if (!isNaN(quantity)) {
        if (coefficient && coefficient !== 1) {
            piecesStr = (quantity / coefficient).toFixed(2);
        } else {
             // If coefficient is 1, usually pieces = quantity, but let's keep pieces empty or same as qty?
             // In current logic, if coeff=1, pieces is hidden or '-' in some views, but let's set it.
             piecesStr = quantity.toString();
        }
    }
    
    setEditValues({
        ...editValues,
        quantity: quantityStr,
        pieces: piecesStr
    });
  };

  const saveEdit = async (itemId: string, itemCoefficient: number = 1) => {
    try {
        const newPrice = parseFloat(editValues.price);
        const newQty = parseFloat(editValues.quantity);
        const newPieces = editValues.pieces ? parseFloat(editValues.pieces) : undefined;

        if (isNaN(newPrice) || newPrice < 0) {
            alert("Prezzo non valido");
            return;
        }
        
        if (isNaN(newQty) || newQty <= 0) {
            alert("Quantità non valida");
            return;
        }

        await purchasesApi.updateItem(itemId, {
            price: newPrice,
            quantity: newQty,
            pieces: newPieces
        });

        // Update local state
        setItems(items.map(i => i.id === itemId ? { ...i, price: newPrice, quantity: newQty, pieces: newPieces } : i));
        setEditingItemId(null);
    } catch (error) {
        console.error("Failed to update item", error);
        alert("Errore durante l'aggiornamento");
    }
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  if (loading) {
    return (
        <DashboardLayout>
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        </DashboardLayout>
    );
  }

  if (!purchase) return <DashboardLayout><div>Acquisto non trovato</div></DashboardLayout>;

  const hasMissingPrices = items.some(i => i.price === 0);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-10">
        <div className="mb-6">
          <Link href="/purchases" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna agli Acquisti
          </Link>
          <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Dettaglio Acquisto</h1>
                <p className="text-slate-500">
                    Bolla n. {purchase.deliveryNoteNumber} del {new Date(purchase.deliveryNoteDate).toLocaleDateString()}
                </p>
            </div>
            {hasMissingPrices && (
                <div className="bg-yellow-50 text-yellow-800 px-4 py-2 rounded-md border border-yellow-200 flex items-center shadow-sm animate-pulse">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    <span className="font-medium">Attenzione: Ci sono articoli con prezzo mancante (0.00)</span>
                </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
            {/* Header Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Informazioni Generali</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="text-slate-500">Fornitore</Label>
                        <div className="font-medium text-lg">{purchase.supplierName}</div>
                    </div>
                    <div>
                        <Label className="text-slate-500">Registrato da</Label>
                        <div className="font-medium">{purchase.createdByName || 'N/D'}</div>
                    </div>
                    <div>
                        <Label className="text-slate-500">Numero Bolla</Label>
                        <div className="font-medium">{purchase.deliveryNoteNumber}</div>
                    </div>
                    <div>
                        <Label className="text-slate-500">Data Bolla</Label>
                        <div className="font-medium">{new Date(purchase.deliveryNoteDate).toLocaleDateString()}</div>
                    </div>
                </CardContent>
            </Card>

            {/* Items List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Materiali in Bolla</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Materiale</TableHead>
                                <TableHead className="text-right">Pezzi</TableHead>
                                <TableHead className="text-right">Coeff.</TableHead>
                                <TableHead className="text-right">Q.tà Tot.</TableHead>
                                <TableHead className="text-right">Prezzo Unit.</TableHead>
                                <TableHead className="text-right">Totale Riga</TableHead>
                                <TableHead>Destinazione</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.id} className={item.price === 0 ? "bg-yellow-50/50" : ""}>
                                    <TableCell>
                                        <div className="font-medium">{item.itemName}</div>
                                        <div className="text-xs text-slate-500">{item.itemCode}</div>
                                    </TableCell>
                                    
                                    {/* Editable Fields */}
                                    {editingItemId === item.id ? (
                                        <>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-20 ml-auto text-right h-8" 
                                                    value={editValues.pieces}
                                                    onChange={(e) => handleEditPiecesChange(e.target.value, item.coefficient || 1)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-slate-500">
                                                {item.coefficient || 1}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-20 ml-auto text-right h-8" 
                                                    value={editValues.quantity}
                                                    onChange={(e) => handleEditQuantityChange(e.target.value, item.coefficient || 1)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-24 ml-auto text-right h-8" 
                                                    value={editValues.price}
                                                    step="0.00001"
                                                    onChange={(e) => setEditValues({...editValues, price: e.target.value})}
                                                />
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            <TableCell className="text-right">
                                                {item.pieces || (item.coefficient === 1 || !item.coefficient ? item.quantity : '-')}
                                            </TableCell>
                                            <TableCell className="text-right text-slate-500">
                                                {item.coefficient || 1}
                                            </TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                {item.price === 0 ? (
                                                    <span className="text-red-500 font-bold flex items-center justify-end">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        MANCANTE
                                                    </span>
                                                ) : (
                                                    `€ ${item.price.toFixed(5)}`
                                                )}
                                            </TableCell>
                                        </>
                                    )}

                                    <TableCell className="text-right font-medium">
                                        € {(item.quantity * item.price).toFixed(2)}
                                    </TableCell>
                                    
                                    <TableCell>
                                        {item.jobId ? (
                                            <span className="text-blue-600 font-medium text-sm">
                                                Commessa: {item.jobCode}
                                            </span>
                                        ) : (
                                            <span className="text-green-600 font-medium text-sm">
                                                Magazzino
                                            </span>
                                        )}
                                    </TableCell>
                                    
                                    <TableCell className="text-right">
                                        {editingItemId === item.id ? (
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveEdit(item.id, item.coefficient)}>
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={cancelEdit}>
                                                    X
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => startEditing(item)}
                                                >
                                                    Modifica
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-slate-50 font-bold text-lg">
                                <TableCell colSpan={5} className="text-right">TOTALE BOLLA</TableCell>
                                <TableCell className="text-right">
                                    € {items.reduce((acc, item) => acc + (item.quantity * item.price), 0).toFixed(2)}
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add New Item Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Aggiungi Materiale</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-4 space-y-2">
                                <Label>Materiale</Label>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                        onClick={() => setIsItemSelectorOpen(true)}
                                    >
                                        <Search className="mr-2 h-4 w-4" />
                                        {selectedItemForLine ? (
                                            <span>{selectedItemForLine.name} ({selectedItemForLine.code})</span>
                                        ) : (
                                            <span className="text-muted-foreground">Cerca materiale...</span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="md:col-span-2 space-y-2">
                                <Label>Pezzi</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="1"
                                    value={newItem.pieces}
                                    onChange={(e) => handleNewItemPiecesChange(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">Coeff: {newItem.coefficient || 1}</p>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label>Quantità {newItem.coefficient !== 1 ? '(Calc.)' : ''}</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={newItem.quantity}
                                    onChange={(e) => handleNewItemQuantityChange(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label>Prezzo Unit.</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="md:col-span-2 flex items-center gap-2 pb-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                        id="isJobNew" 
                                        checked={newItem.isJob}
                                        onCheckedChange={(c) => setNewItem({...newItem, isJob: c as boolean})}
                                    />
                                    <Label htmlFor="isJobNew" className="cursor-pointer">Per Commessa?</Label>
                                </div>
                            </div>
                        </div>

                        {newItem.isJob && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label>Seleziona Commessa</Label>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal"
                                        onClick={() => setIsJobSelectorOpen(true)}
                                    >
                                        <Search className="mr-2 h-4 w-4" />
                                        {selectedJobForLine ? (
                                            <span>{selectedJobForLine.code} - {selectedJobForLine.description}</span>
                                        ) : (
                                            <span className="text-muted-foreground">Scegli cantiere...</span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Button 
                            type="button" 
                            onClick={handleAddItem} 
                            disabled={addingItem}
                            className="w-full md:w-auto"
                        >
                            {addingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Aggiungi Riga
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <ItemSelectorDialog
                open={isItemSelectorOpen}
                onOpenChange={setIsItemSelectorOpen}
                onSelect={(item) => {
                    setSelectedItemForLine(item);
                    setNewItem(prev => ({
                        ...prev,
                        itemId: item.id,
                        coefficient: item.coefficient || 1,
                        pieces: "",
                        quantity: "",
                        price: item.price ? item.price.toString() : ""
                    }));
                    setIsItemSelectorOpen(false);
                }}
            />

            <JobSelectorDialog
                open={isJobSelectorOpen}
                onOpenChange={setIsJobSelectorOpen}
                onSelect={(job) => {
                    setSelectedJobForLine(job);
                    setNewItem(prev => ({ ...prev, jobId: job.id }));
                    setIsJobSelectorOpen(false);
                }}
            />
        </div>
      </div>
    </DashboardLayout>
  );
}
