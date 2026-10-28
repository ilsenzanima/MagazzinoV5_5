"use client"

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Building2, Mail, Phone, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { SupplierOverview, suppliersApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatCurrency } from "@/lib/utils/format";

// Fornitori per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

type SortKey = "name" | "count" | "last" | "year" | "total";
type Completeness = "all" | "incomplete" | "complete";

const CURRENT_YEAR = new Date().getFullYear();

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const missingList = (s: SupplierOverview) =>
  [s.missingVat && "P. IVA", s.missingEmail && "email", s.missingPhone && "telefono"].filter(Boolean) as string[];

function DataBadge({ supplier }: { supplier: SupplierOverview }) {
  if (supplier.isTechnical) return <span className="text-slate-300">—</span>;
  const missing = missingList(supplier);
  return missing.length === 0 ? (
    <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Completo</span>
  ) : (
    <span title={`Manca: ${missing.join(", ")}`} className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      Da completare ({missing.length})
    </span>
  );
}

function TechnicalBadge() {
  return (
    <span title="Voce di servizio per inserire dati incompleti di fornitori vecchi" className="ml-2 inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
      Tecnico
    </span>
  );
}

function SuppliersPageContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canView = userRole === 'admin' || userRole === 'operativo';

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [completeness, setCompleteness] = useState<Completeness>(
    searchParams.get("dati") === "incomplete" ? "incomplete" : searchParams.get("dati") === "complete" ? "complete" : "all"
  );
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "desc" ? "desc" : "asc");
  const [year, setYear] = useState<number>(Number(searchParams.get("anno")) || CURRENT_YEAR);
  const [years, setYears] = useState<number[]>([CURRENT_YEAR]);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [suppliers, setSuppliers] = useState<SupplierOverview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  // Anni disponibili per il «speso»
  useEffect(() => {
    suppliersApi.getPurchaseYears().then(list => setYears(list.includes(CURRENT_YEAR) ? list : [CURRENT_YEAR, ...list])).catch(console.error);
  }, []);

  // Solo admin e operativi vedono i fornitori
  useEffect(() => {
    if (userRole && !canView) router.push("/dashboard");
  }, [userRole, canView, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== debouncedSearch) {
        setDebouncedSearch(searchTerm);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (completeness !== "all") params.set("dati", completeness);
    if (year !== CURRENT_YEAR) params.set("anno", String(year));
    if (sortKey !== "name") params.set("sort", sortKey);
    if (sortDir !== "asc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/suppliers?${query}` : "/suppliers", { scroll: false });
  }, [debouncedSearch, completeness, year, sortKey, sortDir, page, router]);

  const load = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await suppliersApi.getOverview({
        page, limit: PAGE_SIZE, search: debouncedSearch, completeness, sort: sortKey, dir: sortDir, year,
      });
      if (id !== requestId.current) return;
      setSuppliers(data);
      setTotal(total);
    } catch (e: any) {
      if (id !== requestId.current) return;
      console.error("Failed to load suppliers:", e);
      setError(e.message || "Errore sconosciuto durante il caricamento");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, completeness, sortKey, sortDir, year, canView]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
    setPage(1);
  };
  const changeYear = (v: string) => { setYear(Number(v)); setPage(1); };
  const changeCompleteness = (v: string) => { setCompleteness(v as Completeness); setPage(1); };
  const anyFilterActive = completeness !== "all" || !!searchTerm;
  const resetFilters = () => { setCompleteness("all"); setSearchTerm(""); setPage(1); };

  const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
  const sortBtn = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  );
  const completenessItems = (
    <>
      <SelectItem value="all">Tutti</SelectItem>
      <SelectItem value="incomplete">Da completare</SelectItem>
      <SelectItem value="complete">Completi</SelectItem>
    </>
  );
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("it-IT") : "");

  if (!canView) {
    return <DashboardLayout><div className="py-20 text-center text-slate-400">Caricamento...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <ListPageHeader
        title="Gestione Fornitori"
        actions={
          <Link href="/suppliers/new" className="w-full sm:w-auto md:hidden">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Fornitore
            </Button>
          </Link>
        }
        search={{ id: "suppliers-search", label: "Cerca fornitore", value: searchTerm, onChange: setSearchTerm, placeholder: "Cerca Fornitore (Nome, P.IVA, Email, Telefono, Indirizzo...)" }}
        searchActions={anyFilterActive && (
          <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
            Azzera filtri
          </Button>
        )}
      >
        {/* Telefono: completezza dei dati */}
        <div className="md:hidden">
          <Select value={completeness} onValueChange={changeCompleteness}>
            <SelectTrigger aria-label="Dati"><SelectValue placeholder="Dati" /></SelectTrigger>
            <SelectContent>{completenessItems}</SelectContent>
          </Select>
        </div>
      </ListPageHeader>

      {loading && suppliers.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento fornitori...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={load} variant="outline">Riprova</Button>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className={headCls}>{sortBtn("name", "Fornitore")}</TableHead>
                  <TableHead className={`w-32 ${headCls}`}>P. IVA</TableHead>
                  <TableHead className={`w-56 ${headCls}`}>Contatti</TableHead>
                  <TableHead className={`w-24 text-right ${headCls}`}>{sortBtn("count", "Acquisti")}</TableHead>
                  <TableHead className={`w-32 ${headCls}`}>{sortBtn("last", "Ultimo")}</TableHead>
                  <TableHead className={`w-36 ${headCls}`}>
                    <div className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Select value={String(year)} onValueChange={changeYear}>
                          <SelectTrigger aria-label="Anno del speso" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                            <SelectValue>Speso {year}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <button type="button" aria-label="Ordina per speso nell'anno" onClick={() => toggleSort("year")} className="shrink-0 text-slate-500 hover:text-slate-900">
                        <SortArrow active={sortKey === "year"} dir={sortDir} />
                      </button>
                    </div>
                  </TableHead>
                  <TableHead className={`w-32 text-right ${headCls}`}>{sortBtn("total", "Totale")}</TableHead>
                  <TableHead className="w-44 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <Select value={completeness} onValueChange={changeCompleteness}>
                      <SelectTrigger aria-label="Filtra per dati" className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"><SelectValue placeholder="Dati" /></SelectTrigger>
                      <SelectContent>{completenessItems}</SelectContent>
                    </Select>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      Nessun fornitore trovato
                    </TableCell>
                  </TableRow>
                ) : suppliers.map((s) => (
                  <TableRow key={s.id} className={`cursor-pointer ${s.isTechnical ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}`} onClick={() => router.push(`/suppliers/${s.id}`)}>
                    <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">
                      <span className="line-clamp-2" title={s.name}>{s.name}</span>
                      {s.isTechnical && <TechnicalBadge />}
                    </TableCell>
                    <TableCell className="border-r py-2 font-mono text-xs text-slate-500">{s.vatNumber || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                      {s.email || s.phone ? (
                        <>
                          {s.email && <div className="truncate" title={s.email}>{s.email}</div>}
                          {s.phone && <div>{s.phone}</div>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="border-r py-2 text-right text-sm text-slate-700 dark:text-slate-300">{s.purchasesCount || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{fmtDate(s.lastPurchaseDate) || <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-right text-sm text-slate-700 dark:text-slate-300">{s.spentYear ? formatCurrency(s.spentYear) : <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="border-r py-2 text-right text-sm font-semibold text-slate-800 dark:text-slate-200">{s.spentTotal ? formatCurrency(s.spentTotal) : <span className="font-normal text-slate-300">—</span>}</TableCell>
                    <TableCell className="py-2"><DataBadge supplier={s} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {suppliers.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Nessun fornitore trovato</p>
              </div>
            ) : suppliers.map((s) => (
              <Link href={`/suppliers/${s.id}`} key={s.id}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="space-y-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-tight text-slate-800 dark:text-white">
                        {s.name}{s.isTechnical && <TechnicalBadge />}
                      </div>
                      <DataBadge supplier={s} />
                    </div>
                    {s.email && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Mail className="h-3 w-3 shrink-0" />{s.email}</div>}
                    {s.phone && <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="h-3 w-3 shrink-0" />{s.phone}</div>}
                    <div className="flex justify-between border-t pt-1.5 text-xs text-slate-500">
                      <span>{s.purchasesCount} acquisti{s.lastPurchaseDate ? ` · ultimo ${fmtDate(s.lastPurchaseDate)}` : ""}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{s.spentTotal ? formatCurrency(s.spentTotal) : ""}</span>
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
            itemLabel="fornitori"
          />
        </div>
      )}

      {/* Pulsante «nuovo fornitore» sempre visibile (PC) */}
      <FloatingAddButton href="/suppliers/new" label="Nuovo fornitore" />
    </DashboardLayout>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento fornitori...</span>
        </div>
      </DashboardLayout>
    }>
      <SuppliersPageContent />
    </Suspense>
  );
}
