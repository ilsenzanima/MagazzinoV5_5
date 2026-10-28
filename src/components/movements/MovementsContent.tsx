"use client"

import { notify } from "@/lib/notify";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus, Loader2, FileText, ArrowDownRight, ArrowUpRight, ShoppingBag, Truck, Calendar, Printer, Recycle, Repeat,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deliveryNotesApi, jobsApi, DeliveryNote, DeliveryNoteItem } from "@/lib/api";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";

// Movimenti per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

type SortKey = "date" | "number" | "type";

interface MovementsContentProps {
  initialMovements: DeliveryNote[];
  initialTotalItems: number;
}

const TYPE_OPTIONS = [
  { value: "exit", label: "Uscite" },
  { value: "entry", label: "Entrate" },
  { value: "waste", label: "Eccedenze" },
  { value: "transfer", label: "Trasferimenti" },
  { value: "sale", label: "Vendite" },
];

const getTypeConfig = (type: string) => {
  switch (type) {
    case 'waste':
      return { label: 'Eccedenze', color: 'bg-violet-100 text-violet-700 hover:bg-violet-100', icon: Recycle };
    case 'transfer':
      return { label: 'Trasferimento', color: 'bg-teal-100 text-teal-700 hover:bg-teal-100', icon: Repeat };
    case 'entry':
      return { label: 'Entrata', color: 'bg-green-100 text-green-700 hover:bg-green-100', icon: ArrowDownRight };
    case 'exit':
      return { label: 'Uscita', color: 'bg-amber-100 text-amber-700 hover:bg-amber-100', icon: ArrowUpRight };
    case 'sale':
      return { label: 'Vendita', color: 'bg-blue-100 text-blue-700 hover:bg-blue-100', icon: ShoppingBag };
    default:
      return { label: type, color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', icon: FileText };
  }
};

function TypeBadge({ type }: { type: string }) {
  const cfg = getTypeConfig(type);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3.5 w-3.5" />{cfg.label}
    </span>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

// Stampa rapida: scarica il PDF della bolla senza aprirla
async function quickPrint(e: React.MouseEvent, movement: DeliveryNote) {
  e.preventDefault();
  e.stopPropagation();
  try {
    const fullNote = await deliveryNotesApi.getById(movement.id);
    const grouped = new Map<string, DeliveryNoteItem>();
    fullNote.items?.forEach(item => {
      const existing = grouped.get(item.inventoryId);
      grouped.set(item.inventoryId, existing ? { ...existing, quantity: existing.quantity + item.quantity } : { ...item });
    });
    const { generateDeliveryNotePDF } = await import('@/lib/pdf/delivery-note-pdf');
    await generateDeliveryNotePDF(fullNote, Array.from(grouped.values()));
  } catch (error) {
    console.error("Failed to print", error);
    notify.error("Errore durante la stampa");
  }
}

const jobLabel = (m: DeliveryNote) => {
  const name = m.jobName || m.jobDescription;
  if (!name) return m.jobCode || "";
  return m.jobClientName ? `${name} - ${m.jobClientName}` : name;
};

export default function MovementsContent({ initialMovements, initialTotalItems }: MovementsContentProps) {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = userRole === 'admin' || userRole === 'operativo';

  const [movements, setMovements] = useState<DeliveryNote[]>(initialMovements);
  const [total, setTotal] = useState(initialTotalItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [type, setType] = useState(searchParams.get("tipo") || "all");
  const [jobId, setJobId] = useState(searchParams.get("jobId") || "");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [jobs, setJobs] = useState<{ value: string; label: string }[]>([]);
  const requestId = useRef(0);
  const firstLoad = useRef(true);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== debouncedSearch) {
        setDebouncedSearch(searchTerm);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  // Commesse per il filtro: prima quelle attive e in cantiere
  useEffect(() => {
    jobsApi.getAll()
      .then(list => setJobs(list.map(j => ({
        value: j.id,
        label: `${j.code ? j.code + " · " : ""}${j.name || j.description || ""}${j.clientName ? " - " + j.clientName : ""}`,
      }))))
      .catch(console.error);
  }, []);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (type !== "all") params.set("tipo", type);
    if (jobId) params.set("jobId", jobId);
    if (sortKey !== "date") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/movements?${query}` : "/movements", { scroll: false });
  }, [debouncedSearch, dateFrom, dateTo, type, jobId, sortKey, sortDir, page, router]);

  const loadMovements = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await deliveryNotesApi.getPaginated({
        page, limit: PAGE_SIZE, search: debouncedSearch, dateFrom, dateTo,
        type: type === "all" ? "" : type, jobId, sort: sortKey, dir: sortDir,
      });
      if (id !== requestId.current) return;
      setMovements(data);
      setTotal(total);
    } catch (error: any) {
      console.error("Failed to load movements", error);
      if (id === requestId.current) setError(error.message || "Errore durante il caricamento dei movimenti");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    // La prima pagina senza filtri arriva già dal server
    const isDefault = page === 1 && !debouncedSearch && !dateFrom && !dateTo && type === "all" && !jobId && sortKey === "date" && sortDir === "desc";
    if (firstLoad.current) {
      firstLoad.current = false;
      if (isDefault) return;
    }
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, dateFrom, dateTo, type, jobId, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "type" ? "asc" : "desc"); }
    setPage(1);
  };

  const changeType = (v: string) => { setType(v); setPage(1); };
  const changeJob = (v: string) => { setJobId(v === "all" ? "" : v); setPage(1); };
  const changeDate = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  const anyFilterActive = type !== "all" || !!jobId || !!dateFrom || !!dateTo || !!searchTerm;
  const resetFilters = () => {
    setType("all"); setJobId(""); setDateFrom(""); setDateTo(""); setSearchTerm(""); setPage(1);
  };

  const jobOptions = [{ value: "all", label: "Tutte le commesse" }, ...jobs];
  const typeSelect = (
    <Select value={type} onValueChange={changeType}>
      <SelectTrigger aria-label="Filtra per tipo" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Tipo" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti i tipi</SelectItem>
        {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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

  return (
    <>
      <ListPageHeader
        title="Movimentazione Merce"
        actions={canEdit && (
          <Link href="/movements/new" className="w-full sm:w-auto md:hidden">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuova Bolla
            </Button>
          </Link>
        )}
        search={{ id: "movements-search", label: "Cerca movimenti", value: searchTerm, onChange: setSearchTerm, placeholder: "Cerca per bolla, commessa, causale, articolo, note... (virgola = OR)" }}
        searchActions={
          <>
            <div className="hidden items-center gap-2 md:flex">
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Dal</span>
              <Input type="date" aria-label="Dal" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
              <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">Al</span>
              <Input type="date" aria-label="Al" className="w-36 border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
            </div>
            {anyFilterActive && (
              <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
                Azzera filtri
              </Button>
            )}
          </>
        }
      >
        {/* Telefono: date, tipo e commessa */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Input type="date" aria-label="Dal" className="border-none bg-slate-100 dark:bg-muted" value={dateFrom} onChange={(e) => changeDate(setDateFrom)(e.target.value)} />
          <Input type="date" aria-label="Al" className="border-none bg-slate-100 dark:bg-muted" value={dateTo} onChange={(e) => changeDate(setDateTo)(e.target.value)} />
          <Select value={type} onValueChange={changeType}>
            <SelectTrigger aria-label="Tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <SearchableSelect
            options={jobOptions}
            value={jobId}
            onValueChange={changeJob}
            placeholder="Commessa"
            searchPlaceholder="Scrivi per cercare commessa..."
          />
        </div>
      </ListPageHeader>

      {loading && movements.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento movimenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadMovements} variant="outline">Riprova</Button>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className={`w-40 ${headCls}`}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">{typeSelect}</div>
                      <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                        <SortArrow active={sortKey === "type"} dir={sortDir} />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className={`w-28 ${headCls}`}>{sortBtn("number", "Bolla")}</TableHead>
                  <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Data")}</TableHead>
                  <TableHead className={`w-48 ${headCls}`}>Causale</TableHead>
                  <TableHead className={`w-64 ${headCls}`}>
                    <SearchableSelect
                      options={jobOptions}
                      value={jobId}
                      onValueChange={changeJob}
                      placeholder="Commessa"
                      searchPlaceholder="Scrivi per cercare commessa..."
                      className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
                      contentClassName="min-w-[24rem]"
                    />
                  </TableHead>
                  <TableHead className={headCls}>Articoli</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <Truck className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      Nessun movimento trovato
                    </TableCell>
                  </TableRow>
                ) : movements.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/movements/${m.id}`)}>
                    <TableCell className="border-r py-2"><TypeBadge type={m.type} /></TableCell>
                    <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">{m.number}</TableCell>
                    <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{format(new Date(m.date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">{m.causal || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-sm text-blue-600 dark:text-blue-400">
                      <span className="line-clamp-2" title={jobLabel(m)}>{jobLabel(m) || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="line-clamp-2" title={m.itemNames?.join(', ')}>{m.itemNames?.join(', ') || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <button
                        onClick={(e) => quickPrint(e, m)}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                        title="Stampa rapida"
                        aria-label="Stampa rapida"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {movements.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                <Truck className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Nessun movimento trovato</p>
              </div>
            ) : movements.map((movement) => (
              <Link href={`/movements/${movement.id}`} key={movement.id}>
                <Card className="h-full cursor-pointer border-slate-200 transition-shadow hover:shadow-md dark:border-slate-700">
                  <CardContent className="p-3 sm:p-5">
                    <div className="mb-3 flex items-start justify-between sm:mb-4">
                      <div className="mr-2 min-w-0 flex-1">
                        <div className="mb-1"><TypeBadge type={movement.type} /></div>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                          <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="truncate">Bolla: {movement.number}</span>
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {format(new Date(movement.date), 'dd MMMM yyyy', { locale: it })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => quickPrint(e, movement)}
                        className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                        title="Stampa rapida"
                        aria-label="Stampa rapida"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between gap-3 border-b border-slate-50 py-1 dark:border-slate-700">
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">Causale</span>
                        <span className="break-words text-right font-medium">{movement.causal}</span>
                      </div>
                      {jobLabel(movement) && (
                        <div className="flex justify-between gap-3 border-b border-slate-50 py-1 dark:border-slate-700">
                          <span className="shrink-0 text-slate-500 dark:text-slate-400">Commessa</span>
                          <span className="break-words text-right font-medium text-blue-600 dark:text-blue-400">{jobLabel(movement)}</span>
                        </div>
                      )}
                      <div className="py-1">
                        <div className="mb-1 flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Articoli</span>
                          <span className="text-xs font-medium text-slate-500">{movement.itemCount ?? movement.items?.length ?? 0} righe</span>
                        </div>
                        {movement.itemNames && movement.itemNames.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {movement.itemNames.map((name, i) => (
                              <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">{name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPageChange={setPage}
            totalItems={total}
            itemLabel="movimenti"
          />
        </div>
      )}

      {/* Pulsante «nuova bolla» sempre visibile (PC) */}
      {canEdit && <FloatingAddButton href="/movements/new" label="Nuova bolla" />}
    </>
  );
}
