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
// jsPDF and autoTable are loaded dynamically on demand to reduce bundle size
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

        // Dynamic import of jsPDF to reduce initial bundle size (~248KB saved)
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width; // 210
        const pageHeight = doc.internal.pageSize.height; // 297
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        // --- Colors (Softer/Lighter) ---
        const grayBg = [245, 245, 245] as [number, number, number]; // Very light gray background
        const borderColor = [180, 180, 180] as [number, number, number]; // Softer border

        // --- Helper: Draw Box (Rounded) ---
        const drawBox = (x: number, y: number, w: number, h: number, fill: boolean = false) => {
            if (fill) doc.setFillColor(...grayBg);
            doc.setDrawColor(...borderColor);
            doc.roundedRect(x, y, w, h, 1, 1, fill ? 'FD' : 'S');
        };

        // --- Helper: Draw Header Box (Title) ---
        const drawHeaderBox = (x: number, y: number, w: number, h: number, title: string, fontSize = 8, bold = true) => {
            drawBox(x, y, w, h, true);
            doc.setTextColor(50); // Dark gray text, not black
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.text(title, x + 2, y + h - 2);
        };

        // --- Helper: Calculate Text Height ---
        const getTextHeight = (text: string, width: number, fontSize: number, fontStyle: string = "normal") => {
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", fontStyle);
            const lines = doc.splitTextToSize(text, width - 4);
            const lineHeight = fontSize * 0.3527 * 1.5; // mm approx with line spacing
            return Math.max(lines.length * lineHeight + 4, 8); // Min height 8mm
        };

        // --- 1. Logo & Company Info ---
        try {
            const logoUrl = '/logo_header.png'; // Updated logo
            const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            }));
            // Logo centered/large
            doc.addImage(logoData as string, 'PNG', 60, 5, 90, 25);
        } catch (e) {
            console.error("Could not load logo", e);
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.text("OPI Firesafe", pageWidth / 2, 20, { align: "center" });
        }

        // Company Details (Right aligned below logo)
        doc.setFontSize(7);
        doc.setTextColor(80); // Gray text
        doc.setFont("helvetica", "normal");
        const headerTextY = 35;
        doc.text("Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)", pageWidth - margin, headerTextY, { align: "right" });
        doc.text("Tel. 0432-1901608 - email: amministrazione@opifiresafe.com", pageWidth - margin, headerTextY + 3, { align: "right" });
        doc.text("Cod. Fisc: 02357730304 - P.IVA e RI UD 02357730304 - Capitale Sociale € 250.000,00 i.v.", pageWidth - margin, headerTextY + 6, { align: "right" });

        // --- 2. Grid Layout (Dynamic) ---
        let currentY = 45;
        const col1W = 50;
        const col2W = contentWidth - col1W;

        // -- Row A: Headers --
        drawHeaderBox(margin, currentY, col1W, 6, "DOCUMENTO DI TRASPORTO", 7, true);
        drawHeaderBox(margin + col1W, currentY, col2W, 6, "CAUSALE DEL TRASPORTO:", 8, true);
        currentY += 6;

        // -- Row B: Sub-headers / Content --
        // Calculate max height for Row B
        const dprText = "D.D.T. - D.P.R. 472 del 14-08-1996 - D.P.R. 696 del 21-12-1996";
        const causalText = movement.causal || "Rifornimento cantiere";

        const rowBHeight = Math.max(
            getTextHeight(dprText, col1W, 5, "normal"),
            getTextHeight(causalText, col2W, 10, "bold")
        );

        // Col 1: Subtext
        drawBox(margin, currentY, col1W, rowBHeight);
        doc.setTextColor(0);
        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text(dprText, margin + 2, currentY + 4, { maxWidth: col1W - 4 });

        // Col 2: Causale Content
        drawBox(margin + col1W, currentY, col2W, rowBHeight);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(causalText, margin + col1W + 2, currentY + 6);

        currentY += rowBHeight;

        // -- Row C: Number & Pickup --
        // Header strip for Pickup
        drawHeaderBox(margin + col1W, currentY, col2W, 6, "LUOGO DI RITIRO MERCE:", 7, false);
        // Number box (spans header + content height of pickup) needs to wait for pickup content height
        const pickupY = currentY + 6;

        const pickupText = movement.pickupLocation || "OPI Firesafe S.r.l. MAGAZZINO: Via A. Malignani, 9 REANA DEL ROJALE (UD)";
        const pickupContentHeight = getTextHeight(pickupText, col2W, 9, "normal");
        const rowCHeight = 6 + pickupContentHeight; // Header + Content

        // Col 1: Number (Full height)
        drawBox(margin, currentY, col1W, rowCHeight);
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(movement.number, margin + col1W / 2, currentY + (rowCHeight / 2) + 2, { align: "center" });

        // Col 2: Pickup Content
        drawBox(margin + col1W, pickupY, col2W, pickupContentHeight);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(pickupText, margin + col1W + 2, pickupY + 5, { maxWidth: col2W - 4 });

        currentY += rowCHeight;

        // -- Row D: Date & Destination --
        drawHeaderBox(margin, currentY, col1W, 6, "DATA DI CARICO", 7, true);
        drawHeaderBox(margin + col1W, currentY, col2W, 6, "LUOGO DI DESTINAZIONE MERCE:", 7, false);
        currentY += 6;

        // -- Row E: Content --
        let destText = movement.deliveryLocation || "Sede cliente";

        const destHeight = getTextHeight(destText, col2W, 9, "normal");
        const rowEHeight = Math.max(12, destHeight); // Min 12mm

        // Col 1: Date Content
        drawBox(margin, currentY, col1W, rowEHeight);
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), margin + col1W / 2, currentY + (rowEHeight / 2) + 2, { align: "center" });

        // Col 2: Dest Content
        drawBox(margin + col1W, currentY, col2W, rowEHeight);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(destText, margin + col1W + 2, currentY + 5, { maxWidth: col2W - 4 });

        currentY += rowEHeight + 5; // Gap before table

        // --- 3. Table (Harmonized) ---
        const tableBody = groupedItems.map(item => [
            item.inventoryCategory || "-",
            `${item.inventoryName || "Articolo"} ${item.inventoryDescription ? `- ${item.inventoryDescription}` : ""}`,
            item.inventoryUnit || "PZ",
            item.quantity.toString()
        ]);

        // Footer Height Calculation (Dynamic)
        const notesText = movement.notes || "";
        const notesHeight = movement.notes ? getTextHeight(notesText, contentWidth, 8) : 0;
        const footerBaseHeight = 13 + 13 + 20; // Transport + Aspect + Signatures
        const footerHeight = footerBaseHeight + (notesHeight > 0 ? notesHeight + 8 : 0) + 10; // + Header for notes + Padding

        autoTable(doc, {
            startY: currentY,
            head: [['Categoria', 'Prodotto', 'U.M.', 'Quantità']],
            body: tableBody,
            theme: 'plain', // Cleaner look
            styles: {
                fontSize: 9,
                cellPadding: 3,
                textColor: 50,
                lineColor: [230, 230, 230],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: grayBg,
                textColor: 0,
                fontStyle: 'bold',
                lineColor: borderColor,
                lineWidth: 0.1
            },
            bodyStyles: {
                // Add bottom border to rows
                lineWidth: { bottom: 0.1 },
                lineColor: [230, 230, 230]
            },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'right' }
            },
            margin: { bottom: footerHeight + 10, left: margin, right: margin },
            tableWidth: 'auto',
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
            drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false);
            doc.setTextColor(100);
            doc.text("TRASPORTO A MEZZO", col1X, fy + 3.5);
            doc.text("DATA DI RITIRO", col2X, fy + 3.5);
            doc.text("ORA DEL RITIRO", col3X, fy + 3.5);
            fy += footerRowHeight;

            // Content Row 1
            drawBox(margin, fy, contentWidth, footerContentHeight);
            doc.setTextColor(0);
            doc.setFontSize(9);
            doc.text("Mittente", col1X, fy + 5);
            doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), col2X, fy + 5);
            doc.text("08:00:00", col3X, fy + 5);
            // Vertical dividers
            doc.setDrawColor(...borderColor);
            doc.line(margin + 98, fy, margin + 98, fy + footerContentHeight);
            doc.line(margin + 148, fy, margin + 148, fy + footerContentHeight);
            fy += footerContentHeight;

            // Row 2: Aspect
            drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false);
            doc.setTextColor(100);
            doc.text("ASPETTO ESTERIORE DEI BENI", col1X, fy + 3.5);
            doc.text("NUMERO DI COLLI", col3X, fy + 3.5);
            fy += footerRowHeight;

            // Content Row 2
            drawBox(margin, fy, contentWidth, footerContentHeight);
            doc.setTextColor(0);
            doc.setFontSize(9);
            doc.text(movement.appearance || "A VISTA", col1X, fy + 5);
            doc.text((movement.packagesCount || 0).toString(), col3X + 30, fy + 5, { align: "right" });
            doc.line(margin + 148, fy, margin + 148, fy + footerContentHeight);
            fy += footerContentHeight;

            // Row 3: Notes (Dynamic)
            if (notesHeight > 0) {
                drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "ANNOTAZIONI", 6, false);
                fy += footerRowHeight;

                drawBox(margin, fy, contentWidth, notesHeight);
                doc.setTextColor(0);
                doc.setFontSize(8);
                doc.text(notesText, col1X, fy + 5, { maxWidth: contentWidth - 4 });
                fy += notesHeight + 2;
            } else {
                fy += 2;
            }

            // Signatures (Side by Side)
            const sigW = contentWidth / 3;
            const sigH = 5;
            const sigBoxH = 15;

            const drawSigBlock = (x: number, title: string) => {
                // Header
                doc.setFillColor(...grayBg);
                doc.setDrawColor(...borderColor);
                doc.roundedRect(x, fy, sigW, sigH, 1, 1, 'FD');

                doc.setTextColor(100);
                doc.setFontSize(6);
                doc.text(title, x + 2, fy + 3.5);
                // Box
                doc.roundedRect(x, fy + sigH, sigW, sigBoxH, 1, 1, 'S');
            };

            drawSigBlock(margin, "FIRMA MITTENTE");
            drawSigBlock(margin + sigW, "FIRMA VETTORE");
            drawSigBlock(margin + sigW * 2, "FIRMA DESTINATARIO");

            // Page Numbering (bottom right)
            const pageCount = (doc.internal as any).getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(100);
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
            }
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
                                            onChange={e => setEditForm({ ...editForm, number: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label>Data</Label>
                                        <Input
                                            type="date"
                                            value={editForm.date ? editForm.date.split('T')[0] : ''}
                                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Causale</Label>
                                    <Input
                                        value={editForm.causal}
                                        onChange={e => setEditForm({ ...editForm, causal: e.target.value })}
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
                                        onChange={e => setEditForm({ ...editForm, appearance: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Note</Label>
                                    <Input
                                        value={editForm.notes}
                                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
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
