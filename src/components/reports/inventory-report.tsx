"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Loader2, ClipboardList, Info } from "lucide-react";
import { getInventoryCountData, InventoryCountData } from "@/lib/services/reports";
import { generateInventoryCountReport } from "./inventory-report-generator";

export default function InventoryReport() {
    const [data, setData] = useState<InventoryCountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getInventoryCountData();
            setData(result);
        } catch (err) {
            console.error("Error loading inventory count data:", err);
            setError("Errore nel caricamento dei dati");
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        if (data) {
            generateInventoryCountReport(data);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardContent className="pt-6 text-center text-red-600 dark:text-red-400">
                    {error}
                </CardContent>
            </Card>
        );
    }

    if (!data || data.items.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <p>Nessun articolo in magazzino da contare.</p>
                </CardContent>
            </Card>
        );
    }

    // Group by type
    const groupedItems: Record<string, typeof data.items> = {};
    data.items.forEach(item => {
        const type = item.itemType || 'Senza Categoria';
        if (!groupedItems[type]) {
            groupedItems[type] = [];
        }
        groupedItems[type].push(item);
    });

    // Sort grouped items by type name
    const sortedGroups = Object.entries(groupedItems).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="space-y-4">
            {/* Summary and Export */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-4">
                    <Card className="px-4 py-2">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Righe da contare</p>
                        <p className="text-xl font-bold dark:text-white">{data.items.length}</p>
                    </Card>
                    <Card className="px-4 py-2">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Categorie</p>
                        <p className="text-xl font-bold dark:text-white">{Object.keys(groupedItems).length}</p>
                    </Card>
                </div>
                <Button onClick={handleExportPDF} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Stampa Foglio Conta
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="pt-4 text-sm text-amber-800 dark:text-amber-200">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <strong>Istruzioni:</strong> Esporta il foglio PDF e usalo per la conta fisica dell&apos;inventario.
                            Compila la colonna &quot;Contati&quot; durante la verifica e annota le differenze.
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Legend Card */}
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <CardContent className="pt-4 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                            <strong>Pezzi Fisici (Sistema):</strong> Quantità di pezzi fisici registrata nel sistema
                            (es. colli, rotoli, scatole). Questa è la giacenza attuale da verificare durante la conta.
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Preview Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg dark:text-white">Anteprima Articoli</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[600px] relative">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                                <TableRow className="border-b dark:border-slate-700">
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Codice</TableHead>
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Articolo</TableHead>
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Lotto</TableHead>
                                    <TableHead className="text-center bg-white dark:bg-slate-900 dark:text-slate-300">Pezzi Fisici (Sistema)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedGroups.map(([type, items]) => (
                                    <>
                                        {/* Type Header Row */}
                                        <TableRow key={`type-${type}`} className="bg-slate-100 dark:bg-slate-800">
                                            <TableCell colSpan={4} className="font-bold text-slate-700 dark:text-slate-200 py-2">
                                                {type}
                                            </TableCell>
                                        </TableRow>
                                        {/* Items in this type */}
                                        {items.map((item, idx) => (
                                            <TableRow
                                                key={`${item.itemId}-${item.lotRef}-${idx}`}
                                                className="dark:border-slate-700"
                                            >
                                                <TableCell className="font-mono text-sm dark:text-slate-300">{item.itemCode}</TableCell>
                                                <TableCell className="max-w-[250px] truncate dark:text-slate-300">
                                                    {item.itemName}
                                                    {item.itemModel && <span className="text-slate-400 dark:text-slate-500"> ({item.itemModel})</span>}
                                                </TableCell>
                                                <TableCell className="text-sm dark:text-slate-300">{item.lotRef}</TableCell>
                                                <TableCell className="text-center font-medium dark:text-slate-300">{item.systemPieces}</TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
