"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Plus,
    Loader2,
    Trash2,
    Pencil,
    Copy,
    Check,
    QrCode,
    ExternalLink,
    Search,
    RefreshCw,
    Building2,
    Calendar,
    FileText,
    Link as LinkIcon,
    X,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { guestSitesApi } from "@/lib/services/guest-sites";
import { jobsApi } from "@/lib/api";
import { GuestSite, GuestSiteJob, Job } from "@/lib/types";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function GuestSitesTab() {
    const [sites, setSites] = useState<GuestSite[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedSite, setSelectedSite] = useState<GuestSite | null>(null);
    const [associatedJobs, setAssociatedJobs] = useState<GuestSiteJob[]>([]);
    const [loadingAssocs, setLoadingAssocs] = useState(false);

    // Site creation / edit dialog
    const [formOpen, setFormOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<GuestSite | null>(null);
    const [siteName, setSiteName] = useState("");
    const [siteAddress, setSiteAddress] = useState("");
    const [sitePasscode, setSitePasscode] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Job association dialog
    const [assocOpen, setAssocOpen] = useState(false);
    const [allJobs, setAllJobs] = useState<Job[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [jobSearch, setJobSearch] = useState("");
    const [selectedJobId, setSelectedJobId] = useState("");
    const [assocNotes, setAssocNotes] = useState("");
    const [associating, setAssociating] = useState(false);

    // Edit notes dialog
    const [editNotesOpen, setEditNotesOpen] = useState(false);
    const [editingAssoc, setEditingAssoc] = useState<GuestSiteJob | null>(null);
    const [editNotesText, setEditNotesText] = useState("");
    const [updatingNotes, setUpdatingNotes] = useState(false);

    // Delete confirm state
    const [deleteSite, setDeleteSite] = useState<GuestSite | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Copy states
    const [copiedInvite, setCopiedInvite] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    useEffect(() => {
        loadSites();
    }, []);

    useEffect(() => {
        if (selectedSite) {
            loadAssociations(selectedSite.id);
        } else {
            setAssociatedJobs([]);
        }
    }, [selectedSite]);

    const loadSites = async () => {
        try {
            setLoading(true);
            const data = await guestSitesApi.getAll();
            setSites(data);
        } catch (e) {
            console.error(e);
            toast.error("Errore nel caricamento dei cantieri ospiti");
        } finally {
            setLoading(false);
        }
    };

    const loadAssociations = async (siteId: string) => {
        try {
            setLoadingAssocs(true);
            const data = await guestSitesApi.getJobsForSite(siteId);
            setAssociatedJobs(data);
        } catch (e) {
            console.error(e);
            toast.error("Errore nel caricamento delle commesse associate");
        } finally {
            setLoadingAssocs(false);
        }
    };

    const openCreateDialog = () => {
        setEditingSite(null);
        setSiteName("");
        setSiteAddress("");
        setSitePasscode("");
        setFormOpen(true);
    };

    const openEditDialog = (site: GuestSite) => {
        setEditingSite(site);
        setSiteName(site.name);
        setSiteAddress(site.address);
        setSitePasscode(site.passcode);
        setFormOpen(true);
    };

    const handleSaveSite = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = siteName.trim();
        const address = siteAddress.trim();
        const passcode = sitePasscode.trim();

        if (!name || !address) {
            toast.error("Compila tutti i campi obbligatori");
            return;
        }

        try {
            setSubmitting(true);
            if (editingSite) {
                const updated = await guestSitesApi.update(editingSite.id, {
                    name,
                    address,
                    passcode: passcode || undefined,
                });
                setSites(prev => prev.map(s => s.id === updated.id ? updated : s));
                if (selectedSite?.id === updated.id) {
                    setSelectedSite(updated);
                }
                toast.success("Cantiere ospite aggiornato");
            } else {
                const created = await guestSitesApi.create({
                    name,
                    address,
                    passcode: passcode || undefined,
                });
                setSites(prev => [created, ...prev]);
                setSelectedSite(created);
                toast.success("Cantiere ospite creato");
            }
            setFormOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Errore nel salvataggio del cantiere");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSite = async () => {
        if (!deleteSite) return;
        try {
            setDeleting(true);
            await guestSitesApi.delete(deleteSite.id);
            setSites(prev => prev.filter(s => s.id !== deleteSite.id));
            if (selectedSite?.id === deleteSite.id) {
                setSelectedSite(null);
            }
            toast.success("Cantiere ospite eliminato");
            setDeleteSite(null);
        } catch (e) {
            console.error(e);
            toast.error("Errore durante l'eliminazione");
        } finally {
            setDeleting(false);
        }
    };

    const openAssociateDialog = async () => {
        setAssocOpen(true);
        setSelectedJobId("");
        setAssocNotes("");
        setJobSearch("");
        try {
            setLoadingJobs(true);
            // Carica tutte le commesse per la dialog di associazione
            const { data } = await jobsApi.getPaginated({ page: 1, limit: 100, status: "active" });
            setAllJobs(data || []);
        } catch (e) {
            console.error(e);
            toast.error("Errore nel caricamento delle commesse");
        } finally {
            setLoadingJobs(false);
        }
    };

    const handleAssociateJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSite || !selectedJobId) return;

        // Evita associazioni duplicate nel frontend
        if (associatedJobs.some(j => j.jobId === selectedJobId)) {
            toast.error("Questa commessa è già associata a questo cantiere");
            return;
        }

        try {
            setAssociating(true);
            const created = await guestSitesApi.associateJob(selectedSite.id, selectedJobId, assocNotes.trim());
            setAssociatedJobs(prev => [...prev, created]);
            toast.success("Commessa associata con successo");
            setAssocOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Errore nell'associazione della commessa");
        } finally {
            setAssociating(false);
        }
    };

    const handleDisassociateJob = async (assocId: string) => {
        try {
            await guestSitesApi.disassociateJob(assocId);
            setAssociatedJobs(prev => prev.filter(a => a.id !== assocId));
            toast.success("Commessa disassociata");
        } catch (e) {
            console.error(e);
            toast.error("Errore durante la disassociazione");
        }
    };

    const openEditNotesDialog = (assoc: GuestSiteJob) => {
        setEditingAssoc(assoc);
        setEditNotesText(assoc.customNotes || "");
        setEditNotesOpen(true);
    };

    const handleUpdateNotes = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAssoc) return;
        try {
            setUpdatingNotes(true);
            const updated = await guestSitesApi.updateJobAssociation(editingAssoc.id, editNotesText.trim() || null);
            setAssociatedJobs(prev => prev.map(a => a.id === updated.id ? updated : a));
            toast.success("Note aggiornate");
            setEditNotesOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Errore nell'aggiornamento delle note");
        } finally {
            setUpdatingNotes(false);
        }
    };

    const getPortalUrl = (siteId: string) => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/cantiere-ospite/${siteId}`;
    };

    const handleCopyLink = () => {
        if (!selectedSite) return;
        navigator.clipboard.writeText(getPortalUrl(selectedSite.id));
        setCopiedLink(true);
        toast.success("Link copiato negli appunti");
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleCopyInvite = () => {
        if (!selectedSite) return;
        const inviteText = `Portale Conformità Ospiti - OPI Firesafe S.r.l.
