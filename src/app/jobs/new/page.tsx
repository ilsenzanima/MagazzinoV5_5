"use client"

import { notify } from "@/lib/notify";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Save, RefreshCw, Plus } from "lucide-react";
import Link from "next/link";
import { jobsApi, clientsApi, Client, Job } from "@/lib/api";
import { JobCategory } from "@/lib/types";
import { JobCategorySelector } from "@/components/jobs/JobCategorySelector";
import { DuplicateJobsNotice } from "@/components/jobs/DuplicateJobsNotice";
import { DuplicateClientsNotice } from "@/components/clients/DuplicateClientsNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { BlockBrowserBack } from "@/components/BlockBrowserBack";

const EMPTY_QUICK_CLIENT_FORM = {
  name: "", street: "", streetNumber: "", postalCode: "", city: "", province: "",
  vatNumber: "", email: "", phone: "",
};

export default function NewJobPage() {
  return (
    <Suspense>
      <NewJobForm />
    </Suspense>
  );
}

function NewJobForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Commessa da cui si parte ("Nuovo inizio"): dall'indirizzo (?clone=) oppure scelta nel modulo
  const [cloneId, setCloneId] = useState<string | null>(searchParams.get("clone"));
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  // Indirizzo cantiere copiato dalla commessa di partenza (testo unico, modificabile)
  const [inheritedAddress, setInheritedAddress] = useState<string | null>(null);
  // Commesse dello stesso cantiere di quella di partenza: non vanno segnalate come doppioni
  const [chainIds, setChainIds] = useState<string[]>([]);
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [useClientAddress, setUseClientAddress] = useState(false);

  if (userRole === 'user') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-20">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
          <p className="text-slate-500 mb-6">Non hai i permessi necessari per creare nuove commesse.</p>
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alle Commesse
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const [formData, setFormData] = useState({
    clientId: "",
    code: "",
    name: "",
    description: "",
    status: "active" as const,
    startDate: new Date().toISOString().split('T')[0], // Default to today
    endDate: "",
    siteManager: "",
    cig: "",
    cup: "",
    category: "fornitura_posa" as JobCategory
  });

  const [siteFields, setSiteFields] = useState({
    street: "",
    streetNumber: "",
    postalCode: "",
    city: "",
    province: "",
  });

  // Nuovo committente rapido
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState(EMPTY_QUICK_CLIENT_FORM);
  const [savingQuickClient, setSavingQuickClient] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const data = await clientsApi.getAll();
        setClients(data);
      } catch (err) {
        console.error(err);
        notify.error("Errore nel caricamento dei committenti");
      }
    };
    loadClients();
    jobsApi.getAll().then(setAllJobs).catch(console.error);
  }, []);

  // Se viene da "Nuovo inizio cantiere", pre-compila con i dati della commessa originale
  useEffect(() => {
    if (!cloneId) { setChainIds([]); return; }
    jobsApi.getChain(cloneId).then(c => setChainIds(c.map(x => x.id))).catch(() => setChainIds([cloneId]));
  }, [cloneId]);

  useEffect(() => {
    if (!cloneId) { setInheritedAddress(null); return; }
    const loadCloneData = async () => {
      try {
        const [job, allClients] = await Promise.all([
          jobsApi.getById(cloneId),
          clientsApi.getAll(),
        ]);
        if (!job) return;
        setClients(allClients);
        setInheritedAddress(job.siteAddress?.trim() || null);
        const client = allClients.find(c => c.id === job.clientId);
        const code = client ? generateCode(client.name) : "";
        setFormData(prev => ({
          ...prev,
          clientId: job.clientId || "",
          name: job.name || "",
          description: job.description || "",
          siteManager: job.siteManager || "",
          status: "active",
          startDate: "",
          endDate: "",
          cig: "",
          cup: "",
          code,
          category: job.category || "fornitura_posa",
        }));
      } catch (err) {
        console.error("Errore caricamento commessa da clonare", err);
        notify.error("Errore nel caricamento della commessa da clonare");
      }
    };
    loadCloneData();
  }, [cloneId]);

  // Effect to handle "Use client address" checkbox
  useEffect(() => {
    if (useClientAddress && formData.clientId) {
      const selectedClient = clients.find(c => c.id === formData.clientId);
      if (selectedClient) {
        setSiteFields({
          street: selectedClient.street || "",
          streetNumber: selectedClient.streetNumber || "",
          postalCode: selectedClient.postalCode || "",
          city: selectedClient.city || "",
          province: selectedClient.province || "",
        });
      }
    }
  }, [useClientAddress, formData.clientId, clients]);

  const generateCode = (clientName: string) => {
    if (!clientName) return "";
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    // Sanitize client name: take first 3 chars, uppercase, alphanumeric only
    const clientSlug = clientName.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    return `${year}-${month}-${clientSlug}`;
  };

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === clientId);
    const newCode = selectedClient ? generateCode(selectedClient.name) : formData.code;

    setFormData(prev => ({
      ...prev,
      clientId,
      code: newCode || prev.code,
    }));
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
      handleClientChange(created.id);
      setQuickClientForm(EMPTY_QUICK_CLIENT_FORM);
      setQuickClientOpen(false);
      notify.success("Committente creato");
    } catch { notify.error("Errore durante la creazione del committente"); }
    finally { setSavingQuickClient(false); }
  };

  const regenerateCode = () => {
    const selectedClient = clients.find(c => c.id === formData.clientId);
    if (selectedClient) {
      setFormData(prev => ({ ...prev, code: generateCode(selectedClient.name) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      notify.warning("Seleziona un committente");
      return;
    }

    try {
      setLoading(true);
      const siteAddressParts = inheritedAddress !== null ? [inheritedAddress.trim()].filter(Boolean) : [
        siteFields.street && `${siteFields.street}${siteFields.streetNumber ? " " + siteFields.streetNumber : ""}`,
        (siteFields.postalCode || siteFields.city) && `${siteFields.postalCode} ${siteFields.city}`.trim(),
        siteFields.province && `(${siteFields.province.toUpperCase()})`,
      ].filter(Boolean);
      const created = await jobsApi.create({
        ...formData,
        siteAddress: siteAddressParts.join(", "),
        originJobId: cloneId,
      });
      router.push(`/jobs/${created.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error creating job:", error);
      notify.error("Errore durante la creazione della commessa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <BlockBrowserBack />
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/jobs" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna alle Commesse
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            {cloneId ? "Nuovo Inizio Cantiere" : "Nuova Commessa"}
          </h1>
          {cloneId && (
            <p className="text-sm text-blue-600 mt-1">
              Dati pre-compilati dalla commessa precedente. Inserisci la nuova data di inizio — CIG e CUP sono stati lasciati vuoti.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Nuovo inizio: parti da una commessa esistente */}
          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <Label>Parti da una commessa esistente <span className="font-normal text-slate-500">(nuovo inizio dello stesso cantiere, opzionale)</span></Label>
            <SearchableSelect
              options={allJobs.map((j) => ({
                value: j.id,
                label: `${j.code} · ${j.name}`,
                description: [j.clientName, j.startDate ? new Date(j.startDate).toLocaleDateString("it-IT") : ""].filter(Boolean).join(" · ") || undefined,
              }))}
              value={cloneId || ""}
              onValueChange={(v) => setCloneId(v || null)}
              placeholder="Nessuna: commessa del tutto nuova"
              searchPlaceholder="Cerca per codice, nome o committente..."
              emptyMessage="Nessuna commessa trovata."
            />
            {cloneId ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Committente, nome, descrizione, referente, tipologia e indirizzo vengono copiati. Le due commesse risulteranno collegate (stesso cantiere).
                </p>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => setCloneId(null)}>Togli</Button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Se il cantiere è già stato lavorato, partire da una commessa precedente evita di reinserire i dati e le tiene collegate.</p>
            )}
          </div>

          {/* Tipologia: tre schede affiancate a tutta larghezza */}
          <Card>
            <CardContent className="pt-6">
              <JobCategorySelector
                value={formData.category}
                onChange={(category) => setFormData({ ...formData, category })}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Colonna sinistra: chi e cosa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Committente e commessa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Committente *</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        options={clients.map((c) => ({
                          value: c.id,
                          label: c.name,
                          description: c.address || undefined
                        }))}
                        value={formData.clientId}
                        onValueChange={handleClientChange}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="code">Codice (auto)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="YYYY-MM-CLT"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={regenerateCode} title="Rigenera codice">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Nome commessa *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Es. Ristrutturazione Villa Rossi"
                    />
                  </div>
                </div>

                <DuplicateJobsNotice
                  name={formData.name}
                  clientId={formData.clientId}
                  siteAddress={inheritedAddress ?? [siteFields.street, siteFields.streetNumber, siteFields.postalCode, siteFields.city].filter(Boolean).join(" ")}
                  jobs={allJobs}
                  excludeIds={chainIds}
                  onUseAsSource={(id) => { setCloneId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                />

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione (opzionale)</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cig">CIG</Label>
                    <Input
                      id="cig"
                      value={formData.cig}
                      onChange={(e) => setFormData({ ...formData, cig: e.target.value })}
                      placeholder="Codice Identificativo Gara"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cup">CUP</Label>
                    <Input
                      id="cup"
                      value={formData.cup}
                      onChange={(e) => setFormData({ ...formData, cup: e.target.value })}
                      placeholder="Codice Unico Progetto"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colonna destra: dove e quando */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cantiere e tempi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data inizio</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fine (prevista)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Stato</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Attiva</SelectItem>
                        <SelectItem value="completed">Completata</SelectItem>
                        <SelectItem value="suspended">Sospesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Indirizzo cantiere</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="useClientAddress"
                        checked={useClientAddress}
                        onCheckedChange={(checked) => { setUseClientAddress(checked as boolean); if (checked) setInheritedAddress(null); }}
                      />
                      <Label htmlFor="useClientAddress" className="text-sm font-normal cursor-pointer">
                        Usa indirizzo committente
                      </Label>
                    </div>
                  </div>

                  {inheritedAddress !== null && (
                    <div className="space-y-2">
                      <Label htmlFor="inheritedAddress">Indirizzo copiato dalla commessa di partenza</Label>
                      <Input id="inheritedAddress" value={inheritedAddress} onChange={(e) => setInheritedAddress(e.target.value)} />
                      <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setInheritedAddress(null)}>
                        Compila con i campi separati
                      </button>
                    </div>
                  )}

                  <div className={inheritedAddress !== null ? "hidden" : "grid grid-cols-4 gap-4"}>
                    <div className="col-span-3 space-y-2">
                      <Label htmlFor="siteStreet">Via / Piazza</Label>
                      <Input
                        id="siteStreet"
                        value={siteFields.street}
                        onChange={(e) => setSiteFields({ ...siteFields, street: e.target.value })}
                        placeholder="Via Roma"
                      />
                    </div>
                    <div className="col-span-1 space-y-2">
                      <Label htmlFor="siteStreetNumber">N. Civico</Label>
                      <Input
                        id="siteStreetNumber"
                        value={siteFields.streetNumber}
                        onChange={(e) => setSiteFields({ ...siteFields, streetNumber: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>

                  <div className={inheritedAddress !== null ? "hidden" : "grid grid-cols-2 md:grid-cols-4 gap-4"}>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="sitePostalCode">CAP</Label>
                      <Input
                        id="sitePostalCode"
                        value={siteFields.postalCode}
                        onChange={(e) => setSiteFields({ ...siteFields, postalCode: e.target.value })}
                        placeholder="00100"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="siteCity">Città</Label>
                      <Input
                        id="siteCity"
                        value={siteFields.city}
                        onChange={(e) => setSiteFields({ ...siteFields, city: e.target.value })}
                        placeholder="Milano"
                      />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <Label htmlFor="siteProvince">Provincia</Label>
                      <Input
                        id="siteProvince"
                        value={siteFields.province}
                        onChange={(e) => setSiteFields({ ...siteFields, province: e.target.value.toUpperCase() })}
                        placeholder="MI"
                        maxLength={2}
                        className="uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="siteManager">Capocantiere / Referente (opzionale)</Label>
                    <Input
                      id="siteManager"
                      value={formData.siteManager}
                      onChange={(e) => setFormData({ ...formData, siteManager: e.target.value })}
                      placeholder="Nome Cognome"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/jobs">
              <Button type="button" variant="outline">Annulla</Button>
            </Link>
            <Button type="submit" disabled={loading} className="bg-blue-600">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salva Commessa
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Nuovo committente rapido */}
      <Dialog open={quickClientOpen} onOpenChange={setQuickClientOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuovo Committente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Ragione Sociale / Nome *</Label>
              <Input value={quickClientForm.name} onChange={e => setQuickClientForm({ ...quickClientForm, name: e.target.value })} placeholder="Inserisci il nome dell'azienda o del cliente" />
            </div>
            <DuplicateClientsNotice
              name={quickClientForm.name}
              vatNumber={quickClientForm.vatNumber}
              street={quickClientForm.street}
              streetNumber={quickClientForm.streetNumber}
              postalCode={quickClientForm.postalCode}
              city={quickClientForm.city}
            />
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
