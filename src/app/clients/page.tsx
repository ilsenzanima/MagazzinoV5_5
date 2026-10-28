"use client"

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Building2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Client, clientsApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { ClientCard } from "@/components/clients";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Committenti per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

type SortKey = "name" | "city" | "vat";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const streetLine = (c: Client) =>
  c.street ? `${c.street}${c.streetNumber ? " " + c.streetNumber : ""}` : "";
const cityLine = (c: Client) =>
  [c.postalCode, c.city].filter(Boolean).join(" ") + (c.province ? ` (${c.province.toUpperCase()})` : "");

function ClientsPageContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = userRole === 'admin' || userRole === 'operativo';

  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [activeLetter, setActiveLetter] = useState<string | null>(searchParams.get("letter"));
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "desc" ? "desc" : "asc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [clients, setClients] = useState<Client[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [jobCounts, setJobCounts] = useState<Map<string, { total: number; active: number }>>(new Map());
  const [allCities, setAllCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchTerm !== debouncedSearch) {
        setDebouncedSearch(searchTerm);
        setPage(1);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm, debouncedSearch]);

  // Città presenti, per il filtro nell'intestazione
  useEffect(() => {
    clientsApi.getAll()
      .then(list => setAllCities([...new Set(list.map(c => c.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'))))
      .catch(console.error);
  }, []);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (activeLetter) params.set("letter", activeLetter);
    if (city) params.set("city", city);
    if (sortKey !== "name") params.set("sort", sortKey);
    if (sortDir !== "asc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/clients?${query}` : "/clients", { scroll: false });
  }, [debouncedSearch, activeLetter, city, sortKey, sortDir, page, router]);

  const loadClients = async () => {
    const id = ++requestId.current;
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await clientsApi.getPaginated({
        page, limit: PAGE_SIZE, search: debouncedSearch, letter: activeLetter || undefined,
        city: city || undefined, sort: sortKey, dir: sortDir,
      });
      const counts = await clientsApi.getJobCounts(data.map(c => c.id)).catch(() => new Map());
      if (id !== requestId.current) return;
      setClients(data);
      setTotalItems(total);
      setJobCounts(counts);
    } catch (error: any) {
      if (id !== requestId.current) return;
      console.error("Failed to load clients:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, activeLetter, city, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const handleLetterClick = (letter: string) => {
    setActiveLetter(prev => prev === letter ? null : letter);
    setSearchTerm(""); setDebouncedSearch("");
    setPage(1);
  };
  const changeCity = (v: string) => { setCity(v === "all" ? "" : v); setPage(1); };

  const anyFilterActive = !!city || !!activeLetter || !!searchTerm;
  const resetFilters = () => { setCity(""); setActiveLetter(null); setSearchTerm(""); setPage(1); };

  const cityOptions = useMemo(
    () => [{ value: "all", label: "Tutte le città" }, ...allCities.map(c => ({ value: c, label: c }))],
    [allCities]
  );

  const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
  const sortBtn = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  );

  const alphabetStrip = (
    <>
      {activeLetter && (
        <button onClick={() => setActiveLetter(null)} className="h-7 w-7 shrink-0 rounded text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20" title="Rimuovi filtro">✕</button>
      )}
      {ALPHABET.map(letter => (
        <button
          key={letter}
          onClick={() => handleLetterClick(letter)}
          className={`h-7 w-7 shrink-0 rounded text-xs font-semibold transition-colors ${
            activeLetter === letter ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          {letter}
        </button>
      ))}
    </>
  );

  return (
    <DashboardLayout>
      <ListPageHeader
        title="Gestione Committenti"
        actions={canEdit && (
          <Link href="/clients/new" className="w-full sm:w-auto md:hidden">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Committente
            </Button>
          </Link>
        )}
        search={{
          id: "clients-search", label: "Cerca committente", value: searchTerm,
          onChange: (v) => { setSearchTerm(v); if (v) setActiveLetter(null); },
          placeholder: "Cerca Committente (Nome, P.IVA, Email, Telefono, Indirizzo...)",
        }}
        searchActions={anyFilterActive && (
          <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
            Azzera filtri
          </Button>
        )}
      >
        {/* Telefono: lettere e città */}
        <div className="space-y-2 md:hidden">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">{alphabetStrip}</div>
          <SearchableSelect
            options={cityOptions}
            value={city}
            onValueChange={changeCity}
            placeholder="Città"
            searchPlaceholder="Scrivi per cercare città..."
          />
        </div>
      </ListPageHeader>

      {loading && clients.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento committenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadClients} variant="outline">Riprova</Button>
        </div>
      ) : (
        <div className={`${loading ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
          <div className="min-w-0 flex-1">
            {/* Tabella: da tablet in su */}
            <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
              <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                    <TableHead className={headCls}>{sortBtn("name", "Committente")}</TableHead>
                    <TableHead className={`w-32 ${headCls}`}>{sortBtn("vat", "P. IVA")}</TableHead>
                    <TableHead className={`w-48 ${headCls}`}>Indirizzo</TableHead>
                    <TableHead className={`w-52 ${headCls}`}>
                      <div className="flex items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <SearchableSelect
                            options={cityOptions}
                            value={city}
                            onValueChange={changeCity}
                            placeholder="Città"
                            searchPlaceholder="Scrivi per cercare città..."
                            className="h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
                            contentClassName="min-w-[16rem]"
                          />
                        </div>
                        <button type="button" aria-label="Ordina per città" onClick={() => toggleSort("city")} className="shrink-0 text-slate-500 hover:text-slate-900">
                          <SortArrow active={sortKey === "city"} dir={sortDir} />
                        </button>
                      </div>
                    </TableHead>
                    <TableHead className={`w-48 ${headCls}`}>Email</TableHead>
                    <TableHead className={`w-32 ${headCls}`}>Telefono</TableHead>
                    <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-600">Commesse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                        <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                        Nessun committente trovato{activeLetter ? ` con la lettera "${activeLetter}"` : ''}
                      </TableCell>
                    </TableRow>
                  ) : clients.map((client) => {
                    const jobs = jobCounts.get(client.id);
                    return (
                      <TableRow key={client.id} className="cursor-pointer" onClick={() => router.push(`/clients/${client.id}`)}>
                        <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">
                          <span className="line-clamp-2" title={client.name}>{client.name}</span>
                        </TableCell>
                        <TableCell className="border-r py-2 font-mono text-xs text-slate-500">{client.vatNumber || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="line-clamp-2" title={streetLine(client)}>{streetLine(client) || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{cityLine(client).trim() || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="block truncate" title={client.email}>{client.email || <span className="text-slate-300">—</span>}</span>
                        </TableCell>
                        <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">{client.phone || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="py-2 text-xs text-slate-600 dark:text-slate-300">
                          {jobs ? (
                            <>
                              <span className="font-semibold">{jobs.total}</span>
                              {jobs.active > 0 && <span className="ml-1 text-green-600">({jobs.active} attive)</span>}
                            </>
                          ) : <span className="text-slate-300">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Schede: telefono */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
              {clients.length === 0 ? (
                <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                  <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                  <p>Nessun committente trovato{activeLetter ? ` con la lettera "${activeLetter}"` : ''}</p>
                </div>
              ) : clients.map((client) => <ClientCard key={client.id} client={client} />)}
            </div>

            <PaginationControls
              page={page}
              totalPages={totalPages}
              loading={loading}
              onPageChange={setPage}
              totalItems={totalItems}
              itemLabel="committenti"
            />
          </div>
        </div>
      )}

      {/* Pulsante «nuovo committente» sempre visibile (PC) */}
      {canEdit && <FloatingAddButton href="/clients/new" label="Nuovo committente" />}
    </DashboardLayout>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento committenti...</span>
        </div>
      </DashboardLayout>
    }>
      <ClientsPageContent />
    </Suspense>
  );
}
