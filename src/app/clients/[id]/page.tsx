"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { NotchTabs, NotchActions, NotchButton } from "@/components/ui/notch-tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Briefcase, Building2, Loader2, Mail, MapPin,
  Pencil, Phone, Plus, Search, Trash2,
} from "lucide-react";
import { clientsApi, jobsApi, Client, Job } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useAuth } from "@/components/auth-provider";
import { ClientEditDialog, ClientDeleteDialog } from "@/components/clients";
import { ClientContacts } from "@/components/clients/detail/ClientContacts";
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FloatingAddButton } from "@/components/ui/floating-add-button";

const STATUS_LABELS: Record<string, string> = {
  active: "Attiva", completed: "Completata", suspended: "Sospesa",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  suspended: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};
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

const EMPTY_PROPOSAL_FORM = {
  title: "", description: "", estimatedValue: "",
  status: "draft" as ProposalStatus, date: "", notes: "",
  siteStreet: "", siteStreetNumber: "", sitePostalCode: "", siteCity: "", siteProvince: "",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userRole } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [proposals, setProposals] = useState<ClientProposal[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "anagrafica");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [proposalSearch, setProposalSearch] = useState("");
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>("all");

  // Dialogs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState(EMPTY_PROPOSAL_FORM);
  const [useClientAddr, setUseClientAddr] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);

  const canEdit = userRole === "admin" || userRole === "operativo";

  useEffect(() => { loadClient(); }, [id]);

  useEffect(() => {
    if (activeTab === "commesse" && jobs.length === 0) loadJobs();
    if (activeTab === "proposte" && proposals.length === 0) loadProposals();
  }, [activeTab]);

  useEffect(() => {
    if (useClientAddr && client) {
      setProposalForm(f => ({
        ...f,
        siteStreet: client.street || "",
        siteStreetNumber: client.streetNumber || "",
        sitePostalCode: client.postalCode || "",
        siteCity: client.city || "",
        siteProvince: client.province || "",
      }));
    }
  }, [useClientAddr, client]);

  const loadClient = async () => {
    try {
      setLoadingClient(true);
      const data = await clientsApi.getById(id);
      if (!data) { router.push("/anagrafiche?v=committenti"); return; }
      setClient(data);
      setNotes((data as any).notes || "");
    } catch { router.push("/anagrafiche?v=committenti"); }
    finally { setLoadingClient(false); }
  };

  const loadJobs = async () => {
    try { setLoadingJobs(true); setJobs(await jobsApi.getByClientId(id)); }
    catch { /* non bloccante */ } finally { setLoadingJobs(false); }
  };

  const loadProposals = async () => {
    try { setLoadingProposals(true); setProposals(await clientProposalsApi.getByClientId(id)); }
    catch { notify.error("Errore caricamento offerte"); } finally { setLoadingProposals(false); }
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      await clientsApi.update(id, { ...client!, notes } as any);
      notify.success("Note salvate");
    } catch { notify.error("Errore salvataggio note"); }
    finally { setSavingNotes(false); }
  };

  const handleNewProposal = async () => {
    if (!proposalForm.title.trim()) { notify.warning("Il titolo è obbligatorio"); return; }
    try {
      setSavingProposal(true);
      const created = await clientProposalsApi.create(id, {
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
      router.push(`/clients/${id}/proposals/${created.id}`);
    } catch { notify.error("Errore durante la creazione"); }
    finally { setSavingProposal(false); }
  };

  const filteredProposals = proposals.filter(p => {
    const matchSearch = !proposalSearch || p.title.toLowerCase().includes(proposalSearch.toLowerCase());
    const matchStatus = proposalStatusFilter === "all" || p.status === proposalStatusFilter;
    return matchSearch && matchStatus;
  });

  if (loadingClient) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) return null;

  const fullAddress = [
    client.street && `${client.street} ${client.streetNumber || ""}`.trim(),
    (client.postalCode || client.city) && `${client.postalCode} ${client.city}${client.province ? ` (${client.province.toUpperCase()})` : ""}`.trim(),
  ].filter(Boolean).join(", ");

  return (
    <DashboardLayout>
      <div className="mb-3">
        <Link href="/anagrafiche?v=committenti" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-300">
          <ArrowLeft className="mr-1 h-4 w-4" /> Committenti
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <NotchTabs
          title={client.name}
          items={[
            { value: "anagrafica", label: "Anagrafica", icon: <Building2 /> },
            ...(canEdit ? [{ value: "proposte", label: "Offerte generali", icon: <Plus /> }] : []),
            { value: "commesse", label: "Commesse", icon: <Briefcase /> },
          ]}
          value={activeTab}
          onValueChange={setActiveTab}
        >
          {canEdit && (
            <NotchActions>
              <NotchButton type="button" onClick={() => setIsEditDialogOpen(true)}><Pencil /> Modifica</NotchButton>
              <NotchButton type="button" onClick={() => setIsDeleteDialogOpen(true)} className="border-red-700 bg-red-600 text-white hover:bg-red-700 hover:text-white [&_svg]:text-white"><Trash2 /> Elimina</NotchButton>
            </NotchActions>
          )}
        </NotchTabs>

        {/* ── ANAGRAFICA ──────────────────────────────────────────────── */}
        <TabsContent value="anagrafica">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
            {/* Dati anagrafici */}
            <Card>
              <CardHeader><CardTitle className="text-base">Dati Anagrafici</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Ragione Sociale</span>
                    <p className="font-medium mt-0.5">{client.name}</p>
                  </div>
                  {client.vatNumber && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">P.IVA / C.F.</span>
                      <p className="font-medium mt-0.5">{client.vatNumber}</p>
                    </div>
                  )}
                </div>
                {fullAddress && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Indirizzo Sede</span>
                    <div className="flex items-start gap-2 mt-0.5"><MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /><p>{fullAddress}</p></div>
                  </div>
                )}
                {client.email && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Email</span>
                    <div className="flex items-center gap-2 mt-0.5"><Mail className="h-4 w-4 text-slate-400 shrink-0" /><a href={`mailto:${client.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">{client.email}</a></div>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Telefono</span>
                    <div className="flex items-center gap-2 mt-0.5"><Phone className="h-4 w-4 text-slate-400 shrink-0" /><a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a></div>
                  </div>
                )}
                {client.createdAt && (
                  <div className="pt-2 border-t dark:border-slate-700">
                    <span className="text-slate-400 dark:text-slate-500 text-xs">Creato il {format(new Date(client.createdAt), "d MMMM yyyy", { locale: it })}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Note interne */}
            <Card>
              <CardHeader><CardTitle className="text-base">Note Interne</CardTitle></CardHeader>
              <CardContent>
                <textarea
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Note interne sul committente (visibili solo a voi)..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button size="sm" className="mt-3" onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva Note
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Rubrica Contatti — full width */}
            <div className="lg:col-span-2">
              <ClientContacts clientId={id} canEdit={canEdit} />
            </div>
          </div>
        </TabsContent>

        {/* ── PROPOSTE ─────────────────────────────────────────────────── */}
        <TabsContent value="proposte">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Cerca offerta..." value={proposalSearch} onChange={e => setProposalSearch(e.target.value)} />
              </div>
              <Select value={proposalStatusFilter} onValueChange={setProposalStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Tutti gli stati" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  {(Object.entries(PROP_STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loadingProposals ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : filteredProposals.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Plus className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>{proposals.length === 0 ? "Nessuna offerta ancora. Creane una!" : "Nessuna offerta corrisponde alla ricerca."}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Offerta</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Luogo</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Data</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Valore</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProposals.map(p => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/clients/${id}/proposals/${p.id}`)}>
                      <TableCell className="py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{p.title}</div>
                        {p.description && <div className="line-clamp-1 text-xs text-slate-500">{p.description}</div>}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-600 dark:text-slate-300">
                        {(p.siteCity || p.siteStreet) ? [p.siteStreet, p.siteCity].filter(Boolean).join(", ") : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-600 dark:text-slate-300">
                        {p.date ? format(new Date(p.date), "d MMM yyyy", { locale: it }) : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {p.estimatedValue !== null ? `€ ${p.estimatedValue.toLocaleString('it-IT', { minimumFractionDigits: 2, useGrouping: true })}` : "—"}
                      </TableCell>
                      <TableCell className="py-3"><Badge className={`text-xs ${PROP_STATUS_COLORS[p.status]}`} variant="secondary">{PROP_STATUS_LABELS[p.status]}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── COMMESSE ─────────────────────────────────────────────────── */}
        <TabsContent value="commesse">
          {loadingJobs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Briefcase className="mx-auto mb-2 h-12 w-12 opacity-20" />
              <p>Nessuna commessa associata a questo committente</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Codice</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Commessa</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Indirizzo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Inizio</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => router.push(`/jobs/${job.id}`)}>
                    <TableCell className="py-3 font-mono text-xs text-slate-500">{job.code}</TableCell>
                    <TableCell className="py-3 font-medium text-slate-900 dark:text-white">{job.name}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 dark:text-slate-300">{job.siteAddress || "—"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-600 dark:text-slate-300">{job.startDate ? format(new Date(job.startDate), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="py-3"><Badge className={`text-xs ${STATUS_COLORS[job.status] ?? ""}`} variant="secondary">{STATUS_LABELS[job.status] ?? job.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {canEdit && activeTab === "proposte" && (
        <FloatingAddButton onClick={() => { setProposalForm(EMPTY_PROPOSAL_FORM); setUseClientAddr(false); setNewProposalOpen(true); }} label="Nuova offerta" />
      )}
      {canEdit && activeTab === "commesse" && (
        <FloatingAddButton href={`/jobs/new?clientId=${id}`} label="Nuova commessa" />
      )}

      {/* Edit / Delete dialogs */}
      <ClientEditDialog client={client} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSaved={() => { setIsEditDialogOpen(false); loadClient(); }} />
      <ClientDeleteDialog client={client} open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onConfirm={async () => { try { await clientsApi.delete(client.id); router.push("/anagrafiche?v=committenti"); } catch { notify.error("Errore durante l'eliminazione del committente"); } }} />

      {/* Nuova proposta dialog */}
      <Dialog open={newProposalOpen} onOpenChange={setNewProposalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuova Offerta</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
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
                  <Checkbox id="useClientAddrNew" checked={useClientAddr} onCheckedChange={v => setUseClientAddr(v as boolean)} />
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
    </DashboardLayout>
  );
}
