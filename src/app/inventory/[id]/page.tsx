"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Upload, QrCode, Plus, Minus, FileText } from "lucide-react";
import { 
  InventoryItem 
} from "@/lib/mock-data";
import { 
  inventoryApi, 
  movementsApi, 
  jobsApi, 
  Movement, 
  Job 
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

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userRole } = useAuth();
  const id = params?.id as string;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  
  // Movement Form State
  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'load' | 'unload' | 'purchase' | 'entry' | 'exit' | 'sale'>('load');
  const [movementQty, setMovementQty] = useState(1);
  const [movementRef, setMovementRef] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [movementJob, setMovementJob] = useState("");
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [realQtyInput, setRealQtyInput] = useState<string>("");

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
      } catch (err: any) {
        console.error("Error loading item:", err);
        throw new Error(err.message || "Impossibile caricare l'articolo");
      }

      // 2. Load History & Jobs (Non-critical)
      try {
        const [movementsData, jobsData] = await Promise.all([
          inventoryApi.getHistory(id),
          jobsApi.getAll()
        ]);
        setMovements(movementsData);
        setActiveJobs(jobsData.filter(j => j.status === 'active'));
      } catch (err) {
        console.warn("Error loading auxiliary data:", err);
        // Don't block the page if history fails
      }
      
    } catch (error: any) {
      console.error("Error loading data:", error);
      setError(error.message || "Errore durante il caricamento dei dati");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Handle Delete Item
  const handleDelete = async () => {
    if (confirm("Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.")) {
      try {
        await inventoryApi.delete(id);
        router.push("/inventory");
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("Errore durante l'eliminazione");
      }
    }
  };

  // Handle Image Upload (Mock for now, as we don't have storage set up yet)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (item) {
            // In a real app, upload to Supabase Storage here
            // setItem({ ...item, image: reader.result as string });
            alert("Upload immagini non ancora configurato (richiede Supabase Storage)");
        }
      };
      reader.readAsDataURL(file);
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
    
    if (movementQty <= 0) {
        alert("La quantità deve essere maggiore di 0");
        return;
    }
    
    if (movementType === 'unload' && movementQty > item.quantity) {
        alert("Non puoi scaricare più quantità di quella disponibile!");
        return;
    }

    try {
        setSubmittingMovement(true);
        
        // 1. Create movement
        await movementsApi.create({
            itemId: item.id,
            type: movementType,
            quantity: movementQty,
            reference: movementRef,
            notes: movementNotes,
            jobId: movementType === 'unload' ? movementJob : undefined // Link job only on unload usually
        });

        // 2. Update item quantity locally and in DB
        const newQty = movementType === 'load' 
            ? item.quantity + movementQty 
            : item.quantity - movementQty;
            
        await inventoryApi.update(item.id, { ...item, quantity: newQty });

        // 3. Reset form and reload
        setIsMovementOpen(false);
        setMovementQty(1);
        setMovementRef("");
        setMovementNotes("");
        setMovementJob("");
        loadData(); // Reload all data to ensure sync

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
                {item.name}
              </h1>
              <p className="text-sm text-slate-500 font-mono">{item.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Elimina
            </Button>
            {/* Note: Save button logic would go here if we had editable fields outside of movements */}
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
                    <Label>Quantità Teorica (Sistema)</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 bg-slate-50 border rounded-md text-center">
                            <div className="text-lg font-bold text-slate-900">{item.quantity}</div>
                            <div className="text-xs text-slate-500 font-medium">{item.unit}</div>
                        </div>
                        {item.coefficient !== 1 && (
                            <div className="p-3 bg-slate-50 border rounded-md text-center">
                                <div className="text-lg font-bold text-slate-900">
                                    {(item.quantity * item.coefficient).toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">Moltiplicato (x{item.coefficient})</div>
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
                    <Input id="brand" value={item.brand} readOnly className="bg-slate-50" />
                  </div>
                </div>

                {item.supplierCode && (
                  <div className="space-y-2">
                    <Label htmlFor="supplierCode">Codice Fornitore</Label>
                    <Input id="supplierCode" value={item.supplierCode} readOnly className="bg-slate-50" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Prodotto</Label>
                  <Input id="name" value={item.name} readOnly className="bg-slate-50" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipologia</Label>
                    <Input id="type" value={item.type} readOnly className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Scorta Minima</Label>
                    <Input id="minStock" type="number" value={item.minStock} readOnly className="bg-slate-50" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="unit">Unità di Misura</Label>
                    <Input id="unit" value={item.unit} readOnly className="bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficient">Coeff. Moltiplicazione</Label>
                    <Input id="coefficient" type="number" step="0.01" value={item.coefficient} readOnly className="bg-slate-50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea 
                    id="description" 
                    value={item.description} 
                    readOnly
                    className="min-h-[100px] bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Movements Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Storico Movimenti</CardTitle>
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

                            <div className="space-y-2">
                                <Label htmlFor="qty">Quantità ({item.unit})</Label>
                                <Input 
                                    id="qty" 
                                    type="number" 
                                    min="1" 
                                    value={movementQty}
                                    onChange={(e) => setMovementQty(parseInt(e.target.value) || 0)}
                                />
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
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Riferimento</TableHead>
                      <TableHead>Pezzi</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-400 py-6">
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
                                        <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 text-[10px]">
                                            FITTIZIO
                                        </Badge>
                                    )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                   <span className="font-medium text-slate-700">{move.reference || "-"}</span>
                                   {move.userName && <span className="text-[10px] text-slate-400">Utente: {move.userName}</span>}
                                   {move.isFictitious && (
                                        <span className="text-[10px] text-orange-500 italic">
                                            Non movimenta il magazzino
                                        </span>
                                   )}
                                   {move.notes && <span className="text-xs text-slate-500 truncate max-w-[200px]">{move.notes}</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                {move.pieces ? (
                                    <span className="text-xs font-mono">
                                        {move.pieces} pz 
                                        {move.coefficient && move.coefficient !== 1 && (
                                            <span className="text-slate-400"> (x{move.coefficient})</span>
                                        )}
                                    </span>
                                ) : "-"}
                              </TableCell>
                              <TableCell className={`text-right font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? '+' : ''}{move.quantity} {item.unit}
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
