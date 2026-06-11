"use client"

import { notify } from "@/lib/notify";;

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, Trash2, Loader2, Search, X, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    suppliersApi,
    inventoryApi,
    jobsApi,
    purchasesApi,
    Supplier,
    InventoryItem,
    Job
} from "@/lib/api";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog";
import { useAuth } from "@/components/auth-provider";

interface PurchaseLine {
    tempId: string;
    itemId: string;
    itemName: string;
    itemModel?: string;
    itemBrand?: string;
    itemCategory?: string;
    itemDescription?: string;
    itemCode?: string;
    pieces: string;
    quantity: string;
    coefficient: number;
    unit: string;
    price: string;
    total: string;
    isJob: boolean;
    jobId?: string;
    jobCode?: string;
}

const emptyLine = (): PurchaseLine => ({
    tempId: Math.random().toString(36).substr(2, 9),
    itemId: "",
    itemName: "",
    pieces: "",
    quantity: "",
    coefficient: 1,
    unit: "PZ",
    price: "0",
    total: "0",
    isJob: false,
});

const ensureTrailingEmpty = (lines: PurchaseLine[]): PurchaseLine[] => {
    const last = lines[lines.length - 1];
    if (!last || last.itemId) {
        return [...lines, emptyLine()];
    }
    return lines;
};

function NewPurchaseContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOrder = searchParams?.get("type") === "order";
    const presetJobId = searchParams?.get("jobId") ?? "";
    const fromOrderIds = searchParams?.get("fromOrders")?.split(',').filter(Boolean) ?? [];
    const { userRole } = useAuth();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [jobsLoading, setJobsLoading] = useState(false);

    if (userRole === 'user') {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full py-20">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
                    <p className="text-slate-500 mb-6">Non hai i permessi necessari.</p>
                    <Link href="/purchases">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Torna
                        </Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    // Data Sources
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);

    // Form State - Header
    const [formData, setFormData] = useState({
        supplierId: "",
        deliveryNoteNumber: "",
        deliveryNoteDate: new Date().toISOString().split('T')[0],
        jobId: ""
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Form State - Lines (inline table)
    const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);

    // Dialog States
    const [openItemSelectorForRowId, setOpenItemSelectorForRowId] = useState<string | null>(null);
    const [openJobSelectorForRowId, setOpenJobSelectorForRowId] = useState<string | null>(null);
    const [isHeaderJobSelectorOpen, setIsHeaderJobSelectorOpen] = useState(false);
    const [selectedHeaderJob, setSelectedHeaderJob] = useState<Job | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) setSelectedFiles(prev => [...prev, ...files]);
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setInitialLoading(true);
            const [suppliersData, inventoryData, jobsData] = await Promise.all([
                suppliersApi.getAll(),
                inventoryApi.getPaginated({ page: 1, limit: 50 }),
                jobsApi.getPaginated({ page: 1, limit: 50, status: 'active' })
            ]);
            setSuppliers(suppliersData);
            setInventory(inventoryData.items);
            setJobs(jobsData.data);

            // ── Pre-populate from orders ──────────────────────────────────────
            if (fromOrderIds.length > 0) {
                const orders = await purchasesApi.getOrdersForConversion(fromOrderIds);
                if (orders.length > 0) {
                    const first = orders[0];

                    // Fornitore
                    setFormData(prev => ({ ...prev, supplierId: first.supplierId }));

                    // Commessa: usa quella del primo ordine se tutti coincidono
                    const allSameJob = orders.every(o => o.jobId === first.jobId);
                    const headerJobId = allSameJob && first.jobId ? first.jobId : null;
                    if (headerJobId) {
                        const job = jobsData.data.find((j: any) => j.id === headerJobId)
                            ?? await jobsApi.getById(headerJobId).catch(() => null);
                        if (job) {
                            setSelectedHeaderJob(job);
                            setFormData(prev => ({ ...prev, supplierId: first.supplierId, jobId: job.id }));
                        } else {
                            setFormData(prev => ({ ...prev, supplierId: first.supplierId }));
                        }
                    }

                    // Righe: aggrega tutti gli articoli da tutti gli ordini
                    const orderLines: PurchaseLine[] = orders.flatMap(order =>
                        order.items.map(item => ({
                            tempId: Math.random().toString(36).substr(2, 9),
                            itemId: item.itemId,
                            itemName: item.itemName,
                            itemModel: item.itemModel,
                            itemCode: item.itemCode,
                            itemBrand: undefined,
                            itemCategory: undefined,
                            itemDescription: undefined,
                            coefficient: item.coefficient,
                            unit: item.itemUnit,
                            pieces: item.pieces != null ? String(item.pieces) : "",
                            quantity: item.quantity != null ? String(item.quantity) : "",
                            price: item.price != null ? String(item.price) : "0",
                            total: item.price != null && item.quantity != null
                                ? (item.price * item.quantity).toFixed(2) : "0",
                            isJob: !!item.jobId,
                            jobId: item.jobId ?? undefined,
                            jobCode: item.jobCode ?? undefined,
                        }))
                    );
                    setLines(ensureTrailingEmpty(orderLines));
                }
                return; // skip presetJobId logic below
            }

            // Pre-populate job from query param
            if (presetJobId) {
                const presetJob = jobsData.data.find((j: any) => j.id === presetJobId);
                if (presetJob) {
                    setSelectedHeaderJob(presetJob);
                    setFormData(prev => ({ ...prev, jobId: presetJob.id }));
                } else {
                    try {
                        const j = await jobsApi.getById(presetJobId);
                        if (j) {
                            setSelectedHeaderJob(j);
                            setFormData(prev => ({ ...prev, jobId: j.id }));
                        }
                    } catch { /* ignore */ }
                }
            }
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleItemSearch = useCallback(async (term: string) => {
        setItemsLoading(true);
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term });
            setInventory(items);
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setItemsLoading(false);
        }
    }, []);

    const handleJobSearch = useCallback(async (term: string) => {
        setJobsLoading(true);
        try {
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 50, search: term, status: 'active' });
            setJobs(data);
        } catch (error) {
            console.error("Failed to search jobs", error);
        } finally {
            setJobsLoading(false);
        }
    }, []);

    // ── Item selection (per row) ──────────────────────────────────────────────

    const openItemSelector = (rowId: string) => {
        setOpenItemSelectorForRowId(rowId);
    };

    const handleItemSelect = (item: InventoryItem) => {
        if (!openItemSelectorForRowId) return;
        setLines(prev => {
            const updated = prev.map(line => {
                if (line.tempId !== openItemSelectorForRowId) return line;
                return {
                    ...line,
                    itemId: item.id,
                    itemName: item.name,
                    itemModel: item.model,
                    itemBrand: item.brand,
                    itemCategory: item.type,
                    itemDescription: item.description,
                    itemCode: item.code,
                    coefficient: item.coefficient ? Number(item.coefficient) : 1,
                    unit: item.unit || 'PZ',
                    pieces: "",
                    quantity: "",
                    price: "0",
                    total: "0",
                    isJob: !!formData.jobId,
                    jobId: formData.jobId || undefined,
                    jobCode: selectedHeaderJob?.code,
                };
            });
            return ensureTrailingEmpty(updated);
        });
        setOpenItemSelectorForRowId(null);
    };

    // ── Job selection (per row) ───────────────────────────────────────────────

    const openJobSelector = (rowId: string) => {
        setOpenJobSelectorForRowId(rowId);
    };

    const clearLineJob = (tempId: string) => {
        setLines(prev => prev.map(line =>
            line.tempId !== tempId ? line : { ...line, isJob: false, jobId: undefined, jobCode: undefined }
        ));
    };

    const handleJobSelect = (job: Job) => {
        if (!openJobSelectorForRowId) return;
        setLines(prev => prev.map(line =>
            line.tempId !== openJobSelectorForRowId ? line :
                { ...line, isJob: true, jobId: job.id, jobCode: job.code }
        ));
        setOpenJobSelectorForRowId(null);
    };

    // ── Header job selection ──────────────────────────────────────────────────

    const handleHeaderJobSelect = (job: Job) => {
        setSelectedHeaderJob(job);
        setFormData(prev => ({ ...prev, jobId: job.id }));
        setIsHeaderJobSelectorOpen(false);
    };

    // ── Conversion handlers ───────────────────────────────────────────────────

    const handleLinePiecesChange = (tempId: string, piecesStr: string) => {
        setLines(prev => prev.map(line => {
            if (line.tempId !== tempId) return line;
            const pieces = parseFloat(piecesStr);
            if (isNaN(pieces)) return { ...line, pieces: piecesStr, quantity: "", total: "" };
            const quantity = (pieces * line.coefficient).toFixed(2);
            const price = parseFloat(line.price);
            const total = !isNaN(price) && price > 0 ? (parseFloat(quantity) * price).toFixed(2) : line.total;
            return { ...line, pieces: piecesStr, quantity, total };
        }));
    };

    const handleLineQuantityChange = (tempId: string, quantityStr: string) => {
        setLines(prev => prev.map(line => {
            if (line.tempId !== tempId) return line;
            const quantity = parseFloat(quantityStr);
            if (isNaN(quantity)) return { ...line, quantity: quantityStr, pieces: "", total: "" };
            const pieces = line.coefficient !== 1
                ? (quantity / line.coefficient).toFixed(2)
                : quantityStr;
            const price = parseFloat(line.price);
            const total = !isNaN(price) && price > 0 ? (quantity * price).toFixed(2) : line.total;
            return { ...line, quantity: quantityStr, pieces, total };
        }));
    };

    const handleLinePriceChange = (tempId: string, priceStr: string) => {
        setLines(prev => prev.map(line => {
            if (line.tempId !== tempId) return line;
            const price = parseFloat(priceStr);
            const quantity = parseFloat(line.quantity);
            const total = !isNaN(price) && !isNaN(quantity) && quantity > 0
                ? (price * quantity).toFixed(2)
                : line.total;
            return { ...line, price: priceStr, total };
        }));
    };

    const handleLineTotalChange = (tempId: string, totalStr: string) => {
        setLines(prev => prev.map(line =>
            line.tempId !== tempId ? line : { ...line, total: totalStr }
        ));
    };

    const handleLineTotalBlur = (tempId: string) => {
        setLines(prev => prev.map(line => {
            if (line.tempId !== tempId) return line;
            const total = parseFloat(line.total);
            const quantity = parseFloat(line.quantity);
            if (isNaN(total) || isNaN(quantity) || quantity === 0) return line;
            const price = (total / quantity).toFixed(5);
            return { ...line, price, total: total.toFixed(2) };
        }));
    };

    const removeLine = (tempId: string) => {
        setLines(prev => {
            if (prev.length === 1) return [emptyLine()];
            const updated = prev.filter(l => l.tempId !== tempId);
            return ensureTrailingEmpty(updated);
        });
    };

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.supplierId || !formData.deliveryNoteNumber || !formData.deliveryNoteDate) {
            notify.warning(isOrder ? "Compila i dati dell'ordine (Fornitore, Numero, Data)" : "Compila i dati della bolla (Fornitore, Numero, Data)");
            return;
        }

        const validLines = lines.filter(l => l.itemId && l.quantity && l.price);
        if (validLines.length === 0) {
            notify.warning(isOrder ? "Inserisci almeno un materiale nell'ordine" : "Inserisci almeno una riga nell'acquisto");
            return;
        }

        try {
            setLoading(true);

            let documentUrls: string[] = [];
            if (selectedFiles.length > 0) {
                documentUrls = await Promise.all(selectedFiles.map(f => purchasesApi.uploadDocument(f)));
            }

            const purchase = await purchasesApi.create({
                supplierId: formData.supplierId,
                deliveryNoteNumber: formData.deliveryNoteNumber,
                deliveryNoteDate: formData.deliveryNoteDate,
                notes: '',
                jobId: formData.jobId || undefined,
                documentUrls,
                orderType: isOrder ? 'order' : 'purchase',
            });

            for (const line of validLines) {
                const qty = parseFloat(line.quantity);
                const pieces = parseFloat(line.pieces);
                await purchasesApi.addItem({
                    purchaseId: purchase.id,
                    itemId: line.itemId,
                    quantity: qty,
                    pieces: !isNaN(pieces) ? pieces : (line.coefficient === 1 ? qty : undefined),
                    coefficient: line.coefficient,
                    price: parseFloat(line.price),
                    jobId: line.jobId
                });
            }

            router.push(isOrder ? '/purchases?tab=ordini' : '/purchases');
        } catch (error: any) {
            console.error("Failed to save purchase", error);
            alert(`Errore durante il salvataggio: ${error.message || error.toString()}`);
        } finally {
            setLoading(false);
        }
    };

    const grandTotal = lines.reduce((acc, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const price = parseFloat(l.price) || 0;
        return acc + qty * price;
    }, 0);

    if (initialLoading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto pb-10">
                <div className="mb-6">
                    <Link href={fromOrderIds.length > 0 ? "/purchases?tab=ordini" : isOrder ? "/purchases?tab=ordini" : "/purchases"} className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        {fromOrderIds.length > 0 ? "Torna agli Ordini" : isOrder ? "Torna agli Ordini" : "Torna agli Acquisti"}
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {fromOrderIds.length > 0 ? "Converti Ordini in Acquisto" : isOrder ? "Registrazione Ordine" : "Registrazione Acquisto / Bolla"}
                    </h1>
                    {fromOrderIds.length > 0 && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            Form precompilato da {fromOrderIds.length} ordine{fromOrderIds.length > 1 ? 'i' : ''}. Inserisci numero e data bolla, poi salva.
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header Data */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{isOrder ? "Dati Ordine" : "Dati Bolla"}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="supplier">Fornitore *</Label>
                                <Select
                                    value={formData.supplierId}
                                    onValueChange={(v) => setFormData({ ...formData, supplierId: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona Fornitore" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bolla">{isOrder ? "Numero Ordine *" : "Numero Bolla *"}</Label>
                                <Input
                                    id="bolla"
                                    value={formData.deliveryNoteNumber}
                                    onChange={(e) => setFormData({ ...formData, deliveryNoteNumber: e.target.value })}
                                    placeholder={isOrder ? "Es. ORD-2024-001" : "Es. 123/A"}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">{isOrder ? "Data Ordine *" : "Data Bolla *"}</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.deliveryNoteDate}
                                    onChange={(e) => setFormData({ ...formData, deliveryNoteDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Commessa (Generale)</Label>
                                <div
                                    className="flex items-center justify-between border dark:border-slate-600 rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 h-10"
                                    onClick={() => setIsHeaderJobSelectorOpen(true)}
                                >
                                    {selectedHeaderJob ? (
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-sm truncate">{selectedHeaderJob.code}</span>
                                            {selectedHeaderJob.clientName && (
                                                <span className="text-[10px] text-slate-500 truncate">{selectedHeaderJob.clientName}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-slate-500 truncate">Seleziona per intero acquisto...</span>
                                    )}
                                    {selectedHeaderJob ? (
                                        <X
                                            className="h-4 w-4 text-slate-400 hover:text-red-500 flex-shrink-0 ml-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedHeaderJob(null);
                                                setFormData(prev => ({ ...prev, jobId: "" }));
                                            }}
                                        />
                                    ) : (
                                        <Search className="h-4 w-4 text-slate-400 flex-shrink-0 ml-1" />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 md:col-span-4 border-t pt-2">
                                <Label>Documento Allegato (PDF, Immagine)</Label>
                                <div
                                    className={`relative border-2 border-dashed rounded-md p-4 transition-colors text-center ${isDragging
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        }`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <Input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        multiple
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length) setSelectedFiles(prev => [...prev, ...files]);
                                            e.target.value = "";
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="pointer-events-none flex flex-col items-center justify-center gap-1">
                                        <Upload className={`h-8 w-8 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
                                        {selectedFiles.length > 0 ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                {selectedFiles.map((f, i) => (
                                                    <p key={i} className="text-sm font-medium text-blue-600 dark:text-blue-400">{f.name}</p>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {isDragging ? "Rilascia i file qui..." : "Clicca o trascina qui uno o più file"}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inline Items Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{isOrder ? "Materiali Ordinati" : "Materiali in Bolla"}</CardTitle>
                            <CardDescription>Clicca su una riga per selezionare il materiale, poi inserisci le quantità e i prezzi</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6 sm:pt-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Materiale</TableHead>
                                            <TableHead className="w-[90px] text-center">Pezzi</TableHead>
                                            <TableHead className="w-[70px] text-center">Coeff.</TableHead>
                                            <TableHead className="w-[110px] text-center">Quantità</TableHead>
                                            <TableHead className="w-[120px] text-right">Prezzo Unit.</TableHead>
                                            <TableHead className="w-[120px] text-right">Totale Riga</TableHead>
                                            <TableHead className="w-[120px] text-center">Commessa</TableHead>
                                            <TableHead className="w-[44px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lines.map((line, index) => {
                                            const isLast = index === lines.length - 1;
                                            return (
                                                <TableRow key={line.tempId} className="group">
                                                    {/* Materiale */}
                                                    <TableCell
                                                        className="cursor-pointer select-none py-2"
                                                        onClick={() => openItemSelector(line.tempId)}
                                                    >
                                                        {line.itemId ? (
                                                            <div className="space-y-0.5">
                                                                <div className="font-mono text-[10px] text-muted-foreground leading-none">{line.itemCode}</div>
                                                                <div className="font-medium text-sm leading-tight">{line.itemName}</div>
                                                                {line.itemModel && (
                                                                    <div className="text-xs text-muted-foreground leading-none">{line.itemModel}</div>
                                                                )}
                                                                {line.itemCategory && line.itemBrand && (
                                                                    <div className="text-xs text-slate-400 leading-none">{line.itemCategory} · {line.itemBrand}</div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-muted-foreground py-1">
                                                                <Search className="h-4 w-4 shrink-0" />
                                                                <span className="text-sm">Cerca materiale...</span>
                                                            </div>
                                                        )}
                                                    </TableCell>

                                                    {/* Pezzi */}
                                                    <TableCell className="py-2 px-1">
                                                        <Input
                                                            type="number"
                                                            inputMode="decimal"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.pieces}
                                                            onChange={e => handleLinePiecesChange(line.tempId, e.target.value)}
                                                            placeholder="0"
                                                            className="h-9 text-center px-1"
                                                            disabled={!line.itemId}
                                                        />
                                                    </TableCell>

                                                    {/* Coefficiente */}
                                                    <TableCell className="py-2 px-1 text-center">
                                                        <span className="text-sm text-muted-foreground">
                                                            {line.itemId ? line.coefficient : "—"}
                                                        </span>
                                                    </TableCell>

                                                    {/* Quantità */}
                                                    <TableCell className="py-2 px-1">
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.quantity}
                                                                onChange={e => handleLineQuantityChange(line.tempId, e.target.value)}
                                                                placeholder="0.00"
                                                                className="h-9 text-center px-1"
                                                                disabled={!line.itemId}
                                                            />
                                                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">{line.unit}</span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Prezzo Unit. */}
                                                    <TableCell className="py-2 px-1">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <span className="text-xs text-slate-400 shrink-0">€</span>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min="0"
                                                                step="0.00001"
                                                                value={line.price}
                                                                onChange={e => handleLinePriceChange(line.tempId, e.target.value)}
                                                                placeholder="0"
                                                                className="h-9 text-right px-1 w-24"
                                                                disabled={!line.itemId}
                                                            />
                                                        </div>
                                                    </TableCell>

                                                    {/* Totale Riga */}
                                                    <TableCell className="py-2 px-1">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <span className="text-xs text-slate-400 shrink-0">€</span>
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min="0"
                                                                step="0.01"
                                                                value={line.total}
                                                                onChange={e => handleLineTotalChange(line.tempId, e.target.value)}
                                                                onBlur={() => handleLineTotalBlur(line.tempId)}
                                                                placeholder="0.00"
                                                                className="h-9 text-right px-1 w-24"
                                                                disabled={!line.itemId}
                                                            />
                                                        </div>
                                                    </TableCell>

                                                    {/* Commessa */}
                                                    <TableCell className="py-2 px-1 text-center">
                                                        {line.itemId && (
                                                            line.isJob && line.jobCode ? (
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openJobSelector(line.tempId)}
                                                                        className="text-blue-600 font-medium text-xs truncate max-w-[80px] hover:underline"
                                                                        title={line.jobCode}
                                                                    >
                                                                        {line.jobCode}
                                                                    </button>
                                                                    <X
                                                                        className="h-3 w-3 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                                                                        onClick={() => clearLineJob(line.tempId)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openJobSelector(line.tempId)}
                                                                    className="text-green-600 font-medium text-xs hover:text-green-800 hover:underline"
                                                                >
                                                                    Magazzino
                                                                </button>
                                                            )
                                                        )}
                                                    </TableCell>

                                                    {/* Elimina */}
                                                    <TableCell className="py-2 px-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            type="button"
                                                            onClick={() => removeLine(line.tempId)}
                                                            className={`h-8 w-8 transition-opacity ${isLast && !line.itemId
                                                                ? 'opacity-0 pointer-events-none'
                                                                : 'text-destructive hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                                                                }`}
                                                            tabIndex={-1}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {/* Totale */}
                                        {lines.some(l => l.itemId) && (
                                            <TableRow className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2">
                                                <TableCell colSpan={5} className="text-right pr-4 text-base dark:text-white py-3">
                                                    {isOrder ? "TOTALE ORDINE" : "TOTALE BOLLA"}
                                                </TableCell>
                                                <TableCell className="text-right text-base dark:text-white py-3 pr-2">
                                                    <span className="text-xs font-normal text-slate-400 mr-0.5">€</span>
                                                    {grandTotal.toFixed(2)}
                                                </TableCell>
                                                <TableCell colSpan={2} />
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Link href="/purchases">
                            <Button variant="outline" type="button">Annulla</Button>
                        </Link>
                        <Button type="submit" disabled={loading} className="bg-blue-600 w-32">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salva</>}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Item Selector Dialog */}
            <ItemSelectorDialog
                open={!!openItemSelectorForRowId}
                onOpenChange={(open) => { if (!open) setOpenItemSelectorForRowId(null); }}
                onSelect={handleItemSelect}
                items={inventory}
                onSearch={handleItemSearch}
                loading={itemsLoading}
            />

            {/* Job Selector Dialog (per row) */}
            <JobSelectorDialog
                open={!!openJobSelectorForRowId}
                onOpenChange={(open) => { if (!open) setOpenJobSelectorForRowId(null); }}
                onSelect={handleJobSelect}
                jobs={jobs}
                onSearch={handleJobSearch}
                loading={jobsLoading}
            />

            {/* Header Job Selector Dialog */}
            <JobSelectorDialog
                open={isHeaderJobSelectorOpen}
                onOpenChange={setIsHeaderJobSelectorOpen}
                onSelect={handleHeaderJobSelect}
                jobs={jobs}
                onSearch={handleJobSearch}
                loading={jobsLoading}
            />
        </DashboardLayout>
    );
}

export default function NewPurchasePage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        }>
            <NewPurchaseContent />
        </Suspense>
    );
}
