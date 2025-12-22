"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Loader2, Save, ArrowDownRight, ArrowUpRight, ShoppingBag, FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  inventoryApi, 
  deliveryNotesApi, 
  InventoryItem, 
  DeliveryNote,
  DeliveryNoteItem
} from "@/lib/api";

export default function MovementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [movement, setMovement] = useState<DeliveryNote | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState<Partial<DeliveryNote>>({});
  
  // Items State (for local manipulation before save)
  const [items, setItems] = useState<DeliveryNoteItem[]>([]);
  
  // Add Item State
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    inventoryId: "",
    quantity: "",
    pieces: "",
    coefficient: 1,
    price: ""
  });

  useEffect(() => {
    if (id) {
        loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [movementData, inventoryData] = await Promise.all([
        deliveryNotesApi.getById(id),
        inventoryApi.getAll()
      ]);
      
      setMovement(movementData);
      setItems(movementData.items || []);
      setInventory(inventoryData);
    } catch (error) {
      console.error("Failed to load movement details", error);
      alert("Errore nel caricamento del movimento");
    } finally {
      setLoading(false);
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
        case 'entry':
            return { label: 'Entrata', color: 'bg-green-100 text-green-700', icon: ArrowDownRight };
        case 'exit':
            return { label: 'Uscita', color: 'bg-amber-100 text-amber-700', icon: ArrowUpRight };
        case 'sale':
            return { label: 'Vendita', color: 'bg-blue-100 text-blue-700', icon: ShoppingBag };
        default:
            return { label: type, color: 'bg-slate-100 text-slate-700', icon: FileText };
    }
  };

  const handleAddItem = () => {
    if (!newItem.inventoryId || !newItem.quantity) {
      alert("Seleziona materiale e quantità");
      return;
    }

    const selectedInventory = inventory.find(i => i.id === newItem.inventoryId);
    if (!selectedInventory) return;

    const newItemObj: DeliveryNoteItem = {
      id: `temp-${Date.now()}`, // Temp ID
      deliveryNoteId: id,
      inventoryId: newItem.inventoryId,
      inventoryName: selectedInventory.name,
      inventoryCode: selectedInventory.code,
      inventoryUnit: selectedInventory.unit,
      quantity: parseFloat(newItem.quantity),
      pieces: newItem.pieces ? parseFloat(newItem.pieces) : undefined,
      coefficient: newItem.coefficient,
      price: newItem.price ? parseFloat(newItem.price) : 0
    };

    setItems([...items, newItemObj]);
    setNewItem({
      inventoryId: "",
      quantity: "",
      pieces: "",
      coefficient: 1,
      price: ""
    });
    setIsEditing(true); // Mark as editing so user has to save
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
    setIsEditing(true);
  };

  const handleSaveChanges = async () => {
    if (!movement) return;
    
    try {
        setLoading(true);
        // Prepare items for API (remove temp fields if any, strictly match interface)
        const itemsToSave = items.map(item => ({
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            price: item.price
        }));

        await deliveryNotesApi.update(id, editNote, itemsToSave);
        
        alert("Modifiche salvate con successo!");
        setIsEditing(false);
        loadData(); // Reload to get fresh state
    } catch (error) {
        console.error("Failed to save changes", error);
        alert("Errore nel salvataggio");
        setLoading(false);
    }
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

  if (!movement) return <DashboardLayout><div>Movimento non trovato</div></DashboardLayout>;

  const typeConfig = getTypeConfig(movement.type);
  const TypeIcon = typeConfig.icon;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-10">
        <div className="mb-6">
          <Link href="/movements" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna ai Movimenti
          </Link>
          <div className="flex justify-between items-start">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-slate-900">Dettaglio Movimento</h1>
                    <Badge variant="secondary" className={typeConfig.color}>
                        <TypeIcon className="mr-1 h-3 w-3" />
                        {typeConfig.label}
                    </Badge>
                </div>
                <p className="text-slate-500">
                    Bolla n. {movement.number} del {format(new Date(movement.date), 'dd MMMM yyyy', { locale: it })}
                </p>
            </div>
            {isEditing && (
                <Button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700">
                    <Save className="mr-2 h-4 w-4" />
                    Salva Modifiche
                </Button>
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
                        <Label className="text-slate-500">Causale</Label>
                        <div className="font-medium">{movement.causal}</div>
                    </div>
                    {movement.jobCode && (
                        <div>
                            <Label className="text-slate-500">Commessa</Label>
                            <div className="font-medium text-blue-600">{movement.jobCode}</div>
                        </div>
                    )}
                    <div>
                        <Label className="text-slate-500">Luogo Ritiro</Label>
                        <div className="font-medium">{movement.pickupLocation}</div>
                    </div>
                    <div>
                        <Label className="text-slate-500">Luogo Consegna</Label>
                        <div className="font-medium">{movement.deliveryLocation}</div>
                    </div>
                    {movement.transportMean && (
                        <div>
                            <Label className="text-slate-500">Mezzo di Trasporto</Label>
                            <div className="font-medium">{movement.transportMean}</div>
                        </div>
                    )}
                    {movement.notes && (
                        <div className="md:col-span-2">
                            <Label className="text-slate-500">Note</Label>
                            <div className="font-medium">{movement.notes}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Items List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Articoli</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Articolo</TableHead>
                                <TableHead className="text-right">Pezzi</TableHead>
                                <TableHead className="text-right">Coeff.</TableHead>
                                <TableHead className="text-right">Quantità</TableHead>
                                <TableHead className="text-right">Prezzo</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.inventoryName}</div>
                                        <div className="text-xs text-slate-500">{item.inventoryCode}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.pieces || (item.coefficient === 1 ? '-' : '')}
                                    </TableCell>
                                    <TableCell className="text-right text-slate-500">
                                        {item.coefficient !== 1 ? item.coefficient : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {item.quantity} {item.inventoryUnit}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.price ? `€ ${item.price.toFixed(2)}` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                                        Nessun articolo inserito
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add New Item Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Aggiungi Articolo</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-4 space-y-2">
                                <Label>Materiale</Label>
                                <Select 
                                    value={newItem.inventoryId} 
                                    onValueChange={(v) => {
                                        const selectedItem = inventory.find(i => i.id === v);
                                        const coeff = selectedItem?.coefficient || 1;
                                        setNewItem({...newItem, inventoryId: v, coefficient: coeff, pieces: "", quantity: ""});
                                    }}
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
                            
                            {newItem.coefficient !== 1 && (
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Pezzi</Label>
                                    <Input 
                                        type="number" 
                                        min="0"
                                        step="1"
                                        value={newItem.pieces}
                                        onChange={(e) => {
                                            const p = e.target.value;
                                            const q = p ? (parseFloat(p) * newItem.coefficient).toFixed(2) : "";
                                            setNewItem({...newItem, pieces: p, quantity: q});
                                        }}
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-muted-foreground">Coeff: {newItem.coefficient}</p>
                                </div>
                            )}

                            <div className="md:col-span-2 space-y-2">
                                <Label>Quantità {newItem.coefficient !== 1 ? '(Calc.)' : ''}</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={newItem.quantity}
                                    readOnly={newItem.coefficient !== 1}
                                    onChange={(e) => setNewItem({...newItem, quantity: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label>Prezzo {movement.type === 'sale' ? '(Vendita)' : '(Opz.)'}</Label>
                                <Input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    value={newItem.price}
                                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Button 
                                    type="button" 
                                    onClick={handleAddItem} 
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Aggiungi
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
