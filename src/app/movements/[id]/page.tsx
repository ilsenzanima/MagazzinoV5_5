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
import { useState, useEffect, useMemo } from "react";
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from "@/components/auth-provider";

export default function MovementDetailPage() {
  const { userRole } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [movement, setMovement] = useState<DeliveryNote | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DeliveryNote>>({});
  
  // Items State (for local manipulation before save)
  const [items, setItems] = useState<DeliveryNoteItem[]>([]);

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
      
      // Initialize edit form
      setEditForm({
          number: movementData.number,
          date: movementData.date,
          notes: movementData.notes,
          pickupLocation: movementData.pickupLocation,
          deliveryLocation: movementData.deliveryLocation,
          transportMean: movementData.transportMean,
          transportTime: movementData.transportTime,
          appearance: movementData.appearance,
          packagesCount: movementData.packagesCount,
          causal: movementData.causal
      });
    } catch (error) {
      console.error("Failed to load movement details", error);
      alert("Errore nel caricamento del movimento");
    } finally {
      setLoading(false);
    }
  };

  // Group items by inventory ID for display
  const groupedItems = useMemo(() => {
    const grouped = new Map<string, DeliveryNoteItem>();
    
    items.forEach(item => {
        // Use inventoryId as key to group identical products
        const key = item.inventoryId;
        
        if (grouped.has(key)) {
            const existing = grouped.get(key)!;
            grouped.set(key, {
                ...existing,
                quantity: existing.quantity + item.quantity,
                // Don't sum coefficients or prices, keep the first one found or average? 
                // For display purposes, keeping the static data of the first entry is usually enough 
                // unless we want weighted average. 
                // Since user asked to group identical items, we sum quantities.
            });
        } else {
            grouped.set(key, { ...item });
        }
    });
    
    return Array.from(grouped.values());
  }, [items]);

  const handlePrint = () => {
    if (!movement) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("DOCUMENTO DI TRASPORTO (D.D.T.)", 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Numero: ${movement.number}`, 14, 25);
    doc.text(`Data: ${format(new Date(movement.date), 'dd/MM/yyyy')}`, 14, 30);
    
    // Locations
    doc.setLineWidth(0.1);
    doc.rect(14, 35, 90, 25);
    doc.text("Luogo di Ritiro:", 16, 40);
    doc.setFontSize(9);
    doc.text(movement.pickupLocation || "-", 16, 45, { maxWidth: 86 });

    doc.setFontSize(10);
    doc.rect(110, 35, 90, 25);
    doc.text("Luogo di Destinazione:", 112, 40);
    doc.setFontSize(9);
    doc.text(movement.deliveryLocation || "-", 112, 45, { maxWidth: 86 });

    // Transport Details
    doc.setFontSize(10);
    doc.text(`Causale: ${movement.causal || "-"}`, 14, 68);
    doc.text(`Mezzo: ${movement.transportMean || "-"}`, 14, 73);
    doc.text(`Colli: ${movement.packagesCount || "-"}`, 110, 68);
    doc.text(`Aspetto: ${movement.appearance || "-"}`, 110, 73);
    
    // Table
    const tableBody = groupedItems.map(item => [
        item.inventoryCode || "-",
        item.inventoryName || "Articolo non trovato",
        item.inventoryUnit || "PZ",
        item.quantity.toString(),
        "" // Notes not available on item level
    ]);

    autoTable(doc, {
        startY: 80,
        head: [['Codice', 'Descrizione', 'U.M.', 'Q.tà', 'Note']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 80;
    
    if (movement.notes) {
        doc.text("Note:", 14, finalY + 10);
        doc.setFontSize(9);
        doc.text(movement.notes, 14, finalY + 15, { maxWidth: 180 });
    }

    // Signatures
    doc.line(14, 270, 70, 270);
    doc.text("Firma Conducente", 14, 275);
    
    doc.line(80, 270, 136, 270);
    doc.text("Firma Destinatario", 80, 275);
    
    doc.line(146, 270, 202, 270);
    doc.text("Firma Trasportatore", 146, 275);

    doc.save(`DDT_${movement.number.replace(/\//g, '-')}.pdf`);
  };

  const handleSaveChanges = async () => {
    if (!movement) return;
    
    try {
        setLoading(true);
        // Only update header fields
        await deliveryNotesApi.update(id, editForm); // Pass items only if you want to replace them, here we don't
        
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
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!movement) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900">Movimento non trovato</h2>
          <Link href="/movements" className="mt-4 inline-block text-blue-600 hover:underline">
            Torna alla lista
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/movements">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                {movement.type === 'entry' && <ArrowDownRight className="h-6 w-6 text-green-600" />}
                {movement.type === 'exit' && <ArrowUpRight className="h-6 w-6 text-orange-600" />}
                {movement.type === 'sale' && <ShoppingBag className="h-6 w-6 text-blue-600" />}
                DDT {movement.number}
              </h1>
              <p className="text-sm text-slate-500">
                Data: {format(new Date(movement.date), 'dd MMMM yyyy', { locale: it })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
                <>
                <Button variant="outline" onClick={handlePrint}>
                    <FileText className="h-4 w-4 mr-2" />
                    Stampa PDF
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                    Modifica Testata
                </Button>
                </>
            ) : (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Annulla
                    </Button>
                    <Button onClick={handleSaveChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Salva Modifiche
                    </Button>
                </div>
            )}
          </div>
        </div>

        {/* Details Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-500">Dettagli Documento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isEditing ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Numero</Label>
                                    <Input 
                                        value={editForm.number} 
                                        onChange={e => setEditForm({...editForm, number: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>Data</Label>
                                    <Input 
                                        type="date"
                                        value={editForm.date ? editForm.date.split('T')[0] : ''} 
                                        onChange={e => setEditForm({...editForm, date: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Causale</Label>
                                <Input 
                                    value={editForm.causal} 
                                    onChange={e => setEditForm({...editForm, causal: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Colli</Label>
                                    <Input 
                                        type="number"
                                        value={editForm.packagesCount} 
                                        onChange={e => setEditForm({...editForm, packagesCount: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                                <div>
                                    <Label>Aspetto</Label>
                                    <Input 
                                        value={editForm.appearance} 
                                        onChange={e => setEditForm({...editForm, appearance: e.target.value})}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-slate-500">Numero</Label>
                                    <div className="font-medium text-lg">{movement.number}</div>
                                </div>
                                <div>
                                    <Label className="text-slate-500">Data</Label>
                                    <div className="font-medium text-lg">
                                        {format(new Date(movement.date), 'dd/MM/yyyy')}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-slate-500">Causale</Label>
                                <div className="font-medium">{movement.causal}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-slate-500">Colli</Label>
                                    <div className="font-medium">{movement.packagesCount}</div>
                                </div>
                                <div>
                                    <Label className="text-slate-500">Aspetto</Label>
                                    <div className="font-medium">{movement.appearance}</div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-500">Trasporto e Destinazione</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isEditing ? (
                        <>
                             <div>
                                <Label>Luogo Ritiro</Label>
                                <Input 
                                    value={editForm.pickupLocation} 
                                    onChange={e => setEditForm({...editForm, pickupLocation: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label>Luogo Consegna</Label>
                                <Input 
                                    value={editForm.deliveryLocation} 
                                    onChange={e => setEditForm({...editForm, deliveryLocation: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Mezzo</Label>
                                    <Input 
                                        value={editForm.transportMean} 
                                        onChange={e => setEditForm({...editForm, transportMean: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label>Note</Label>
                                    <Input 
                                        value={editForm.notes} 
                                        onChange={e => setEditForm({...editForm, notes: e.target.value})}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <Label className="text-slate-500">Luogo Ritiro</Label>
                                <div className="font-medium">{movement.pickupLocation}</div>
                            </div>
                            <div>
                                <Label className="text-slate-500">Luogo Consegna</Label>
                                <div className="font-medium">{movement.deliveryLocation}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-slate-500">Mezzo</Label>
                                    <div className="font-medium">{movement.transportMean || "-"}</div>
                                </div>
                                <div>
                                    <Label className="text-slate-500">Note</Label>
                                    <div className="font-medium">{movement.notes || "-"}</div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>

            {/* Items List - Read Only */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Articoli (Sola Lettura)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Codice</TableHead>
                                <TableHead>Articolo</TableHead>
                                <TableHead>U.M.</TableHead>
                                <TableHead className="text-right">Q.tà</TableHead>
                                <TableHead className="text-right">Coeff.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        Nessun articolo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groupedItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-sm">{item.inventoryCode}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.inventoryName}</div>
                                            <div className="text-xs text-slate-500">{item.inventoryBrand}</div>
                                        </TableCell>
                                        <TableCell>{item.inventoryUnit}</TableCell>
                                        <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{item.coefficient}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
      </div>
    </DashboardLayout>
  );
}
