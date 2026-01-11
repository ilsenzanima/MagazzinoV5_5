"use client"

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2, Package, Calendar, RotateCcw } from "lucide-react";
import { getArticlesWithStock, ArticlesReportData, ArticleLot } from "@/lib/services/reports";
import { generateArticlesReport } from "./articles-report-generator";
import { format } from "date-fns";

export default function ArticlesReport() {
    const [data, setData] = useState<ArticlesReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (targetDate?: string) => {
        try {
            setLoading(true);
            setError(null);
            const result = await getArticlesWithStock(targetDate);
            setData(result);
            setIsHistorical(!!targetDate);
        } catch (err) {
            console.error("Error loading articles report:", err);
            setError("Errore nel caricamento dei dati");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadHistorical = () => {
        if (selectedDate) {
            loadData(selectedDate);
        }
    };

    const handleResetToToday = () => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        loadData(); // No date = current stock
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
            <div className="space-y-4">
                {/* Date Selector */}
                <Card className="p-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-1">
                            <Label htmlFor="reportDate" className="text-sm flex items-center gap-1">
                                <Calendar className="h-4 w-4" /> Data Report
                            </Label>
                            <Input
                                id="reportDate"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <Button onClick={handleLoadHistorical} variant="outline" className="gap-2">
                            Carica Storico
                        </Button>
                        {isHistorical && (
                            <Button onClick={handleResetToToday} variant="ghost" className="gap-2">
                                <RotateCcw className="h-4 w-4" /> Torna ad Oggi
                            </Button>
                        )}
                    </div>
                </Card>
                <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
                        <Package className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <p>Nessun articolo con giacenza superiore a 0{isHistorical ? ` alla data ${format(new Date(selectedDate), 'dd/MM/yyyy')}` : ''}.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Date Selector and Summary */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Date Selector - inline */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-md">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <Input
                        id="reportDate"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-32 h-7 text-sm border-0 p-0 bg-transparent"
                    />
                    <Button onClick={handleLoadHistorical} variant="outline" size="sm" className="h-7 text-xs">
                        Carica
                    </Button>
                    {isHistorical && (
                        <Button onClick={handleResetToToday} variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <RotateCcw className="h-3 w-3" /> Oggi
                        </Button>
                    )}
                </div>

                {isHistorical && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
                        ⚠️ Stock al {format(new Date(selectedDate), 'dd/MM/yyyy')}
                    </span>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Summary Cards */}
                <Card className="px-3 py-1.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Articoli</p>
                    <p className="text-lg font-bold dark:text-white">{data.articles.length}</p>
                </Card>
                <Card className="px-3 py-1.5 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Valore Totale</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                        € {data.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </p>
                </Card>

                <Button onClick={handleExportPDF} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Esporta PDF
                </Button>
            </div>

            {/* Articles Table - Grouped by Type */}
            <Card className="flex flex-col" style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
                <CardHeader className="pb-2 flex-shrink-0 border-b dark:border-slate-700">
                    <CardTitle className="text-lg dark:text-white">
                        Dettaglio Articoli per Tipologia e Lotto
                        {isHistorical && (
                            <span className="text-sm font-normal text-amber-600 dark:text-amber-400 ml-2">
                                (al {format(new Date(selectedDate), 'dd/MM/yyyy')})
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div
                        ref={tableContainerRef}
                        className="h-full overflow-auto"
                    >
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700">
                                <tr>
                                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Codice</th>
                                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Articolo</th>
                                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Marca</th>
                                    <th className="text-left p-3 font-medium text-slate-700 dark:text-slate-300">Lotto</th>
                                    <th className="text-right p-3 font-medium text-slate-700 dark:text-slate-300">Prezzo €</th>
                                    <th className="text-right p-3 font-medium text-slate-700 dark:text-slate-300">Pezzi Fisici</th>
                                    <th className="text-right p-3 font-medium text-slate-700 dark:text-slate-300">Quantità</th>
                                    <th className="text-center p-3 font-medium text-slate-700 dark:text-slate-300">U.M.</th>
                                    <th className="text-right p-3 font-medium text-slate-700 dark:text-slate-300">Valore €</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(groupedArticles).map(([type, articles]) => (
                                    <>
                                        {/* Type Header Row */}
                                        <tr key={`type-${type}`} className="bg-slate-200 dark:bg-slate-700">
                                            <td colSpan={9} className="p-2 font-bold text-slate-700 dark:text-slate-200">
                                                {type}
                                            </td>
                                        </tr>
                                        {/* Articles in this type */}
                                        {articles.map((article, idx) => (
                                            <tr
                                                key={`${article.itemId}-${article.lotRef}-${idx}`}
                                                className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                <td className="p-3 font-mono text-sm dark:text-slate-300">{article.itemCode}</td>
                                                <td className="p-3 max-w-[200px] truncate dark:text-slate-300">
                                                    {article.itemName}
                                                    {article.itemModel && <span className="text-slate-400 dark:text-slate-500"> ({article.itemModel})</span>}
                                                </td>
                                                <td className="p-3 dark:text-slate-300">{article.itemBrand}</td>
                                                <td className="p-3 text-sm dark:text-slate-300">
                                                    <span className="font-medium">{article.lotRef}</span>
                                                    {article.lotDate && (
                                                        <span className="text-slate-400 dark:text-slate-500 ml-1">
                                                            ({format(new Date(article.lotDate), 'dd/MM/yy')})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right dark:text-slate-300">
                                                    {article.price > 0 ? article.price.toFixed(2) : '-'}
                                                </td>
                                                <td className="p-3 text-right font-medium dark:text-slate-300">{article.pieces}</td>
                                                <td className="p-3 text-right dark:text-slate-300">{article.quantity.toFixed(2)}</td>
                                                <td className="p-3 text-center text-sm dark:text-slate-300">{article.itemUnit}</td>
                                                <td className="p-3 text-right font-medium dark:text-slate-300">
                                                    {article.totalValue > 0 ? article.totalValue.toFixed(2) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </>
                                ))}
                            </tbody>
                            {/* Totals Footer */}
                            <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 border-t-2 dark:border-slate-600">
                                <tr className="font-bold">
                                    <td colSpan={5} className="p-3 dark:text-white">TOTALE</td>
                                    <td className="p-3 text-right dark:text-white">
                                        {data.articles.reduce((sum, a) => sum + a.pieces, 0)}
                                    </td>
                                    <td className="p-3 text-right dark:text-white">
                                        {data.articles.reduce((sum, a) => sum + a.quantity, 0).toFixed(2)}
                                    </td>
                                    <td className="p-3"></td>
                                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">
                                        € {data.totalValue.toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
