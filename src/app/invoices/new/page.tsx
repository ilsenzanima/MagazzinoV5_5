"use client";

import { notify } from "@/lib/notify";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2, Upload, FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { suppliersApi, invoicesApi, Supplier } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

interface UnlinkedPurchase {
    id: string;
    deliveryNoteNumber: string;
    deliveryNoteDate: string;
    totalAmount: number;
    selected: boolean;
}

export default function NewInvoicePage() {
    const router = useRouter();
    const { userRole } = useAuth();

    const [loading, setLoading] = useState(false);
    const [suppliersLoading, setSuppliersLoading] = useState(true);
    const [purchasesLoading, setPurchasesLoading] = useState(false);

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [unlinkedPurchases, setUnlinkedPurchases] = useState<UnlinkedPurchase[]>([]);

    const [formData, setFormData] = useState({
        supplierId: "",
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split('T')[0],
        notes: "",
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        suppliersApi.getAll().then(setSuppliers).catch(console.error).finally(() => setSuppliersLoading(false));
    }, []);

    useEffect(() => {
        if (!formData.supplierId) {
            setUnlinkedPurchases([]);
            return;
        }
        setPurchasesLoading(true);
        invoicesApi.getUnlinkedPurchasesBySupplier(formData.supplierId)
            .then(purchases => setUnlinkedPurchases(purchases.map(p => ({ ...p, selected: false }))))
            .catch(console.error)
            .finally(() => setPurchasesLoading(false));
    }, [formData.supplierId]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) setSelectedFiles(prev => [...prev, ...files]);
    };

    const togglePurchase = (id: string) => {
        setUnlinkedPurchases(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
    };

    const toggleAll = () => {
        const allSelected = unlinkedPurchases.every(p => p.selected);
        setUnlinkedPurchases(prev => prev.map(p => ({ ...p, selected: !allSelected })));
    };

    const selectedPurchases = unlinkedPurchases.filter(p => p.selected);
    const totalAmount = selectedPurchases.reduce((s, p) => s + p.totalAmount, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.supplierId || !formData.invoiceNumber || !formData.invoiceDate) {
            notify.warning("Compila tutti i campi obbligatori (Fornitore, Numero, Data)");
            return;
        }

        if (selectedPurchases.length === 0) {
            notify.warning("Seleziona almeno una bolla da collegare alla fattura");
            return;
        }

        try {
            setLoading(true);

            let documentUrls: string[] = [];
            if (selectedFiles.length > 0) {
                documentUrls = await Promise.all(selectedFiles.map(f => invoicesApi.uploadDocument(f)));
            }

            const invoice = await invoicesApi.create({
                supplierId: formData.supplierId,
                invoiceNumber: formData.invoiceNumber,
                invoiceDate: formData.invoiceDate,
                notes: formData.notes || undefined,
                documentUrls,
            });

            // Link selected purchases
            await Promise.all(selectedPurchases.map(p => invoicesApi.linkPurchase(invoice.id, p.id)));

            // Save total
            await invoicesApi.updateTotal(invoice.id, totalAmount);

            notify.success("Fattura salvata con successo");
            router.push(`/invoices/${invoice.id}`);
        } catch (error: any) {
            console.error("Failed to save invoice", error);
            notify.error(`Errore durante il salvataggio: ${error.message || error.toString()}`);
        } finally {
            setLoading(false);
        }
    };

    if (userRole === 'user') {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full py-20">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
                    <p className="text-slate-500 mb-6">Non hai i permessi necessari per registrare fatture.</p>
                    <Link href="/purchases?tab=fatture">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Torna alle Fatture
                        </Button>
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto pb-10">
                <div className="mb-6">
                    <Link href="/purchases?tab=fatture" className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Torna alle Fatture
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registrazione Fattura</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Dati Fattura</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Fornitore *</Label>
                                <Select
                                    value={formData.supplierId}
                                    onValueChange={(v) => setFormData({ ...formData, supplierId: v })}
                                    disabled={suppliersLoading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={suppliersLoading ? "Caricamento..." : "Seleziona Fornitore"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Numero Fattura *</Label>
                                <Input
                                    value={formData.invoiceNumber}
                                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                    placeholder="Es. FT-2024-001"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Data Fattura *</Label>
                                <Input
                                    type="date"
                                    value={formData.invoiceDate}
                                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 md:col-span-3 border-t pt-2">
                                <Label>Copia Documento (PDF, Immagine)</Label>
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

                    {/* Bolle collegate */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Bolle da Collegare</CardTitle>
                            <CardDescription>
                                {!formData.supplierId
                                    ? "Seleziona prima un fornitore per vedere le bolle disponibili"
                                    : purchasesLoading
                                        ? "Caricamento bolle..."
                                        : unlinkedPurchases.length === 0
                                            ? "Nessuna bolla senza fattura per questo fornitore"
                                            : "Seleziona le bolle da associare a questa fattura"
                                }
                            </CardDescription>
                        </CardHeader>
                        {formData.supplierId && !purchasesLoading && unlinkedPurchases.length > 0 && (
                            <CardContent className="p-0 sm:p-6 sm:pt-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead colSpan={4}>
                                                    <label className="flex items-center gap-3 px-0 cursor-pointer">
                                                        <Checkbox
                                                            checked={unlinkedPurchases.every(p => p.selected)}
                                                            onCheckedChange={toggleAll}
                                                        />
                                                        <span className="flex-1 flex items-center gap-1 text-xs font-medium">
                                                            <FileText className="h-3.5 w-3.5" />Numero Bolla
                                                        </span>
                                                        <span className="text-xs font-medium flex items-center gap-1">
                                                            <Calendar className="h-3.5 w-3.5" />Data
                                                        </span>
                                                        <span className="text-xs font-medium text-right min-w-[80px]">Importo</span>
                                                    </label>
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {unlinkedPurchases.map((purchase) => (
                                                <TableRow key={purchase.id} className={purchase.selected ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                                                    <TableCell colSpan={4} className="p-0">
                                                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer w-full">
                                                            <Checkbox
                                                                checked={purchase.selected}
                                                                onCheckedChange={() => togglePurchase(purchase.id)}
                                                            />
                                                            <span className="font-medium flex-1">{purchase.deliveryNoteNumber}</span>
                                                            <span className="text-slate-500 text-sm">
                                                                {new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}
                                                            </span>
                                                            <span className="font-medium text-right min-w-[80px]">
                                                                € {(purchase.totalAmount ?? 0).toFixed(2)}
                                                            </span>
                                                        </label>
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {selectedPurchases.length > 0 && (
                                                <TableRow key="total-row" className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2">
                                                    <TableCell colSpan={3} className="text-right pr-4 dark:text-white py-3">
                                                        TOTALE FATTURA
                                                    </TableCell>
                                                    <TableCell className="text-right text-base dark:text-white py-3">
                                                        <span className="text-xs font-normal text-slate-400 mr-0.5">€</span>
                                                        {(totalAmount ?? 0).toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        )}
                        {purchasesLoading && (
                            <CardContent className="flex justify-center py-6">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </CardContent>
                        )}
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Link href="/invoices">
                            <Button variant="outline" type="button">Annulla</Button>
                        </Link>
                        <Button type="submit" disabled={loading} className="bg-blue-600 w-36">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Salva Fattura</>}
                        </Button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
