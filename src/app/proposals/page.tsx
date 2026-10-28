"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MapPin, FileText, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals";
import { clientsApi } from "@/lib/api";
import { Client } from "@/lib/types";
import { notify } from "@/lib/notify";
import { useAuth } from "@/components/auth-provider";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Offerte per pagina: fisso, uguale per tutti
const PAGE_SIZE = 50;

const PROP_STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Bozza", sent: "Inviata", pending: "In attesa", accepted: "Accettata", rejected: "Rifiutata",
};
const PROP_STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

type ProposalWithClient = ClientProposal & { clientName: string };

const EMPTY_PROPOSAL_FORM = {
  clientId: "",
  title: "", description: "", estimatedValue: "",
  status: "draft" as ProposalStatus, date: "", notes: "",
  siteStreet: "", siteStreetNumber: "", sitePostalCode: "", siteCity: "", siteProvince: "",
};

const EMPTY_QUICK_CLIENT_FORM = {
  name: "", street: "", streetNumber: "", postalCode: "", city: "", province: "",
  vatNumber: "", email: "", phone: "",
};

const proposalYear = (p: ClientProposal) => new Date(p.date || p.createdAt).getFullYear();


type SortKey = "title" | "client" | "status" | "value" | "date";

// Stato di partenza: le offerte ancora aperte (tutte tranne le accettate)
const STATUS_PROGRESS = "progress";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PROP_STATUS_COLORS[status]}`}>
      {PROP_STATUS_LABELS[status]}
    </span>
  );
}

const money = (v: number) => `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2, useGrouping: true })}`;
const siteLine = (p: ClientProposal) => [p.siteStreet, p.siteCity].filter(Boolean).join(", ");

function ProposalsPageContent() {
  const { userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [proposals, setProposals] = useState<ProposalWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  // Compatibile con i vecchi indirizzi (?stage=accepted)
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || (searchParams.get("stage") === "accepted" ? "accepted" : STATUS_PROGRESS)
  );
  const [clientFilter, setClientFilter] = useState<string>(searchParams.get("client") || "all");
  const [yearFilter, setYearFilter] = useState<string>(searchParams.get("year") || "all");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter !== STATUS_PROGRESS) params.set("status", statusFilter);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (yearFilter !== "all") params.set("year", yearFilter);
    if (sortKey !== "date") params.set("sort", sortKey);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page !== 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/proposals?${query}` : "/proposals", { scroll: false });
  }, [search, statusFilter, clientFilter, yearFilter, sortKey, sortDir, page, router]);

  // Nuova proposta dialog
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState(EMPTY_PROPOSAL_FORM);
  const [useClientAddr, setUseClientAddr] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);

  // Nuovo committente rapido (dal modale nuova proposta)
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState(EMPTY_QUICK_CLIENT_FORM);
  const [savingQuickClient, setSavingQuickClient] = useState(false);

  const canEdit = userRole === "admin" || userRole === "operativo";

  useEffect(() => {
    if (userRole && userRole !== "admin" && userRole !== "operativo") {
      router.push("/dashboard");
      return;
    }
    if (userRole) load();
  }, [userRole]);

  useEffect(() => {
    if (useClientAddr) {
      const c = clients.find(c => c.id === proposalForm.clientId);
      if (c) {
        setProposalForm(f => ({
          ...f,
          siteStreet: c.street || "",
          siteStreetNumber: c.streetNumber || "",
          sitePostalCode: c.postalCode || "",
          siteCity: c.city || "",
          siteProvince: c.province || "",
        }));
      }
    }
  }, [useClientAddr, proposalForm.clientId, clients]);

  const load = async () => {
    try {
      setLoading(true);
      const [props, cls] = await Promise.all([clientProposalsApi.getAll(), clientsApi.getAll()]);
      setProposals(props);
      setClients(cls.sort((a, b) => a.name.localeCompare(b.name, "it")));
    } catch {
      notify.error("Errore caricamento offerte");
    } finally {
      setLoading(false);
    }
  };

  const openNewProposal = () => {
    setProposalForm(EMPTY_PROPOSAL_FORM);
    setUseClientAddr(false);
    setNewProposalOpen(true);
  };

  const handleNewProposal = async () => {
    if (!proposalForm.title.trim()) { notify.warning("Il titolo è obbligatorio"); return; }
    if (!proposalForm.clientId) { notify.warning("Il committente è obbligatorio"); return; }
    try {
      setSavingProposal(true);
      const created = await clientProposalsApi.create(proposalForm.clientId, {
        title: proposalForm.title.trim(),
        description: proposalForm.description,
        estimatedValue: proposalForm.estimatedValue ? Number(proposalForm.estimatedValue) : null,
        status: proposalForm.status,
        date: proposalForm.date,
        notes: proposalForm.notes,
        siteStreet: proposalForm.siteStreet,
        siteStreetNumber: proposalForm.siteStreetNumber,
        sitePostalCode: proposalForm.sitePostalCode,
        siteCity: proposalForm.siteCity,
        siteProvince: proposalForm.siteProvince,
      });
      setNewProposalOpen(false);
      setProposalForm(EMPTY_PROPOSAL_FORM);
      router.push(`/clients/${proposalForm.clientId}/proposals/${created.id}`);
    } catch { notify.error("Errore durante la creazione"); }
    finally { setSavingProposal(false); }
  };

  const handleQuickClient = async () => {
    if (!quickClientForm.name.trim()) { notify.warning("Il nome del committente è obbligatorio"); return; }
    try {
      setSavingQuickClient(true);
      const created = await clientsApi.create({
        name: quickClientForm.name.trim(),
        street: quickClientForm.street,
        streetNumber: quickClientForm.streetNumber,
        postalCode: quickClientForm.postalCode,
        city: quickClientForm.city,
        province: quickClientForm.province,
        vatNumber: quickClientForm.vatNumber,
        email: quickClientForm.email,
        phone: quickClientForm.phone,
      });
      setClients(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "it")));
      setProposalForm(f => ({ ...f, clientId: created.id }));
      setQuickClientForm(EMPTY_QUICK_CLIENT_FORM);
      setQuickClientOpen(false);
      notify.success("Committente creato");
    } catch { notify.error("Errore durante la creazione del committente"); }
    finally { setSavingQuickClient(false); }
  };

  const clientNames = useMemo(() => {
    const names = [...new Set(proposals.map(p => p.clientName).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, "it"));
  }, [proposals]);

  const availableYears = useMemo(() => {
    const years = new Set(proposals.map(proposalYear));
    return [...years].sort((a, b) => b - a);
  }, [proposals]);

  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = proposals.filter(p => {
      const text = [p.title, p.clientName, p.siteCity, p.siteStreet, p.description].filter(Boolean).join(" ").toLowerCase();
      const matchSearch = words.every(w => text.includes(w));
      const matchStatus = statusFilter === "all" ? true
        : statusFilter === STATUS_PROGRESS ? p.status !== "accepted"
        : p.status === statusFilter;
      const matchClient = clientFilter === "all" || p.clientName === clientFilter;
      const matchYear = yearFilter === "all" || proposalYear(p) === Number(yearFilter);
      return matchSearch && matchStatus && matchClient && matchYear;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const when = (p: ProposalWithClient) => p.date || p.createdAt || "";
    const cmp = (a: ProposalWithClient, b: ProposalWithClient): number => {
      switch (sortKey) {
        case "title": return a.title.localeCompare(b.title, "it");
        case "client": return a.clientName.localeCompare(b.clientName, "it");
        case "status": return a.status.localeCompare(b.status);
        case "value": return (a.estimatedValue ?? -1) - (b.estimatedValue ?? -1);
        default: return when(a).localeCompare(when(b));
      }
    };
    return rows.sort((a, b) => cmp(a, b) * dir || when(b).localeCompare(when(a)));
  }, [proposals, search, statusFilter, clientFilter, yearFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" || key === "value" ? "desc" : "asc"); }
    setPage(1);
  };
  const changeStatus = (v: string) => { setStatusFilter(v); setPage(1); };
  const changeClient = (v: string) => { setClientFilter(v || "all"); setPage(1); };
  const changeYear = (v: string) => { setYearFilter(v); setPage(1); };

  const anyFilterActive = statusFilter !== STATUS_PROGRESS || clientFilter !== "all" || yearFilter !== "all" || !!search;
  const resetFilters = () => { setStatusFilter(STATUS_PROGRESS); setClientFilter("all"); setYearFilter("all"); setSearch(""); setPage(1); };

  const clientOptions = [{ value: "all", label: "Tutti i committenti" }, ...clientNames.map(n => ({ value: n, label: n }))];
  const progressCount = proposals.filter(p => p.status !== "accepted").length;
  const statusItems = (
    <>
      <SelectItem value={STATUS_PROGRESS}>In lavorazione ({progressCount})</SelectItem>
      <SelectItem value="all">Tutte</SelectItem>
      {(Object.entries(PROP_STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => (
        <SelectItem key={k} value={k}>{v}</SelectItem>
      ))}
    </>
  );
  const yearItems = (
    <>
      <SelectItem value="all">Tutti gli anni</SelectItem>
      {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
    </>
  );

  const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
  const sortBtn = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  );
  const withSort = (control: React.ReactNode, key: SortKey, label: string) => (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{control}</div>
      <button type="button" aria-label={`Ordina per ${label}`} onClick={() => toggleSort(key)} className="shrink-0 text-slate-500 hover:text-slate-900">
        <SortArrow active={sortKey === key} dir={sortDir} />
      </button>
    </div>
  );
  const triggerCls = "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase";

  return (
    <DashboardLayout>
      <ListPageHeader
        title="Offerte Generali"
        actions={canEdit && (
          <Button onClick={openNewProposal} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto md:hidden">
            <Plus className="mr-2 h-4 w-4" />Nuova Offerta
          </Button>
        )}
        search={{ id: "proposals-search", label: "Cerca offerte", value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Cerca per titolo, committente, città, descrizione..." }}
        searchActions={anyFilterActive && (
          <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex" onClick={resetFilters}>
            Azzera filtri
          </Button>
        )}
      >
        {/* Telefono: stato, anno e committente */}
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <Select value={statusFilter} onValueChange={changeStatus}>
            <SelectTrigger aria-label="Stato"><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>{statusItems}</SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={changeYear}>
            <SelectTrigger aria-label="Anno"><SelectValue placeholder="Anno" /></SelectTrigger>
            <SelectContent>{yearItems}</SelectContent>
          </Select>
          <div className="col-span-2">
            <SearchableSelect
              options={clientOptions}
              value={clientFilter === "all" ? "" : clientFilter}
              onValueChange={changeClient}
              placeholder="Committente"
              searchPlaceholder="Scrivi per cercare committente..."
            />
          </div>
        </div>
      </ListPageHeader>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Tabella: da tablet in su */}
          <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className={headCls}>{sortBtn("title", "Offerta")}</TableHead>
                  <TableHead className={`w-64 ${headCls}`}>
                    {withSort(
                      <SearchableSelect
                        options={clientOptions}
                        value={clientFilter === "all" ? "" : clientFilter}
                        onValueChange={changeClient}
                        placeholder="Committente"
                        searchPlaceholder="Scrivi per cercare committente..."
                        className={triggerCls}
                        contentClassName="min-w-[22rem]"
                      />, "client", "committente"
                    )}
                  </TableHead>
                  <TableHead className={`w-44 ${headCls}`}>
                    {withSort(
                      <Select value={statusFilter} onValueChange={changeStatus}>
                        <SelectTrigger aria-label="Filtra per stato" className={triggerCls}><SelectValue placeholder="Stato" /></SelectTrigger>
                        <SelectContent>{statusItems}</SelectContent>
                      </Select>, "status", "stato"
                    )}
                  </TableHead>
                  <TableHead className={`w-36 text-right ${headCls}`}>{sortBtn("value", "Valore")}</TableHead>
                  <TableHead className={`w-52 ${headCls}`}>Indirizzo cantiere</TableHead>
                  <TableHead className="w-36 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {withSort(
                      <Select value={yearFilter} onValueChange={changeYear}>
                        <SelectTrigger aria-label="Filtra per anno" className={triggerCls}><SelectValue placeholder="Data" /></SelectTrigger>
                        <SelectContent>{yearItems}</SelectContent>
                      </Select>, "date", "data"
                    )}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      {proposals.length === 0 ? "Nessuna offerta presente." : "Nessuna offerta corrisponde ai filtri."}
                    </TableCell>
                  </TableRow>
                ) : pageRows.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/clients/${p.clientId}/proposals/${p.id}`)}>
                    <TableCell className="border-r py-2">
                      <div className="line-clamp-2 font-medium text-slate-900 dark:text-white" title={p.title}>{p.title}</div>
                      {p.description && <div className="line-clamp-1 text-[11px] text-slate-400" title={p.description}>{p.description}</div>}
                    </TableCell>
                    <TableCell className="border-r py-2 text-sm text-blue-700 dark:text-blue-400">
                      <span className="line-clamp-2" title={p.clientName}>{p.clientName}</span>
                    </TableCell>
                    <TableCell className="border-r py-2"><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="border-r py-2 text-right text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {p.estimatedValue !== null ? money(p.estimatedValue) : <span className="font-normal text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2" title={siteLine(p)}>{siteLine(p) || <span className="text-slate-300">—</span>}</span>
                    </TableCell>
                    <TableCell className="py-2 text-sm text-slate-600 dark:text-slate-300">
                      {p.date ? format(new Date(p.date), "dd/MM/yyyy", { locale: it }) : <span className="text-slate-300">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Schede: telefono */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
            {pageRows.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400">
                <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>{proposals.length === 0 ? "Nessuna offerta presente." : "Nessuna offerta corrisponde ai filtri."}</p>
              </div>
            ) : pageRows.map(p => (
              <Link key={p.id} href={`/clients/${p.clientId}/proposals/${p.id}`}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug text-slate-900 dark:text-white">{p.title}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{p.clientName}</p>
                    {p.estimatedValue !== null && <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{money(p.estimatedValue)}</p>}
                    {p.description && <p className="line-clamp-2 text-xs text-slate-500">{p.description}</p>}
                    {siteLine(p) && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{siteLine(p)}</span>
                      </div>
                    )}
                    {p.date && <p className="text-xs text-slate-400">{format(new Date(p.date), "d MMM yyyy", { locale: it })}</p>}
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
            itemLabel="offerte"
          />
        </>
      )}

      {/* Pulsante «nuova offerta» sempre visibile (PC) */}
      {canEdit && <FloatingAddButton onClick={openNewProposal} label="Nuova offerta" />}

      {/* Nuova proposta dialog */}
      <Dialog open={newProposalOpen} onOpenChange={setNewProposalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuova Offerta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Committente *</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.name,
                      description: c.address || undefined
                    }))}
                    value={proposalForm.clientId}
                    onValueChange={v => setProposalForm({ ...proposalForm, clientId: v })}
                    placeholder="Cerca committente..."
                    searchPlaceholder="Digita per cercare..."
                    emptyMessage="Nessun committente trovato."
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => setQuickClientOpen(true)} title="Nuovo committente">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Titolo *</Label>
              <Input value={proposalForm.title} onChange={e => setProposalForm({ ...proposalForm, title: e.target.value })} placeholder="Es. Ristrutturazione appartamento Via Roma" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Stato</Label>
                <Select value={proposalForm.status} onValueChange={v => setProposalForm({ ...proposalForm, status: v as ProposalStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(PROP_STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={proposalForm.date} onChange={e => setProposalForm({ ...proposalForm, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valore Stimato (€)</Label>
              <Input type="number" value={proposalForm.estimatedValue} onChange={e => setProposalForm({ ...proposalForm, estimatedValue: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Descrizione</Label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={proposalForm.description} onChange={e => setProposalForm({ ...proposalForm, description: e.target.value })} />
            </div>
            {/* Indirizzo cantiere */}
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Indirizzo Cantiere</Label>
                <div className="flex items-center gap-2">
                  <Checkbox id="useClientAddrNew" checked={useClientAddr} onCheckedChange={v => setUseClientAddr(v as boolean)} disabled={!proposalForm.clientId} />
                  <label htmlFor="useClientAddrNew" className="text-xs cursor-pointer text-slate-600">Usa indirizzo committente</label>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3 space-y-1"><Label className="text-xs">Via / Piazza</Label><Input value={proposalForm.siteStreet} onChange={e => setProposalForm({ ...proposalForm, siteStreet: e.target.value })} placeholder="Via Roma" /></div>
                <div className="col-span-1 space-y-1"><Label className="text-xs">N. Civico</Label><Input value={proposalForm.siteStreetNumber} onChange={e => setProposalForm({ ...proposalForm, siteStreetNumber: e.target.value })} placeholder="1" /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1 space-y-1"><Label className="text-xs">CAP</Label><Input value={proposalForm.sitePostalCode} onChange={e => setProposalForm({ ...proposalForm, sitePostalCode: e.target.value })} placeholder="00100" /></div>
                <div className="col-span-2 space-y-1"><Label className="text-xs">Città</Label><Input value={proposalForm.siteCity} onChange={e => setProposalForm({ ...proposalForm, siteCity: e.target.value })} placeholder="Milano" /></div>
                <div className="col-span-1 space-y-1"><Label className="text-xs">Prov.</Label><Input value={proposalForm.siteProvince} onChange={e => setProposalForm({ ...proposalForm, siteProvince: e.target.value.toUpperCase() })} placeholder="MI" maxLength={2} className="uppercase" /></div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={proposalForm.notes} onChange={e => setProposalForm({ ...proposalForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProposalOpen(false)}>Annulla</Button>
            <Button onClick={handleNewProposal} disabled={savingProposal} className="bg-blue-600 hover:bg-blue-700">
              {savingProposal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea e Apri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nuovo committente rapido */}
      <Dialog open={quickClientOpen} onOpenChange={setQuickClientOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuovo Committente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Ragione Sociale / Nome *</Label>
              <Input value={quickClientForm.name} onChange={e => setQuickClientForm({ ...quickClientForm, name: e.target.value })} placeholder="Inserisci il nome dell'azienda o del cliente" />
            </div>
            <div className="space-y-4 border-t border-b py-4 border-slate-100">
              <h3 className="font-medium text-slate-900 dark:text-white text-sm">Indirizzo Sede</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-1">
                  <Label>Via / Piazza</Label>
                  <Input value={quickClientForm.street} onChange={e => setQuickClientForm({ ...quickClientForm, street: e.target.value })} placeholder="Via Roma" />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label>N. Civico</Label>
                  <Input value={quickClientForm.streetNumber} onChange={e => setQuickClientForm({ ...quickClientForm, streetNumber: e.target.value })} placeholder="10" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 space-y-1">
                  <Label>CAP</Label>
                  <Input value={quickClientForm.postalCode} onChange={e => setQuickClientForm({ ...quickClientForm, postalCode: e.target.value })} placeholder="00100" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label>Città</Label>
                  <Input value={quickClientForm.city} onChange={e => setQuickClientForm({ ...quickClientForm, city: e.target.value })} placeholder="Milano" />
                </div>
                <div className="md:col-span-1 space-y-1">
                  <Label>Provincia</Label>
                  <Input value={quickClientForm.province} onChange={e => setQuickClientForm({ ...quickClientForm, province: e.target.value.toUpperCase() })} placeholder="MI" maxLength={2} className="uppercase" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Partita IVA / Codice Fiscale</Label>
                <Input value={quickClientForm.vatNumber} onChange={e => setQuickClientForm({ ...quickClientForm, vatNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input type="tel" value={quickClientForm.phone} onChange={e => setQuickClientForm({ ...quickClientForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={quickClientForm.email} onChange={e => setQuickClientForm({ ...quickClientForm, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickClientOpen(false)}>Annulla</Button>
            <Button onClick={handleQuickClient} disabled={savingQuickClient} className="bg-blue-600 hover:bg-blue-700">
              {savingQuickClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea Committente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default function ProposalsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    }>
      <ProposalsPageContent />
    </Suspense>
  );
}
