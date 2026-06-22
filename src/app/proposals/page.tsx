"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ViewToggle } from "@/components/ui/view-toggle";
import { Loader2, Search, MapPin, FileText, Users, Plus } from "lucide-react";
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals";
import { clientsApi } from "@/lib/api";
import { Client } from "@/lib/types";
import { notify } from "@/lib/notify";
import { useAuth } from "@/components/auth-provider";
import { useViewMode } from "@/hooks/useViewMode";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

const EMPTY_QUICK_CLIENT_FORM = { name: "", vatNumber: "", email: "", phone: "" };

const ALL_YEARS = "all";
const CURRENT_YEAR = new Date().getFullYear();
const LAST_5_YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3, CURRENT_YEAR - 4];

export default function ProposalsPage() {
  const { userRole } = useAuth();
  const router = useRouter();
  const [viewMode, setViewMode] = useViewMode("proposte");

  const [proposals, setProposals] = useState<ProposalWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [stageTab, setStageTab] = useState<"progress" | "accepted">("progress");
  const [yearTab, setYearTab] = useState<string>(ALL_YEARS);

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
      notify.error("Errore caricamento proposte");
    } finally {
      setLoading(false);
    }
  };

  const clientNames = useMemo(() => {
    const names = [...new Set(proposals.map(p => p.clientName).filter(Boolean))];
    return names.sort((a, b) => a.localeCompare(b, "it"));
  }, [proposals]);

  const stageFiltered = useMemo(() => {
    return proposals.filter(p => stageTab === "accepted" ? p.status === "accepted" : p.status !== "accepted");
  }, [proposals, stageTab]);

  const availableYears = useMemo(() => {
    const years = new Set(stageFiltered.map(p => new Date(p.createdAt).getFullYear()));
    LAST_5_YEARS.forEach(y => years.add(y));
    return [...years].sort((a, b) => b - a);
  }, [stageFiltered]);

  const yearTabsToShow = useMemo(() => {
    const tabs = [...LAST_5_YEARS];
    if (yearTab !== ALL_YEARS && !tabs.includes(Number(yearTab))) tabs.push(Number(yearTab));
    return tabs.sort((a, b) => b - a);
  }, [yearTab]);

  const filtered = useMemo(() => {
    return stageFiltered.filter(p => {
      const s = search.toLowerCase();
      const matchSearch = !s ||
        p.title.toLowerCase().includes(s) ||
        p.clientName.toLowerCase().includes(s) ||
        (p.siteCity && p.siteCity.toLowerCase().includes(s));
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchClient = clientFilter === "all" || p.clientName === clientFilter;
      const matchYear = yearTab === ALL_YEARS || new Date(p.createdAt).getFullYear() === Number(yearTab);
      return matchSearch && matchStatus && matchClient && matchYear;
    });
  }, [stageFiltered, search, statusFilter, clientFilter, yearTab]);

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

  const progressCount = proposals.filter(p => p.status !== "accepted").length;
  const acceptedCount = proposals.filter(p => p.status === "accepted").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Elenco Proposte</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tutte le proposte di tutti i committenti</p>
          </div>
          {canEdit && (
            <Button onClick={openNewProposal} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />Nuova Proposta
            </Button>
          )}
        </div>

        {/* Tabs stato: in lavorazione / accettate */}
        <Tabs value={stageTab} onValueChange={v => setStageTab(v as "progress" | "accepted")}>
          <TabsList>
            <TabsTrigger value="progress">
              In Lavorazione
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{progressCount}</span>
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Accettate
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{acceptedCount}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tabs anno + selettore anno specifico */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={yearTab} onValueChange={setYearTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value={ALL_YEARS}>Tutti gli anni</TabsTrigger>
              {yearTabsToShow.map(y => (
                <TabsTrigger key={y} value={String(y)}>{y}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={yearTab === ALL_YEARS || LAST_5_YEARS.includes(Number(yearTab)) ? "" : yearTab} onValueChange={setYearTab}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Cerca anno specifico..." />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtri + toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Cerca per titolo, committente, città..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tutti i committenti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i committenti</SelectItem>
              {clientNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tutti gli stati" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              {(Object.entries(PROP_STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* Conteggio */}
        {!loading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} proposta{filtered.length !== 1 ? "e" : ""} trovata{filtered.length !== 1 ? "e" : ""}
            {filtered.length !== stageFiltered.length && ` (su ${stageFiltered.length} totali)`}
          </p>
        )}

        {/* Contenuto */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>{stageFiltered.length === 0 ? "Nessuna proposta presente." : "Nessuna proposta corrisponde ai filtri."}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-1.5">
            {filtered.map(p => (
              <Link key={p.id} href={`/clients/${p.clientId}/proposals/${p.id}`}>
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm flex-1 min-w-0 truncate">
                    {p.title}
                  </span>
                  <span className="text-blue-700 dark:text-blue-400 text-xs w-44 shrink-0 truncate hidden sm:flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" />{p.clientName}
                  </span>
                  {p.estimatedValue !== null && (
                    <span className="text-slate-600 dark:text-slate-300 text-xs w-28 shrink-0 text-right hidden md:block">
                      € {p.estimatedValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {(p.siteCity || p.siteStreet) && (
                    <span className="text-slate-400 text-xs w-36 shrink-0 truncate hidden lg:flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />{[p.siteStreet, p.siteCity].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {p.date && (
                    <span className="text-slate-400 text-xs w-24 shrink-0 hidden xl:block">
                      {format(new Date(p.date), "d MMM yyyy", { locale: it })}
                    </span>
                  )}
                  <Badge className={`text-xs shrink-0 ${PROP_STATUS_COLORS[p.status]}`} variant="secondary">
                    {PROP_STATUS_LABELS[p.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <Link key={p.id} href={`/clients/${p.clientId}/proposals/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-white leading-snug">{p.title}</p>
                      <Badge className={`text-xs shrink-0 ${PROP_STATUS_COLORS[p.status]}`} variant="secondary">
                        {PROP_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{p.clientName}</p>
                    {p.estimatedValue !== null && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        € {p.estimatedValue.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    {p.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{p.description}</p>
                    )}
                    {(p.siteCity || p.siteStreet) && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{[p.siteStreet, p.siteCity].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {p.date && (
                      <p className="text-xs text-slate-400">
                        {format(new Date(p.date), "d MMM yyyy", { locale: it })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Nuova proposta dialog */}
      <Dialog open={newProposalOpen} onOpenChange={setNewProposalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuova Proposta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Committente *</Label>
              <div className="flex gap-2">
                <Select value={proposalForm.clientId} onValueChange={v => setProposalForm({ ...proposalForm, clientId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Seleziona committente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuovo Committente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome / Ragione sociale *</Label>
              <Input value={quickClientForm.name} onChange={e => setQuickClientForm({ ...quickClientForm, name: e.target.value })} placeholder="Es. Mario Rossi" />
            </div>
            <div className="space-y-1">
              <Label>Partita IVA / Codice Fiscale</Label>
              <Input value={quickClientForm.vatNumber} onChange={e => setQuickClientForm({ ...quickClientForm, vatNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={quickClientForm.email} onChange={e => setQuickClientForm({ ...quickClientForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input value={quickClientForm.phone} onChange={e => setQuickClientForm({ ...quickClientForm, phone: e.target.value })} />
              </div>
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