Cantiere: ${selectedSite.name}
Indirizzo: ${selectedSite.address}

Link di accesso: ${getPortalUrl(selectedSite.id)}
Codice di accesso (Passcode): ${selectedSite.passcode}

Note: Questo link consente di visualizzare in sola lettura i certificati di conformità e i DDT di cantiere relativi alle lavorazioni.`;

        navigator.clipboard.writeText(inviteText);
        setCopiedInvite(true);
        toast.success("Invito copiato negli appunti");
        setTimeout(() => setCopiedInvite(false), 2000);
    };

    const filteredSites = sites.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.address.toLowerCase().includes(search.toLowerCase())
    );

    const filteredAvailableJobs = allJobs.filter(j =>
        (j.code.toLowerCase().includes(jobSearch.toLowerCase()) ||
        j.description?.toLowerCase().includes(jobSearch.toLowerCase()) ||
        j.name?.toLowerCase().includes(jobSearch.toLowerCase())) &&
        !associatedJobs.some(assoc => assoc.jobId === j.id)
    );

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* Lista cantieri (colonna sinistra) */}
            <div className="md:col-span-1 space-y-4">
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-lg">Cantieri configurati</CardTitle>
                            <CardDescription>Gestisci accessi esterni</CardDescription>
                        </div>
                        <Button size="sm" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4 mr-1" /> Nuovo
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="Cerca cantiere..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="ml-2 text-slate-500 text-sm">Caricamento...</span>
                            </div>
                        ) : filteredSites.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                Nessun cantiere ospite trovato.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-hide">
                                {filteredSites.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedSite(s)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors border text-sm flex items-start gap-3 ${
                                            selectedSite?.id === s.id
                                                ? "bg-primary/5 border-primary text-primary font-medium"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800"
                                        }`}
                                    >
                                        <Building2 className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold truncate">{s.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                                            <p className="text-xs text-primary/80 mt-1 font-mono">{s.passcode}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dettaglio cantiere (colonna destra) */}
            <div className="md:col-span-2">
                {selectedSite ? (
                    <div className="space-y-6">
                        {/* Scheda credenziali e accesso */}
                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                                <div>
                                    <CardTitle>{selectedSite.name}</CardTitle>
                                    <CardDescription>{selectedSite.address}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedSite)}>
                                        <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/5" onClick={() => setDeleteSite(selectedSite)}>
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 sm:grid-cols-3 items-center">
                                    {/* QR Code */}
                                    <div className="sm:col-span-1 flex flex-col items-center justify-center p-3 border rounded-lg bg-white">
                                        <div className="p-1">
                                            <QRCode
                                                value={getPortalUrl(selectedSite.id)}
                                                size={120}
                                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                viewBox={`0 0 256 256`}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-2 font-medium">Scansiona per accedere</span>
                                    </div>

                                    {/* Info credenziali */}
                                    <div className="sm:col-span-2 space-y-4">
                                        <div>
                                            <Label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Codice di accesso (Passcode)</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xl font-mono font-bold tracking-wider bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded text-primary border">
                                                    {selectedSite.passcode}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEditDialog(selectedSite)}
                                                    title="Modifica passcode"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-xs text-slate-400 uppercase font-bold tracking-wider">Link dedicato</Label>
                                            <p className="text-xs text-primary truncate font-mono mt-1 mb-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded border">
                                                {getPortalUrl(selectedSite.id)}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button size="sm" variant="default" onClick={handleCopyInvite}>
                                                {copiedInvite ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                                                Copia invito completo
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleCopyLink}>
                                                {copiedLink ? <Check className="h-3.5 w-3.5 mr-1" /> : <LinkIcon className="h-3.5 w-3.5 mr-1" />}
                                                Copia solo Link
                                            </Button>
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={getPortalUrl(selectedSite.id)} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Apri portale
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Storico Commesse Associate */}
                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-lg">Commesse associate</CardTitle>
                                    <CardDescription>Storico commesse visibili all'ospite</CardDescription>
                                </div>
                                <Button size="sm" onClick={openAssociateDialog}>
                                    <Plus className="h-4 w-4 mr-1" /> Associa commessa
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {loadingAssocs ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : associatedJobs.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed rounded-lg text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                                        <Building2 className="h-8 w-8 opacity-30" />
                                        <p>Nessuna commessa associata a questo cantiere.</p>
                                        <Button variant="outline" size="sm" onClick={openAssociateDialog}>
                                            Associa la prima commessa
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {associatedJobs.map((assoc) => (
                                            <div
                                                key={assoc.id}
                                                className="p-4 border rounded-lg hover:shadow-sm transition-shadow bg-card flex flex-col sm:flex-row justify-between gap-4"
                                            >
                                                <div className="space-y-2 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-mono">
                                                            {assoc.jobCode}
                                                        </span>
                                                        <span className="text-sm font-semibold text-foreground truncate">
                                                            {assoc.jobDescription}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>
                                                            Periodo:{" "}
                                                            {assoc.jobStartDate
                                                                ? format(new Date(assoc.jobStartDate), "dd/MM/yyyy")
                                                                : "N/D"}{" "}
                                                            -{" "}
                                                            {assoc.jobEndDate
                                                                ? format(new Date(assoc.jobEndDate), "dd/MM/yyyy")
                                                                : "N/D"}
                                                        </span>
                                                    </div>

                                                    {/* Note ad-hoc */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded border border-slate-100 dark:border-slate-800 mt-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Commento per l'ospite</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-primary"
                                                                onClick={() => openEditNotesDialog(assoc)}
                                                            >
                                                                <Pencil className="h-3 w-3 mr-1" /> Modifica
                                                            </Button>
                                                        </div>
                                                        {assoc.customNotes ? (
                                                            <p className="text-xs text-slate-600 dark:text-slate-300 italic whitespace-pre-wrap">
                                                                &ldquo;{assoc.customNotes}&rdquo;
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-slate-400 italic">
                                                                Nessun commento specifico per l'ospite inserito.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex sm:flex-col justify-end items-end gap-2 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:bg-destructive/5"
                                                        onClick={() => handleDisassociateJob(assoc.id)}
                                                    >
                                                        <X className="h-4 w-4 mr-1" /> Disassocia
                                                    </Button>
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <a href={`/jobs/${assoc.jobId}`} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4 mr-1" /> Dettaglio Commessa
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="h-[400px] border border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground p-6 text-center gap-3">
                        <Building2 className="h-12 w-12 opacity-20" />
                        <div>
                            <h3 className="font-semibold text-lg">Nessun cantiere ospite selezionato</h3>
                            <p className="text-sm max-w-sm mt-1">
                                Scegli un cantiere ospite dalla lista a sinistra per vederne i dettagli, generare il codice QR o associare le commesse.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Creation / Editing Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSite ? "Modifica cantiere ospite" : "Nuovo cantiere ospite"}</DialogTitle>
                        <DialogDescription>
                            Configura il nome e l'indirizzo del cantiere fisico a cui associare le commesse.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveSite} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Nome Cantiere *</Label>
                            <Input
                                id="name"
                                required
                                placeholder="es. Cantiere Condominio Aurora"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="address">Indirizzo *</Label>
                            <Input
                                id="address"
                                required
                                placeholder="es. Via Galileo Galilei 12, Tavagnacco (UD)"
                                value={siteAddress}
                                onChange={(e) => setSiteAddress(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="passcode">
                                Password (Passcode) {editingSite && "*"}
                            </Label>
                            <Input
                                id="passcode"
                                placeholder={editingSite ? "Reinserisci o modifica la password" : "Lascia vuoto per autogenerare (es. OPI-XXXXXX)"}
                                value={sitePasscode}
                                onChange={(e) => setSitePasscode(e.target.value)}
                                className="font-mono"
                            />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salva
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Association Dialog */}
            <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Associa commessa</DialogTitle>
                        <DialogDescription>
                            Seleziona una commessa attiva da associare al cantiere per renderne visibili i documenti.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAssociateJob} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Cerca e seleziona commessa *</Label>
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    className="pl-9"
                                    placeholder="Filtra per codice, descrizione..."
                                    value={jobSearch}
                                    onChange={(e) => setJobSearch(e.target.value)}
                                />
                            </div>
                            {loadingJobs ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredAvailableJobs.length === 0 ? (
                                <div className="text-center py-4 text-xs text-muted-foreground border rounded bg-slate-50 dark:bg-slate-900/30">
                                    Nessuna commessa attiva disponibile da associare.
                                </div>
                            ) : (
                                <div className="border rounded-md max-h-[160px] overflow-y-auto p-1 bg-card space-y-1">
                                    {filteredAvailableJobs.map((j) => (
                                        <button
                                            key={j.id}
                                            type="button"
                                            onClick={() => setSelectedJobId(j.id)}
                                            className={`w-full text-left p-2 rounded text-xs flex justify-between items-center transition-colors ${
                                                selectedJobId === j.id
                                                    ? "bg-primary text-primary-foreground font-semibold"
                                                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <span className="font-mono font-bold shrink-0 mr-2">{j.code}</span>
                                            <span className="truncate flex-1 text-right">{j.description || j.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="assocNotes">Commento per l'ospite</Label>
                            <Textarea
                                id="assocNotes"
                                placeholder="Scrivi un commento ad-hoc che descrive questa commessa o fornisce indicazioni sui documenti ai visitatori esterni..."
                                value={assocNotes}
                                onChange={(e) => setAssocNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setAssocOpen(false)} disabled={associating}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={associating || !selectedJobId}>
                                {associating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Associa
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Notes Dialog */}
            <Dialog open={editNotesOpen} onOpenChange={setEditNotesOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifica commento ospite</DialogTitle>
                        <DialogDescription>
                            Aggiorna il testo visualizzato dagli ospiti a fianco della commessa.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateNotes} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="editNotesText">Commento per l'ospite</Label>
                            <Textarea
                                id="editNotesText"
                                placeholder="Scrivi un commento per l'ospite..."
                                value={editNotesText}
                                onChange={(e) => setEditNotesText(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setEditNotesOpen(false)} disabled={updatingNotes}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={updatingNotes}>
                                {updatingNotes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salva
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm delete cantiere */}
            <ConfirmDeleteDialog
                open={!!deleteSite}
                onOpenChange={(v) => !v && setDeleteSite(null)}
                onConfirm={handleDeleteSite}
                title="Elimina cantiere ospite"
                description={`Sei sicuro di voler eliminare definitivamente il cantiere ospite "${deleteSite?.name}"? Questo revocherà immediatamente l'accesso a tutti i visitatori esterni ed eliminerà lo storico delle associazioni delle commesse.`}
                loading={deleting}
            />
        </div>
    );
}
