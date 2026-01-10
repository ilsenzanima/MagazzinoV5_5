"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Loader2, Package } from "lucide-react";
import { getArticlesWithStock, ArticlesReportData, ArticleLot } from "@/lib/services/reports";
import { generateArticlesReport } from "./articles-report-generator";
import { format } from "date-fns";

export default function ArticlesReport() {
    const [data, setData] = useState<ArticlesReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getArticlesWithStock();
            setData(result);
        } catch (err) {
            console.error("Error loading articles report:", err);
            setError("Errore nel caricamento dei dati");
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        if (data) {
            generateArticlesReport(data);
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

    if (!data || data.articles.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>Nessun articolo con giacenza superiore a 0.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Card */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-4">
                    <Card className="px-4 py-2">
                        <p className="text-sm text-slate-500">Articoli</p>
                        <p className="text-xl font-bold">{data.articles.length}</p>
                    </Card>
                    <Card className="px-4 py-2 bg-emerald-50 border-emerald-200">
                        <p className="text-sm text-emerald-600">Valore Totale</p>
                        <p className="text-xl font-bold text-emerald-700">
                            € {data.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </p>
                    </Card>
                </div>
                <Button onClick={handleExportPDF} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Esporta PDF
                </Button>
            </div>

            {/* Articles Table */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Dettaglio Articoli per Lotto</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Codice</TableHead>
                                    <TableHead>Articolo</TableHead>
                                    <TableHead>Marca</TableHead>
                                    <TableHead>Lotto</TableHead>
                                    <TableHead className="text-right">Prezzo €</TableHead>
                                    <TableHead className="text-right">Pezzi</TableHead>
                                    <TableHead className="text-right">Quantità</TableHead>
                                    <TableHead className="text-center">U.M.</TableHead>
                                    <TableHead className="text-right">Valore €</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.articles.map((article, idx) => (
                                    <TableRow key={`${article.itemId}-${article.lotRef}-${idx}`}>
                                        <TableCell className="font-mono text-sm">{article.itemCode}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{article.itemName}</TableCell>
                                        <TableCell>{article.itemBrand}</TableCell>
                                        <TableCell className="text-sm">
                                            <span className="font-medium">{article.lotRef}</span>
                                            {article.lotDate && (
                                                <span className="text-slate-400 ml-1">
                                                    ({format(new Date(article.lotDate), 'dd/MM/yy')})
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {article.price > 0 ? article.price.toFixed(2) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{article.pieces}</TableCell>
                                        <TableCell className="text-right">{article.quantity.toFixed(2)}</TableCell>
                                        <TableCell className="text-center text-sm">{article.itemUnit}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            {article.totalValue > 0 ? article.totalValue.toFixed(2) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {/* Totals Row */}
                                <TableRow className="bg-slate-50 font-bold">
                                    <TableCell colSpan={5}>TOTALE</TableCell>
                                    <TableCell className="text-right">
                                        {data.articles.reduce((sum, a) => sum + a.pieces, 0)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {data.articles.reduce((sum, a) => sum + a.quantity, 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-emerald-600">
                                        {data.totalValue.toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
