"use client"

import { useState, useEffect, useMemo } from "react";
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

    // Group articles by type
    const groupedArticles = useMemo(() => {
        if (!data) return {};
        const groups: Record<string, ArticleLot[]> = {};
        data.articles.forEach(article => {
            const type = article.itemType || 'Senza Categoria';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(article);
        });
        // Sort types alphabetically
        return Object.keys(groups)
            .sort((a, b) => a.localeCompare(b))
            .reduce((acc, key) => {
                acc[key] = groups[key];
                return acc;
            }, {} as Record<string, ArticleLot[]>);
    }, [data]);

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

    if (!data || data.articles.length === 0) {
        return (
            <Card className="border-dashed">
                <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
                    <Package className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
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
                        <p className="text-sm text-slate-500 dark:text-slate-400">Articoli</p>
                        <p className="text-xl font-bold dark:text-white">{data.articles.length}</p>
                    </Card>
                    <Card className="px-4 py-2 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">Valore Totale</p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                            € {data.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </p>
                    </Card>
                </div>
                <Button onClick={handleExportPDF} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Esporta PDF
                </Button>
            </div>

            {/* Articles Table - Grouped by Type */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg dark:text-white">Dettaglio Articoli per Tipologia e Lotto</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-auto max-h-[600px] relative">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                                <TableRow className="border-b dark:border-slate-700">
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Codice</TableHead>
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Articolo</TableHead>
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Marca</TableHead>
                                    <TableHead className="bg-white dark:bg-slate-900 dark:text-slate-300">Lotto</TableHead>
                                    <TableHead className="text-right bg-white dark:bg-slate-900 dark:text-slate-300">Prezzo €</TableHead>
                                    <TableHead className="text-right bg-white dark:bg-slate-900 dark:text-slate-300">Pezzi Fisici</TableHead>
                                    <TableHead className="text-right bg-white dark:bg-slate-900 dark:text-slate-300">Quantità</TableHead>
                                    <TableHead className="text-center bg-white dark:bg-slate-900 dark:text-slate-300">U.M.</TableHead>
                                    <TableHead className="text-right bg-white dark:bg-slate-900 dark:text-slate-300">Valore €</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(groupedArticles).map(([type, articles]) => (
                                    <>
                                        {/* Type Header Row */}
                                        <TableRow key={`type-${type}`} className="bg-slate-100 dark:bg-slate-800">
                                            <TableCell colSpan={9} className="font-bold text-slate-700 dark:text-slate-200 py-2">
                                                {type}
                                            </TableCell>
                                        </TableRow>
                                        {/* Articles in this type */}
                                        {articles.map((article, idx) => (
                                            <TableRow
                                                key={`${article.itemId}-${article.lotRef}-${idx}`}
                                                className="dark:border-slate-700"
                                            >
                                                <TableCell className="font-mono text-sm dark:text-slate-300">{article.itemCode}</TableCell>
                                                <TableCell className="max-w-[200px] truncate dark:text-slate-300">{article.itemName}</TableCell>
                                                <TableCell className="dark:text-slate-300">{article.itemBrand}</TableCell>
                                                <TableCell className="text-sm dark:text-slate-300">
                                                    <span className="font-medium">{article.lotRef}</span>
                                                    {article.lotDate && (
                                                        <span className="text-slate-400 dark:text-slate-500 ml-1">
                                                            ({format(new Date(article.lotDate), 'dd/MM/yy')})
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right dark:text-slate-300">
                                                    {article.price > 0 ? article.price.toFixed(2) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-medium dark:text-slate-300">{article.pieces}</TableCell>
                                                <TableCell className="text-right dark:text-slate-300">{article.quantity.toFixed(2)}</TableCell>
                                                <TableCell className="text-center text-sm dark:text-slate-300">{article.itemUnit}</TableCell>
                                                <TableCell className="text-right font-medium dark:text-slate-300">
                                                    {article.totalValue > 0 ? article.totalValue.toFixed(2) : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                ))}
                                {/* Totals Row */}
                                <TableRow className="bg-slate-50 dark:bg-slate-800 font-bold sticky bottom-0">
                                    <TableCell colSpan={5} className="dark:text-white">TOTALE</TableCell>
                                    <TableCell className="text-right dark:text-white">
                                        {data.articles.reduce((sum, a) => sum + a.pieces, 0)}
                                    </TableCell>
                                    <TableCell className="text-right dark:text-white">
                                        {data.articles.reduce((sum, a) => sum + a.quantity, 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
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
