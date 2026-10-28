"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Worker, workersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, HardHat, Mail, Pencil, Calendar, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { WorkerDialog } from "./worker-dialog";
import { useToast } from "@/components/ui/use-toast";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";

// Operai per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

type SortKey = "name" | "status" | "created";
type StatusFilter = "all" | "active" | "inactive";

interface WorkersContentProps {
    initialWorkers: Worker[];
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function StatusBadge({ active }: { active: boolean }) {
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${active ? "border-green-200 bg-green-100 text-green-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
            {active ? "Attivo" : "Inattivo"}
        </span>
    );
}

const euro = (v: number) => `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

export default function WorkersContent({ initialWorkers }: WorkersContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [workers, setWorkers] = useState<Worker[]>(initialWorkers);
    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [status, setStatus] = useState<StatusFilter>(
        searchParams.get("stato") === "active" ? "active" : searchParams.get("stato") === "inactive" ? "inactive" : "all"
    );
    const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "desc" ? "desc" : "asc");
    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const { userRole } = useAuth();
    const { toast } = useToast();

    const canEdit = userRole === 'admin' || userRole === 'operativo';

    // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (status !== "all") params.set("stato", status);
        if (sortKey !== "name") params.set("sort", sortKey);
        if (sortDir !== "asc") params.set("dir", sortDir);
        if (page !== 1) params.set("page", String(page));
        const query = params.toString();
        router.replace(query ? `/workers?${query}` : "/workers", { scroll: false });
    }, [search, status, sortKey, sortDir, page, router]);

    const filtered = useMemo(() => {
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const rows = workers.filter((w) => {
            const target = `${w.firstName} ${w.lastName} ${w.email || ''}`.toLowerCase();
            return words.every(word => target.includes(word))
                && (status === "all" || (status === "active" ? w.isActive : !w.isActive));
        });
        const dir = sortDir === "asc" ? 1 : -1;
        const byName = (a: Worker, b: Worker) =>
            `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "it");
        return rows.sort((a, b) => {
            if (sortKey === "status") return (Number(b.isActive) - Number(a.isActive)) * dir || byName(a, b);
            if (sortKey === "created") return (a.createdAt || "").localeCompare(b.createdAt || "") * dir || byName(a, b);
            return byName(a, b) * dir;
        });
    }, [workers, search, status, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "created" ? "desc" : "asc"); }
        setPage(1);
    };
    const changeStatus = (v: string) => { setStatus(v as StatusFilter); setPage(1); };
    const anyFilterActive = status !== "all" || !!search;
    const resetFilters = () => { setStatus("all"); setSearch(""); setPage(1); };

    const handleWorkerCreated = () => { window.location.reload(); };
    const handleWorkerUpdated = () => { window.location.reload(); };

    const handleToggleStatus = async (worker: Worker, checked: boolean) => {
        try {
            setTogglingId(worker.id);
            const updated = await workersApi.toggleStatus(worker.id, checked);
            setWorkers(prev => prev.map(w => w.id === worker.id ? updated : w));
            toast({
                title: "Stato aggiornato",
                description: `${worker.firstName} è ora ${checked ? 'Attivo' : 'Inattivo'}.`,
            });
        } catch {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile aggiornare lo stato.",
            });
        } finally {
            setTogglingId(null);
        }
    };

    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );
    const statusItems = (
        <>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="inactive">Inattivi</SelectItem>
        </>
    );
    const colCount = canEdit ? 7 : 4;

    return (
        <>
            <ListPageHeader
                title="Gestione Operai"
                actions={canEdit && (
                    <Button onClick={() => setIsCreateOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto md:hidden">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuovo Operaio
                    </Button>
                )}
                search={{ id: "workers-search", label: "Cerca operai", value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Cerca Operaio (Nome, Email...)" }}
                searchActions={anyFilterActive && (
                    <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
                        Azzera filtri
                    </Button>
                )}
            >
                {/* Telefono: stato */}
                <div className="md:hidden">
                    <Select value={status} onValueChange={changeStatus}>
                        <SelectTrigger aria-label="Stato"><SelectValue placeholder="Stato" /></SelectTrigger>
                        <SelectContent>{statusItems}</SelectContent>
                    </Select>
                </div>
            </ListPageHeader>

            {/* Tabella: da tablet in su */}
            <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className={headCls}>{sortBtn("name", "Operaio")}</TableHead>
                            <TableHead className={`w-64 ${headCls}`}>Email</TableHead>
                            {canEdit && <TableHead className={`w-32 text-right ${headCls}`}>Tariffa oraria</TableHead>}
                            {canEdit && <TableHead className={`w-32 text-right ${headCls}`}>Trasferta</TableHead>}
                            <TableHead className={`w-44 ${headCls}`}>
                                <div className="flex items-center gap-1">
                                    <div className="min-w-0 flex-1">
                                        <Select value={status} onValueChange={changeStatus}>
                                            <SelectTrigger aria-label="Filtra per stato" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Stato" /></SelectTrigger>
                                            <SelectContent>{statusItems}</SelectContent>
                                        </Select>
                                    </div>
                                    <button type="button" aria-label="Ordina per stato" onClick={() => toggleSort("status")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                        <SortArrow active={sortKey === "status"} dir={sortDir} />
                                    </button>
                                </div>
                            </TableHead>
                            <TableHead className={`w-36 ${canEdit ? headCls : ""} text-xs font-semibold uppercase tracking-wide text-slate-600`}>{sortBtn("created", "Registrato il")}</TableHead>
                            {canEdit && <TableHead className="w-14" />}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={colCount} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    <HardHat className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                    Nessun operaio trovato
                                </TableCell>
                            </TableRow>
                        ) : pageRows.map((worker) => (
                            <TableRow key={worker.id} className="cursor-pointer" onClick={() => router.push(`/workers/${worker.id}`)}>
                                <TableCell className="border-r py-2 font-medium capitalize text-slate-900 dark:text-white">{worker.firstName} {worker.lastName}</TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                    {worker.email ? (
                                        <a href={`mailto:${worker.email}`} className="block truncate text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()} title={worker.email}>{worker.email}</a>
                                    ) : <span className="text-slate-300">—</span>}
                                </TableCell>
                                {canEdit && <TableCell className="border-r py-2 text-right text-sm text-slate-700 dark:text-slate-300">{euro(worker.hourlyRate)}</TableCell>}
                                {canEdit && <TableCell className="border-r py-2 text-right text-sm text-slate-700 dark:text-slate-300">{euro(worker.trasfertaRate)}</TableCell>}
                                <TableCell className="border-r py-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge active={worker.isActive} />
                                        {canEdit && (
                                            <Switch
                                                checked={worker.isActive}
                                                disabled={togglingId === worker.id}
                                                onCheckedChange={(checked) => handleToggleStatus(worker, checked)}
                                                aria-label="Attivo / inattivo"
                                            />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className={`py-2 text-sm text-slate-600 dark:text-slate-300 ${canEdit ? "border-r" : ""}`}>{new Date(worker.createdAt).toLocaleDateString('it-IT')}</TableCell>
                                {canEdit && (
                                    <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-slate-400 hover:text-blue-600"
                                            title="Modifica operaio"
                                            aria-label="Modifica operaio"
                                            onClick={() => { setSelectedWorker(worker); setIsEditOpen(true); }}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Schede: telefono */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
                {pageRows.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-slate-400">
                        <HardHat className="mx-auto mb-2 h-12 w-12 opacity-20" />
                        <p>Nessun operaio trovato</p>
                    </div>
                ) : pageRows.map((worker) => (
                    <Card key={worker.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => router.push(`/workers/${worker.id}`)}>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between">
                                <span className="truncate capitalize">{worker.firstName} {worker.lastName}</span>
                                {canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-slate-400 hover:text-blue-600"
                                        aria-label="Modifica operaio"
                                        onClick={(e) => { e.stopPropagation(); setSelectedWorker(worker); setIsEditOpen(true); }}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                            {worker.email && (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <a href={`mailto:${worker.email}`} className="truncate text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>{worker.email}</a>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 shrink-0" />
                                <span>Registrato il {new Date(worker.createdAt).toLocaleDateString('it-IT')}</span>
                            </div>
                            <div className="flex items-center justify-between border-t pt-1 dark:border-border" onClick={(e) => e.stopPropagation()}>
                                <StatusBadge active={worker.isActive} />
                                {canEdit && (
                                    <Switch
                                        checked={worker.isActive}
                                        disabled={togglingId === worker.id}
                                        onCheckedChange={(checked) => handleToggleStatus(worker, checked)}
                                        aria-label="Attivo / inattivo"
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                itemLabel="operai"
            />

            {/* Pulsante «nuovo operaio» sempre visibile (PC) */}
            {canEdit && <FloatingAddButton onClick={() => setIsCreateOpen(true)} label="Nuovo operaio" />}

            {/* Dialogs */}
            <WorkerDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={handleWorkerCreated}
            />

            {selectedWorker && (
                <WorkerDialog
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    workerToEdit={selectedWorker}
                    onSuccess={handleWorkerUpdated}
                />
            )}
        </>
    );
}
