"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Loader2, ClipboardList } from "lucide-react";
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
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6 text-center text-red-600">
                    {error}
                </CardContent>
            </Card>
        );
    }

    if (!data || data.items.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-slate-500">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>Nessun articolo in magazzino da contare.</p>
                </CardContent>
            </Card>
        );
    }

    // Group by type
    const groupedItems: Record<string, typeof data.items> = {};
    data.items.forEach(item => {
        if (!groupedItems[item.itemType]) {
            groupedItems[item.itemType] = [];
        }
        groupedItems[item.itemType].push(item);
    });

    return (
        <div className="space-y-4">
            {/* Summary and Export */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-4">
                    <Card className="px-4 py-2">
                        <p className="text-sm text-slate-500">Righe da contare</p>
                        <p className="text-xl font-bold">{data.items.length}</p>
                    </Card>
                    <Card className="px-4 py-2">
                        <p className="text-sm text-slate-500">Categorie</p>
                        <p className="text-xl font-bold">{Object.keys(groupedItems).length}</p>
                    </Card>
                </div>
                <Button onClick={handleExportPDF} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Stampa Foglio Conta
                </Button>
            </div>

            {/* Info Card */}
            <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4 text-sm text-amber-800">
                    <strong>Istruzioni:</strong> Esporta il foglio PDF e usalo per la conta fisica dell&apos;inventario.
                    Compila la colonna &quot;Contati&quot; durante la verifica e annota le differenze.
                </CardContent>
            </Card>

            {/* Preview Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Anteprima Articoli</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Codice</TableHead>
                                    <TableHead>Articolo</TableHead>
                                    <TableHead>Lotto</TableHead>
                                    <TableHead className="text-center">U.M.</TableHead>
                                    <TableHead className="text-center">Pezzi Sistema</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(groupedItems).map(([type, items]) => (
                                    <>
                                        <TableRow key={type} className="bg-slate-100">
                                            <TableCell colSpan={5} className="font-bold text-slate-700">
                                                {type}
                                            </TableCell>
                                        </TableRow>
                                        {items.map((item, idx) => (
                                            <TableRow key={`${item.itemId}-${item.lotRef}-${idx}`}>
                                                <TableCell className="font-mono text-sm">{item.itemCode}</TableCell>
                                                <TableCell className="max-w-[250px] truncate">{item.itemName}</TableCell>
                                                <TableCell className="text-sm">{item.lotRef}</TableCell>
                                                <TableCell className="text-center">{item.itemUnit}</TableCell>
                                                <TableCell className="text-center font-medium">{item.systemPieces}</TableCell>
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
