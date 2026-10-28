"use client"

import { notify } from "@/lib/notify";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Calendar, Building, MapPin, Plus, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JobOnSiteToggle } from "@/components/jobs/JobOnSiteToggle";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Job, jobsApi, clientsApi } from "@/lib/api";
import { JobCategory, JOB_CATEGORY_LABELS, JOB_CATEGORY_BADGE_COLORS } from "@/lib/types";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

// Commesse per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

interface JobsContentProps {
  initialJobs: Job[];
  initialTotal: number;
}

type SortKey = "status" | "code" | "name" | "date";

const STATUS_ORDER: Record<string, number> = { active: 0, suspended: 1, completed: 2 };

// Stato (attive, sospese, concluse), poi in cantiere per prime
const compareJobs = (a: Job, b: Job) =>
  ((STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)) || (Number(!!b.onSite) - Number(!!a.onSite));

const STATUS_CONFIG = {
  active:    { label: 'Attiva',     badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
  suspended: { label: 'Sospesa',    badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
  completed: { label: 'Completata', badge: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
} as const;

type JobStatus = keyof typeof STATUS_CONFIG;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as JobStatus];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cfg?.badge ?? ''}`}>
      {cfg?.label ?? status}
    </span>
  );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('it-IT') : '');

export default function JobsContent({ initialJobs, initialTotal }: JobsContentProps) {
  const router = useRouter();
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const canEdit = userRole === 'admin' || userRole === 'operativo';

  const isValidCategory = (v: string | null): v is JobCategory => !!v && Object.keys(JOB_CATEGORY_LABELS).includes(v);
  const initialStatus = searchParams.get('stato');

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [category, setCategory] = useState<'all' | JobCategory>(isValidCategory(searchParams.get('category')) ? (searchParams.get('category') as JobCategory) : 'all');
  const [status, setStatus] = useState<'all' | JobStatus>(initialStatus && initialStatus in STATUS_CONFIG ? (initialStatus as JobStatus) : 'all');
  const [clientId, setClientId] = useState(searchParams.get('clientId') || "");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'status');
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get('dir') === 'desc' ? 'desc' : 'asc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [clients, setClients] = useState<{ value: string; label: string }[]>([]);

  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const firstLoad = useRef(true);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== debouncedSearch) {
        setDebouncedSearch(searchTerm);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    clientsApi.getAll()
      .then(list => setClients(list.map(c => ({ value: c.id, label: c.name }))))
      .catch(console.error);
  }, []);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("stato", status);
    if (clientId) params.set("clientId", clientId);
    if (sortKey !== "status") params.set("sort", sortKey);
    if (sortDir !== "asc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/jobs?${query}` : "/jobs", { scroll: false });
  }, [debouncedSearch, category, status, clientId, sortKey, sortDir, page, router]);

  // Guards against out-of-order responses: changing page/filter quickly can fire loadJobs() more than once -
  // if an older request resolves after the newer one its result is discarded.
  const loadJobs = async () => {
    const requestId = ++loadRequestId.current;
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await jobsApi.getPaginated({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        clientId,
        status: status === 'all' ? '' : status,
        category: category === 'all' ? undefined : category,
        sort: sortKey,
        dir: sortDir,
      });
      if (requestId !== loadRequestId.current) return;
      setJobs(data);
      setTotal(total);
    } catch (error: any) {
      if (requestId !== loadRequestId.current) return;
      console.error("Failed to load jobs:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento commesse");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    // La prima pagina senza filtri arriva già dal server
    const isDefault = page === 1 && !debouncedSearch && !clientId && category === 'all' && status === 'all' && sortKey === 'status' && sortDir === 'asc';
    if (firstLoad.current) {
      firstLoad.current = false;
      if (isDefault && initialJobs.length > 0) return;
    }
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, clientId, category, status, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
    setPage(1);
  };

  const changeStatus = (v: string) => { setStatus(v as 'all' | JobStatus); setPage(1); };
  const changeCategory = (v: string) => { setCategory(v as 'all' | JobCategory); setPage(1); };
  const changeClient = (v: string) => { setClientId(v === "all" ? "" : v); setPage(1); };

  const anyFilterActive = status !== 'all' || category !== 'all' || !!clientId || !!searchTerm;
  const resetFilters = () => { setStatus('all'); setCategory('all'); setClientId(""); setSearchTerm(""); setPage(1); };

  const handleStatusChange = async (job: Job, newStatus: JobStatus) => {
    if (job.status === newStatus) return;
    setUpdatingStatus(job.id);
    try {
      await jobsApi.update(job.id, { status: newStatus });
      setJobs(prev => {
        const updated = prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j);
        return sortKey === 'status' && sortDir === 'asc' ? updated.sort(compareJobs) : updated;
      });
    } catch (err: any) {
      notify.error(err?.message || "Errore durante l'aggiornamento dello stato");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleOnSiteToggle = async (job: Job) => {
    const next = !job.onSite;
    setUpdatingStatus(job.id);
    try {
      await jobsApi.update(job.id, { onSite: next });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, onSite: next } : j));
    } catch (err: any) {
      notify.error(err?.message || "Errore durante l'aggiornamento della commessa");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const clientOptions = [{ value: "all", label: "Tutti i committenti" }, ...clients];
  const statusOptions = (
    <>
      <SelectItem value="all">Tutti gli stati</SelectItem>
      {(Object.keys(STATUS_CONFIG) as JobStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
    </>
  );
  const categoryOptions = (
    <>
      <SelectItem value="all">Tutti i tipi</SelectItem>
      {(Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]).map(c => <SelectItem key={c} value={c}>{JOB_CATEGORY_LABELS[c]}</SelectItem>)}
    </>
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
        title="Gestione Commesse"
        actions={canEdit && (
          <Link href="/jobs/new" className="w-full sm:w-auto md:hidden">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuova Commessa
            </Button>
          </Link>
        )}
        search={{ id: "jobs-search", label: "Cerca commessa", value: searchTerm, onChange: setSearchTerm, placeholder: "Cerca Commessa (Codice, Nome, CIG, CUP, Indirizzo...)" }}
        searchActions={anyFilterActive && (
          <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
            Azzera filtri
          </Button>
        )}
      >
        {/* Telefono: stato, tipo e committente */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger aria-label="Stato"><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>{statusOptions}</SelectContent>
          </Select>
          <Select value={category} onValueChange={changeCategory}>
            <SelectTrigger aria-label="Tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>{categoryOptions}</SelectContent>
          </Select>
          <div className="col-span-2">
            <SearchableSelect
              options={clientOptions}
              value={clientId}
              onValueChange={changeClient}
              placeholder="Committente"
              searchPlaceholder="Scrivi per cercare committente..."
            />
          </div>
        </div>
      </ListPageHeader>

      {loading && jobs.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento commesse...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Briefcase className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadJobs} variant="outline">Riprova</Button>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className="w-12 border-r text-center text-xs font-semibold uppercase tracking-wide text-slate-600" title="In cantiere">
                    <span className="sr-only">In cantiere</span>
                  </TableHead>
                  <TableHead className={`w-40 ${headCls}`}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Select value={status} onValueChange={changeStatus}>
                          <SelectTrigger aria-label="Filtra per stato" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Stato" /></SelectTrigger>
                          <SelectContent>{statusOptions}</SelectContent>
                        </Select>
                      </div>
                      <button type="button" aria-label="Ordina per stato" onClick={() => toggleSort("status")} className="shrink-0 text-slate-500 hover:text-slate-900">
                        <SortArrow active={sortKey === "status"} dir={sortDir} />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className={`w-28 ${headCls}`}>{sortBtn("code", "Codice")}</TableHead>
                  <TableHead className={headCls}>{sortBtn("name", "Commessa")}</TableHead>
                  <TableHead className={`w-56 ${headCls}`}>
                    <SearchableSelect
                      options={clientOptions}
                      value={clientId}
                      onValueChange={changeClient}
                      placeholder="Committente"
                      searchPlaceholder="Scrivi per cercare committente..."
                      className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
                      contentClassName="min-w-[22rem]"
                    />
                  </TableHead>
                  <TableHead className={`w-40 ${headCls}`}>
                    <Select value={category} onValueChange={changeCategory}>
                      <SelectTrigger aria-label="Filtra per tipo" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>{categoryOptions}</SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className={`w-44 ${headCls}`}>Indirizzo cantiere</TableHead>
                  <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-600">{sortBtn("date", "Inizio")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <Briefcase className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      Nessuna commessa trovata
                    </TableCell>
                  </TableRow>
                ) : jobs.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${job.id}`)}>
                    <TableCell className="border-r py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {job.status === 'active' && (
                        <JobOnSiteToggle onSite={!!job.onSite} canEdit={canEdit} disabled={updatingStatus === job.id} onToggle={() => handleOnSiteToggle(job)} />
                      )}
                    </TableCell>
                    <TableCell className="border-r py-2" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <Select value={job.status} onValueChange={(v) => handleStatusChange(job, v as JobStatus)} disabled={updatingStatus === job.id}>
                          <SelectTrigger aria-label="Cambia stato" className={`h-7 w-full gap-1 rounded-md border px-2 text-xs font-medium ${STATUS_CONFIG[job.status as JobStatus]?.badge ?? ''}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_CONFIG) as JobStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : <StatusBadge status={job.status} />}
                    </TableCell>
                    <TableCell className="border-r py-2 font-mono text-xs text-slate-500">{job.code}</TableCell>
                    <TableCell className="border-r py-2">
                      <div className="line-clamp-2 font-medium text-slate-900 dark:text-white" title={job.name}>{job.name}</div>
                      {(job.cig || job.cup) && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-400">
                          {job.cig && <>CIG {job.cig}</>}{job.cig && job.cup && " · "}{job.cup && <>CUP {job.cup}</>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2" title={job.clientName}>{job.clientName || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    <TableCell className="border-r py-2">
                      <Badge className={`text-[10px] ${JOB_CATEGORY_BADGE_COLORS[job.category]}`}>{JOB_CATEGORY_LABELS[job.category]}</Badge>
                    </TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="line-clamp-2" title={job.siteAddress}>{job.siteAddress || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(job.startDate) || <span className="text-slate-300">—</span>}
                      {job.endDate && <div className="text-slate-400">fino al {formatDate(job.endDate)}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {jobs.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                <Briefcase className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Nessuna commessa trovata</p>
              </div>
            ) : jobs.map((job) => (
              <Card
                key={job.id}
                className="flex h-full cursor-pointer flex-col transition-shadow hover:shadow-md"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-1 font-mono text-xs text-slate-500 dark:text-muted-foreground">{job.code}</div>
                      <CardTitle className="break-words text-base font-bold text-slate-800 dark:text-white" title={job.name}>{job.name}</CardTitle>
                      <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{job.description}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {job.status === 'active' && (
                        <JobOnSiteToggle onSite={!!job.onSite} canEdit={canEdit} disabled={updatingStatus === job.id} onToggle={() => handleOnSiteToggle(job)} />
                      )}
                      <Badge className={`shrink-0 text-[10px] ${JOB_CATEGORY_BADGE_COLORS[job.category]}`}>{JOB_CATEGORY_LABELS[job.category]}</Badge>
                    </div>
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <Select value={job.status} onValueChange={(v) => handleStatusChange(job, v as JobStatus)} disabled={updatingStatus === job.id}>
                        <SelectTrigger aria-label="Cambia stato" className={`h-8 w-40 gap-1 rounded-md border px-2 text-xs font-medium ${STATUS_CONFIG[job.status as JobStatus]?.badge ?? ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_CONFIG) as JobStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <StatusBadge status={job.status} />}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 p-4 pt-0 text-sm text-slate-600 dark:text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    <span className="font-medium text-slate-700 dark:text-foreground">{job.clientName || 'N/A'}</span>
                  </div>
                  {(job.cig || job.cup) && (
                    <div className="flex flex-wrap gap-2">
                      {job.cig && <Badge variant="outline" className="bg-slate-50 text-xs font-normal text-slate-500 dark:bg-muted/50 dark:text-muted-foreground">CIG: {job.cig}</Badge>}
                      {job.cup && <Badge variant="outline" className="bg-slate-50 text-xs font-normal text-slate-500 dark:bg-muted/50 dark:text-muted-foreground">CUP: {job.cup}</Badge>}
                    </div>
                  )}
                  {job.siteAddress && (
                    <div className="flex items-start gap-2 text-xs">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span>{job.siteAddress}</span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-2 border-t pt-2 text-xs dark:border-slate-700">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                    <span>{job.startDate ? formatDate(job.startDate) : 'N/D'}{' - '}{job.endDate ? formatDate(job.endDate) : 'In corso'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPageChange={setPage}
            totalItems={total}
            itemLabel="commesse"
          />
        </div>
      )}

      {/* Pulsante «nuova commessa» sempre visibile (PC) */}
      {canEdit && <FloatingAddButton href="/jobs/new" label="Nuova commessa" />}
    </>
  );
}
