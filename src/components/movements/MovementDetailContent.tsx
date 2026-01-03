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

        // Use the extracted PDF generation utility
        const { generateDeliveryNotePDF } = await import('@/lib/pdf/delivery-note-pdf');
        await generateDeliveryNotePDF(movement, groupedItems);
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
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            {movement.type === 'entry' && <ArrowDownRight className="h-6 w-6 text-green-600" />}
                            {movement.type === 'exit' && <ArrowUpRight className="h-6 w-6 text-orange-600" />}
                            {movement.type === 'sale' && <ShoppingBag className="h-6 w-6 text-blue-600" />}
                            DDT {movement.number}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
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
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Dettagli Documento</CardTitle>
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
                                <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                                    <span className="text-slate-500 dark:text-slate-400">Causale</span>
                                    <span className="font-medium">{movement.causal}</span>
                                </div>
                                <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                                    <span className="text-slate-500 dark:text-slate-400">Luogo Ritiro</span>
                                    <span className="font-medium truncate max-w-[200px]">{movement.pickupLocation}</span>
                                </div>
                                <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                                    <span className="text-slate-500 dark:text-slate-400">Destinazione</span>
                                    <span className="font-medium truncate max-w-[200px]">{movement.deliveryLocation}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Trasporto e Note</CardTitle>
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
                                <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                                    <span className="text-slate-500 dark:text-slate-400">Aspetto Beni</span>
                                    <span className="font-medium">{movement.appearance}</span>
                                </div>
                                <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                                    <span className="text-slate-500 dark:text-slate-400">N. Colli</span>
                                    <span className="font-medium">{movement.packagesCount}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block mb-1">Note</span>
                                    <p className="text-sm bg-slate-50 dark:bg-muted p-2 rounded">{movement.notes || "-"}</p>
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
                                <TableHead>Rif. Acquisto</TableHead>
                                <TableHead className="w-[100px]">Quantità</TableHead>
                                {isEditing && <TableHead className="w-[50px]"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-slate-400 dark:text-slate-500">
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
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{item.inventoryDescription}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {item.purchaseNumber ? (
                                                <div className="text-xs">
                                                    <span className="block font-medium text-blue-600 dark:text-blue-400">
                                                        Bolla {item.purchaseNumber}
                                                    </span>
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        {item.purchaseDate ? format(new Date(item.purchaseDate), 'dd/MM/yyyy') : '-'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
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
