"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Calendar, User, Loader2, ExternalLink, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { invoicesApi, Invoice } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { InvoiceDocuments } from "@/components/invoices/InvoiceDocuments";

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { userRole } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [expandedPurchases, setExpandedPurchases] = useState<Set<string>>(new Set());

    const load = () => {
        invoicesApi.getById(id)
            .then(setInvoice)
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [id]);

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
                    {userRole === 'admin' && (
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" />Elimina</>}
                        </Button>
                    )}
                </div>

                <div className="space-y-6">
                    {/* Dati fattura */}
                    <Card>
                        <CardHeader><CardTitle>Dati Fattura</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                        </CardContent>
                    </Card>

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
                                                        <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                                                            <Link href={`/purchases/${p.id}`} className="text-blue-500 hover:text-blue-700">
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                            </Link>
                                                        </td>
                                                    </tr>

                                                    {/* Dropdown articoli */}
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

                    {/* Documenti */}
                    <InvoiceDocuments
                        invoiceId={id}
                        documentUrls={invoice.documentUrls}
                        onUpdate={load}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
