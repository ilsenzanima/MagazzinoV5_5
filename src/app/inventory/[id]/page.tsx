"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Upload, QrCode, Plus, Minus, FileText, AlertTriangle, Copy } from "lucide-react";
import { 
  InventoryItem 
} from "@/lib/mock-data";
import { 
  inventoryApi, 
  movementsApi, 
  jobsApi, 
  brandsApi,
  itemTypesApi,
  unitsApi,
  inventorySupplierCodesApi,
  suppliersApi,
  Movement, 
  Job,
  Brand,
  ItemType,
  Unit,
  InventorySupplierCode,
  Supplier
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Loader2, Pencil, X } from "lucide-react";

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userRole } = useAuth();
  const id = params?.id as string;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stockValue, setStockValue] = useState<number>(0);
  const [isStockValueComplete, setIsStockValueComplete] = useState(true);
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [supplierCodes, setSupplierCodes] = useState<InventorySupplierCode[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplierCode, setNewSupplierCode] = useState({ supplierId: "", code: "", note: "" });
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});

  // Movement Form State
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'load' | 'unload' | 'purchase' | 'entry' | 'exit' | 'sale'>('load');
  const [movementQty, setMovementQty] = useState<string>("");
  const [movementPieces, setMovementPieces] = useState<string>("");
  const [movementRef, setMovementRef] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [movementJob, setMovementJob] = useState("");
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [realQtyInput, setRealQtyInput] = useState<string>("");

  // Helper to handle pieces/quantity change
  const handleMovementPiecesChange = (val: string) => {
      setMovementPieces(val);
      if (!val) {
          setMovementQty("");
          return;
      }
      const p = parseFloat(val);
      if (!isNaN(p) && item) {
          setMovementQty((p * item.coefficient).toFixed(2));
      }
  };

  const handleMovementQtyChange = (val: string) => {
      setMovementQty(val);
      if (!val) {
          setMovementPieces("");
          return;
      }
      const q = parseFloat(val);
      if (!isNaN(q) && item && item.coefficient) {
          setMovementPieces((q / item.coefficient).toFixed(2));
      }
  };

    // Load data
  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      
      // 1. Load Item (Critical)
      try {
        const itemData = await inventoryApi.getById(id);
        setItem(itemData);
        setRealQtyInput(itemData.realQuantity?.toString() || "");
        
        // Unblock UI immediately after item is loaded
        setLoading(false);

        // Calculate Stock Value from Batches
        try {
            const batches = await inventoryApi.getAvailableBatches(id);
            let val = 0;
            let complete = true;
            
            // EXACT CALCULATION based on traced batches
            // We sum the value of all remaining quantities from purchases.
            // This assumes strict traceability (exits must be linked to purchases).
            
            batches.forEach(b => {
                if (b.remainingQty > 0) {
                     if (b.price !== undefined && b.price !== null) {
                        val += b.remainingQty * b.price;
                    } else {
                        complete = false; // Batch without price
                    }
                }
            });
    
            setStockValue(val);
            setIsStockValueComplete(complete);
        } catch (e) {
            console.error("Error calculating stock value", e);
            setIsStockValueComplete(false);
        }

      } catch (err: any) {
        console.error("Error loading item:", err);
        throw new Error(err.message || "Impossibile caricare l'articolo");
      }

      // 2. Load History & Jobs & Aux Data (Non-critical)
      try {
        // Load history first as it is displayed immediately
        const movementsData = await inventoryApi.getHistory(id);
        setMovements(movementsData);

        // Load auxiliary data for forms in background
        const [jobsData, brandsData, typesData, unitsData, supplierCodesData, suppliersData] = await Promise.all([
          jobsApi.getAll(),
          brandsApi.getAll(),
          itemTypesApi.getAll(),
          unitsApi.getAll(),
          inventorySupplierCodesApi.getByItemId(id),
          suppliersApi.getAll()
        ]);
        
        setActiveJobs(jobsData.filter(j => j.status === 'active'));
        setBrands(brandsData);
        setTypes(typesData);
        setUnits(unitsData);
        setSupplierCodes(supplierCodesData);
        setSuppliers(suppliersData);
      } catch (err) {
        console.warn("Error loading auxiliary data:", err);
        // Don't block the page if history fails
      }
      
    } catch (error: any) {
      console.error("Error loading data:", error);
      setError(error.message || "Errore durante il caricamento dei dati");
      setLoading(false); // Ensure loading is disabled on error
    } 
    // finally { setLoading(false); } // Removed finally as we set it earlier
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleEdit = () => {
    if (item) {
        setEditForm({
            name: item.name,
            brand: item.brand,
            type: item.type,
            supplierCode: item.supplierCode,
            minStock: item.minStock,
            unit: item.unit,
            coefficient: item.coefficient,
            description: item.description
        });
        setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!item) return;
    setIsSaving(true);
    try {
        // Validate
        if (!editForm.name || !editForm.brand || !editForm.type) {
            alert("Compila i campi obbligatori (Nome, Marca, Tipo)");
            return;
        }

        if (editForm.coefficient !== undefined && editForm.coefficient <= 0) {
            alert("Il coefficiente deve essere maggiore di 0");
            return;
        }

        if (editForm.minStock !== undefined && editForm.minStock < 0) {
            alert("La scorta minima non può essere negativa");
            return;
        }

        await inventoryApi.update(item.id, {
            ...editForm
        });
        
        // Refresh
        const updatedItem = { ...item, ...editForm };
        setItem(updatedItem as InventoryItem);
        setIsEditing(false);
    } catch (error) {
        console.error("Failed to update item", error);
        alert("Errore durante il salvataggio");
    } finally {
        setIsSaving(false);
    }
  };

  // Handle Delete Item
  const handleDelete = async () => {
    if (!item) return;
    if (confirm("Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.")) {
      try {
        await inventoryApi.delete(item.id);
        router.push('/inventory');
      } catch (error: any) {
        console.error("Failed to delete item", error);
        // Check for foreign key constraint violation (Postgres code 23503)
        if (error?.code === '23503' || error?.message?.includes('foreign key constraint')) {
            alert("Impossibile eliminare: articolo utilizzato in movimenti");
        } else {
            alert("Errore durante l'eliminazione");
        }
      }
    }
  };

  const handleAddSupplierCode = async () => {
      if (!item || !newSupplierCode.code) return;
      try {
          const added = await inventorySupplierCodesApi.create({
              inventoryId: item.id,
              code: newSupplierCode.code,
              supplierId: newSupplierCode.supplierId || undefined,
              note: newSupplierCode.note
          });
          setSupplierCodes([added, ...supplierCodes]);
          setNewSupplierCode({ supplierId: "", code: "", note: "" });
      } catch (error) {
          console.error("Failed to add code", error);
          alert("Errore durante l'aggiunta del codice");
      }
  };

  const handleDeleteSupplierCode = async (codeId: string) => {
      if (!confirm("Eliminare questo codice?")) return;
      try {
          await inventorySupplierCodesApi.delete(codeId);
          setSupplierCodes(supplierCodes.filter(c => c.id !== codeId));
      } catch (error) {
          console.error("Failed to delete code", error);
          alert("Errore durante l'eliminazione");
      }
  };

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && item) {
      try {
        const imageUrl = await inventoryApi.uploadImage(file);
        
        // Update item with new image URL
        await inventoryApi.update(item.id, { image: imageUrl });
        
        // Update local state
        setItem({ ...item, image: imageUrl });
        alert("Immagine caricata con successo!");
      } catch (error) {
        console.error("Image upload failed", error);
        alert("Errore caricamento immagine");
      }
    }
  };

  // Handle Update Real Quantity
  const handleUpdateRealQty = async () => {
    if (!item) return;
    try {
        const val = realQtyInput === "" ? null : parseFloat(realQtyInput);
        await inventoryApi.update(item.id, { realQuantity: val });
        // Refresh item locally
        setItem({ ...item, realQuantity: val });
        // alert("Quantità reale aggiornata"); // Optional feedback
    } catch (error) {
        console.error("Failed to update real quantity", error);
        alert("Errore durante l'aggiornamento");
    }
  };

  // Handle Movement Submit
  const handleMovementSubmit = async () => {
    if (!item) return;
    
    const qtyCheck = parseFloat(movementQty);
    if (isNaN(qtyCheck) || qtyCheck <= 0) {
        alert("La quantità deve essere maggiore di 0");
        return;
    }
    
    if (movementType === 'unload') {
        // Check pieces first (source of truth)
        if (movementPieces && item.pieces !== undefined && parseFloat(movementPieces) > item.pieces) {
            alert(`Non puoi scaricare più pezzi di quelli disponibili (${item.pieces})!`);
            return;
        }
        // Fallback to quantity check
        if (qtyCheck > item.quantity) {
            alert("Non puoi scaricare più quantità di quella disponibile!");
            return;
        }
    }

    try {
        setSubmittingMovement(true);
        
        const piecesVal = parseFloat(movementPieces);
        const qtyVal = qtyCheck;

        if (isNaN(qtyVal) || qtyVal <= 0) {
            alert("Inserire una quantità valida");
            return;
        }

        // 1. Create movement record
        await movementsApi.create({
            itemId: item.id,
            type: movementType,
            quantity: qtyVal,
            pieces: isNaN(piecesVal) ? undefined : piecesVal,
            coefficient: item.coefficient,
            reference: movementRef || "Manuale",
            notes: movementNotes,
            jobId: movementType === 'unload' ? movementJob : undefined
        });

        // 2. Reload data (Trigger will update stock)
        setIsMovementOpen(false);
        setMovementQty("");
        setMovementPieces("");
        setMovementRef("");
        setMovementNotes("");
        setMovementJob("");
        
        // Wait a bit for trigger
        setTimeout(() => loadData(), 500);

    } catch (error) {
        console.error("Error creating movement:", error);
        alert("Errore durante la registrazione del movimento");
    } finally {
        setSubmittingMovement(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <p>Caricamento...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <h2 className="text-2xl font-bold text-slate-900">
            {error ? "Errore di Caricamento" : "Articolo non trovato"}
          </h2>
          {error && (
            <p className="text-red-600 bg-red-50 px-4 py-2 rounded-md max-w-md text-center">
              {error}
            </p>
          )}
          <div className="flex gap-4">
            <Link href="/inventory">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Torna all'Inventario
              </Button>
            </Link>
            {error && (
                <Button onClick={loadData}>
                    Riprova
                </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Logic for Stock Status
  const getStatus = (qty: number, min: number) => {
    if (qty === 0) return { label: "Esaurito", color: "bg-red-100 text-red-700 border-red-200" };
    if (qty <= min) return { label: "Basse Scorte", color: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "Disponibile", color: "bg-green-100 text-green-700 border-green-200" };
  };

  const status = getStatus(item.quantity, item.minStock);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/inventory">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {item.name} {item.model && <span className="font-normal text-slate-500">({item.model})</span>}
              </h1>
              <p className="text-sm text-slate-500 font-mono">{item.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(userRole === 'admin' || userRole === 'operativo') && (
              isEditing ? (
                <>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                        <X className="mr-2 h-4 w-4" /> Annulla
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Salva
                    </Button>
                </>
              ) : (
                <>
                  <Button variant="default" size="sm" onClick={handleEdit}>
                      <Pencil className="mr-2 h-4 w-4" /> Modifica
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                      <Trash2 className="mr-2 h-4 w-4" /> Elimina
                  </Button>
                </>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Image, QR & Status */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Image Section */}
                <div className="aspect-square relative rounded-md overflow-hidden bg-slate-100 border flex items-center justify-center group">
                  <img
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     {(userRole === 'admin' || userRole === 'operativo') && (
                       <Label htmlFor="image-upload" className="cursor-pointer">
                          <div className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 rounded-md flex items-center text-sm font-medium shadow-sm">
                            <Upload className="mr-2 h-4 w-4" /> Cambia Foto
                          </div>
                          <Input 
                              id="image-upload" 
                              type="file" 
                              accept="image/*" 
                              capture="environment"
                              className="hidden" 
                              onChange={handleImageUpload}
                          />
                       </Label>
                     )}
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="space-y-2">
                  <Label>Stato Stock (Calcolato)</Label>
                  <div className={`flex items-center justify-center p-2 rounded-md border font-bold ${status.color}`}>
                    {status.label}
                  </div>
                </div>

                {/* Quantity Read-Only */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantità Disponibile</Label>
                    <div className="flex flex-col gap-2">
                        {/* Calculated Quantity (Main) */}
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-center">
                            <div className="text-2xl font-bold text-blue-700">
                                {item.quantity.toLocaleString('it-IT', { maximumFractionDigits: 2 })} <span className="text-sm font-normal text-blue-500">{item.unit}</span>
                            </div>
                            <div className="text-xs text-blue-400 font-medium">Quantità Totale</div>
                        </div>

                        {/* Stock Value */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-center">
                            <div className="text-2xl font-bold text-slate-700">
                                {stockValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">Valore Stock Attuale</div>
                        </div>
                        
                        {!isStockValueComplete && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs flex items-center gap-2 justify-center">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>Dati costo incompleti (Valore parziale)</span>
                            </div>
                        )}
                        
                        {/* Real Pieces (Secondary) */}
                        {item.coefficient !== 1 && (
                            <div className="text-center">
                                <span className="text-xs text-slate-400">
                                    {item.pieces ?? item.quantity} Pezzi fisici
                                </span>
                            </div>
                        )}
                        {item.coefficient === 1 && (
                             <div className="text-center text-[10px] text-slate-400">
                                 1 {item.unit} = 1 Pezzo
                             </div>
                        )}
                    </div>
                  </div>

                  {/* Audit Section - Visible only to admin/operativo */}
                  {(userRole === 'admin' || userRole === 'operativo') && (
                      <div className="pt-4 border-t space-y-3">
                          <Label className="text-blue-600 font-semibold">Verifica Inventario (Reale)</Label>
                          <div className="flex gap-2">
                              <Input 
                                type="number" 
                                value={realQtyInput}
                                onChange={(e) => setRealQtyInput(e.target.value)}
                                placeholder="Q.tà fisica"
                                className="bg-white"
                              />
                              <Button size="icon" variant="outline" onClick={handleUpdateRealQty} title="Salva quantità reale">
                                  <Save className="h-4 w-4" />
                              </Button>
                          </div>
                          
                          {item.realQuantity !== null && item.realQuantity !== undefined && (
                              <div className={`text-sm p-2 rounded-md flex justify-between items-center ${
                                  (item.realQuantity - item.quantity) === 0 
                                    ? "bg-green-50 text-green-700 border border-green-200" 
                                    : "bg-red-50 text-red-700 border border-red-200"
                              }`}>
                                  <span className="font-medium">Differenza:</span>
                                  <span className="font-bold">
                                      {item.realQuantity - item.quantity > 0 ? "+" : ""}
                                      {(item.realQuantity - item.quantity).toFixed(2).replace(/[.,]00$/, "")} {item.unit}
                                  </span>
                              </div>
                          )}
                          <p className="text-[10px] text-slate-400">
                              Visibile solo a Admin e Operativi. Indica discrepanze tra sistema e realtà.
                          </p>
                      </div>
                  )}
                </div>

                {/* QR Code & Barcode */}
                <div className="pt-4 border-t flex flex-col items-center gap-4">
                  <div className="w-full">
                    <Label className="mb-2 block text-center">Codice Identificativo</Label>
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white p-2 rounded border">
                        <QRCode value={item.code} size={128} />
                      </div>
                      <div className="bg-white p-2 rounded border overflow-hidden max-w-full">
                        <Barcode value={item.code} width={1.5} height={50} fontSize={12} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details Form */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dettagli Articolo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Codice Articolo</Label>
                    <Input id="code" value={item.code} readOnly className="bg-slate-50 text-slate-500" />
                    <p className="text-[10px] text-slate-400">Generato Automaticamente</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    {isEditing ? (
                        <Select 
                            value={editForm.brand} 
                            onValueChange={(val) => setEditForm({...editForm, brand: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona marca" />
                            </SelectTrigger>
                            <SelectContent>
                                {brands.map((b) => (
                                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input id="brand" value={item.brand} readOnly className="bg-slate-50" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierCode">Codice Fornitore Principale</Label>
                  {isEditing ? (
                      <Input 
                          id="supplierCode" 
                          value={editForm.supplierCode || ""} 
                          onChange={(e) => setEditForm({...editForm, supplierCode: e.target.value})} 
                          placeholder="Codice Fornitore (Opzionale)"
                      />
                  ) : (
                      item.supplierCode ? (
                          <Input id="supplierCode" value={item.supplierCode} readOnly className="bg-slate-50" />
                      ) : (
                          <p className="text-sm text-slate-400 italic py-2">Nessun codice fornitore specificato</p>
                      )
                  )}
                </div>

                {/* Additional Supplier Codes */}
                {!isEditing && (
                    <div className="space-y-2 pt-2 border-t">
                        <Label>Altri Codici Fornitore</Label>
                        <div className="space-y-2">
                            {supplierCodes.map(code => (
                                <div key={code.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-bold">{code.code}</span>
                                        {code.supplierName && <span className="text-xs text-slate-500">{code.supplierName}</span>}
                                    </div>
                                    {(userRole === 'admin' || userRole === 'operativo') && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteSupplierCode(code.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {(userRole === 'admin' || userRole === 'operativo') && (
                                <div className="flex gap-2 items-end pt-2">
                                    <div className="flex-1 space-y-1">
                                        <Input 
                                            placeholder="Nuovo codice" 
                                            value={newSupplierCode.code} 
                                            onChange={(e) => setNewSupplierCode({...newSupplierCode, code: e.target.value})}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="w-1/3 space-y-1">
                                         <Select 
                                            value={newSupplierCode.supplierId} 
                                            onValueChange={(val) => setNewSupplierCode({...newSupplierCode, supplierId: val})}
                                        >
                                            <SelectTrigger className="h-8 text-sm">
                                                <SelectValue placeholder="Fornitore" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map(s => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button size="sm" onClick={handleAddSupplierCode} disabled={!newSupplierCode.code} className="h-8">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Prodotto</Label>
                  {isEditing ? (
                      <Input 
                          id="name" 
                          value={editForm.name || ""} 
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                      />
                  ) : (
                      <Input id="name" value={item.name} readOnly className="bg-slate-50" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="model">Modello / Variante</Label>
                    {!isEditing && (
                      <Link href={`/inventory/new?cloneId=${item.id}`} title="Crea variante da questo articolo">
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2">
                          <Copy className="h-3 w-3 mr-1" />
                          Crea Variante
                        </Button>
                      </Link>
                    )}
                  </div>
                  {isEditing ? (
                      <Input 
                          id="model" 
                          placeholder="Es. 10mm, DN 50..."
                          value={editForm.model || ""} 
                          onChange={(e) => setEditForm({...editForm, model: e.target.value})} 
                      />
                  ) : (
                      <Input id="model" value={item.model || ""} readOnly className="bg-slate-50" placeholder="-" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipologia</Label>
                    {isEditing ? (
                        <Select 
                            value={editForm.type} 
                            onValueChange={(val) => setEditForm({...editForm, type: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {types.map((t) => (
                                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input id="type" value={item.type} readOnly className="bg-slate-50" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Scorta Minima</Label>
                    {isEditing ? (
                        <Input 
                            id="minStock" 
                            type="number" 
                            step="0.01"
                            value={editForm.minStock || 0} 
                            onChange={(e) => setEditForm({...editForm, minStock: parseFloat(e.target.value)})} 
                        />
                    ) : (
                        <Input id="minStock" type="number" step="0.01" value={item.minStock} readOnly className="bg-slate-50" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="unit">Unità di Misura</Label>
                    {isEditing ? (
                        <Select 
                            value={editForm.unit} 
                            onValueChange={(val) => setEditForm({...editForm, unit: val})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona unità" />
                            </SelectTrigger>
                            <SelectContent>
                                {units.map((u) => (
                                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input id="unit" value={item.unit} readOnly className="bg-slate-50" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficient">Coeff. Moltiplicazione</Label>
                    {isEditing ? (
                        <div className="space-y-1">
                            <Input 
                                id="coefficient" 
                                type="number" 
                                step="0.01" 
                                value={editForm.coefficient || 1} 
                                onChange={(e) => setEditForm({...editForm, coefficient: parseFloat(e.target.value)})} 
                                disabled={userRole !== 'admin'}
                                className={userRole !== 'admin' ? "bg-slate-100" : ""}
                            />
                            {userRole !== 'admin' && (
                                <p className="text-[10px] text-red-400">Modificabile solo da Admin</p>
                            )}
                        </div>
                    ) : (
                        <Input id="coefficient" type="number" step="0.01" value={item.coefficient} readOnly className="bg-slate-50" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione</Label>
                  {isEditing ? (
                      <Textarea 
                        id="description" 
                        value={editForm.description || ""} 
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})} 
                        className="min-h-[100px]"
                      />
                  ) : (
                      <Textarea 
                        id="description" 
                        value={item.description} 
                        readOnly
                        className="min-h-[100px] bg-slate-50"
                      />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Movements Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Storico Movimenti</CardTitle>
                {(userRole === 'admin' || userRole === 'operativo') && (
                  <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="bg-blue-600">
                            <Plus className="mr-2 h-4 w-4" /> Nuovo Movimento
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registra Movimento</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Tipo Movimento</Label>
                                <div className="flex gap-2">
                                    <Button 
                                        type="button" 
                                        variant={movementType === 'load' ? 'default' : 'outline'}
                                        className={movementType === 'load' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'flex-1'}
                                        onClick={() => setMovementType('load')}
                                    >
                                        <Plus className="mr-2 h-4 w-4" /> Carico (Entrata)
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant={movementType === 'unload' ? 'default' : 'outline'}
                                        className={movementType === 'unload' ? 'bg-red-600 hover:bg-red-700 flex-1' : 'flex-1'}
                                        onClick={() => setMovementType('unload')}
                                    >
                                        <Minus className="mr-2 h-4 w-4" /> Scarico (Uscita)
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pieces">Pezzi</Label>
                                    <Input 
                                        id="pieces" 
                                        type="number" 
                                        min="0"
                                        step="0.01"
                                        value={movementPieces}
                                        onChange={(e) => handleMovementPiecesChange(e.target.value)}
                                        placeholder="Pezzi"
                                    />
                                    {item.coefficient !== 1 && <span className="text-xs text-muted-foreground">Coeff: {item.coefficient}</span>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="qty">Quantità ({item.unit})</Label>
                                    <Input 
                                        id="qty" 
                                        type="number" 
                                        min="0"
                                        step="0.01" 
                                        value={movementQty}
                                        onChange={(e) => handleMovementQtyChange(e.target.value)}
                                        placeholder="Quantità"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ref">Riferimento (Bolla / Ordine)</Label>
                                <Input 
                                    id="ref" 
                                    placeholder="Es. BOL-2024-001"
                                    value={movementRef}
                                    onChange={(e) => setMovementRef(e.target.value)}
                                />
                            </div>

                            {/* Show Job selection ONLY for Unload or if desired for Load too, but typically Unload */}
                            <div className="space-y-2">
                                <Label htmlFor="job">Commessa (Opzionale)</Label>
                                <Select value={movementJob} onValueChange={setMovementJob}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona Commessa..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Nessuna Commessa</SelectItem>
                                        {activeJobs.map((job) => (
                                            <SelectItem key={job.id} value={job.id}>
                                                {job.code} - {job.description}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Note</Label>
                                <Textarea 
                                    id="notes" 
                                    placeholder="Note aggiuntive..."
                                    value={movementNotes}
                                    onChange={(e) => setMovementNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsMovementOpen(false)}>Annulla</Button>
                            <Button onClick={handleMovementSubmit} disabled={submittingMovement}>
                                {submittingMovement ? "Salvataggio..." : "Registra"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Riferimento</TableHead>
                      <TableHead>Commessa</TableHead>
                      <TableHead>Pezzi</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-400 py-6">
                          Nessun movimento registrato
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((move) => {
                        const isPositive = move.quantity > 0;
                        let typeLabel: string = move.type;
                        let typeColor: string = "bg-slate-500";
                        
                        switch(move.type) {
                            case 'purchase': 
                                typeLabel = "Acquisto"; 
                                typeColor = "bg-blue-600"; 
                                if (move.jobId) {
                                    typeLabel = "Acquisto (Cantiere)";
                                    typeColor = "bg-purple-600";
                                }
                                break;
                            case 'entry': 
                                typeLabel = "Entrata"; 
                                typeColor = "bg-green-600"; 
                                break;
                            case 'load': 
                                typeLabel = "Carico"; 
                                typeColor = "bg-green-600"; 
                                break;
                            case 'exit': 
                                typeLabel = "Uscita"; 
                                typeColor = "bg-red-600"; 
                                break;
                            case 'unload': 
                                typeLabel = "Scarico"; 
                                typeColor = "bg-red-600"; 
                                break;
                            case 'sale': 
                                typeLabel = "Vendita"; 
                                typeColor = "bg-red-600"; 
                                break;
                            default: 
                                typeLabel = move.type; 
                                typeColor = "bg-slate-500"; 
                                break;
                        }

                        if (move.isFictitious) {
                           typeColor = "bg-orange-500";
                        }

                        return (
                            <TableRow key={move.id} className={move.isFictitious ? "bg-orange-50/50" : ""}>
                              <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">
                                        {new Date(move.date).toLocaleDateString('it-IT')}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(move.date).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                    <Badge className={`${typeColor} hover:${typeColor}`}>
                                        {typeLabel}
                                    </Badge>
                                    {move.isFictitious && (
                                        <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50 text-[10px] h-5 px-1">
                                            Fittizio
                                        </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-sm">{move.reference}</div>
                                {move.notes && <div className="text-xs text-slate-500 max-w-[200px] truncate" title={move.notes}>{move.notes}</div>}
                              </TableCell>
                              <TableCell>
                                {move.jobCode ? (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-blue-600">{move.jobCode}</span>
                                        <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={move.jobDescription}>
                                            {move.jobDescription}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {move.pieces ? (
                                    <span className="font-mono">{move.pieces}</span>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold font-mono ${isPositive ? "text-green-600" : "text-red-600"}`}>
                                    {isPositive ? "+" : ""}{move.quantity.toFixed(2)}
                                </span>
                              </TableCell>
                            </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
