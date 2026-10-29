"use client"

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { FileDown, Loader2, Package, Calendar, RotateCcw, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getArticlesWithStock, ArticlesReportData, ArticleLot } from "@/lib/services/reports";
import { generateArticlesReport } from "./articles-report-generator";
import { format } from "date-fns";
import { warehousesApi } from "@/lib/services/warehouses";
import type { Warehouse } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format";

const PAGE_SIZE = 50;
const NO_TYPE = "Senza Categoria";

type SortKey = "code" | "name" | "type" | "brand" | "lot" | "price" | "pieces" | "quantity" | "value";

const sortValue = (a: ArticleLot, key: SortKey): string | number => {
    switch (key) {
        case "code": return a.itemCode;
        case "name": return a.itemName;
        case "type": return a.itemType || NO_TYPE;
        case "brand": return a.itemBrand || "";
        case "lot": return a.lotDate || a.lotRef || "";
        case "price": return a.price;
        case "pieces": return a.pieces;
        case "quantity": return a.quantity;
        case "value": return a.totalValue;
    }
};

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export default function ArticlesReport() {
    const [data, setData] = useState<ArticlesReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortKey, setSortKey] = useState<SortKey>("code");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);

    useEffect(() => {
        loadData();
        warehousesApi.getAll().then(setWarehouses).catch(console.error);
    }, []);

    const loadData = async (targetDate?: string, warehouseId?: string) => {
        try {
            setLoading(true);
            setError(null);
            const result = await getArticlesWithStock(targetDate, warehouseId !== "all" ? warehouseId : undefined);
            setData(result);
            setIsHistorical(!!targetDate);
            setPage(1);
        } catch (err) {
            console.error("Error loading articles report:", err);
            setError("Errore nel caricamento dei dati");
        } finally {
            setLoading(false);
        }
    };

    const stockWarehouses = warehouses.filter((w) => w.isPrimary || /operativ/i.test(w.name));

    const handleWarehouseChange = (warehouseId: string) => {
        setSelectedWarehouse(warehouseId);
        loadData(isHistorical ? selectedDate : undefined, warehouseId);
    };

    const handleLoadHistorical = () => {
        if (selectedDate) loadData(selectedDate, selectedWarehouse);
    };

    const handleResetToToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0]);
        loadData(undefined, selectedWarehouse);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "price" || key === "pieces" || key === "quantity" || key === "value" ? "desc" : "asc"); }
        setPage(1);
    };

    const types = useMemo(
        () => Array.from(new Set((data?.articles ?? []).map(a => a.itemType || NO_TYPE))).sort((a, b) => a.localeCompare(b)),
        [data]
    );

    const filtered = useMemo(() => {
        if (!data) return [];
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const rows = data.articles.filter(a => {
            if (typeFilter !== "all" && (a.itemType || NO_TYPE) !== typeFilter) return false;
            if (words.length === 0) return true;
            const hay = `${a.itemCode} ${a.itemName} ${a.itemModel} ${a.itemBrand} ${a.lotRef}`.toLowerCase();
            return words.every(w => hay.includes(w));
        });
        const mul = sortDir === "asc" ? 1 : -1;
        return rows.slice().sort((a, b) => {
            const x = sortValue(a, sortKey), y = sortValue(b, sortKey);
            const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "it", { numeric: true });
            return c !== 0 ? c * mul : a.itemCode.localeCompare(b.itemCode, "it", { numeric: true });
        });
    }, [data, search, typeFilter, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((Math.min(page, totalPages) - 1) * PAGE_SIZE, Math.min(page, totalPages) * PAGE_SIZE);
    const filteredValue = filtered.reduce((s, a) => s + a.totalValue, 0);

    const sortHead = (label: string, key: SortKey, right = false) => (
        <button type="button" onClick={() => toggleSort(key)} className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 ${right ? "flex-row-reverse" : ""}`}>
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardContent className="pt-6 text-center text-red-600 dark:text-red-400">{error}</CardContent>
            </Card>
        );
    }

    // Il filtro per sede si basa sulla posizione attuale del lotto: non ha senso
    // per lo storico per data (non tracciato), quindi lo disabilitiamo in quel caso.
    const warehouseTabs = stockWarehouses.length > 1 && (
        <div title={isHistorical ? "Il filtro per sede non è disponibile per lo storico per data" : undefined}>
            <Tabs value={selectedWarehouse} onValueChange={handleWarehouseChange}>
                <TabsList
                    className={`bg-slate-100 dark:bg-slate-800 ${isHistorical ? "opacity-50 pointer-events-none" : ""}`}
                    style={{ display: "grid", gridTemplateColumns: `repeat(${stockWarehouses.length + 1}, minmax(0, 1fr))` }}
                >
                    <TabsTrigger value="all">Tutti</TabsTrigger>
                    {stockWarehouses.map((w) => (
                        <TabsTrigger key={w.id} value={w.id} className="truncate" title={w.name}>{w.name}</TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    );

    const dateSelector = (
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-md">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
                id="reportDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-32 h-7 text-sm border-0 p-0 bg-transparent"
            />
            <Button onClick={handleLoadHistorical} variant="outline" size="sm" className="h-7 text-xs">Carica</Button>
            {isHistorical && (
                <Button onClick={handleResetToToday} variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <RotateCcw className="h-3 w-3" /> Oggi
                </Button>
            )}
        </div>
    );

    if (!data || data.articles.length === 0) {
        return (
            <div className="space-y-4">
                {warehouseTabs}
                {dateSelector}
                <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
                        <Package className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <p>Nessun articolo con giacenza superiore a 0{isHistorical ? ` alla data ${format(new Date(selectedDate), 'dd/MM/yyyy')}` : ''}.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const th = "text-xs font-semibold tracking-wide text-slate-600";
    const typeFilterItems = (
        <>
            <SelectItem value="all">Tutte le tipologie</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </>
    );

    return (
        <div className="space-y-4">
            {warehouseTabs}
            <div className="flex flex-wrap gap-2 items-center">
                {dateSelector}
                {isHistorical && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded">
                        ⚠️ Stock al {format(new Date(selectedDate), 'dd/MM/yyyy')}
                    </span>
                )}
                <div className="flex-1" />
                <Card className="px-3 py-1.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{filtered.length === data.articles.length ? "Lotti" : "Lotti filtrati"}</p>
                    <p className="text-lg font-bold dark:text-white">{filtered.length}</p>
                </Card>
                <Card className="px-3 py-1.5 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Valore {filtered.length === data.articles.length ? "totale" : "filtrato"}</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(filtered.length === data.articles.length ? data.totalValue : filteredValue)}</p>
                </Card>
                <Button onClick={() => generateArticlesReport(data)} className="gap-2">
                    <FileDown className="h-4 w-4" />
                    Esporta PDF
                </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        type="search"
                        placeholder="Cerca per codice, articolo, marca o lotto..."
                        className="pl-9 bg-slate-100 dark:bg-muted border-none"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="md:hidden">
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Tipologia" /></SelectTrigger>
                        <SelectContent>{typeFilterItems}</SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabella da computer */}
            <div className={`hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-card ${loading ? "opacity-60" : ""}`}>
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className={`${th} w-[9%]`}>{sortHead("Codice", "code")}</TableHead>
                            <TableHead className={`${th} w-[22%]`}>{sortHead("Articolo", "name")}</TableHead>
                            <TableHead className={`${th} w-[14%]`}>
                                <div className="flex items-center gap-1">
                                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                        <SelectTrigger className="h-7 w-full border-none bg-transparent px-0 text-xs font-semibold uppercase shadow-none">
                                            <SelectValue>{typeFilter === "all" ? "Tipologia" : typeFilter}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>{typeFilterItems}</SelectContent>
                                    </Select>
                                    <button type="button" aria-label="Ordina per tipologia" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                        <SortArrow active={sortKey === "type"} dir={sortDir} />
                                    </button>
                                </div>
                            </TableHead>
                            <TableHead className={`${th} w-[10%]`}>{sortHead("Marca", "brand")}</TableHead>
                            <TableHead className={`${th} w-[13%]`}>{sortHead("Lotto", "lot")}</TableHead>
                            <TableHead className={`${th} w-[8%] text-right`}><div className="flex justify-end">{sortHead("Prezzo", "price", true)}</div></TableHead>
                            <TableHead className={`${th} w-[7%] text-right`}><div className="flex justify-end">{sortHead("Pezzi", "pieces", true)}</div></TableHead>
                            <TableHead className={`${th} w-[9%] text-right`}><div className="flex justify-end">{sortHead("Qtà", "quantity", true)}</div></TableHead>
                            <TableHead className={`${th} w-[8%] text-right`}><div className="flex justify-end">{sortHead("Valore", "value", true)}</div></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.length === 0 ? (
                            <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-400">Nessun articolo corrisponde ai filtri</TableCell></TableRow>
                        ) : pageRows.map((a, i) => (
                            <TableRow key={`${a.itemId}-${a.lotRef}-${i}`}>
                                <TableCell className="py-2 font-mono text-xs">{a.itemCode}</TableCell>
                                <TableCell className="py-2 text-sm">
                                    <div className="truncate" title={a.itemName}>{a.itemName}{a.itemModel && <span className="text-slate-400"> ({a.itemModel})</span>}</div>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-slate-600 dark:text-slate-300"><div className="truncate" title={a.itemType}>{a.itemType || NO_TYPE}</div></TableCell>
                                <TableCell className="py-2 text-sm"><div className="truncate">{a.itemBrand}</div></TableCell>
                                <TableCell className="py-2 text-sm">
                                    <div className="truncate" title={a.lotRef}>{a.lotRef}</div>
                                    {a.lotDate && <div className="text-xs text-slate-400">{format(new Date(a.lotDate), 'dd/MM/yy')}</div>}
                                </TableCell>
                                <TableCell className="py-2 text-right text-sm">{a.price > 0 ? formatCurrency(a.price) : '-'}</TableCell>
                                <TableCell className="py-2 text-right text-sm font-medium">{a.pieces}</TableCell>
                                <TableCell className="py-2 text-right text-sm">{a.quantity.toFixed(2)} <span className="text-xs text-slate-400">{a.itemUnit}</span></TableCell>
                                <TableCell className="py-2 text-right text-sm font-semibold">{a.totalValue > 0 ? formatCurrency(a.totalValue) : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Schede da telefono */}
            <div className={`space-y-2 md:hidden ${loading ? "opacity-60" : ""}`}>
                {pageRows.map((a, i) => (
                    <Card key={`${a.itemId}-${a.lotRef}-${i}`} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{a.itemName}{a.itemModel && <span className="text-slate-400"> ({a.itemModel})</span>}</p>
                                <p className="font-mono text-xs text-slate-500">{a.itemCode}{a.itemBrand ? ` · ${a.itemBrand}` : ""}</p>
                            </div>
                            <p className="shrink-0 font-semibold">{a.totalValue > 0 ? formatCurrency(a.totalValue) : '-'}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            {a.itemType || NO_TYPE} · Lotto {a.lotRef}{a.lotDate ? ` (${format(new Date(a.lotDate), 'dd/MM/yy')})` : ""}
                        </p>
                        <p className="mt-1 text-sm">{a.pieces} pz · {a.quantity.toFixed(2)} {a.itemUnit}{a.price > 0 ? ` · ${formatCurrency(a.price)}` : ""}</p>
                    </Card>
                ))}
            </div>

            <PaginationControls
                page={Math.min(page, totalPages)}
                totalPages={totalPages}
                loading={loading}
                onPageChange={setPage}
                totalItems={filtered.length}
                itemLabel="lotti"
            />
        </div>
    );
}
