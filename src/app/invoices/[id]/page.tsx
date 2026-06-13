"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft, FileText, Calendar, User, Loader2, ExternalLink,
    Trash2, ChevronDown, ChevronRight, Pencil, X, Save, Plus, Lock, Unlock, Truck, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { invoicesApi, purchasesApi, suppliersApi, Invoice, Supplier } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { InvoiceDocuments } from "@/components/invoices/InvoiceDocuments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

// ── Inline editable price row ─────────────────────────────────────────────────

function ItemPriceRow({
    item,
    canEdit,
    onSaved,
}: {
    item: { id: string; itemName?: string; itemModel?: string; quantity?: number; price?: number };
    canEdit: boolean;
    onSaved: () => void;
}) {
    const qty = item.quantity ?? 0;
    const [editing, setEditing] = useState(false);
    const [price, setPrice] = useState(item.price != null ? item.price.toFixed(5) : "");
    const [total, setTotal] = useState(
        item.price != null && qty ? (item.price * qty).toFixed(2) : ""
    );
    const [saving, setSaving] = useState(false);

    const handlePriceChange = (val: string) => {
        setPrice(val);
        const p = parseFloat(val);
        if (!isNaN(p) && qty) setTotal((p * qty).toFixed(2));
    };

    const handleTotalChange = (val: string) => {
        setTotal(val);
    };

    const handleTotalBlur = () => {
        const t = parseFloat(total);
        if (isNaN(t) || !qty) return;
        const newPrice = (t / qty).toFixed(5);
        setPrice(newPrice);
        setTotal(t.toFixed(2));
        commitPrice(parseFloat(newPrice));
    };

    const handlePriceBlur = () => {
        const p = parseFloat(price);
        if (isNaN(p)) return;
        if (qty) setTotal((p * qty).toFixed(2));
        commitPrice(p);
    };

    const commitPrice = async (p: number) => {
        if (isNaN(p) || p < 0) return;
        if (p === item.price) return;
        try {
            setSaving(true);
            await purchasesApi.updateItem(item.id, { price: p });
            notify.success("Prezzo aggiornato");
            setEditing(false);
            onSaved();
        } catch (e: any) {
            notify.error(`Errore: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        setPrice(item.price != null ? item.price.toFixed(5) : "");
        setTotal(item.price != null && qty ? (item.price * qty).toFixed(2) : "");
        setEditing(false);
    };

    return (
        <tr className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
            <td className="py-1.5 pr-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.itemName || '—'}</span>
                {item.itemModel && <span className="text-slate-400 ml-1">({item.itemModel})</span>}
            </td>
            <td className="py-1.5 text-right text-slate-600 dark:text-slate-400 w-16">{qty}</td>
            {canEdit && editing ? (
                <>
                    <td className="py-1 w-32 pl-2">
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs shrink-0">€</span>
                            <Input
                                autoFocus
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.00001"
                                value={price}
                                onChange={e => handlePriceChange(e.target.value)}
                                onBlur={handlePriceBlur}
                                className="h-7 text-right px-1 text-xs w-24"
                                placeholder="0.00000"
                            />
                        </div>
                    </td>
                    <td className="py-1 w-32 pl-2">
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs shrink-0">€</span>
                            <Input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={total}
                                onChange={e => handleTotalChange(e.target.value)}
                                onBlur={handleTotalBlur}
                                className="h-7 text-right px-1 text-xs w-24"
                                placeholder="0.00"
                            />
                        </div>
                    </td>
                    <td className="py-1 w-10 pl-1">
                        {saving
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                            : <button onClick={cancelEdit} title="Annulla" className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                        }
                    </td>
                </>
            ) : (
                <>
                    <td className="py-1.5 text-right text-slate-600 dark:text-slate-400 w-24 pr-1 font-mono text-xs">
                        {item.price != null ? `€ ${item.price.toFixed(5)}` : '—'}
                    </td>
                    <td className="py-1.5 text-right text-slate-600 dark:text-slate-400 w-24 pr-1">
                        {item.price != null && qty ? `€ ${(item.price * qty).toFixed(2)}` : '—'}
                    </td>
                    {canEdit && (
                        <td className="py-1 w-10 pl-1">
                            <button onClick={() => setEditing(true)} title="Modifica prezzo" className="text-slate-300 hover:text-blue-500 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        </td>
                    )}
                </>
            )}
        </tr>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { userRole } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

    // Edit header state
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [editData, setEditData] = useState({ supplierId: "", invoiceNumber: "", invoiceDate: "", notes: "" });

    // Transport cost state: purchaseId -> { input, applying }
    const [transportInputs, setTransportInputs] = useState<Record<string, string>>({});
    const [applyingTransport, setApplyingTransport] = useState<Record<string, boolean>>({});

    // Edit linked purchases state
    const [availablePurchases, setAvailablePurchases] = useState<{ id: string; deliveryNoteNumber: string; deliveryNoteDate: string; totalAmount: number }[]>([]);
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [toAdd, setToAdd] = useState<Set<string>>(new Set());
    const [toRemove, setToRemove] = useState<Set<string>>(new Set());
    const [savingLinks, setSavingLinks] = useState(false);

    const load = () => {
        setLoading(true);
        invoicesApi.getById(id)
            .then(inv => {
                setInvoice(inv);
                setEditData({
                    supplierId: inv.supplierId,
                    invoiceNumber: inv.invoiceNumber,
                    invoiceDate: inv.invoiceDate,
                    notes: inv.notes ?? "",
                });
                // Initialize transport inputs from current purchase values
                const inputs: Record<string, string> = {};
                inv.purchases?.forEach(p => {
                    inputs[p.id] = (p.transportCost ?? 0) > 0 ? (p.transportCost!).toString() : "";
                });
                setTransportInputs(inputs);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleApplyTransport = async (purchaseId: string) => {
        const val = parseFloat(transportInputs[purchaseId] ?? "0") || 0;
        if (val <= 0) return;
        const purchase = invoice?.purchases?.find(p => p.id === purchaseId);
        if (!purchase?.items) return;
        try {
            setApplyingTransport(prev => ({ ...prev, [purchaseId]: true }));
            // Convert invoice items to PurchaseItem-compatible shape
            const items = purchase.items.map(i => ({
                id: i.id,
                purchaseId,
                itemId: '',
                quantity: i.quantity ?? 1,
                price: i.price ?? 0,
                createdAt: '',
                transportApplied: i.transportApplied ?? false,
                transportUnitCost: i.transportUnitCost ?? 0,
            }));
            // Reverse any previously applied transport first
            if (items.some(i => i.transportApplied)) {
                await purchasesApi.reverseTransportOnItems(items);
            }
            const eligible = items.map(i => ({
                ...i,
                transportApplied: false,
                transportUnitCost: 0,
                price: i.transportApplied ? i.price - (i.transportUnitCost ?? 0) : i.price,
            }));
            await purchasesApi.applyTransportToAllItems(purchaseId, val, eligible);
            notify.success("Trasporto applicato");
            load();
        } catch (e: any) {
            notify.error(`Errore: ${e.message}`);
        } finally {
            setApplyingTransport(prev => ({ ...prev, [purchaseId]: false }));
        }
    };

    useEffect(() => { load(); }, [id]);

    // Load suppliers + available purchases when entering edit mode
    const startEdit = () => {
        if (suppliers.length === 0) {
            suppliersApi.getAll().then(setSuppliers).catch(console.error);
        }
        if (invoice) {
            setLoadingAvailable(true);
            invoicesApi.getUnlinkedPurchasesBySupplier(invoice.supplierId)
                .then(setAvailablePurchases)
                .catch(console.error)
                .finally(() => setLoadingAvailable(false));
        }
        setToAdd(new Set());
        setToRemove(new Set());
        setIsEditing(true);
    };

    const handleSaveHeader = async () => {
        if (!editData.invoiceNumber || !editData.invoiceDate) {
            notify.warning("Numero e data fattura sono obbligatori");
            return;
        }
        try {
            setSaving(true);
            await invoicesApi.update(id, editData);
            notify.success("Dati aggiornati");
            setIsEditing(false);
            load();
        } catch (error: any) {
            notify.error(`Errore: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveLinks = async () => {
        if (toAdd.size === 0 && toRemove.size === 0) {
            setIsEditing(false);
            return;
        }
        try {
            setSavingLinks(true);
            await Promise.all([
                ...[...toAdd].map(pid => invoicesApi.linkPurchase(id, pid)),
                ...[...toRemove].map(pid => invoicesApi.unlinkPurchase(pid)),
            ]);
            // Recalculate total
            const inv = await invoicesApi.getById(id);
            const newTotal = inv.purchases?.reduce((s, p) => s + (p.totalAmount ?? 0), 0) ?? 0;
            await invoicesApi.updateTotal(id, newTotal);
            notify.success("Bolle aggiornate");
            setIsEditing(false);
            setToAdd(new Set());
            setToRemove(new Set());
            load();
        } catch (error: any) {
            notify.error(`Errore: ${error.message}`);
        } finally {
            setSavingLinks(false);
        }
    };

    const togglePurchase = (purchaseId: string) => {
        setExpandedPurchases(prev => {
            const next = new Set(prev);
            next.has(purchaseId) ? next.delete(purchaseId) : next.add(purchaseId);
            return next;
        });
    };

    const handleDelete = async () => {
        try {
            setDeleting(true);
            await invoicesApi.delete(id);
            notify.success("Fattura eliminata");
            router.push('/purchases?tab=fatture');
        } catch (error: any) {
            notify.error(`Errore: ${error.message}`);
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    if (loading) return (
        <DashboardLayout>
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        </DashboardLayout>
    );

    if (!invoice) return (
        <DashboardLayout>
            <div className="text-center py-20 text-slate-400">Fattura non trovata</div>
        </DashboardLayout>
    );

    if (userRole === 'user') return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Accesso Negato</h2>
                <p className="text-slate-500 mb-6">Non hai i permessi per visualizzare le fatture.</p>
                <Link href="/purchases">
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Torna agli Acquisti</Button>
                </Link>
            </div>
        </DashboardLayout>
    );

    const canSeeAmounts = true; // only admin/operativo reach this point
    const canEdit = userRole === 'admin' || userRole === 'operativo';

    // Current linked purchases, minus those marked for removal
    const linkedPurchases = (invoice.purchases ?? []).filter(p => !toRemove.has(p.id));

    // Totale calcolato dinamicamente dagli articoli (non da total_amount nel DB che può essere stale)
    const totaleNetto = linkedPurchases.reduce((sum, p) => {
        return sum + (p.items?.reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 0), 0) ?? 0);
    }, 0);
    const iva = totaleNetto * 0.22;
    const totaleConIva = totaleNetto + iva;

    return (
        <>
        <DashboardLayout>
            <div className="max-w-3xl mx-auto pb-10">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Link href="/purchases?tab=fatture" className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 mb-2">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Torna alle Fatture
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Fattura {invoice.invoiceNumber}
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        {canEdit && !isEditing && (
                            <Button variant="outline" size="sm" onClick={startEdit}>
                                <Pencil className="h-4 w-4 mr-1" />Modifica
                            </Button>
                        )}
                        {userRole === 'admin' && !isEditing && (
                            <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" />Elimina</>}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* ── Dati fattura ── */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle>Dati Fattura</CardTitle>
                            {isEditing && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saving || savingLinks}>
                                        <X className="h-4 w-4 mr-1" />Annulla
                                    </Button>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={async () => { await handleSaveHeader(); await handleSaveLinks(); }} disabled={saving || savingLinks}>
                                        {(saving || savingLinks) ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Salva</>}
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isEditing ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Fornitore</Label>
                                        <Select value={editData.supplierId} onValueChange={v => setEditData(d => ({ ...d, supplierId: v }))}>
                                            <SelectTrigger><SelectValue placeholder="Seleziona Fornitore" /></SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Numero Fattura *</Label>
                                        <Input value={editData.invoiceNumber} onChange={e => setEditData(d => ({ ...d, invoiceNumber: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Data Fattura *</Label>
                                        <Input type="date" value={editData.invoiceDate} onChange={e => setEditData(d => ({ ...d, invoiceDate: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Note</Label>
                                        <Input value={editData.notes} onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))} placeholder="Note opzionali" />
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500 mb-0.5 flex items-center gap-1"><User className="h-3.5 w-3.5" />Fornitore</p>
                                        <p className="font-medium">{invoice.supplierName}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 mb-0.5 flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Numero Fattura</p>
                                        <p className="font-medium">{invoice.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 mb-0.5 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Data Fattura</p>
                                        <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString('it-IT')}</p>
                                    </div>
                                    {canSeeAmounts && (
                                        <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                                            <div className="flex flex-col gap-1 text-sm max-w-xs ml-auto text-right">
                                                <div className="flex justify-between gap-8">
                                                    <span className="text-slate-500">Totale Netto</span>
                                                    <span className="font-medium">€ {totaleNetto.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between gap-8">
                                                    <span className="text-slate-500">IVA 22%</span>
                                                    <span className="font-medium">€ {iva.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between gap-8 border-t pt-1 mt-0.5">
                                                    <span className="font-bold text-slate-800 dark:text-white">Totale Fattura</span>
                                                    <span className="font-bold text-lg">€ {totaleConIva.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {invoice.notes && (
                                        <div className="col-span-2">
                                            <p className="text-slate-500 mb-0.5">Note</p>
                                            <p className="font-medium">{invoice.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Documenti ── */}
                    <InvoiceDocuments
                        invoiceId={id}
                        documentUrls={invoice.documentUrls}
                        onUpdate={load}
                    />

                    {/* ── Bolle collegate ── */}
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle>Bolle Collegate</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Bolle attuali */}
                            {linkedPurchases.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-slate-500">
                                            <th className="w-8 py-2 pl-4"></th>
                                            <th className="text-left py-2 px-2">Numero Bolla</th>
                                            {canSeeAmounts && <th className="text-right py-2 px-4">Importo</th>}
                                            <th className="w-10 py-2 px-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {linkedPurchases.map((p) => {
                                            const isExpanded = expandedPurchases.has(p.id);
                                            const hasItems = p.items && p.items.length > 0;
                                            return (
                                                <Fragment key={p.id}>
                                                    <tr
                                                        className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800 ${hasItems && !isEditing ? 'cursor-pointer' : ''}`}
                                                        onClick={() => !isEditing && hasItems && togglePurchase(p.id)}
                                                    >
                                                        <td className="py-2.5 pl-4">
                                                            {!isEditing && hasItems && (
                                                                isExpanded
                                                                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                                                    : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-2 font-medium">
                                            {p.deliveryNoteNumber}
                                            {p.deliveryNoteDate && (
                                                <span className="ml-1.5 text-xs font-normal text-slate-400">
                                                    ({new Date(p.deliveryNoteDate).toLocaleDateString('it-IT')})
                                                </span>
                                            )}
                                        </td>
                                                        {canSeeAmounts && (
                                                            <td className="py-2.5 px-4 text-right">
                                                                {p.totalAmount !== undefined ? `€ ${p.totalAmount.toFixed(2)}` : '—'}
                                                            </td>
                                                        )}
                                                        <td className="py-2.5 px-2">
                                                            {isEditing ? (
                                                                <button
                                                                    title="Rimuovi bolla"
                                                                    className="text-red-400 hover:text-red-600"
                                                                    onClick={() => setToRemove(prev => { const n = new Set(prev); n.add(p.id); return n; })}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            ) : (
                                                                <Link href={`/purchases/${p.id}`} className="text-blue-500 hover:text-blue-700">
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </Link>
                                                            )}
                                                        </td>
                                                    </tr>

                                                    {/* Dropdown articoli con prezzi editabili */}
                                                    {isExpanded && !isEditing && hasItems && (() => {
                                                        const allApplied = p.items!.every(i => i.transportApplied);
                                                        const someApplied = p.items!.some(i => i.transportApplied);
                                                        const isApplying = applyingTransport[p.id];
                                                        return (
                                                        <tr key={`${p.id}-items`} className="border-b bg-slate-50 dark:bg-slate-800/50">
                                                            <td colSpan={canSeeAmounts ? 4 : 3} className="py-2 px-4">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                                            <th className="text-left py-1">Articolo</th>
                                                                            <th className="text-right py-1 w-16">Qtà</th>
                                                                            {canSeeAmounts && <><th className="text-left py-1 w-32 pl-2">Prezzo Unit.</th><th className="text-left py-1 w-32 pl-2">Totale Riga</th><th className="w-10"></th></>}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {p.items!.map((item) => (
                                                                            <ItemPriceRow
                                                                                key={item.id}
                                                                                item={item}
                                                                                canEdit={canSeeAmounts}
                                                                                onSaved={load}
                                                                            />
                                                                        ))}
                                                                    </tbody>
                                                                </table>

                                                                {/* Sezione trasporto per questa bolla */}
                                                                {canSeeAmounts && (
                                                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3 flex-wrap">
                                                                        <Truck className="h-4 w-4 text-amber-500 shrink-0" />
                                                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">Costo Trasporto:</span>
                                                                        {allApplied ? (
                                                                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                                Applicato (€ {(p.transportCost ?? 0).toFixed(2)})
                                                                            </span>
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-slate-400 text-xs">€</span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        step="0.01"
                                                                                        className="h-7 w-24 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-right text-xs"
                                                                                        placeholder="0.00"
                                                                                        value={transportInputs[p.id] ?? ""}
                                                                                        onChange={e => setTransportInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                                                    />
                                                                                </div>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                                                                    disabled={isApplying || !(parseFloat(transportInputs[p.id] ?? "0") > 0)}
                                                                                    onClick={() => handleApplyTransport(p.id)}
                                                                                >
                                                                                    {isApplying
                                                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                                        : "Applica a tutte le righe"}
                                                                                </Button>
                                                                                {someApplied && !allApplied && (
                                                                                    <span className="text-xs text-amber-600">Applicato parzialmente</span>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                        );
                                                    })()}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-center py-6 text-slate-400 text-sm">Nessuna bolla collegata</p>
                            )}

                            {/* Aggiungi bolle in modalità edit */}
                            {isEditing && (
                                <div className="border-t p-4">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1">
                                        <Plus className="h-4 w-4" />Aggiungi bolle disponibili
                                    </p>
                                    {loadingAvailable ? (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />Caricamento...
                                        </div>
                                    ) : availablePurchases.length === 0 ? (
                                        <p className="text-slate-400 text-sm">Nessuna bolla disponibile per questo fornitore</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {availablePurchases.map(p => (
                                                <label key={p.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                    <Checkbox
                                                        checked={toAdd.has(p.id)}
                                                        onCheckedChange={checked => setToAdd(prev => {
                                                            const n = new Set(prev);
                                                            checked ? n.add(p.id) : n.delete(p.id);
                                                            return n;
                                                        })}
                                                    />
                                                    <span className="flex-1 text-sm font-medium">{p.deliveryNoteNumber}</span>
                                                    <span className="text-xs text-slate-500">{new Date(p.deliveryNoteDate).toLocaleDateString('it-IT')}</span>
                                                    {canSeeAmounts && <span className="text-sm font-medium">€ {p.totalAmount.toFixed(2)}</span>}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>

        <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Elimina fattura"
            description={`La fattura ${invoice?.invoiceNumber} verrà spostata nel Cestino e potrà essere ripristinata dagli admin entro 30 giorni. Per procedere è necessario scollegare prima tutte le bolle associate.`}
            loading={deleting}
            onConfirm={handleDelete}
        />
        </>
    );
}
