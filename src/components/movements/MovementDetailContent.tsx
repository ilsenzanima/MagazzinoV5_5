"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Loader2, Save, ArrowDownRight, ArrowUpRight, ShoppingBag, FileText, Calendar, Search } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  inventoryApi, 
  deliveryNotesApi, 
  InventoryItem, 
  DeliveryNote,
  DeliveryNoteItem
} from "@/lib/api";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from "@/components/auth-provider";

interface MovementDetailContentProps {
  initialMovement: DeliveryNote;
}

export default function MovementDetailContent({ initialMovement }: MovementDetailContentProps) {
  const { userRole } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [movement, setMovement] = useState<DeliveryNote>(initialMovement);
  
  // Inventory Selection State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isSearchingInventory, setIsSearchingInventory] = useState(false);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<DeliveryNote>>({
      number: initialMovement.number,
      date: initialMovement.date,
      notes: initialMovement.notes,
      pickupLocation: initialMovement.pickupLocation,
      deliveryLocation: initialMovement.deliveryLocation,
      transportMean: initialMovement.transportMean,
      transportTime: initialMovement.transportTime,
      appearance: initialMovement.appearance,
      packagesCount: initialMovement.packagesCount,
      causal: initialMovement.causal
  });
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  
  // Items State (for local manipulation before save)
  const [items, setItems] = useState<DeliveryNoteItem[]>(initialMovement.items || []);

  // Fetch inventory items on demand
  const handleSearchInventory = async (term: string) => {
    setIsSearchingInventory(true);
    try {
        const { items } = await inventoryApi.getPaginated({ 
            page: 1, 
            limit: 50, 
            search: term 
        });
        setInventoryItems(items);
    } catch (err) {
        console.error("Failed to search inventory", err);
    } finally {
        setIsSearchingInventory(false);
    }
  };

  // Initial load of items when dialog opens
  useEffect(() => {
     if (isItemSelectorOpen) {
         handleSearchInventory("");
     }
  }, [isItemSelectorOpen]);

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
            });
        } else {
            grouped.set(key, { ...item });
        }
    });
    
    return Array.from(grouped.values());
  }, [items]);

  const handlePrint = async () => {
    if (!movement) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // 210
    const pageHeight = doc.internal.pageSize.height; // 297
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // --- Colors ---
    const grayBg = [220, 220, 220] as [number, number, number]; // Light gray for headers

    // --- Helper: Draw Gray Header Box ---
    const drawHeaderBox = (x: number, y: number, w: number, h: number, title: string, fontSize = 8, bold = true) => {
        doc.setFillColor(...grayBg);
        doc.rect(x, y, w, h, 'F'); // Fill
        doc.setDrawColor(0);
        doc.rect(x, y, w, h, 'S'); // Stroke
        doc.setTextColor(0);
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(title, x + 2, y + h - 2); // Text padding
    };

    // --- 1. Logo & Company Info ---
    try {
        const logoUrl = '/opi_logo.jpg';
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        // Logo centered/large as in reference
        doc.addImage(logoData as string, 'JPEG', 60, 5, 90, 25); 
    } catch (e) {
        console.error("Could not load logo", e);
        // Fallback text if logo fails
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("OPI Firesafe", pageWidth / 2, 20, { align: "center" });
    }

    // Company Details (Right aligned below logo)
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const headerTextY = 35;
    doc.text("Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)", pageWidth - margin, headerTextY, { align: "right" });
    doc.text("Tel. 0432-1901608 - email: amministrazione@opifiresafe.com", pageWidth - margin, headerTextY + 3, { align: "right" });
    doc.text("Cod. Fisc: 02357730304 - P.IVA e RI UD 02357730304 - Capitale Sociale € 250.000,00 i.v.", pageWidth - margin, headerTextY + 6, { align: "right" });

    // --- 2. Grid Layout (Header) ---
    let currentY = 45;
    const col1W = 50;
    const col2W = contentWidth - col1W;
    
    // -- Row A: Headers --
    drawHeaderBox(margin, currentY, col1W, 5, "DOCUMENTO DI TRASPORTO", 7, true);
    drawHeaderBox(margin + col1W, currentY, col2W, 5, "CAUSALE DEL TRASPORTO:", 8, true);
    currentY += 5;

    // -- Row B: Sub-headers / Content --
    // Col 1: Subtext (DPR...)
    doc.rect(margin, currentY, col1W, 8, 'S');
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text("D.D.T. - D.P.R. 472 del 14-08-1996 - D.P.R. 696 del 21-12-1996", margin + 1, currentY + 3, { maxWidth: 48 });

    // Col 2: Causale Content
    doc.rect(margin + col1W, currentY, col2W, 8, 'S');
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(movement.causal || "Rifornimento cantiere", margin + col1W + 2, currentY + 5);
    currentY += 8;

    // -- Row C: Number & Pickup --
    const rowCHeight = 12;
    // Col 1: Number
    doc.rect(margin, currentY, col1W, rowCHeight, 'S');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(movement.number, margin + col1W - 2, currentY + 8, { align: "right" });

    // Col 2: Pickup Header (Small strip) & Content
    drawHeaderBox(margin + col1W, currentY, col2W, 5, "LUOGO DI RITIRO MERCE:", 7, false);
    
    // Content (Rest of height)
    doc.rect(margin + col1W, currentY + 5, col2W, rowCHeight - 5, 'S');
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const pickupText = movement.pickupLocation || "OPI Firesafe S.r.l. MAGAZZINO: Via A. Malignani, 9 REANA DEL ROJALE (UD)";
    doc.text(pickupText, margin + col1W + 2, currentY + 9);
    currentY += rowCHeight;

    // -- Row D: Date & Destination --
    drawHeaderBox(margin, currentY, col1W, 5, "DATA DI CARICO", 7, true);
    drawHeaderBox(margin + col1W, currentY, col2W, 5, "LUOGO DI DESTINAZIONE MERCE:", 7, false);
    currentY += 5;

    // -- Row E: Date Content & Dest Content --
    const rowEHeight = 12;

    // Col 1: Date Content
    doc.rect(margin, currentY, col1W, rowEHeight, 'S');
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), margin + col1W / 2, currentY + 8, { align: "center" });

    // Col 2: Dest Content
    doc.rect(margin + col1W, currentY, col2W, rowEHeight, 'S');
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    let destText = "";
    if (movement.jobCode) destText += `Commessa: ${movement.jobCode} - `;
    if (movement.jobDescription) destText += `${movement.jobDescription} `;
    if (movement.deliveryLocation) destText += `: ${movement.deliveryLocation}`;
    doc.text(destText || "Sede cliente", margin + col1W + 2, currentY + 5, { maxWidth: col2W - 4 });
    
    currentY += rowEHeight + 2; // Gap before table

    // --- Footer Calculation ---
    // Define Footer Height
    // Transport (13) + Aspect (13) + Notes (15) + Signatures (20) = 61mm + gaps ~ 70mm
    const footerHeight = 70; 

    // --- 3. Table ---
    const tableBody = groupedItems.map(item => [
        item.inventoryCategory || "-",
        `${item.inventoryName || "Articolo"} ${item.inventoryDescription ? `- ${item.inventoryDescription}` : ""}`,
        item.inventoryUnit || "PZ",
        item.quantity.toString()
    ]);

    autoTable(doc, {
        startY: currentY,
        head: [['Categoria', 'Prodotto', 'U.M.', 'Quantità']],
        body: tableBody,
        theme: 'grid',
        styles: { 
            fontSize: 8, 
            cellPadding: 2, 
            lineColor: [180, 180, 180], 
            lineWidth: 0.1,
            textColor: 0 
        },
        headStyles: { 
            fillColor: [220, 220, 220], 
            textColor: 0, 
            fontStyle: 'bold',
            lineColor: [180, 180, 180],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20 },
            3: { cellWidth: 20, halign: 'right' }
        },
        margin: { bottom: 20 }, // Minimal margin to maximize space on intermediate pages
        rowPageBreak: 'avoid',
    });

    // --- 4. Footer Drawing Function ---
    const drawFooter = (y: number) => {
        let fy = y;
        const footerRowHeight = 5;
        const footerContentHeight = 8;

        // Labels positions
        const col1X = margin + 2;
        const col2X = margin + 100;
        const col3X = margin + 150;

        // Row 1: Transport
        drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false); // Background bar
        doc.setTextColor(100);
        doc.text("TRASPORTO A MEZZO", col1X, fy + 3.5);
        doc.text("DATA DI RITIRO", col2X, fy + 3.5);
        doc.text("ORA DEL RITIRO", col3X, fy + 3.5);
        fy += footerRowHeight;

        // Content Row 1
        doc.rect(margin, fy, contentWidth, footerContentHeight, 'S');
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text("Mittente", col1X, fy + 5);
        doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), col2X, fy + 5);
        doc.text("08:00:00", col3X, fy + 5);
        // Vertical lines
        doc.line(margin + 98, fy - footerRowHeight, margin + 98, fy + footerContentHeight);
        doc.line(margin + 148, fy - footerRowHeight, margin + 148, fy + footerContentHeight);
        fy += footerContentHeight;

        // Row 2: Aspect
        drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false);
        doc.setTextColor(100);
        doc.text("ASPETTO ESTERIORE DEI BENI", col1X, fy + 3.5);
        doc.text("NUMERO DI COLLI", col3X, fy + 3.5);
        fy += footerRowHeight;

        // Content Row 2
        doc.rect(margin, fy, contentWidth, footerContentHeight, 'S');
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(movement.appearance || "A VISTA", col1X, fy + 5);
        doc.text((movement.packagesCount || 0).toString(), col3X + 30, fy + 5, { align: "right" });
        doc.line(margin + 148, fy - footerRowHeight, margin + 148, fy + footerContentHeight);
        fy += footerContentHeight;

        // Row 3: Notes
        drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "ANNOTAZIONI", 6, false);
        
        fy += footerRowHeight;
        
        // Content Row 3
        const notesHeight = 10;
        doc.rect(margin, fy, contentWidth, notesHeight, 'S');
        doc.setTextColor(0);
        doc.setFontSize(8);
        if (movement.notes) {
            doc.text(movement.notes, col1X, fy + 5);
        }
        fy += notesHeight + 2; // Gap

        // Signatures (Side by Side)
        const sigW = contentWidth / 3;
        const sigH = 5;
        const sigBoxH = 15;
        
        const drawSigBlock = (x: number, title: string) => {
            // Header
            doc.setFillColor(...grayBg);
            doc.rect(x, fy, sigW, sigH, 'F');
            doc.rect(x, fy, sigW, sigH, 'S');
            doc.setTextColor(100);
            doc.setFontSize(6);
            doc.text(title, x + 2, fy + 3.5);
            // Box
            doc.rect(x, fy + sigH, sigW, sigBoxH, 'S');
        };

        drawSigBlock(margin, "FIRMA MITTENTE");
        drawSigBlock(margin + sigW, "FIRMA VETTORE");
        drawSigBlock(margin + sigW * 2, "FIRMA DESTINATARIO");
    };

    // --- Handle Pagination for Footer ---
    const finalY = (doc as any).lastAutoTable.finalY || currentY;
    const spaceNeeded = footerHeight + margin;
    
    // If not enough space on current page, add new page
    if (pageHeight - finalY < spaceNeeded) {
        doc.addPage();
    }
    
    // Draw footer at the bottom of the current (last) page
    drawFooter(pageHeight - footerHeight - margin);

    doc.save(`DDT_${movement.number.replace(/\//g, '-')}.pdf`);
  };

  const handleDelete = async () => {
    if (!confirm("Sei sicuro di voler eliminare questo movimento? Questa azione è irreversibile.")) return;
    
    try {
        setLoading(true);
        await deliveryNotesApi.delete(initialMovement.id);
        router.push('/movements');
    } catch (error) {
        console.error("Failed to delete movement", error);
        alert("Errore durante l'eliminazione del movimento");
        setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!movement) return;
    
    try {
        setLoading(true);
        // Update header fields and items
        await deliveryNotesApi.update(initialMovement.id, editForm, items.map(item => ({
            inventoryId: item.inventoryId,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            purchaseItemId: item.purchaseItemId || undefined,
            isFictitious: item.isFictitious,
            price: item.price
        })) as any);
        
        alert("Modifiche salvate con successo!");
        setIsEditing(false);
        // In a real app we might want to revalidate data here
        // But for now we just update local state if needed or reload page
        router.refresh(); 
    } catch (error) {
        console.error("Failed to save changes", error);
        alert("Errore nel salvataggio");
        setLoading(false);
    }
  };

  const handleAddItem = (inventoryItem: InventoryItem) => {
    const newItem: DeliveryNoteItem = {
        id: `temp-${Date.now()}`,
        deliveryNoteId: initialMovement.id,
        inventoryId: inventoryItem.id,
        quantity: 1,
        pieces: 0,
        coefficient: 0,
        isFictitious: false,
        inventoryCode: inventoryItem.code,
        inventoryName: inventoryItem.name,
        inventoryModel: inventoryItem.model,
        inventoryUnit: inventoryItem.unit,
        inventoryDescription: inventoryItem.description
    };
    
    setItems([...items, newItem]);
    setIsItemSelectorOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof DeliveryNoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
                <Button 
                                variant="default" 
                                className="bg-[#003366] hover:bg-[#002244]"
                                onClick={handlePrint}
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Stampa Bolla
                            </Button>
                {(userRole === 'admin' || userRole === 'operativo') && (
                    <Button variant="destructive" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                    </Button>
                )}
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
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Causale</span>
                                <span className="font-medium">{movement.causal}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Luogo Ritiro</span>
                                <span className="font-medium truncate max-w-[200px]">{movement.pickupLocation}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Destinazione</span>
                                <span className="font-medium truncate max-w-[200px]">{movement.deliveryLocation}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-500">Trasporto e Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isEditing ? (
                        <>
                            <div>
                                <Label>Aspetto Beni</Label>
                                <Input 
                                    value={editForm.appearance} 
                                    onChange={e => setEditForm({...editForm, appearance: e.target.value})}
                                />
                            </div>
                            <div>
                                <Label>Note</Label>
                                <Input 
                                    value={editForm.notes} 
                                    onChange={e => setEditForm({...editForm, notes: e.target.value})}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">Aspetto Beni</span>
                                <span className="font-medium">{movement.appearance}</span>
                            </div>
                            <div className="flex justify-between border-b pb-2">
                                <span className="text-slate-500">N. Colli</span>
                                <span className="font-medium">{movement.packagesCount}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-1">Note</span>
                                <p className="text-sm bg-slate-50 p-2 rounded">{movement.notes || "-"}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Items Table */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Articoli ({items.length})</CardTitle>
                {isEditing && (
                    <Button size="sm" onClick={() => setIsItemSelectorOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Aggiungi Articolo
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Codice</TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead className="w-[100px]">Quantità</TableHead>
                            {isEditing && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                                    Nessun articolo inserito
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.inventoryCode}</TableCell>
                                    <TableCell>
                                        <div>
                                            <span className="block font-medium">{item.inventoryName}</span>
                                            <span className="text-xs text-slate-500">{item.inventoryDescription}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {isEditing ? (
                                            <Input 
                                                type="number" 
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                className="w-20"
                                            />
                                        ) : (
                                            <Badge variant="secondary">{item.quantity} {item.inventoryUnit}</Badge>
                                        )}
                                    </TableCell>
                                    {isEditing && (
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <ItemSelectorDialog 
            open={isItemSelectorOpen} 
            onOpenChange={setIsItemSelectorOpen}
            onSelect={handleAddItem}
            items={inventoryItems}
            onSearch={handleSearchInventory}
            loading={isSearchingInventory}
        />
      </div>
  );
}
