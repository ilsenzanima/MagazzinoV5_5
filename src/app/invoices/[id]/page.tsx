"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowLeft, FileText, Calendar, User, Loader2, ExternalLink,
    Trash2, ChevronDown, ChevronRight, Pencil, X, Save
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { invoicesApi, suppliersApi, Invoice, Supplier } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { InvoiceDocuments } from "@/components/invoices/InvoiceDocuments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { userRole } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [editData, setEditData] = useState({ supplierId: "", invoiceNumber: "", invoiceDate: "", notes: "" });

    const load = () => {
        invoicesApi.getById(id)
            .then(inv => {
                setInvoice(inv);
                setEditData({
                    supplierId: inv.supplierId,
                    invoiceNumber: inv.invoiceNumber,
                    invoiceDate: inv.invoiceDate,
                    notes: inv.notes ?? "",
                });
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

    const startEdit = () => {
        if (suppliers.length === 0) {
            suppliersApi.getAll().then(setSuppliers).catch(console.error);
        }
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editData.invoiceNumber || !editData.invoiceDate) {
            notify.warning("Numero e data fattura sono obbligatori");
            return;
        }
        try {
            setSaving(true);
            await invoicesApi.update(id, editData);
            notify.success("Fattura aggiornata");
            setIsEditing(false);
            load();
        } catch (error: any) {
            notify.error(`Errore: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const togglePurchase = (purchaseId: string) => {
        setExpandedPurchases(prev => {
            const next = new Set(prev);
            if (next.has(purchaseId)) next.delete(purchaseId);
            else next.add(purchaseId);
            return next;
        });
    };

    const handleDelete = async () => {
        if (!confirm("Eliminare questa fattura? Le bolle collegate torneranno disponibili.")) return;
        try {
            setDeleting(true);
            await invoicesApi.delete(id);
            notify.success("Fattura eliminata");
            router.push('/purchases?tab=fatture');
        } catch (error: any) {
            notify.error(`Errore: ${error.message}`);
            setDeleting(false);
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

    const canSeeAmounts = userRole === 'admin' || userRole === 'operativo';
    const canEdit = userRole === 'admin' || userRole === 'operativo';

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto pb-10">
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
                            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" />Elimina</>}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Dati fattura — view o edit */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle>Dati Fattura</CardTitle>
                            {isEditing && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>
                                        <X className="h-4 w-4 mr-1" />Annulla
                                    </Button>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Salva</>}
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
                                    {canSeeAmounts && invoice.totalAmount != null && (
                                        <div>
                                            <p className="text-slate-500 mb-0.5">Importo Totale</p>
                                            <p className="font-bold text-lg">€ {Number(invoice.totalAmount).toFixed(2)}</p>
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

                    {/* Documenti — SOPRA le bolle */}
                    <InvoiceDocuments
                        invoiceId={id}
                        documentUrls={invoice.documentUrls}
                        onUpdate={load}
                    />

                    {/* Bolle collegate con dropdown articoli */}
                    {invoice.purchases && invoice.purchases.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Bolle Collegate</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-slate-500">
                                            <th className="w-8 py-2 pl-4"></th>
                                            <th className="text-left py-2 px-2">Numero Bolla</th>
                                            {canSeeAmounts && <th className="text-right py-2 px-4">Importo</th>}
                                            <th className="w-10 py-2 px-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.purchases.map((p) => {
                                            const isExpanded = expandedPurchases.has(p.id);
                                            const hasItems = p.items && p.items.length > 0;
                                            return (
                                                <>
                                                    <tr
                                                        key={p.id}
                                                        className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800 ${hasItems ? 'cursor-pointer' : ''}`}
                                                        onClick={() => hasItems && togglePurchase(p.id)}
                                                    >
                                                        <td className="py-2.5 pl-4">
                                                            {hasItems && (
                                                                isExpanded
                                                                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                                                    : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-2 font-medium">{p.deliveryNoteNumber}</td>
                                                        {canSeeAmounts && (
                                                            <td className="py-2.5 px-4 text-right">
                                                                {p.totalAmount !== undefined ? `€ ${p.totalAmount.toFixed(2)}` : '—'}
                                                            </td>
                                                        )}
                                                        <td className="py-2.5 px-4" onClick={e => e.stopPropagation()}>
                                                            <Link href={`/purchases/${p.id}`} className="text-blue-500 hover:text-blue-700">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </Link>
                                                        </td>
                                                    </tr>

                                                    {isExpanded && hasItems && (
                                                        <tr key={`${p.id}-items`} className="border-b bg-slate-50 dark:bg-slate-800/50">
                                                            <td colSpan={canSeeAmounts ? 4 : 3} className="py-2 px-4">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                                                            <th className="text-left py-1">Articolo</th>
                                                                            <th className="text-right py-1 w-20">Quantità</th>
                                                                            {canSeeAmounts && <th className="text-right py-1 w-24">Prezzo Unit.</th>}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {p.items!.map((item, idx) => (
                                                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                                                                <td className="py-1.5">
                                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                                                                        {item.itemName || '—'}
                                                                                    </span>
                                                                                    {item.itemModel && (
                                                                                        <span className="text-slate-400 ml-1">({item.itemModel})</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                                                                    {item.quantity ?? '—'}
                                                                                </td>
                                                                                {canSeeAmounts && (
                                                                                    <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">
                                                                                        {item.price != null ? `€ ${item.price.toFixed(2)}` : '—'}
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
