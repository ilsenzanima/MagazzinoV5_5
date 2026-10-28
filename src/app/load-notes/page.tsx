"use client"

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
    Plus, FileText, CheckCircle2, Clock, Trash2, Archive, RotateCcw, User, Calendar,
    ArrowUpRight, ArrowDownRight, Loader2, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import { LoadNote } from "@/lib/types";
import { loadNotesService } from "@/lib/services/load-notes";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Note per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

type SortKey = "status" | "type" | "date" | "job" | "author";
type StatusFilter = "pending" | "completed" | "all";

const jobLabel = (n: LoadNote) => n.jobDescription || n.jobCode || "";
const itemSummary = (n: LoadNote) =>
    n.items.map(i => (i.inventoryModel ? `${i.inventoryName} (${i.inventoryModel})` : i.inventoryName)).filter(Boolean).join(", ");

function TypeBadge({ type }: { type: LoadNote["noteType"] }) {
    return type === "reso" ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            <ArrowDownRight className="h-3.5 w-3.5" />Reso
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <ArrowUpRight className="h-3.5 w-3.5" />Uscita
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    return status === "pending" ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-yellow-200 bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
            <Clock className="h-3.5 w-3.5" />Da processare
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" />Completata
        </span>
    );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

// Virgola = OR tra gruppi, spazio = tutte le parole devono comparire
function matches(note: LoadNote, search: string): boolean {
    const groups = search.split(",").map(g => g.split(/\s+/).map(w => w.toLowerCase()).filter(Boolean)).filter(g => g.length > 0);
    if (groups.length === 0) return true;
    const text = [note.jobCode, note.jobDescription, note.notes, note.createdByName, itemSummary(note), note.items.map(i => i.inventoryCode).join(" ")]
        .filter(Boolean).join(" ").toLowerCase();
    return groups.some(g => g.every(w => text.includes(w)));
}

function LoadNotesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
    const [status, setStatus] = useState<StatusFilter>(
        searchParams.get("stato") === "all" ? "all" : (searchParams.get("stato") === "completed" || searchParams.get("tab") === "completed") ? "completed" : "pending"
    );
    const [type, setType] = useState(searchParams.get("tipo") || "all");
    const [jobId, setJobId] = useState(searchParams.get("jobId") || "");
    const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
    const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
    const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
    useEffect(() => {
        const params = new URLSearchParams();
        if (searchTerm) params.set("q", searchTerm);
        if (status !== "pending") params.set("stato", status);
        if (type !== "all") params.set("tipo", type);
        if (jobId) params.set("jobId", jobId);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (sortKey !== "date") params.set("sort", sortKey);
        if (sortDir !== "desc") params.set("dir", sortDir);
        if (page !== 1) params.set("page", String(page));
        const query = params.toString();
        router.replace(query ? `/load-notes?${query}` : "/load-notes", { scroll: false });
    }, [searchTerm, status, type, jobId, dateFrom, dateTo, sortKey, sortDir, page, router]);

    const fetchNotes = async () => {
        try {
            setNotes(await loadNotesService.getAll());
        } catch {
            toast.error("Errore nel caricamento delle note");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotes(); }, []);

    const jobOptions = useMemo(() => {
        const seen = new Map<string, string>();
        notes.forEach(n => { if (n.jobId && !seen.has(n.jobId)) seen.set(n.jobId, jobLabel(n)); });
        return [{ value: "all", label: "Tutte le commesse" }, ...[...seen].map(([value, label]) => ({ value, label }))];
    }, [notes]);

    const filtered = useMemo(() => {
        const rows = notes.filter(n =>
            (status === "all" || (status === "pending" ? n.status === "pending" : n.status !== "pending")) &&
            (type === "all" || n.noteType === type) &&
            (!jobId || n.jobId === jobId) &&
            (!dateFrom || n.date >= dateFrom) &&
            (!dateTo || n.date <= dateTo) &&
            matches(n, searchTerm)
        );
        const dir = sortDir === "asc" ? 1 : -1;
        const byDate = (a: LoadNote, b: LoadNote) => b.date.localeCompare(a.date);
        const key = (n: LoadNote): string => {
            switch (sortKey) {
                case "status": return n.status;
                case "type": return n.noteType;
                case "job": return jobLabel(n).toLowerCase();
                case "author": return (n.createdByName || "").toLowerCase();
                default: return n.date;
            }
        };
        return rows.sort((a, b) => key(a).localeCompare(key(b)) * dir || byDate(a, b));
    }, [notes, status, type, jobId, dateFrom, dateTo, searchTerm, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const pendingCount = notes.filter(n => n.status === "pending").length;

    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
        setPage(1);
    };
    const changeStatus = (v: string) => { setStatus(v as StatusFilter); setPage(1); };
    const changeType = (v: string) => { setType(v); setPage(1); };
    const changeJob = (v: string) => { setJobId(v === "all" ? "" : v); setPage(1); };
    const changeDate = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

    const anyFilterActive = status !== "pending" || type !== "all" || !!jobId || !!dateFrom || !!dateTo || !!searchTerm;
    const resetFilters = () => {
        setStatus("pending"); setType("all"); setJobId(""); setDateFrom(""); setDateTo(""); setSearchTerm(""); setPage(1);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("Sei sicuro di voler eliminare questa nota?")) return;
        try {
            await loadNotesService.delete(id);
            toast.success("Nota eliminata");
            fetchNotes();
        } catch {
            toast.error("Errore eliminazione");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await loadNotesService.toggleStatus(id, currentStatus);
            toast.success(currentStatus === "pending" ? "Nota archiviata" : "Nota riaperta");
            fetchNotes();
        } catch {
            toast.error("Impossibile aggiornare lo stato");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Sei sicuro di voler eliminare ${selectedIds.size} nota${selectedIds.size > 1 ? "e" : ""}?`)) return;
        try {
            await Promise.all([...selectedIds].map(id => loadNotesService.delete(id)));
            toast.success(`${selectedIds.size} nota${selectedIds.size > 1 ? "e eliminate" : " eliminata"}`);
            setSelectedIds(new Set());
            fetchNotes();
        } catch {
            toast.error("Errore durante l'eliminazione");
        }
    };

    const allSelected = pageRows.length > 0 && pageRows.every(n => selectedIds.has(n.id));
    const someSelected = pageRows.some(n => selectedIds.has(n.id));
    const toggleAll = () => {
        const next = new Set(selectedIds);
        pageRows.forEach(n => (allSelected ? next.delete(n.id) : next.add(n.id)));
        setSelectedIds(next);
    };
    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const statusSelect = (compact: boolean) => (
        <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger aria-label="Filtra per stato" className={compact ? "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase" : undefined}>
                <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="pending">Da processare{pendingCount > 0 ? ` (${pendingCount})` : ""}</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
                <SelectItem value="all">Tutte</SelectItem>
            </SelectContent>
        </Select>
    );
    const typeSelect = (compact: boolean) => (
        <Select value={type} onValueChange={changeType}>
            <SelectTrigger aria-label="Filtra per tipo" className={compact ? "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase" : undefined}>
                <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="uscita">Uscite</SelectItem>
                <SelectItem value="reso">Resi</SelectItem>
            </SelectContent>
        </Select>
    );

    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );
    const filterWithSort = (select: React.ReactNode, key: SortKey, label: string) => (
        <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">{select}</div>
            <button type="button" aria-label={`Ordina per ${label}`} onClick={() => toggleSort(key)} className="shrink-0 text-slate-500 hover:text-slate-900">
                <SortArrow active={sortKey === key} dir={sortDir} />
            </button>
        </div>
    );

    const actionButtons = (note: LoadNote) => (
        <div className="flex items-center justify-end gap-1">
            <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleToggleStatus(note.id, note.status, e)}
                title={note.status === "pending" ? "Archivia: cambia solo lo stato della nota, puoi sempre riaprirla" : "Riapri nota"}
            >
                {note.status === "pending" ? <Archive className="h-4 w-4 text-green-600" /> : <RotateCcw className="h-4 w-4 text-orange-500" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => handleDelete(note.id, e)} title="Elimina nota">
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );

    return (
        <DashboardLayout>
            <ListPageHeader
                title="Note di Carico"
                actions={
                    <Link href="/load-notes/new" className="w-full sm:w-auto md:hidden">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuova Nota
                        </Button>
                    </Link>
                }
                search={{ id: "load-notes-search", label: "Cerca note", value: searchTerm, onChange: (v) => { setSearchTerm(v); setPage(1); }, placeholder: "Cerca per commessa, note, materiale o autore... (virgola = OR)" }}
                searchActions={
                    <>
                        <div className="hidden items-center gap-2 md:flex">
                            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Dal</span>
                            <Input type="date" aria-label="Dal" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
                            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Al</span>
                            <Input type="date" aria-label="Al" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
                        </div>
                        {selectedIds.size > 0 && (
                            <Button variant="destructive" className="hidden shrink-0 md:inline-flex" onClick={handleBulkDelete}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Elimina selezionate ({selectedIds.size})
                            </Button>
                        )}
                        {anyFilterActive && (
                            <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
                                Azzera filtri
                            </Button>
                        )}
                    </>
                }
            >
                {/* Telefono: stato, tipo, date e commessa */}
                <div className="grid grid-cols-2 gap-2 md:hidden">
                    {statusSelect(false)}
                    {typeSelect(false)}
                    <Input type="date" aria-label="Dal" className="border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
                    <Input type="date" aria-label="Al" className="border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
                    <div className="col-span-2">
                        <SearchableSelect
                            options={jobOptions}
                            value={jobId}
                            onValueChange={changeJob}
                            placeholder="Commessa"
                            searchPlaceholder="Scrivi per cercare commessa..."
                        />
                    </div>
                </div>
            </ListPageHeader>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento note...</span>
                </div>
            ) : (
                <>
                    {/* Tabella: da tablet in su */}
                    <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className="w-10 border-r">
                                        <Checkbox
                                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                                            onCheckedChange={toggleAll}
                                            aria-label="Seleziona tutte"
                                        />
                                    </TableHead>
                                    <TableHead className={`w-44 ${headCls}`}>{filterWithSort(statusSelect(true), "status", "stato")}</TableHead>
                                    <TableHead className={`w-32 ${headCls}`}>{filterWithSort(typeSelect(true), "type", "tipo")}</TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Data")}</TableHead>
                                    <TableHead className={`w-64 ${headCls}`}>
                                        {filterWithSort(
                                            <SearchableSelect
                                                options={jobOptions}
                                                value={jobId}
                                                onValueChange={changeJob}
                                                placeholder="Commessa"
                                                searchPlaceholder="Scrivi per cercare commessa..."
                                                className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
                                                contentClassName="min-w-[22rem]"
                                            />,
                                            "job", "commessa"
                                        )}
                                    </TableHead>
                                    <TableHead className={headCls}>Note e materiali</TableHead>
                                    <TableHead className={`w-32 ${headCls}`}>{sortBtn("author", "Autore")}</TableHead>
                                    <TableHead className="w-24" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                            <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                            Nessuna nota trovata
                                        </TableCell>
                                    </TableRow>
                                ) : pageRows.map((note) => (
                                    <TableRow
                                        key={note.id}
                                        className={`cursor-pointer ${selectedIds.has(note.id) ? "bg-muted/30" : ""}`}
                                        onClick={() => router.push(`/load-notes/${note.id}`)}
                                    >
                                        <TableCell className="border-r py-2" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox checked={selectedIds.has(note.id)} onCheckedChange={() => toggleOne(note.id)} aria-label="Seleziona nota" />
                                        </TableCell>
                                        <TableCell className="border-r py-2"><StatusBadge status={note.status} /></TableCell>
                                        <TableCell className="border-r py-2"><TypeBadge type={note.noteType} /></TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{format(new Date(note.date), "dd/MM/yyyy", { locale: it })}</TableCell>
                                        <TableCell className="border-r py-2 text-sm text-blue-600 dark:text-blue-400">
                                            <span className="line-clamp-2" title={jobLabel(note)}>
                                                {jobLabel(note) || <span className="italic text-slate-400">Nessuna commessa</span>}
                                            </span>
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-xs text-slate-500 dark:text-slate-400">
                                            {note.notes && <div className="line-clamp-1 text-slate-700 dark:text-slate-300" title={note.notes}>{note.notes}</div>}
                                            <div className="line-clamp-2" title={itemSummary(note)}>
                                                {note.items.length > 0 ? `${note.items.length} articoli: ${itemSummary(note)}` : <span className="text-slate-300">—</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            <span className="block truncate" title={note.createdByName}>{note.createdByName || "—"}</span>
                                        </TableCell>
                                        <TableCell className="py-2 text-right">{actionButtons(note)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Schede: telefono */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
                        {pageRows.length === 0 ? (
                            <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                                <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                <p>Nessuna nota trovata</p>
                            </div>
                        ) : pageRows.map((note) => (
                            <Link href={`/load-notes/${note.id}`} key={note.id}>
                                <Card className="h-full cursor-pointer border-slate-200 transition-shadow hover:shadow-md dark:border-slate-700">
                                    <CardContent className="p-4">
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            <StatusBadge status={note.status} />
                                            <TypeBadge type={note.noteType} />
                                        </div>
                                        <p className="mb-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                            <Calendar className="h-3 w-3 shrink-0" />
                                            {format(new Date(note.date), "dd MMMM yyyy", { locale: it })}
                                            {note.createdByName && (<><User className="ml-2 h-3 w-3 shrink-0" />{note.createdByName}</>)}
                                        </p>
                                        <p className="break-words font-medium text-blue-600 dark:text-blue-400">
                                            {jobLabel(note) || <span className="italic text-slate-400">Nessuna commessa</span>}
                                        </p>
                                        {note.notes && <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{note.notes}</p>}
                                        {note.items.length > 0 && (
                                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{note.items.length} articoli: {itemSummary(note)}</p>
                                        )}
                                        <div className="mt-2 border-t pt-1">{actionButtons(note)}</div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    <PaginationControls
                        page={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={filtered.length}
                        itemLabel="note"
                    />
                </>
            )}

            {/* Pulsante «nuova nota» sempre visibile (PC) */}
            <FloatingAddButton href="/load-notes/new" label="Nuova nota" />
        </DashboardLayout>
    );
}

export default function LoadNotesPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="py-12 text-center text-muted-foreground">Caricamento...</div>
            </DashboardLayout>
        }>
            <LoadNotesContent />
        </Suspense>
    );
}
