"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Calendar, User, Paperclip, Loader2, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { invoicesApi, Invoice } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";

export default function InvoiceDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { userRole } = useAuth();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        invoicesApi.getById(id)
            .then(setInvoice)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const handleDelete = async () => {
        if (!confirm("Eliminare questa fattura? Le bolle collegate torneranno disponibili.")) return;
        try {
            setDeleting(true);
            await invoicesApi.delete(id);
            notify.success("Fattura eliminata");
            router.push('/invoices');
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

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto pb-10">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <Link href="/invoices" className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 mb-2">
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
                            {(userRole === 'admin' || userRole === 'operativo') && invoice.totalAmount !== undefined && (
                                <div>
                                    <p className="text-slate-500 mb-0.5">Importo Totale</p>
                                    <p className="font-bold text-lg">€ {Number(invoice.totalAmount).toFixed(2)}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {invoice.purchases && invoice.purchases.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Bolle Collegate</CardTitle></CardHeader>
                            <CardContent className="p-0 sm:p-6 sm:pt-0">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-slate-500">
                                            <th className="text-left py-2 px-4">Numero Bolla</th>
                                            <th className="text-right py-2 px-4">Importo</th>
                                            <th className="w-10 py-2 px-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.purchases.map((p) => (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <td className="py-2.5 px-4 font-medium">{p.deliveryNoteNumber}</td>
                                                <td className="py-2.5 px-4 text-right">
                                                    {p.totalAmount !== undefined ? `€ ${p.totalAmount.toFixed(2)}` : '—'}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    <Link href={`/purchases/${p.id}`} className="text-blue-500 hover:text-blue-700">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    {invoice.documentUrls && invoice.documentUrls.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Documenti Allegati</CardTitle></CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {invoice.documentUrls.map((url, i) => (
                                    <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                        Documento {i + 1}
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
