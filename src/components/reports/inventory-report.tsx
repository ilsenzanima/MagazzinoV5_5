"use client"

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { FileDown, Loader2, ClipboardList, Info, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getInventoryCountData, InventoryCountData, InventoryCountItem } from "@/lib/services/reports";
import { generateInventoryCountReport } from "./inventory-report-generator";
import { warehousesApi } from "@/lib/services/warehouses";
import type { Warehouse } from "@/lib/types";

const PAGE_SIZE = 50;
const NO_TYPE = "Senza Categoria";

type SortKey = "code" | "name" | "type" | "pieces";
type ActivityFilter = "all" | "recent" | "old";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export default function InventoryReport() {
    const [data, setData] = useState<InventoryCountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [activity, setActivity] = useState<ActivityFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("type");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);

    useEffect(() => {
        loadData();
        warehousesApi.getAll().then(setWarehouses).catch(console.error);
    }, []);

    const loadData = async (warehouseId?: string) => {
        try {
            setLoading(true);
            setError(null);
            const result = await getInventoryCountData(warehouseId !== "all" ? warehouseId : undefined);
            setData(result);
            setPage(1);
        } catch (err) {
            console.error("Error loading inventory count data:", err);
            setError("Errore nel caricamento dei dati");
        } finally {
            setLoading(false);
        }
    };

    const stockWarehouses = warehouses.filter((w) => w.isPrimary || /operativ/i.test(w.name));

    const handleWarehouseChange = (warehouseId: string) => {
        setSelectedWarehouse(warehouseId);
        loadData(warehouseId);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "pieces" ? "desc" : "asc"); }
        setPage(1);
    };

    const types = useMemo(
        () => Array.from(new Set((data?.items ?? []).map(i => i.itemType || NO_TYPE))).sort((a, b) => a.localeCompare(b)),
        [data]
    );

    const filtered = useMemo(() => {
        if (!data) return [];
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const mul = sortDir === "asc" ? 1 : -1;
        const byCode = (a: InventoryCountItem, b: InventoryCountItem) => a.itemCode.localeCompare(b.itemCode, "it", { numeric: true });
        return data.items
            .filter(i => {
                if (typeFilter !== "all" && (i.itemType || NO_TYPE) !== typeFilter) return false;
                if (activity === "recent" && !i.recentlyActive) return false;
                if (activity === "old" && i.recentlyActive) return false;
                if (words.length === 0) return true;
                const hay = `${i.itemCode} ${i.itemName} ${i.itemModel} ${i.itemBrand}`.toLowerCase();
                return words.every(w => hay.includes(w));
            })
            .sort((a, b) => {
                let c = 0;
                if (sortKey === "pieces") c = a.systemPieces - b.systemPieces;
                else if (sortKey === "name") c = a.itemName.localeCompare(b.itemName, "it");
                else if (sortKey === "type") c = (a.itemType || NO_TYPE).localeCompare(b.itemType || NO_TYPE, "it");
                else c = byCode(a, b);
                return c !== 0 ? c * mul : byCode(a, b);
            });
    }, [data, search, typeFilter, activity, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const isFiltered = !!data && filtered.length !== data.items.length;

    // Il foglio conta segue i filtri attivi: si può stampare una categoria o solo i movimentati
    const handleExportPDF = async () => {
        if (!data) return;
        try {
            setGenerating(true);
            await generateInventoryCountReport({ ...data, items: filtered });
        } catch (err) {
            console.error("Error generating PDF:", err);
            setError("Errore nella generazione del PDF");
        } finally {
            setGenerating(false);
        }
    };

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
                <CardContent className="pt-6 text-center text-red-600 dark:text-red-400">
                    {error}
                </CardContent>
            </Card>
        );
    }

    const warehouseTabs = stockWarehouses.length > 1 && (
        <Tabs value={selectedWarehouse} onValueChange={handleWarehouseChange}>
            <TabsList
                className="bg-slate-100 dark:bg-slate-800"
                style={{ display: "grid", gridTemplateColumns: `repeat(${stockWarehouses.length + 1}, minmax(0, 1fr))` }}
            >
                <TabsTrigger value="all">Tutti</TabsTrigger>
                {stockWarehouses.map((w) => (
                    <TabsTrigger key={w.id} value={w.id} className="truncate" title={w.name}>{w.name}</TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );

    if (!data || data.items.length === 0) {
        return (
            <div className="space-y-4">
                {warehouseTabs}
                <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-slate-500 dark:text-slate-400">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                        <p>Nessun articolo in magazzino da contare.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const th = "text-xs font-semibold tracking-wide text-slate-600";
    const sortHead = (label: string, key: SortKey) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );
    const typeItems = (
        <>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </>
    );
    const activityItems = (
        <>
            <SelectItem value="all">Tutti gli articoli</SelectItem>
            <SelectItem value="recent">Movimentati nell&apos;ultimo anno</SelectItem>
            <SelectItem value="old">Fermi da oltre un anno</SelectItem>
        </>
    );

    return (
        <div className="space-y-4">
            {warehouseTabs}

            <div className="flex flex-wrap items-center gap-2">
                <Card className="px-3 py-1.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">{isFiltered ? "Righe filtrate" : "Righe da contare"}</p>
                    <p className="text-lg font-bold dark:text-white">{filtered.length}</p>
                </Card>
                <div className="flex-1" />
                <Button onClick={handleExportPDF} disabled={generating || filtered.length === 0} className="gap-2">
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Stampa Foglio Conta{isFiltered ? ` (${filtered.length})` : ""}
                </Button>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900">
                <CardContent className="space-y-1 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                            Il foglio PDF serve per la conta fisica: annota nella colonna &quot;Diff.&quot; le differenze. Segue i filtri attivi,
                            quindi puoi stampare una sola categoria o solo gli articoli movimentati.
                        </span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm border border-emerald-400 bg-emerald-200 dark:border-emerald-600 dark:bg-emerald-800" />
                        <span>Righe evidenziate: movimentati o acquistati nell&apos;ultimo anno, i più probabili ad aver cambiato giacenza.</span>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        type="search"
                        placeholder="Cerca per codice, articolo o marca..."
                        className="pl-9 bg-slate-100 dark:bg-muted border-none"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <Select value={activity} onValueChange={(v) => { setActivity(v as ActivityFilter); setPage(1); }}>
                    <SelectTrigger className="w-full sm:w-60"><SelectValue /></SelectTrigger>
                    <SelectContent>{activityItems}</SelectContent>
                </Select>
                <div className="md:hidden">
                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>{typeItems}</SelectContent>
                    </Select>
                </div>
            </div>

            {/* Tabella da computer */}
            <div className={`hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-card ${loading ? "opacity-60" : ""}`}>
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className={`${th} w-[16%]`}>{sortHead("Codice", "code")}</TableHead>
                            <TableHead className={`${th} w-[46%]`}>{sortHead("Articolo", "name")}</TableHead>
                            <TableHead className={`${th} w-[24%]`}>
                                <div className="flex items-center gap-1">
                                    <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                        <SelectTrigger className="h-7 w-full border-none bg-transparent px-0 text-xs font-semibold uppercase shadow-none">
                                            <SelectValue>{typeFilter === "all" ? "Categoria" : typeFilter}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>{typeItems}</SelectContent>
                                    </Select>
                                    <button type="button" aria-label="Ordina per categoria" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                        <SortArrow active={sortKey === "type"} dir={sortDir} />
                                    </button>
                                </div>
                            </TableHead>
                            <TableHead className={`${th} w-[14%] text-right`}><div className="flex justify-end">{sortHead("Pezzi (sistema)", "pieces")}</div></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-400">Nessun articolo corrisponde ai filtri</TableCell></TableRow>
                        ) : pageRows.map((item, idx) => (
                            <TableRow key={`${item.itemId}-${idx}`} className={item.recentlyActive ? "bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/40" : ""}>
                                <TableCell className="py-2 font-mono text-xs">{item.itemCode}</TableCell>
                                <TableCell className="py-2 text-sm">
                                    <div className="truncate" title={item.itemName}>
                                        {item.itemName}
                                        {item.itemModel && <span className="text-slate-400"> ({item.itemModel})</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="py-2 text-sm text-slate-600 dark:text-slate-300"><div className="truncate">{item.itemType || NO_TYPE}</div></TableCell>
                                <TableCell className="py-2 text-right text-sm font-semibold tabular-nums">{item.systemPieces}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Schede da telefono */}
            <div className={`space-y-2 md:hidden ${loading ? "opacity-60" : ""}`}>
                {pageRows.map((item, idx) => (
                    <Card key={`${item.itemId}-${idx}`} className={`p-3 ${item.recentlyActive ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{item.itemName}{item.itemModel && <span className="text-slate-400"> ({item.itemModel})</span>}</p>
                                <p className="font-mono text-xs text-slate-500">{item.itemCode} · {item.itemType || NO_TYPE}</p>
                            </div>
                            <p className="shrink-0 text-lg font-semibold tabular-nums">{item.systemPieces}</p>
                        </div>
                    </Card>
                ))}
            </div>

            <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                loading={loading}
                onPageChange={setPage}
                totalItems={filtered.length}
                itemLabel="articoli"
            />
        </div>
    );
}
