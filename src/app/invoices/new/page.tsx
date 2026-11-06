"use client";

import { notify } from "@/lib/notify";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NotchTabs, NotchActions, NotchButton } from "@/components/ui/notch-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2, Upload, FileText, Calendar, Truck } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { suppliersApi, invoicesApi, purchasesApi, supplierGroupsApi, Supplier } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useBatchUpload } from "@/hooks/useBatchUpload";
import { UploadStatusBar } from "@/components/ui/upload-status-row";
import { HelpTip } from "@/components/ui/help-tip";
import { formatCurrency } from "@/lib/utils/format";
import { BlockBrowserBack } from "@/components/BlockBrowserBack";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface UnlinkedPurchase {
    id: string;
    deliveryNoteNumber: string;
    deliveryNoteDate: string;
    supplierId: string;
    supplierName?: string;
    totalAmount: number;
    selected: boolean;
    items: { id: string; itemName?: string; itemModel?: string; quantity: number; price: number; returned: number; transportApplied: boolean }[];
    transportCost: number;
}

// Riga di una bolla con il prezzo da inserire: prezzo unitario o totale riga (l'altro si calcola da solo)
function PriceLine({ item, onPrice }: { item: UnlinkedPurchase["items"][number]; onPrice: (price: number) => void }) {
    const [unit, setUnit] = useState(item.price > 0 ? item.price.toFixed(5) : "");
    const [total, setTotal] = useState(item.price > 0 ? (item.price * item.quantity).toFixed(2) : "");
    return (
        <tr className="border-b border-slate-100 last:border-0 dark:border-slate-700/50">
            <td className="py-1.5 pr-2 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.itemName || "—"}</span>
                {item.itemModel && <span className="ml-1 text-slate-400">({item.itemModel})</span>}
            </td>
            <td className="w-16 py-1.5 text-right text-xs text-slate-600 dark:text-slate-400">{item.quantity}</td>
            <td className="w-32 py-1 pl-2">
                <div className="flex items-center gap-1">
                    <span className="shrink-0 text-xs text-slate-400">€</span>
                    <Input
                        type="number" inputMode="decimal" min="0" step="0.00001"
                        value={unit} placeholder="0.00000" aria-label="Prezzo unitario"
                        onChange={e => {
                            setUnit(e.target.value);
                            const p = parseFloat(e.target.value);
                            if (!isNaN(p)) { setTotal((p * item.quantity).toFixed(2)); onPrice(p); }
                        }}
                        className="h-7 w-24 px-1 text-right text-xs"
                    />
                </div>
            </td>
            <td className="w-32 py-1 pl-2">
                <div className="flex items-center gap-1">
                    <span className="shrink-0 text-xs text-slate-400">€</span>
                    <Input
                        type="number" inputMode="decimal" min="0" step="0.01"
                        value={total} placeholder="0.00" aria-label="Totale riga"
                        onChange={e => setTotal(e.target.value)}
                        onBlur={() => {
                            const t = parseFloat(total);
                            if (isNaN(t) || !item.quantity) return;
                            const p = parseFloat((t / item.quantity).toFixed(5));
                            setUnit(p.toFixed(5)); setTotal(t.toFixed(2)); onPrice(p);
                        }}
                        className="h-7 w-24 px-1 text-right text-xs"
                    />
                </div>
            </td>
        </tr>
    );
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

    // Prezzi inseriti qui per le righe delle bolle (id riga → prezzo unitario); si salvano insieme alla fattura
    const [prices, setPrices] = useState<Record<string, number>>({});

    // Trasporto per bolla (id bolla → importo), spalmato sulle righe al salvataggio come «Applica trasporto»
    const [transport, setTransport] = useState<Record<string, string>>({});
    // Importo riportato sulla fattura del fornitore, solo per controllo
    const [printedTotal, setPrintedTotal] = useState("");

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const batchUpload = useBatchUpload();

    useEffect(() => {
        Promise.all([suppliersApi.getAll(), supplierGroupsApi.getHiddenFromInvoicesIds()])
            .then(([allSuppliers, hiddenIds]) => setSuppliers(allSuppliers.filter(s => !hiddenIds.includes(s.id))))
            .catch(console.error)
            .finally(() => setSuppliersLoading(false));
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
    // Importo di una bolla con i prezzi appena inseriti al posto di quelli già registrati (resi sempre detratti)
    const transportOf = (p: UnlinkedPurchase) =>
        p.items.some(i => i.transportApplied) ? 0 : Math.max(0, parseFloat((transport[p.id] ?? "").replace(",", ".")) || 0);
    const purchaseTotal = (p: UnlinkedPurchase) =>
        p.items.reduce((s, i) => s + (prices[i.id] ?? i.price) * i.quantity - i.returned, 0) + transportOf(p);
    const totalAmount = selectedPurchases.reduce((s, p) => s + purchaseTotal(p), 0);
    const isSharedBilling = new Set(unlinkedPurchases.map(p => p.supplierId)).size > 1;

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

        // Importo stampato sulla fattura: se non coincide con le bolle si chiede conferma
        const printed = parseFloat(printedTotal.replace(",", "."));
        if (!isNaN(printed) && Math.abs(printed - totalAmount) > 0.01) {
            if (!confirm(`Il totale delle bolle (${formatCurrency(totalAmount)}) è diverso dall'importo in fattura (${formatCurrency(printed)}). Salvare comunque?`)) return;
        }

        // Tutto o niente: se un passo fallisce si annulla quanto già fatto
        let createdId: string | null = null;
        const linkedIds: string[] = [];
        const priceBackups: { id: string; price: number }[] = [];
        const transportDone: { purchaseId: string; prevCost: number; items: { id: string; quantity: number; price: number; transportApplied: boolean; transportUnitCost: number }[] }[] = [];

        try {
            setLoading(true);

            let documentUrls: string[] = [];
            if (selectedFiles.length > 0) {
                const supplierName = suppliers.find(s => s.id === formData.supplierId)?.name;
                const urls: string[] = [];
                const { failedCount } = await batchUpload.run(selectedFiles, async (f) => {
                    urls.push(await invoicesApi.uploadDocument(f, supplierName));
                });
                if (failedCount > 0) throw new Error("Caricamento documento fallito, riprova");
                documentUrls = urls;
            }

            const invoice = await invoicesApi.create({
                supplierId: formData.supplierId,
                invoiceNumber: formData.invoiceNumber,
                invoiceDate: formData.invoiceDate,
                notes: formData.notes || undefined,
                documentUrls,
            });

            createdId = invoice.id;

            // Link selected purchases (una bolla già presa da un'altra fattura blocca tutto)
            for (const p of selectedPurchases) {
                await invoicesApi.linkPurchaseIfFree(invoice.id, p.id, p.deliveryNoteNumber);
                linkedIds.push(p.id);
            }

            // Prezzi inseriti qui sulle righe delle bolle
            const edits = selectedPurchases.flatMap(p => p.items).filter(i => prices[i.id] !== undefined && prices[i.id] !== i.price);
            for (const i of edits) {
                await purchasesApi.updateItem(i.id, { price: prices[i.id] });
                priceBackups.push({ id: i.id, price: i.price });
            }

            // Trasporto: come «Applica trasporto» nella scheda fattura, spalmato sulle righe della sua bolla
            for (const p of selectedPurchases) {
                const cost = transportOf(p);
                if (cost <= 0) continue;
                const rows = p.items.map(i => ({ id: i.id, quantity: i.quantity, price: prices[i.id] ?? i.price }));
                await purchasesApi.applyTransportToAllItems(p.id, cost, rows.map(r => ({ ...r, purchaseId: p.id, itemId: "", createdAt: "" })));
                const perUnit = (q: number) => (q > 0 ? cost / rows.length / q : 0);
                transportDone.push({
                    purchaseId: p.id,
                    prevCost: p.transportCost,
                    items: rows.map(r => ({ ...r, price: parseFloat((r.price + perUnit(r.quantity)).toFixed(5)), transportApplied: true, transportUnitCost: perUnit(r.quantity) })),
                });
            }

            // Il totale salvato è quello reale delle bolle collegate, dopo prezzi e trasporto
            const saved = await invoicesApi.getById(invoice.id);
            await invoicesApi.updateTotal(invoice.id, saved.purchases?.reduce((s, p) => s + (p.totalAmount ?? 0), 0) ?? totalAmount);

            notify.success("Fattura salvata con successo");
            router.push(`/invoices/${invoice.id}`);
        } catch (error: any) {
            console.error("Failed to save invoice", error);
            // Annulla quanto già scritto, così non resta una fattura a metà
            let undone = true;
            try {
                for (const t of transportDone) {
                    await purchasesApi.reverseTransportOnItems(t.items.map(i => ({ ...i, purchaseId: t.purchaseId, itemId: "", createdAt: "" })));
                    await purchasesApi.saveTransportCost(t.purchaseId, t.prevCost);
                }
                for (const b of priceBackups) await purchasesApi.updateItem(b.id, { price: b.price });
                for (const id of linkedIds) await invoicesApi.unlinkPurchase(id);
                if (createdId) await invoicesApi.delete(createdId);
            } catch (undoError) {
                undone = false;
                console.error("Rollback failed", undoError);
            }
            notify.error(`Errore durante il salvataggio: ${error.message || error.toString()}${undone ? ". Nessuna modifica è stata salvata." : ". Attenzione: l'annullamento non è riuscito, controlla la fattura e le bolle."}`);
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
          <BlockBrowserBack />
            <div className="max-w-4xl mx-auto pb-10">
                <div className="mb-6">
                    <Link href="/purchases?tab=fatture" className="flex items-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 mb-2">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Torna alle Fatture
                    </Link>
                    <NotchTabs title="Registrazione Fattura">
                        <NotchActions>
                            <Link href="/purchases?tab=fatture">
                                <NotchButton type="button">Annulla</NotchButton>
                            </Link>
                            <NotchButton type="submit" form="invoice-form" disabled={loading} className="min-w-28 border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white [&_svg]:text-white">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save /> Salva Fattura</>}
                            </NotchButton>
                        </NotchActions>
                    </NotchTabs>
                </div>

                <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Header */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Dati Fattura</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Fornitore *</Label>
                                <SearchableSelect
                                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                                  value={formData.supplierId}
                                  onValueChange={(v) => setFormData({ ...formData, supplierId: v })}
                                  placeholder={suppliersLoading ? "Caricamento..." : "Seleziona Fornitore"}
                                  searchPlaceholder="Scrivi per cercare fornitore..."
                                  disabled={suppliersLoading}
                                />
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
                                    className={`relative border-2 border-dashed rounded-md p-3 transition-colors text-center ${isDragging
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
                                        disabled={loading}
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length) setSelectedFiles(prev => [...prev, ...files]);
                                            e.target.value = "";
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                    <div className="pointer-events-none flex flex-col items-center justify-center gap-1">
                                        <Upload className={`h-8 w-8 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
                                        {selectedFiles.length > 0 ? (
                                            <div className="flex flex-col items-stretch gap-1 w-full max-w-xs">
                                                {selectedFiles.map((f, i) => (
                                                    <div key={i}>
                                                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{f.name}</p>
                                                        {loading && <UploadStatusBar state={batchUpload.statuses[i]} />}
                                                    </div>
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
                            <CardTitle className="flex items-center">
                                Bolle da Collegare
                                <HelpTip
                                    title="Bolle da Collegare"
                                    description="Solo le bolle d'acquisto (mai gli ordini) del fornitore selezionato che non hanno già un'altra fattura collegata. Per ogni bolla spuntata si aprono le righe: inserisci il prezzo unitario oppure il totale riga. Il totale della fattura è la somma delle bolle spuntate."
                                />
                            </CardTitle>
                            <CardDescription>
                                {!formData.supplierId
                                    ? "Seleziona prima un fornitore per vedere le bolle disponibili"
                                    : purchasesLoading
                                        ? "Caricamento bolle..."
                                        : unlinkedPurchases.length === 0
                                            ? "Nessuna bolla senza fattura per questo fornitore"
                                            : "Spunta le bolle della fattura: sotto ogni bolla spuntata puoi inserire i prezzi delle righe"
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
                                                        {isSharedBilling && (
                                                            <span className="text-xs font-medium min-w-[120px]">Fornitore</span>
                                                        )}
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
                                                <Fragment key={purchase.id}>
                                                <TableRow className={purchase.selected ? "bg-blue-50 dark:bg-blue-900/10" : ""}>
                                                    <TableCell colSpan={4} className="p-0">
                                                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer w-full">
                                                            <Checkbox
                                                                checked={purchase.selected}
                                                                onCheckedChange={() => togglePurchase(purchase.id)}
                                                            />
                                                            <span className="font-medium flex-1">{purchase.deliveryNoteNumber}</span>
                                                            {isSharedBilling && (
                                                                <span className="text-slate-500 text-sm min-w-[120px]">{purchase.supplierName}</span>
                                                            )}
                                                            <span className="text-slate-500 text-sm">
                                                                {new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}
                                                            </span>
                                                            <span className="font-medium text-right min-w-[80px]">
                                                                {formatCurrency(purchaseTotal(purchase))}
                                                            </span>
                                                        </label>
                                                    </TableCell>
                                                </TableRow>
                                                {purchase.selected && purchase.items.length > 0 && (
                                                    <TableRow key={`${purchase.id}-lines`} className="bg-slate-50 hover:bg-slate-50 dark:bg-slate-800/50">
                                                        <TableCell colSpan={4} className="px-4 py-2">
                                                            <table className="w-full">
                                                                <thead>
                                                                    <tr className="border-b border-slate-200 text-xs text-slate-400 dark:border-slate-700">
                                                                        <th className="py-1 text-left font-normal">Articolo</th>
                                                                        <th className="w-16 py-1 text-right font-normal">Qtà</th>
                                                                        <th className="w-32 py-1 pl-2 text-left font-normal">Prezzo unit.</th>
                                                                        <th className="w-32 py-1 pl-2 text-left font-normal">Totale riga</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {purchase.items.map(it => (
                                                                        <PriceLine key={it.id} item={it} onPrice={price => setPrices(prev => ({ ...prev, [it.id]: price }))} />
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                                                                <Truck className="h-4 w-4 shrink-0 text-amber-500" />
                                                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Costo trasporto:</span>
                                                                {purchase.items.some(i => i.transportApplied) ? (
                                                                    <span className="text-xs text-green-600">già applicato a questa bolla ({formatCurrency(purchase.transportCost)})</span>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-xs text-slate-400">€</span>
                                                                        <Input
                                                                            type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                                                                            aria-label="Costo trasporto" className="h-7 w-24 px-1 text-right text-xs"
                                                                            value={transport[purchase.id] ?? ""}
                                                                            onChange={e => setTransport(prev => ({ ...prev, [purchase.id]: e.target.value }))}
                                                                        />
                                                                        <span className="text-xs text-slate-400">si divide sulle righe di questa bolla</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                                </Fragment>
                                            ))}

                                            {selectedPurchases.length > 0 && (
                                                <TableRow key="total-row" className="bg-slate-50 dark:bg-slate-800 font-bold border-t-2">
                                                    <TableCell colSpan={3} className="text-right pr-4 dark:text-white py-3">
                                                        TOTALE FATTURA
                                                    </TableCell>
                                                    <TableCell className="text-right text-base dark:text-white py-3">
                                                        {formatCurrency(totalAmount ?? 0)}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {selectedPurchases.length > 0 && (
                                    <div className="mt-4 flex flex-wrap items-center gap-3 px-4 sm:px-0">
                                        <Label htmlFor="printed-total" className="text-sm">Importo riportato in fattura</Label>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm text-slate-400">€</span>
                                            <Input
                                                id="printed-total" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                                                className="h-8 w-32 text-right" value={printedTotal} onChange={e => setPrintedTotal(e.target.value)}
                                            />
                                        </div>
                                        {printedTotal !== "" && !isNaN(parseFloat(printedTotal)) && (
                                            Math.abs(parseFloat(printedTotal) - totalAmount) <= 0.01
                                                ? <span className="text-sm font-medium text-green-600">Coincide con le bolle</span>
                                                : <span className="text-sm font-medium text-amber-600">
                                                    Differenza: {formatCurrency(parseFloat(printedTotal) - totalAmount)} rispetto al totale bolle
                                                </span>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        )}
                        {purchasesLoading && (
                            <CardContent className="flex justify-center py-6">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </CardContent>
                        )}
                    </Card>
                </form>
            </div>
        </DashboardLayout>
    );
}
