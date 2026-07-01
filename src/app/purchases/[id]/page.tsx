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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, Save, Search, X, Pen, Edit, ChevronDown, ChevronRight, Receipt, ClipboardList, ExternalLink, Truck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { PurchaseDocuments } from "@/components/purchases/details/PurchaseDocuments";
import { PurchaseDDTConformita } from "@/components/purchases/details/PurchaseDDTConformita";
import { useAuth } from "@/components/auth-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { complianceApi, ComplianceDocument } from "@/lib/services/compliance";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

export default function PurchaseDetailPage() {
    const { userRole } = useAuth();
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { isMobile } = useIsMobile();

    const [loading, setLoading] = useState(true);
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [transportCost, setTransportCost] = useState(0);
    const [transportInput, setTransportInput] = useState("0");
    const [savingTransport, setSavingTransport] = useState(false);
    const [applyingTransport, setApplyingTransport] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [sourceOrders, setSourceOrders] = useState<{ id: string; deliveryNoteNumber: string }[]>([]);
    const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
    const [complianceModalDoc, setComplianceModalDoc] = useState<ComplianceDocument | null>(null);
    const [items, setItems] = useState<PurchaseItem[]>([]);
    const [batchAvailability, setBatchAvailability] = useState<any[]>([]); // New state for traceability
    const [itemJobMovements, setItemJobMovements] = useState<Record<string, any[]>>({}); // Job movements per item
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set()); // Track expanded items

    // Data Sources for Add Item
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // Add Item State
    const [isAddPopupOpen, setIsAddPopupOpen] = useState(false); // New state for popup
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
    const [isHeaderJobSelectorOpen, setIsHeaderJobSelectorOpen] = useState(false);
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [selectedItemForLine, setSelectedItemForLine] = useState<InventoryItem | null>(null);
    const [selectedJobForLine, setSelectedJobForLine] = useState<Job | null>(null);
    const [selectedHeaderJob, setSelectedHeaderJob] = useState<Job | null>(null);

    // Edit Item State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ price: string, quantity: string, pieces: string, total: string }>({ price: "", quantity: "", pieces: "", total: "" });

    // Edit Header State
    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [editNumber, setEditNumber] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editSupplierId, setEditSupplierId] = useState("");

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [purchaseData, itemsData, inventoryData, jobsData, availabilityData, suppliersData, jobMovementsData, sourceOrdersData] = await Promise.all([
                purchasesApi.getById(id),
                purchasesApi.getItems(id),
                inventoryApi.getAll(),
                jobsApi.getAll(),
                purchasesApi.getPurchaseBatchAvailability(id),
                suppliersApi.getAll(),
                purchasesApi.getPurchaseItemJobMovements(id),
                purchasesApi.getSourceOrders(id)
            ]);

            setPurchase(purchaseData);
            const tc = purchaseData.transportCost ?? 0;
            setTransportCost(tc);
            setTransportInput(tc > 0 ? tc.toString() : "");
            setSourceOrders(sourceOrdersData);

            // Carica documenti conformità associati a questo acquisto
            if (purchaseData.supplierId) {
                complianceApi.getBySupplier(purchaseData.supplierId).then(docs => {
                    setComplianceDocs(docs.filter(d => d.purchaseId === id));
                }).catch(() => {});
            }
            setItems(itemsData);
            setInventory(inventoryData);
            setJobs(jobsData.filter(j => j.status === 'active'));
            setBatchAvailability(availabilityData);
            setSuppliers(suppliersData);
            setItemJobMovements(jobMovementsData);

            if (purchaseData.jobId) {
                const job = jobsData.find(j => j.id === purchaseData.jobId);
                if (job) {
                    setSelectedHeaderJob(job);
                    // Set default for new item
                    setNewItem(prev => ({
                        ...prev,
                        isJob: true,
                        jobId: job.id
                    }));
                    setSelectedJobForLine(job);
                }
            }
        } catch (error) {
            console.error("Failed to load purchase details", error);
            alert("Errore nel caricamento dell'acquisto");
        } finally {
            setLoading(false);
        }
    };

    // Header Edit Functions
    const startEditingHeader = () => {
        if (!purchase) return;
        setEditNumber(purchase.deliveryNoteNumber);
        setEditDate(purchase.deliveryNoteDate.split('T')[0]);
        setEditSupplierId(purchase.supplierId);
        setIsEditingHeader(true);
    };

    const cancelEditingHeader = () => {
        setIsEditingHeader(false);
    };

    const saveEditingHeader = async () => {
        if (!editNumber || !editDate || !editSupplierId) {
            alert("Compila tutti i campi");
            return;
        }
        try {
            await purchasesApi.update(id, {
                deliveryNoteNumber: editNumber,
                deliveryNoteDate: editDate,
                supplierId: editSupplierId
            });
            // Refresh data
            await loadData();
            setIsEditingHeader(false);
        } catch (error) {
            console.error("Failed to update header", error);
            alert("Errore durante il salvataggio");
        }
    };

    const handleJobSelect = (job: Job) => {
        setSelectedJobForLine(job);
        setNewItem(prev => ({
            ...prev,
            jobId: job.id
        }));
        setIsJobSelectorOpen(false);
    };

    const handleHeaderJobSelect = async (job: Job) => {
        try {
            await purchasesApi.update(id, { jobId: job.id });
            setSelectedHeaderJob(job);
            // Update current line default
            setNewItem(prev => ({
                ...prev,
                isJob: true,
                jobId: job.id
            }));
            setSelectedJobForLine(job);

            // Also update local purchase state
            if (purchase) {
                setPurchase({ ...purchase, jobId: job.id, jobCode: job.code });
            }
        } catch (error) {
            console.error("Failed to update purchase job", error);
            alert("Errore nell'aggiornamento della commessa");
        }
        setIsHeaderJobSelectorOpen(false);
    };

    const handleClearHeaderJob = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Rimuovere la commessa dall'intestazione?")) return;

        try {
            await purchasesApi.update(id, { jobId: "" });
            setSelectedHeaderJob(null);
            if (purchase) {
                setPurchase({ ...purchase, jobId: undefined, jobCode: undefined });
            }
        } catch (error) {
            console.error("Failed to clear purchase job", error);
            alert("Errore durante la rimozione della commessa");
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

            // Se alcune righe hanno già il trasporto applicato, lo revochiamo prima di aggiungere
            if (items.some(i => i.transportApplied)) {
                await purchasesApi.reverseTransportOnItems(items);
            }

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
                isJob: !!selectedHeaderJob,
                jobId: selectedHeaderJob?.id || ""
            });
            // Keep selected job for line if header job is set
            if (!selectedHeaderJob) {
                setSelectedJobForLine(null);
            } else {
                setSelectedJobForLine(selectedHeaderJob);
            }
        } catch (error) {
            console.error("Failed to add item", error);
            alert("Errore durante l'aggiunta dell'articolo");
        } finally {
            setAddingItem(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        try {
            // Se alcune righe hanno già il trasporto applicato, lo revochiamo prima di eliminare
            if (items.some(i => i.transportApplied)) {
                await purchasesApi.reverseTransportOnItems(items.filter(i => i.id !== itemToDelete));
            }
            await purchasesApi.deleteItem(itemToDelete);
            const updatedItems = await purchasesApi.getItems(id);
            setItems(updatedItems);
            setDeleteItemDialogOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error("Failed to delete item", error);
            alert("Errore durante l'eliminazione");
        }
    };

    const handleDeletePurchase = async () => {
        try {
            setDeleting(true);
            await purchasesApi.delete(id);
            router.push('/purchases');
        } catch (error: any) {
            console.error("Failed to delete purchase", error);
            alert(`Errore: ${error.message || "Verifica se ci sono movimenti collegati a questi articoli."}`);
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    const startEditing = (item: PurchaseItem) => {
        setEditingItemId(item.id);

        // Use coefficient from inventory if available, otherwise fallback to item's saved coefficient
        const inventoryItem = inventory.find(i => i.id === item.itemId);
        const coefficient = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);

        // If pieces are missing but quantity exists and coeff > 1, try to calculate pieces
        let piecesStr = item.pieces?.toString() || "";
        if (!piecesStr && item.quantity && coefficient > 1) {
            piecesStr = (item.quantity / coefficient).toString();
        }

        setEditValues({
            price: item.price.toString(),
            quantity: item.quantity.toString(),
            pieces: piecesStr,
            total: (item.quantity * item.price).toFixed(2)
        });
    };

    const handleEditPiecesChange = (piecesStr: string, coefficient: number) => {
        const pieces = parseFloat(piecesStr);
        let quantityStr = editValues.quantity;

        if (!isNaN(pieces)) {
            quantityStr = (pieces * coefficient).toFixed(2);
        }

        const quantity = !isNaN(pieces) ? (pieces * coefficient).toFixed(2) : editValues.quantity;
        const price = parseFloat(editValues.price);
        const total = !isNaN(parseFloat(quantity)) && !isNaN(price) ? (parseFloat(quantity) * price).toFixed(2) : editValues.total;

        setEditValues({
            ...editValues,
            pieces: piecesStr,
            quantity: quantity,
            total: total
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

        const price = parseFloat(editValues.price);
        const total = !isNaN(quantity) && !isNaN(price) ? (quantity * price).toFixed(2) : editValues.total;

        setEditValues({
            ...editValues,
            quantity: quantityStr,
            pieces: piecesStr,
            total: total
        });
    };

    const handleEditTotalChange = (totalStr: string) => {
        setEditValues({
            ...editValues,
            total: totalStr
        });
    };

    const handleEditTotalBlur = () => {
        const total = parseFloat(editValues.total);
        const quantity = parseFloat(editValues.quantity);

        if (isNaN(total) || editValues.total.trim() === "") return;
        if (isNaN(quantity) || quantity === 0) return;

        const newPrice = (total / quantity).toFixed(5);

        setEditValues({
            ...editValues,
            price: newPrice,
            total: total.toFixed(2)
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

            if (isNaN(newQty) || newQty < 0) {
                alert("Quantità non valida");
                return;
            }

            await purchasesApi.updateItem(itemId, {
                price: newPrice,
                quantity: newQty,
                pieces: newPieces,
                coefficient: itemCoefficient
            });

            // Update local state
            setItems(items.map(i => i.id === itemId ? {
                ...i,
                price: newPrice,
                quantity: newQty,
                pieces: newPieces,
                coefficient: itemCoefficient
            } : i));
            setEditingItemId(null);
        } catch (error) {
            console.error("Failed to update item", error);
            alert("Errore durante l'aggiornamento");
        }
    };

    const cancelEdit = () => {
        setEditingItemId(null);
    };

    const toggleExpanded = (itemId: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    const handleSaveTransportCost = async () => {
        const val = parseFloat(transportInput) || 0;
        try {
            setSavingTransport(true);
            await purchasesApi.saveTransportCost(id, val);
            setTransportCost(val);
        } catch (e) {
            console.error(e);
            alert("Errore nel salvataggio del costo trasporto");
        } finally {
            setSavingTransport(false);
        }
    };

    const handleApplyTransport = async () => {
        const val = parseFloat(transportInput) || 0;
        if (val <= 0) { alert("Inserisci un costo trasporto valido"); return; }
        const eligible = items.filter(i => !i.transportApplied);
        if (eligible.length === 0) { alert("Il trasporto è già stato applicato a tutte le righe"); return; }
        try {
            setApplyingTransport(true);
            await purchasesApi.applyTransportToAllItems(id, val, eligible);
            setTransportCost(val);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Errore durante l'applicazione del trasporto");
        } finally {
            setApplyingTransport(false);
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

    if (!purchase) return <DashboardLayout><div>Acquisto non trovato</div></DashboardLayout>;

    const isOrder = purchase.orderType === 'order';
    const hasMissingPrices = items.some(i => i.price === 0);
    // Mostra colonne trasporto solo se il trasporto è impostato ma non ancora applicato a tutte le righe
    const showTransportCols = transportCost > 0 && items.length > 0 && items.some(i => !i.transportApplied);

    return (
        <>
        <DashboardLayout>
            <div className="max-w-6xl mx-auto pb-10">
                <div className="mb-6">
                    <Link href={isOrder ? "/purchases?tab=ordini" : "/purchases"} className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        {isOrder ? "Torna agli Ordini" : "Torna agli Acquisti"}
                    </Link>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{isOrder ? "Dettaglio Ordine" : "Dettaglio Acquisto"}</h1>
                            <p className="text-slate-500">
                                {isOrder ? "Ordine" : "Bolla"} n. {purchase.deliveryNoteNumber} del {new Date(purchase.deliveryNoteDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {!isOrder && hasMissingPrices && (
                                <div className="bg-yellow-50 text-yellow-800 px-3 py-2 rounded-md border border-yellow-200 flex items-start shadow-sm animate-pulse max-w-full sm:max-w-xs">
                                    <AlertTriangle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                                    <span className="font-medium text-sm leading-tight">Attenzione: Ci sono articoli con prezzo mancante</span>
                                </div>
                            )}
                            {(userRole === 'admin' || userRole === 'operativo') && (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => setIsAddPopupOpen(true)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="sr-only sm:not-sr-only">Aggiungi</span>
                                        <span className="sm:hidden">Agg. Articolo</span>
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => setDeleteDialogOpen(true)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only sm:not-sr-only">Elimina</span>
                                        <span className="sm:hidden">Elimina</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6">
                    {/* Header Info */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Informazioni Generali</CardTitle>
                            {(userRole === 'admin' || userRole === 'operativo') && !isEditingHeader && (
                                <Button variant="ghost" size="sm" onClick={startEditingHeader}>
                                    <Pen className="h-4 w-4 mr-1" /> Modifica
                                </Button>
                            )}
                            {isEditingHeader && (
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={cancelEditingHeader}>
                                        Annulla
                                    </Button>
                                    <Button size="sm" onClick={saveEditingHeader}>
                                        <Save className="h-4 w-4 mr-1" /> Salva
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-slate-500">Fornitore</Label>
                                {isEditingHeader ? (
                                    <Select value={editSupplierId} onValueChange={setEditSupplierId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleziona fornitore..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="font-medium text-lg">{purchase.supplierName}</div>
                                )}
                            </div>
                            <div>
                                <Label className="text-slate-500">Registrato da</Label>
                                <div className="font-medium">{purchase.createdByName || 'N/D'}</div>
                            </div>
                            <div>
                                <Label className="text-slate-500">{isOrder ? "Numero Ordine" : "Numero Bolla"}</Label>
                                {isEditingHeader ? (
                                    <Input
                                        value={editNumber}
                                        onChange={(e) => setEditNumber(e.target.value)}
                                        placeholder="Numero bolla"
                                    />
                                ) : (
                                    <div className="font-medium">{purchase.deliveryNoteNumber}</div>
                                )}
                            </div>
                            <div>
                                <Label className="text-slate-500">{isOrder ? "Data Ordine" : "Data Bolla"}</Label>
                                {isEditingHeader ? (
                                    <Input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                    />
                                ) : (
                                    <div className="font-medium">{new Date(purchase.deliveryNoteDate).toLocaleDateString()}</div>
                                )}
                            </div>
                            <div className="md:col-span-2 border-t pt-4 mt-2">
                                <Label className="text-slate-500 mb-1 block">Commessa (Generale)</Label>
                                <div
                                    className={`flex items-center justify-between border dark:border-slate-600 rounded-md px-3 py-2 bg-white dark:bg-slate-800 max-w-md ${isEditingHeader ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" : "cursor-default opacity-70"}`}
                                    onClick={() => isEditingHeader && setIsHeaderJobSelectorOpen(true)}
                                >
                                    {selectedHeaderJob ? (
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-sm truncate">{selectedHeaderJob.name || selectedHeaderJob.code}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{selectedHeaderJob.code}{selectedHeaderJob.clientName ? ` · ${selectedHeaderJob.clientName}` : ''}</span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-500 truncate">Seleziona per applicare a nuovi articoli...</span>
                                    )}
                                    {/* X button only visible in edit mode */}
                                    {isEditingHeader && selectedHeaderJob ? (
                                        <div
                                            className="p-1 hover:bg-red-100 rounded-full"
                                            onClick={handleClearHeaderJob}
                                        >
                                            <X className="h-4 w-4 text-slate-400 hover:text-red-500 flex-shrink-0" />
                                        </div>
                                    ) : (
                                        <Search className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
                                    )}
                                </div>
                            </div>

                            {/* Fattura, ordine di origine o acquisto collegato */}
                            {(purchase.invoiceId || purchase.convertedPurchaseId || sourceOrders.length > 0 || complianceDocs.length > 0) && (
                                <div className="md:col-span-2 border-t pt-4 mt-2 flex flex-wrap gap-3">
                                    {/* Acquisto → Fattura */}
                                    {purchase.invoiceId && purchase.invoiceNumber && (
                                        (userRole === 'admin' || userRole === 'operativo') ? (
                                            <Link
                                                href={`/invoices/${purchase.invoiceId}`}
                                                target={isMobile ? undefined : "_blank"}
                                                rel={isMobile ? undefined : "noopener noreferrer"}
                                                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-1.5"
                                            >
                                                <Receipt className="h-4 w-4" />
                                                Fattura: {purchase.invoiceNumber}
                                                {!isMobile && <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />}
                                            </Link>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5">
                                                <Receipt className="h-4 w-4" />
                                                Fattura: {purchase.invoiceNumber}
                                            </span>
                                        )
                                    )}
                                    {/* Ordine evaso → Acquisto risultante */}
                                    {purchase.convertedPurchaseId && purchase.convertedPurchaseNumber && (
                                        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-1.5">
                                            <Link
                                                href={`/purchases/${purchase.convertedPurchaseId}`}
                                                target={isMobile ? undefined : "_blank"}
                                                rel={isMobile ? undefined : "noopener noreferrer"}
                                                className="inline-flex items-center gap-1.5"
                                            >
                                                <ClipboardList className="h-4 w-4" />
                                                Acquisto: {purchase.convertedPurchaseNumber}
                                                {!isMobile && <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />}
                                            </Link>
                                            {(userRole === 'admin' || userRole === 'operativo') && (
                                                <button
                                                    type="button"
                                                    title="Annulla associazione con questo acquisto"
                                                    onClick={async () => {
                                                        if (!confirm(`Annullare l'associazione con l'acquisto ${purchase.convertedPurchaseNumber}?`)) return;
                                                        try {
                                                            await purchasesApi.unlinkSourceOrder(purchase.id);
                                                            setPurchase(prev => prev ? { ...prev, convertedPurchaseId: null, convertedPurchaseNumber: null } : prev);
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert("Errore durante l'annullamento dell'associazione.");
                                                        }
                                                    }}
                                                    className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 rounded-full"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {/* Acquisto → Ordini sorgente */}
                                    {sourceOrders.map(order => (
                                        <div
                                            key={order.id}
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-1.5"
                                        >
                                            <Link
                                                href={`/purchases/${order.id}`}
                                                target={isMobile ? undefined : "_blank"}
                                                rel={isMobile ? undefined : "noopener noreferrer"}
                                                className="inline-flex items-center gap-1.5"
                                            >
                                                <ClipboardList className="h-4 w-4" />
                                                Ordine: {order.deliveryNoteNumber}
                                                {!isMobile && <ExternalLink className="h-3 w-3 ml-0.5 opacity-60" />}
                                            </Link>
                                            {(userRole === 'admin' || userRole === 'operativo') && (
                                                <button
                                                    type="button"
                                                    title="Annulla associazione con questo ordine"
                                                    onClick={async () => {
                                                        if (!confirm(`Annullare l'associazione con l'ordine ${order.deliveryNoteNumber}?`)) return;
                                                        try {
                                                            await purchasesApi.unlinkSourceOrder(order.id);
                                                            setSourceOrders(prev => prev.filter(o => o.id !== order.id));
                                                        } catch (err) {
                                                            console.error(err);
                                                            alert("Errore durante l'annullamento dell'associazione.");
                                                        }
                                                    }}
                                                    className="p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800/40 rounded-full"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {/* Documenti conformità collegati */}
                                    {complianceDocs.map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => setComplianceModalDoc(doc)}
                                            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-md px-3 py-1.5"
                                        >
                                            <ShieldCheck className="h-4 w-4" />
                                            {doc.documentTypeName}: {doc.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Modale dettaglio documento conformità */}
                    <Dialog open={!!complianceModalDoc} onOpenChange={(v) => !v && setComplianceModalDoc(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-violet-500" />
                                    {complianceModalDoc?.name}
                                </DialogTitle>
                                <DialogDescription>
                                    {complianceModalDoc?.documentTypeName}
                                    {complianceModalDoc?.brandName && ` · ${complianceModalDoc.brandName}`}
                                </DialogDescription>
                            </DialogHeader>
                            {complianceModalDoc?.notes && (
                                <div className="py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                    {complianceModalDoc.notes}
                                </div>
                            )}
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={async () => {
                                        if (!complianceModalDoc) return;
                                        if (!complianceModalDoc.fileUrl.includes('/')) {
                                            window.open(`/api/drive/download?fileId=${encodeURIComponent(complianceModalDoc.fileUrl)}&fileName=${encodeURIComponent(complianceModalDoc.name)}`, '_blank');
                                            return;
                                        }
                                        try {
                                            const supabase = createClient();
                                            const path = complianceModalDoc.fileUrl.split('/public/documents/')[1];
                                            if (!path) { window.open(complianceModalDoc.fileUrl, '_blank'); return; }
                                            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
                                            if (error || !data?.signedUrl) { window.open(complianceModalDoc.fileUrl, '_blank'); return; }
                                            window.open(data.signedUrl, '_blank');
                                        } catch { window.open(complianceModalDoc?.fileUrl, '_blank'); }
                                    }}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Apri documento PDF
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <PurchaseDocuments
                            purchaseId={id}
                            documentUrls={purchase.documentUrls}
                            onUpdate={loadData}
                            isOrder={isOrder}
                            supplierName={purchase.supplierName}
                        />
                        {!isOrder && (
                            <PurchaseDDTConformita
                                purchaseId={id}
                                supplierId={purchase.supplierId}
                                supplierName={purchase.supplierName}
                                onUpdate={loadData}
                            />
                        )}
                    </div>

                    {/* Items List */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                            <CardTitle>{isOrder ? "Materiali nell'Ordine" : "Materiali in Bolla"}</CardTitle>
                            {(userRole === 'admin' || userRole === 'operativo') && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                                        <span className="text-sm text-slate-500 shrink-0">Costo trasporto €</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={transportInput}
                                            onChange={e => setTransportInput(e.target.value)}
                                            onBlur={handleSaveTransportCost}
                                            className="w-24 h-8 text-sm"
                                            placeholder="0.00"
                                        />
                                        {savingTransport && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                                    </div>
                                    {!isOrder && transportCost > 0 && (
                                        <div className="flex items-center gap-2">
                                            {items.some(i => !i.transportApplied) ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                                    onClick={handleApplyTransport}
                                                    disabled={applyingTransport}
                                                >
                                                    {applyingTransport
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                        : <Truck className="h-3.5 w-3.5 mr-1" />}
                                                    Applica trasporto a tutte le righe
                                                </Button>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Trasporto applicato
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {/* Desktop View: Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Materiale</TableHead>
                                            <TableHead className="text-right">Pezzi</TableHead>
                                            <TableHead className="text-right">Coeff.</TableHead>
                                            <TableHead className="text-right">Q.tà Tot.</TableHead>
                                            {showTransportCols && <TableHead className="text-right text-amber-600">Trasp./u.</TableHead>}
                                            <TableHead className="text-right">Prezzo Unit.</TableHead>
                                            <TableHead className="text-right">Totale Riga</TableHead>
                                            {showTransportCols && <TableHead className="text-right text-amber-600">P.U. c/Trasp.</TableHead>}
                                            {showTransportCols && <TableHead className="text-right text-amber-600">Tot. c/Trasp.</TableHead>}
                                            <TableHead>Destinazione</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => (
                                            <TableRow key={item.id} className={item.price === 0 ? "bg-yellow-50/50 dark:bg-yellow-900/20" : ""}>
                                                <TableCell>
                                                    <div className="font-medium">
                                                        {item.itemName}
                                                        {item.itemModel && <span className="text-slate-500 font-medium ml-1">({item.itemModel})</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{item.itemCode}</div>
                                                </TableCell>

                                                {/* Editable Fields */}
                                                {editingItemId === item.id ? (
                                                    <>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-20 ml-auto text-right h-8"
                                                                value={editValues.pieces}
                                                                onChange={(e) => {
                                                                    const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                                    const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                                    handleEditPiecesChange(e.target.value, coeff);
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">
                                                            {(() => {
                                                                const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                                return inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                            })()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-20 ml-auto text-right h-8"
                                                                value={editValues.quantity}
                                                                onChange={(e) => {
                                                                    const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                                    const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                                    handleEditQuantityChange(e.target.value, coeff);
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Input
                                                                type="number"
                                                                className="w-24 ml-auto text-right h-8"
                                                                value={editValues.price}
                                                                step="0.00001"
                                                                onChange={(e) => {
                                                                    const price = parseFloat(e.target.value);
                                                                    const quantity = parseFloat(editValues.quantity);
                                                                    const total = !isNaN(price) && !isNaN(quantity) ? (price * quantity).toFixed(2) : editValues.total;
                                                                    setEditValues({ ...editValues, price: e.target.value, total: total });
                                                                }}
                                                            />
                                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 leading-tight text-right">
                                                                Usa Totale Riga →
                                                            </p>
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
                                                        {showTransportCols && (userRole === 'admin' || userRole === 'operativo') && (
                                                            <TableCell className="text-right text-amber-600 text-xs">
                                                                {item.quantity > 0
                                                                    ? `€ ${(transportCost / items.length / item.quantity).toFixed(5)}`
                                                                    : '—'}
                                                            </TableCell>
                                                        )}
                                                        {showTransportCols && !(userRole === 'admin' || userRole === 'operativo') && (
                                                            <TableCell className="text-right"><span className="text-slate-400 italic text-xs">Riservato</span></TableCell>
                                                        )}
                                                        <TableCell className="text-right">
                                                            {(userRole === 'admin' || userRole === 'operativo') ? (
                                                                item.price === 0 ? (
                                                                    <span className="text-red-500 font-bold flex items-center justify-end">
                                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                                        MANCANTE
                                                                    </span>
                                                                ) : (
                                                                    `€ ${item.price.toFixed(5)}`
                                                                )
                                                            ) : (
                                                                <span className="text-slate-400 italic text-xs">Riservato</span>
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}

                                                <TableCell className="text-right font-medium">
                                                    {(userRole === 'admin' || userRole === 'operativo') ? (
                                                        editingItemId === item.id ? (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-24 ml-auto text-right h-8"
                                                                value={editValues.total}
                                                                onChange={(e) => handleEditTotalChange(e.target.value)}
                                                                onBlur={handleEditTotalBlur}
                                                            />
                                                        ) : (
                                                            `€ ${(item.quantity * item.price).toFixed(2)}`
                                                        )
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Riservato</span>
                                                    )}
                                                </TableCell>
                                                {showTransportCols && editingItemId !== item.id && (
                                                    <>
                                                        <TableCell className="text-right text-amber-700 font-medium">
                                                            {(userRole === 'admin' || userRole === 'operativo') && item.quantity > 0
                                                                ? `€ ${(item.price + transportCost / items.length / item.quantity).toFixed(5)}`
                                                                : <span className="text-slate-400 italic text-xs">Riservato</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right text-amber-700 font-bold">
                                                            {(userRole === 'admin' || userRole === 'operativo') && item.quantity > 0
                                                                ? `€ ${((item.price + transportCost / items.length / item.quantity) * item.quantity).toFixed(2)}`
                                                                : <span className="text-slate-400 italic text-xs">Riservato</span>}
                                                        </TableCell>
                                                    </>
                                                )}
                                                {showTransportCols && editingItemId === item.id && (
                                                    <>
                                                        <TableCell />
                                                        <TableCell />
                                                    </>
                                                )}

                                                <TableCell>
                                                    {item.jobId ? (
                                                        <span className="text-blue-600 font-medium text-sm">
                                                            Commessa: {item.jobName || item.jobCode}
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
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => {
                                                                const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                                const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                                saveEdit(item.id, coeff);
                                                            }}>
                                                                <Save className="h-4 w-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" onClick={cancelEdit}>
                                                                X
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => { setItemToDelete(item.id); setDeleteItemDialogOpen(true); }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        (userRole === 'admin' || userRole === 'operativo') && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => startEditing(item)}
                                                            >
                                                                Modifica
                                                            </Button>
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-50 dark:bg-slate-800 font-bold text-lg">
                                            <TableCell colSpan={showTransportCols ? 6 : 5} className="text-right">
                                                {isOrder ? "TOTALE ORDINE" : "TOTALE BOLLA"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(userRole === 'admin' || userRole === 'operativo') ? (
                                                    `€ ${items.reduce((acc, item) => acc + (item.quantity * item.price), 0).toFixed(2)}`
                                                ) : (
                                                    <span className="text-slate-400 italic text-sm">Riservato</span>
                                                )}
                                            </TableCell>
                                            {showTransportCols && (
                                                <>
                                                    <TableCell className="text-right text-amber-700">
                                                        {/* P.U. c/Trasp. non ha un totale significativo */}
                                                    </TableCell>
                                                    <TableCell className="text-right text-amber-700">
                                                        {(userRole === 'admin' || userRole === 'operativo') ? (
                                                            `€ ${items.reduce((acc, item) => {
                                                                const tpu = item.quantity > 0 ? transportCost / items.length / item.quantity : 0;
                                                                return acc + (item.price + tpu) * item.quantity;
                                                            }, 0).toFixed(2)}`
                                                        ) : ''}
                                                    </TableCell>
                                                </>
                                            )}
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile View: Cards List */}
                            <div className="md:hidden space-y-2">
                                {items.map((item) => (
                                    <div key={item.id} className={`bg-slate-50 dark:bg-slate-800 p-2.5 rounded-md space-y-2 text-sm shadow-sm ${item.price === 0 ? "border-l-4 border-yellow-500" : "border border-slate-200 dark:border-slate-700"}`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">
                                                        {item.itemName}
                                                    </h4>
                                                    {item.itemModel && <span className="text-slate-500 text-xs">({item.itemModel})</span>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-mono text-slate-500">{item.itemCode}</span>
                                                    {item.jobId ? (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                                                            {item.jobName || item.jobCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-medium">
                                                            Magazzino
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {(userRole === 'admin' || userRole === 'operativo') && (
                                                <div className="flex gap-0 shrink-0">
                                                    {editingItemId === item.id ? (
                                                        <>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => {
                                                                const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                                const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                                saveEdit(item.id, coeff);
                                                            }}>
                                                                <Save className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500" onClick={cancelEdit}>
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { setItemToDelete(item.id); setDeleteItemDialogOpen(true); }}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => startEditing(item)}>
                                                            <Edit className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {editingItemId === item.id ? (
                                            <div className="grid grid-cols-2 gap-2 bg-white dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700/50">
                                                <div className="col-span-1">
                                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Pezzi</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-7 text-sm"
                                                        value={editValues.pieces}
                                                        onChange={(e) => {
                                                            const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                            const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                            handleEditPiecesChange(e.target.value, coeff);
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Quantità</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-7 text-sm"
                                                        value={editValues.quantity}
                                                        onChange={(e) => {
                                                            const inventoryItem = inventory.find(inv => inv.id === item.itemId);
                                                            const coeff = inventoryItem?.coefficient ? Number(inventoryItem.coefficient) : (item.coefficient ? Number(item.coefficient) : 1);
                                                            handleEditQuantityChange(e.target.value, coeff);
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Prezzo</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.00001"
                                                        className="h-7 text-sm"
                                                        value={editValues.price}
                                                        onChange={(e) => {
                                                            const price = parseFloat(e.target.value);
                                                            const quantity = parseFloat(editValues.quantity);
                                                            const total = !isNaN(price) && !isNaN(quantity) ? (price * quantity).toFixed(2) : editValues.total;
                                                            setEditValues({ ...editValues, price: e.target.value, total });
                                                        }}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <Label className="text-[10px] text-slate-500 uppercase tracking-wider">Totale Riga</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        className="h-7 text-sm"
                                                        value={editValues.total}
                                                        onChange={(e) => handleEditTotalChange(e.target.value)}
                                                        onBlur={handleEditTotalBlur}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-200/50 dark:border-slate-700/50 mt-1">
                                                <div>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                                        {item.quantity}
                                                    </span>
                                                    {item.pieces && <span className="text-slate-500 text-xs ml-1">({item.pieces} pz)</span>}
                                                </div>

                                                <div className="text-right">
                                                    {(userRole === 'admin' || userRole === 'operativo') ? (
                                                        item.price === 0 ? (
                                                            <span className="text-red-500 font-bold text-xs flex items-center">
                                                                <AlertTriangle className="h-3 w-3 mr-1" /> MANCANTE
                                                            </span>
                                                        ) : (
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <span className="font-mono text-xs text-slate-500">P.U.: € {item.price.toFixed(5)}</span>
                                                                <span className="font-bold text-slate-900 dark:text-white text-xs">Tot: € {(item.quantity * item.price).toFixed(2)}</span>
                                                                {showTransportCols && item.quantity > 0 && (() => {
                                                                    const tpu = transportCost / items.length / item.quantity;
                                                                    return (
                                                                        <>
                                                                            <span className="text-[10px] text-amber-600">Trasp./u.: € {tpu.toFixed(5)}</span>
                                                                            <span className="text-[10px] text-amber-700 font-semibold">Tot. c/Trasp.: € {((item.price + tpu) * item.quantity).toFixed(2)}</span>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Riservato</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md flex justify-between items-center font-bold text-sm">
                                    <span>{isOrder ? "TOTALE ORDINE" : "TOTALE BOLLA"}</span>
                                    {(userRole === 'admin' || userRole === 'operativo') ? (
                                        <div className="text-right">
                                            <div>{`€ ${items.reduce((acc, item) => acc + (item.quantity * item.price), 0).toFixed(2)}`}</div>
                                            {showTransportCols && (
                                                <div className="text-xs text-amber-700 font-semibold">
                                                    c/Trasp.: € {items.reduce((acc, item) => {
                                                        const tpu = item.quantity > 0 ? transportCost / items.length / item.quantity : 0;
                                                        return acc + (item.price + tpu) * item.quantity;
                                                    }, 0).toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 italic text-sm">Riservato</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Traceability Table */}
                    {!isOrder && <Card>
                        <CardHeader>
                            <CardTitle>Tracciabilità Lotti</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Desktop View */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Articolo</TableHead>
                                            <TableHead className="text-right">Q.tà Iniziale</TableHead>
                                            <TableHead className="text-right">Q.tà Residua</TableHead>
                                            <TableHead className="text-right">Stato</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            const batch = batchAvailability.find(b => b.id === item.id);
                                            const isJobAssigned = purchase?.jobId != null;
                                            // FIX: Use batch remainingQty if available, otherwise fallback.
                                            // Don't force 0 for isJobAssigned if we have actual batch data (which includes returns).
                                            // Se il lotto non è nella vista (es. esaurito o pezzi=null) mostriamo 0,
                                            // non il valore originale che porterebbe a mostrare come "disponibile"
                                            // materiale già uscito. Il fallback item.quantity è fuorviante.
                                            const remaining = batch ? batch.remainingQty : (isJobAssigned ? 0 : 0);
                                            const original = item.quantity;

                                            let statusColor = "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
                                            let statusText = "Disponibile";

                                            if (isJobAssigned && remaining <= 0.001) {
                                                statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
                                                statusText = "A cantiere";
                                            } else if (remaining <= 0.001) {
                                                statusColor = "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
                                                statusText = "Esaurito";
                                            } else if (remaining < original) {
                                                statusColor = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300";
                                                statusText = "Parziale";
                                            } else if (remaining > original) {
                                                statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
                                                statusText = "Eccedenza";
                                            }

                                            let jobMovements = itemJobMovements[item.id] || [];
                                            // FIX:For direct purchases, show "Net at Job" (Original - Remaining).
                                            // This accounts for returns.
                                            if (isJobAssigned && jobMovements.length === 0) {
                                                const job = jobs.find(j => j.id === purchase.jobId);
                                                const netAtJob = Math.max(0, item.quantity - (remaining || 0));

                                                if (job && netAtJob > 0.001) {
                                                    jobMovements = [{
                                                        jobId: job.id,
                                                        jobCode: job.code,
                                                        jobName: job.name,
                                                        jobDescription: job.description,
                                                        totalQuantity: netAtJob,
                                                        totalPieces: 0 // Pieces logic might be complex, leaving 0 or proportional?
                                                    }];
                                                }
                                            }

                                            const isExpanded = expandedItems.has(item.id);
                                            const hasMovements = jobMovements.length > 0;

                                            return (
                                                <>
                                                    <TableRow key={item.id} className={hasMovements ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" : ""}>
                                                        <TableCell onClick={() => hasMovements && toggleExpanded(item.id)}>
                                                            <div className="flex items-center gap-2">
                                                                {hasMovements && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 p-0"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleExpanded(item.id);
                                                                        }}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronDown className="h-4 w-4 text-slate-500" />
                                                                        ) : (
                                                                            <ChevronRight className="h-4 w-4 text-slate-500" />
                                                                        )}
                                                                    </Button>
                                                                )}
                                                                <div className={!hasMovements ? "ml-8" : ""}>
                                                                    <div className="font-medium">
                                                                        {item.itemName}
                                                                        {item.itemModel && <span className="text-slate-500 font-normal ml-1">({item.itemModel})</span>}
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">{item.itemCode}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">{original}</TableCell>
                                                        <TableCell className="text-right font-bold">
                                                            {typeof remaining === 'number' ? remaining.toFixed(2) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Badge variant="secondary" className={statusColor}>
                                                                {statusText}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && jobMovements.map((movement, idx) => (
                                                        <TableRow key={`${item.id}-job-${idx}`} className="bg-slate-50/50 dark:bg-slate-900/50">
                                                            <TableCell colSpan={4}>
                                                                <div className="pl-10 py-1 flex items-center gap-2">
                                                                    <span className="text-slate-400">└─</span>
                                                                    <Link
                                                                        href={`/jobs/${movement.jobId}`}
                                                                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                                                    >
                                                                        {movement.jobName || movement.jobCode}
                                                                    </Link>
                                                                    <span className="text-slate-600 dark:text-slate-300">
                                                                        {movement.totalPieces > 0 && `${movement.totalPieces} pz`}
                                                                        {movement.totalPieces > 0 && movement.totalQuantity > 0 && ' - '}
                                                                        {movement.totalQuantity > 0 && `${movement.totalQuantity.toFixed(2)} ${item.itemModel || 'm²'}`}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile View */}
                            <div className="md:hidden space-y-2">
                                {items.map((item) => {
                                    const batch = batchAvailability.find(b => b.id === item.id);
                                    const isJobAssigned = purchase?.jobId != null;
                                    // FIX: Use batch remainingQty if available, otherwise fallback.
                                    const remaining = batch ? batch.remainingQty : 0;
                                    const original = item.quantity;

                                    let statusColor = "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
                                    let statusText = "Disponibile";

                                    if (isJobAssigned && remaining <= 0.001) {
                                        statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
                                        statusText = "A cantiere";
                                    } else if (remaining <= 0.001) {
                                        statusColor = "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
                                        statusText = "Esaurito";
                                    } else if (remaining < original) {
                                        statusColor = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300";
                                        statusText = "Parziale";
                                    } else if (remaining > original) {
                                        statusColor = "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
                                        statusText = "Eccedenza";
                                    }

                                    let jobMovements = itemJobMovements[item.id] || [];
                                    // FIX: For direct purchases, show "Net at Job" (Original - Remaining).
                                    if (isJobAssigned && jobMovements.length === 0) {
                                        const job = jobs.find(j => j.id === purchase.jobId);
                                        const netAtJob = Math.max(0, item.quantity - (remaining || 0));

                                        if (job && netAtJob > 0.001) {
                                            jobMovements = [{
                                                jobId: job.id,
                                                jobCode: job.code,
                                                jobName: job.name,
                                                jobDescription: job.description,
                                                totalQuantity: netAtJob,
                                                totalPieces: 0
                                            }];
                                        }
                                    }

                                    const isExpanded = expandedItems.has(item.id);
                                    const hasMovements = jobMovements.length > 0;

                                    return (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-md text-sm border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                                            <div className="p-2.5 space-y-2">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {hasMovements && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-5 w-5 p-0 shrink-0"
                                                                    onClick={() => toggleExpanded(item.id)}
                                                                >
                                                                    {isExpanded ? (
                                                                        <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                                                    ) : (
                                                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                                                                    )}
                                                                </Button>
                                                            )}
                                                            <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">
                                                                {item.itemName}
                                                            </h4>
                                                            {item.itemModel && <span className="text-slate-500 text-xs">({item.itemModel})</span>}
                                                        </div>
                                                        <p className="text-xs text-slate-500 font-mono mt-0.5">{item.itemCode}</p>
                                                    </div>
                                                    <Badge variant="secondary" className={`${statusColor} text-[10px] px-1.5 py-0 shrink-0`}>
                                                        {statusText}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-200/50 dark:border-slate-700/50 mt-1">
                                                    <div>
                                                        <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Iniziale</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">{original}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Residua</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">
                                                            {typeof remaining === 'number' ? remaining.toFixed(2) : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && jobMovements.length > 0 && (
                                                <div className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-2 space-y-1">
                                                    {jobMovements.map((movement, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <span className="text-slate-400">└─</span>
                                                            <Link
                                                                href={`/jobs/${movement.jobId}`}
                                                                className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                                            >
                                                                {movement.jobName || movement.jobCode}
                                                            </Link>
                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                {movement.totalPieces > 0 && `${movement.totalPieces} pz`}
                                                                {movement.totalPieces > 0 && movement.totalQuantity > 0 && ' - '}
                                                                {movement.totalQuantity > 0 && `${movement.totalQuantity.toFixed(2)} ${item.itemModel || 'm²'}`}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                                }
                            </div>
                        </CardContent>
                    </Card>}

                    <Dialog open={isAddPopupOpen} onOpenChange={setIsAddPopupOpen}>
                        <DialogContent className="max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Aggiungi Materiale</DialogTitle>
                            </DialogHeader>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700 space-y-4">
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
                                        <Label>Pezzi <span className="text-xs text-muted-foreground font-normal">(Coeff: {newItem.coefficient || 1})</span></Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={newItem.pieces}
                                            onChange={(e) => handleNewItemPiecesChange(e.target.value)}
                                            placeholder="0"
                                        />
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
                                            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                            placeholder="0"
                                        />
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                            Usa il totale riga ÷ quantità se hai solo il totale in fattura.
                                        </p>
                                    </div>
                                    <div className="md:col-span-2 flex items-center gap-2 pb-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="isJobNew"
                                                checked={newItem.isJob}
                                                onCheckedChange={(c) => setNewItem({ ...newItem, isJob: c as boolean })}
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

                                <DialogFooter className="mt-4">
                                    <Button variant="outline" onClick={() => setIsAddPopupOpen(false)}>
                                        Annulla
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={async () => {
                                            await handleAddItem();
                                            // If successful, close dialog? handleAddItem doesn't return success status easily but it alerts on error.
                                            // We can check if newItem is reset.
                                            if (newItem.itemId === "") setIsAddPopupOpen(false);
                                        }}
                                        disabled={addingItem}
                                    >
                                        {addingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        Aggiungi Riga
                                    </Button>
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <ItemSelectorDialog
                        open={isItemSelectorOpen}
                        onOpenChange={setIsItemSelectorOpen}
                        items={inventory}
                        onSelect={(item) => {
                            setSelectedItemForLine(item);
                            setNewItem(prev => ({
                                ...prev,
                                itemId: item.id,
                                coefficient: item.coefficient ? Number(item.coefficient) : 1,
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
                        jobs={jobs}
                        onSelect={handleJobSelect}
                    />

                    <JobSelectorDialog
                        open={isHeaderJobSelectorOpen}
                        onOpenChange={setIsHeaderJobSelectorOpen}
                        jobs={jobs}
                        onSelect={handleHeaderJobSelect}
                    />
                </div >
            </div >
        </DashboardLayout >

        <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title={`Elimina ${purchase?.orderType === 'order' ? 'ordine' : 'acquisto'}`}
            description={`${purchase?.orderType === 'order' ? "L'ordine" : "L'acquisto"} ${purchase?.deliveryNoteNumber} verrà spostato nel Cestino e potrà essere ripristinato dagli admin entro 30 giorni. L'eliminazione è bloccata se: è agganciato a una fattura, è collegato a una commessa, o ha articoli già movimentati in bolle.`}
            loading={deleting}
            onConfirm={handleDeletePurchase}
        />

        <ConfirmDeleteDialog
            open={deleteItemDialogOpen}
            onOpenChange={setDeleteItemDialogOpen}
            title="Elimina riga"
            description="Eliminare questa riga è un'azione definitiva e non può essere annullata. Procedere solo se la riga è stata inserita per errore."
            onConfirm={handleDeleteItem}
        />
        </>
    );
}
