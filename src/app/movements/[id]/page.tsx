"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
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
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
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
  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  
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

    // --- Helper: Draw Content Box ---
    const drawContentBox = (x: number, y: number, w: number, h: number, text: string, fontSize = 10, bold = false, align: "left" | "center" | "right" = "left") => {
        doc.setDrawColor(0);
        doc.rect(x, y, w, h, 'S');
        doc.setTextColor(0);
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        
        // Handle multiline text
        const textLines = doc.splitTextToSize(text, w - 4);
        const textY = y + 5; // Top padding
        
        if (align === "center") {
             doc.text(text, x + w / 2, y + h / 2 + 3, { align: "center" });
        } else {
             doc.text(textLines, x + 2, textY);
        }
    };

    // --- 1. Logo & Company Info ---
    try {
        const logoUrl = '/logo_header.png';
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        // Logo centered/large as in reference
        doc.addImage(logoData as string, 'PNG', 60, 5, 90, 25); 
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

    // --- 2. Grid Layout ---
    let currentY = 45;

    // Row 1
    // Box 1.1: Documento di Trasporto Header
    drawHeaderBox(margin, currentY, 50, 6, "DOCUMENTO DI TRASPORTO", 7, true);
    // Box 1.2: Causale Header
    drawHeaderBox(margin + 50, currentY, contentWidth - 50, 6, "CAUSALE DEL TRASPORTO:", 8, true);
    
    currentY += 6;
    
    // Row 2
    // Box 2.1: DDT Reference Text (Small)
    doc.setDrawColor(0);
    doc.rect(margin, currentY, 50, 6); // Empty box for small text
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text("D.D.T. - D.P.R. 472 del 14-08-1996 - D.P.R. 696 del 21-12-1996", margin + 1, currentY + 4, { maxWidth: 48 });
    
    // Box 2.2: Causale Content
    // We merge this with the row below for the content part? No, in ref image "Causale" header is above content.
    // Actually, let's look at the ref image structure again.
    // Col 1: DDT Header | Subtext | Number Header | Number Value | Date Header | Date Value
    // Col 2: Causale Header | Causale Value | Pickup Header | Pickup Value | Dest Header | Dest Value
    
    // Refined Grid Structure based on "1/PP23" image:
    // The "1/PP23" is in a box to the left.
    // Let's restart the grid logic to match Image 2 exactly.
    
    currentY = 45;
    const col1W = 50;
    const col2W = contentWidth - col1W;
    
    // -- Row A: Headers --
    // Col 1: DDT Header
    doc.setFillColor(...grayBg);
    doc.rect(margin, currentY, col1W, 5, 'F');
    doc.rect(margin, currentY, col1W, 5, 'S');
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("DOCUMENTO DI TRASPORTO", margin + 1, currentY + 3.5);

    // Col 2: Causale Header
    doc.setFillColor(...grayBg);
    doc.rect(margin + col1W, currentY, col2W, 5, 'F');
    doc.rect(margin + col1W, currentY, col2W, 5, 'S');
    doc.text("CAUSALE DEL TRASPORTO:", margin + col1W + 1, currentY + 3.5);

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
    // Col 1: Number (Large) - This spans 2 rows of the right side? No, looks like its own block.
    // In ref: Left side has "1/PP23" large. Right side has "LUOGO DI RITIRO MERCE" header then content.
    const rowCHeight = 12;
    
    // Col 1: Number
    doc.rect(margin, currentY, col1W, rowCHeight, 'S');
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(movement.number, margin + col1W - 2, currentY + 8, { align: "right" });

    // Col 2: Pickup Header (Small strip) & Content
    // Header Strip
    doc.setFillColor(...grayBg);
    doc.rect(margin + col1W, currentY, col2W, 5, 'F');
    doc.rect(margin + col1W, currentY, col2W, 5, 'S');
    doc.setFontSize(7);
    doc.text("LUOGO DI RITIRO MERCE:", margin + col1W + 1, currentY + 3.5);
    
    // Content (Rest of height)
    doc.rect(margin + col1W, currentY + 5, col2W, rowCHeight - 5, 'S');
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const pickupText = movement.pickupLocation || "OPI Firesafe S.r.l. MAGAZZINO: Via A. Malignani, 9 REANA DEL ROJALE (UD)";
    doc.text(pickupText, margin + col1W + 2, currentY + 9);

    currentY += rowCHeight;

    // -- Row D: Date & Destination --
    // Col 1: Header "DATA DI CARICO"
    doc.setFillColor(...grayBg);
    doc.rect(margin, currentY, col1W, 5, 'F');
    doc.rect(margin, currentY, col1W, 5, 'S');
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("DATA DI CARICO", margin + 1, currentY + 3.5); // Centered in ref? Looks left.

    // Col 2: Header "LUOGO DI DESTINAZIONE MERCE"
    doc.setFillColor(...grayBg);
    doc.rect(margin + col1W, currentY, col2W, 5, 'F');
    doc.rect(margin + col1W, currentY, col2W, 5, 'S');
    doc.text("LUOGO DI DESTINAZIONE MERCE:", margin + col1W + 1, currentY + 3.5);

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
    // Build dest text from job/location
    let destText = "";
    if (movement.jobCode) destText += `Commessa: ${movement.jobCode} - `;
    if (movement.jobDescription) destText += `${movement.jobDescription} `;
    if (movement.deliveryLocation) destText += `: ${movement.deliveryLocation}`;
    
    doc.text(destText || "Sede cliente", margin + col1W + 2, currentY + 5, { maxWidth: col2W - 4 });

    currentY += rowEHeight + 2; // Gap before table

    // --- 3. Table ---
    // Columns: Categoria | Prodotto | Quantità (Unit | Value)
    // Ref: Categoria | Prodotto | Mq/Pezzi | Value
    
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
        theme: 'grid', // The ref has simple grid
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
            0: { cellWidth: 30 }, // Categoria
            1: { cellWidth: 'auto' }, // Prodotto
            2: { cellWidth: 20 }, // U.M.
            3: { cellWidth: 20, halign: 'right' } // Quantità
        }
    });

    // --- 4. Footer ---
    const finalY = (doc as any).lastAutoTable.finalY || currentY;
    const footerY = Math.max(finalY + 5, 230); // Push to bottom if space allows, or just after table
    
    // Footer Grid
    const footerRowHeight = 6;
    let fy = footerY;

    // Header Row for Footer
    doc.setFillColor(...grayBg);
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'F');
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'S');
    
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal"); // Headers seem normal in ref? "TRASPORTO A MEZZO" looks grey text? No, white text on grey?
    // Ref Image 2: "TRASPORTO A MEZZO" is grey text on white? No, it's a grey BAR with text.
    // Let's assume standard grey bar with dark text.
    doc.setTextColor(100); // Dark Gray text
    
    // Labels positions
    const col1X = margin + 2;
    const col2X = margin + 100; // Data di ritiro
    const col3X = margin + 150; // Ora del ritiro
    
    doc.text("TRASPORTO A MEZZO", col1X, fy + 4);
    doc.text("DATA DI RITIRO", col2X, fy + 4);
    doc.text("ORA DEL RITIRO", col3X, fy + 4);

    fy += footerRowHeight;

    // Value Row 1
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.rect(margin, fy, contentWidth, 8, 'S');
    // Values
    doc.text("Mittente", col1X, fy + 5); // Hardcoded "Mittente" as in ref? Or movement.transportMean?
    doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), col2X, fy + 5);
    doc.text("08:00:00", col3X, fy + 5); // Mock time or field?
    
    // Vertical lines to separate columns? Ref image has them.
    // We can just draw rects for each cell if we want perfect grid.
    // Let's stick to outer rect for now to keep it simple, or draw vertical lines.
    doc.line(margin + 98, fy - footerRowHeight, margin + 98, fy + 8); // Split 1
    doc.line(margin + 148, fy - footerRowHeight, margin + 148, fy + 8); // Split 2

    fy += 8;

    // Header Row 2
    doc.setFillColor(...grayBg);
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'F');
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'S');
    doc.setTextColor(100);
    doc.setFontSize(6);
    doc.text("ASPETTO ESTERIORE DEI BENI", col1X, fy + 4);
    doc.text("NUMERO DI COLLI", col3X, fy + 4); // Aligned with Ora?

    fy += footerRowHeight;

    // Value Row 2
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.rect(margin, fy, contentWidth, 8, 'S');
    doc.text(movement.appearance || "A VISTA", col1X, fy + 5);
    doc.text((movement.packagesCount || 0).toString(), col3X + 30, fy + 5, { align: "right" });
    
    doc.line(margin + 148, fy - footerRowHeight, margin + 148, fy + 8); // Split

    fy += 8;

    // Annotazioni Header
    doc.setFillColor(...grayBg);
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'F');
    doc.rect(margin, fy, contentWidth, footerRowHeight, 'S');
    doc.setTextColor(100);
    doc.setFontSize(6);
    doc.text("ANNOTAZIONI", col1X, fy + 4);

    fy += footerRowHeight;

    // Annotazioni Value
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.rect(margin, fy, contentWidth, 12, 'S');
    if (movement.notes) {
        doc.text(movement.notes, col1X, fy + 5);
    }

    fy += 15;

    // Signatures
    // Ref: Firma Mittente | Firma Vettore | Firma Destinatario
    // Grey headers for signatures too? Ref shows "FIRMA MITTENTE" in a grey bar?
    // Image 2 shows:
    // Grey bar "FIRMA MITTENTE" -> White box
    // Grey bar "FIRMA VETTORE" -> White box
    // Grey bar "FIRMA DESTINATARIO" -> White box
    
    const sigH = 5;
    const sigBoxH = 15;
    
    // 3 Boxes
    const sigW = contentWidth; // They are stacked? No, stacked in Ref Image 2!
    // Image 2 shows them stacked at the bottom?
    // Wait, Image 2 shows:
    // "FIRMA MITTENTE" bar -> box
    // "FIRMA VETTORE" bar -> box
    // "FIRMA DESTINATARIO" bar -> box
    // They are stacked vertically!
    
    // Stacked Signatures
    const drawSigBlock = (y: number, title: string) => {
        doc.setFillColor(...grayBg);
        doc.rect(margin, y, contentWidth, sigH, 'F');
        doc.rect(margin, y, contentWidth, sigH, 'S');
        doc.setTextColor(100);
        doc.setFontSize(6);
        doc.text(title, margin + 2, y + 3.5);
        
        doc.rect(margin, y + sigH, contentWidth, sigBoxH, 'S');
    };

    drawSigBlock(fy, "FIRMA MITTENTE");
    fy += sigH + sigBoxH;
    
    drawSigBlock(fy, "FIRMA VETTORE");
    fy += sigH + sigBoxH;
    
    drawSigBlock(fy, "FIRMA DESTINATARIO");

    doc.save(`DDT_${movement.number.replace(/\//g, '-')}.pdf`);
  };

  const handleDelete = async () => {
    if (!confirm("Sei sicuro di voler eliminare questo movimento? Questa azione è irreversibile.")) return;
    
    try {
        setLoading(true);
        await deliveryNotesApi.delete(id);
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
        await deliveryNotesApi.update(id, editForm, items.map(item => ({
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
        loadData(); // Reload to get fresh state
    } catch (error) {
        console.error("Failed to save changes", error);
        alert("Errore nel salvataggio");
        setLoading(false);
    }
  };

  const handleAddItem = (inventoryItem: InventoryItem) => {
    const newItem: DeliveryNoteItem = {
        id: `temp-${Date.now()}`,
        deliveryNoteId: id,
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

            {/* Items List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Articoli {isEditing ? "(Modifica)" : ""}</CardTitle>
                    {isEditing && (
                        <Button onClick={() => setIsItemSelectorOpen(true)} size="sm">
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
                                <TableHead>Articolo</TableHead>
                                <TableHead>Descrizione</TableHead>
                                <TableHead className="text-right">Q.tà</TableHead>
                                <TableHead>U.M.</TableHead>
                                {isEditing && <TableHead className="w-[50px]"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(isEditing ? items : groupedItems).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isEditing ? 6 : 5} className="text-center py-8 text-slate-500">
                                        Nessun articolo
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (isEditing ? items : groupedItems).map((item, index) => (
                                    <TableRow key={item.id || index}>
                                        <TableCell className="font-mono text-sm">{item.inventoryCode}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {item.inventoryName}
                                                {item.inventoryModel && <span className="text-slate-500 font-medium ml-1">({item.inventoryModel})</span>}
                                            </div>
                                            <div className="text-xs text-slate-500">{item.inventoryBrand}</div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600 max-w-md truncate" title={item.inventoryDescription}>
                                            {item.inventoryDescription || "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {isEditing ? (
                                                <Input 
                                                    type="number" 
                                                    min="0.01" 
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value))}
                                                    className="w-24 text-right ml-auto"
                                                />
                                            ) : (
                                                item.quantity
                                            )}
                                        </TableCell>
                                        <TableCell>{item.inventoryUnit}</TableCell>
                                        {isEditing && (
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
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
                items={inventory}
            />
      </div>
    </DashboardLayout>
  );
}
