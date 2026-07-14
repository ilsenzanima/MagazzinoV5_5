"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect, useRef, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    ArrowLeft,
    MapPin,
    Key,
    Save,
    Download,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { guestSitesApi } from "@/lib/services/guest-sites";
import { jobsApi } from "@/lib/api";
import { GuestSite, GuestSiteJob, Job } from "@/lib/types";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { downloadSvgAsPng } from "@/lib/qr-download";

function GuestSiteDetailContent() {
    const router = useRouter();
    const { id } = useParams() as { id: string };
    const { userRole } = useAuth();

    const [site, setSite] = useState<GuestSite | null>(null);
    const [loading, setLoading] = useState(true);
    const [associatedJobs, setAssociatedJobs] = useState<GuestSiteJob[]>([]);
    const [loadingAssocs, setLoadingAssocs] = useState(false);

    // Edit general info state
    const [editingDetails, setEditingDetails] = useState(false);
    const [siteName, setSiteName] = useState("");
    const [siteAddress, setSiteAddress] = useState("");
    const [sitePasscode, setSitePasscode] = useState("");
    const [savingDetails, setSavingDetails] = useState(false);

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

    // Disassociate confirm state
    const [disassocItem, setDisassocItem] = useState<GuestSiteJob | null>(null);
    const [disassociating, setDisassociating] = useState(false);

    // Delete site confirm state
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletingSite, setDeletingSite] = useState(false);

    // Copy states
    const [copiedInvite, setCopiedInvite] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // QR code refs (per il download come immagine PNG)
    const qrNoPasscodeRef = useRef<HTMLDivElement>(null);
    const qrWithPasscodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (userRole && userRole !== "admin" && userRole !== "operativo") {
            router.replace("/dashboard");
            return;
        }
        if (id) {
            loadData();
        }
    }, [id, userRole]);

    const loadData = async () => {
        try {
            setLoading(true);
            const siteData = await guestSitesApi.getById(id);
            if (!siteData) {
                toast.error("Cantiere non trovato");
                router.push("/guest-sites");
                return;
            }
            setSite(siteData);
            setSiteName(siteData.name);
            setSiteAddress(siteData.address);
            setSitePasscode(siteData.passcode);

            await loadAssociations(siteData.id);
        } catch (e) {
            console.error(e);
            toast.error("Errore nel caricamento del cantiere ospite");
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

    const handleUpdateDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!site) return;
        const name = siteName.trim();
        const address = siteAddress.trim();
        const passcode = sitePasscode.trim();

        if (!name || !address) {
            toast.error("Compila tutti i campi obbligatori");
            return;
        }

        try {
            setSavingDetails(true);
            const updated = await guestSitesApi.update(site.id, {
                name,
                address,
                passcode: passcode || undefined,
            });
            setSite(updated);
            setSiteName(updated.name);
            setSiteAddress(updated.address);
            setSitePasscode(updated.passcode);
            setEditingDetails(false);
            toast.success("Dettagli cantiere aggiornati");
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Errore durante il salvataggio");
        } finally {
            setSavingDetails(false);
        }
    };

    const openAssociateModal = async () => {
        setAssocOpen(true);
        setSelectedJobId("");
        setAssocNotes("");
        setJobSearch("");
        try {
            setLoadingJobs(true);
            const data = await jobsApi.getAll();
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
        if (!site || !selectedJobId) return;

        try {
            setAssociating(true);
            const created = await guestSitesApi.associateJob(site.id, selectedJobId, assocNotes.trim() || undefined);
            setAssociatedJobs(prev => [...prev, created]);
            toast.success("Commessa collegata con successo");
            setAssocOpen(false);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Errore durante il collegamento");
        } finally {
            setAssociating(false);
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
            toast.success("Note aggiornate con successo");
            setEditNotesOpen(false);
        } catch (e) {
            console.error(e);
            toast.error("Errore nell'aggiornamento delle note");
        } finally {
            setUpdatingNotes(false);
        }
    };

    const handleDisassociate = async () => {
        if (!disassocItem) return;
        try {
            setDisassociating(true);
            await guestSitesApi.disassociateJob(disassocItem.id);
            setAssociatedJobs(prev => prev.filter(a => a.id !== disassocItem.id));
            toast.success("Collegamento commessa rimosso");
            setDisassocItem(null);
        } catch (e) {
            console.error(e);
            toast.error("Errore nella rimozione dell'associazione");
        } finally {
            setDisassociating(false);
        }
    };

    const handleDeleteSite = async () => {
        if (!site) return;
        try {
            setDeletingSite(true);
            await guestSitesApi.delete(site.id);
            toast.success("Portale cantiere eliminato");
            router.push("/guest-sites");
        } catch (e) {
            console.error(e);
            toast.error("Errore durante l'eliminazione");
        } finally {
            setDeletingSite(false);
        }
    };

    const getPortalUrl = (siteId: string) => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/cantiere-ospite/${siteId}`;
    };

    const getPortalUrlWithPasscode = (siteId: string, passcode: string) => {
        const base = getPortalUrl(siteId);
        return base ? `${base}?code=${encodeURIComponent(passcode)}` : "";
    };

    const handleDownloadQr = (containerRef: React.RefObject<HTMLDivElement | null>, withPasscode: boolean) => {
        if (!site) return;
        const svg = containerRef.current?.querySelector("svg") as SVGSVGElement | null;
        if (!svg) return;
        const slug = site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cantiere";
        const filename = `qr-${slug}-${withPasscode ? "con-password" : "senza-password"}.png`;
        downloadSvgAsPng(svg, filename);
    };

    const handleCopyLink = () => {
        if (!site) return;
        navigator.clipboard.writeText(getPortalUrl(site.id));
        setCopiedLink(true);
        toast.success("Link copiato negli appunti");
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleCopyInvite = () => {
        if (!site) return;
        const inviteText = `Portale Conformità Ospiti - OPI Firesafe S.r.l.
Cantiere: ${site.name}
Indirizzo: ${site.address}

Link di accesso: ${getPortalUrl(site.id)}
Codice di accesso (Passcode): ${site.passcode}

Note: Questo link consente di visualizzare in sola lettura i certificati di conformità e i DDT di cantiere relativi alle lavorazioni.`;

        navigator.clipboard.writeText(inviteText);
        setCopiedInvite(true);
        toast.success("Testo invito copiato");
        setTimeout(() => setCopiedInvite(false), 2000);
    };

    const filteredAvailableJobs = allJobs.filter(j =>
        (j.code.toLowerCase().includes(jobSearch.toLowerCase()) ||
        j.description?.toLowerCase().includes(jobSearch.toLowerCase()) ||
        j.name?.toLowerCase().includes(jobSearch.toLowerCase())) &&
        !associatedJobs.some(assoc => assoc.jobId === j.id)
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-slate-500 font-medium">Caricamento dettagli cantiere...</span>
            </div>
        );
    }

    if (!site) return null;

    const inviteUrl = getPortalUrl(site.id);

    return (
        <div className="space-y-6">
            {/* Navigation back and header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/guest-sites")} className="pl-0 text-slate-500">
                        <ArrowLeft className="mr-1.5 h-4 w-4" /> Torna ai cantieri ospiti
                    </Button>
                    <div className="flex items-start gap-3">
                        <Building2 className="h-6 w-6 text-primary mt-1 shrink-0" />
                        <div>
                            <h1 className="text-2xl font-bold">{site.name}</h1>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <MapPin className="h-3.5 w-3.5" /> {site.address}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingDetails(true)}>
                        <Pencil className="mr-2 h-4 w-4" /> Modifica Info
                    </Button>
                    <Button variant="outline" size="sm" className="hover:bg-destructive/10 hover:text-destructive text-slate-500" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Elimina Portale
                    </Button>
                </div>
            </div>

            {/* Layout a 2 colonne */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Colonna Sinistra (2/3): Commesse collegate */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <div>
                                <CardTitle className="text-base font-bold">Commesse collegate al portale</CardTitle>
                                <CardDescription className="text-xs">
                                    L'ospite vedrà i DDT e le certificazioni delle sole commesse associate a questo portale.
                                </CardDescription>
                            </div>
                            <Button size="sm" onClick={openAssociateModal}>
                                <Plus className="mr-1.5 h-4 w-4" /> Collega Commessa
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loadingAssocs ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                </div>
                            ) : associatedJobs.length === 0 ? (
                                <div className="text-center py-12 border-dashed border rounded-lg bg-slate-50/50 dark:bg-slate-900/10">
                                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm font-semibold">Nessuna commessa collegata</p>
                                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-4">
                                        Per visualizzare dei documenti sul portale ospiti, devi prima associare almeno una commessa.
                                    </p>
                                    <Button size="sm" variant="outline" onClick={openAssociateModal}>
                                        Collega Commessa
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {associatedJobs.map((assoc) => (
                                        <div key={assoc.id} className="p-4 border rounded-lg bg-white dark:bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded">
                                                        {assoc.jobCode}
                                                    </span>
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                        {assoc.jobName || assoc.jobDescription || "Senza nome"}
                                                    </h4>
                                                </div>
                                                {assoc.customNotes && (
                                                    <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border rounded p-2 italic mt-2">
                                                        &ldquo;{assoc.customNotes}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                                <Button variant="ghost" size="sm" className="h-8" onClick={() => openEditNotesDialog(assoc)}>
                                                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Note
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 hover:bg-destructive/10 hover:text-destructive text-slate-400" onClick={() => setDisassocItem(assoc)}>
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Rimuovi
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Colonna Destra (1/3): QR Code e Link portale */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-primary/20 shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 pb-4 border-b">
                            <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                                <QrCode className="h-4 w-4" /> Portale per l'Ospite
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                                Condividi queste credenziali o fai scansionare il QR code al cliente/direttore dei lavori.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-5">
                            {/* QR Code */}
                            <div ref={qrNoPasscodeRef} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-lg border shadow-inner">
                                <QRCode value={inviteUrl} size={150} />
                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-3">Scansiona per accedere</span>
                            </div>

                            {/* QR "con password" incorporata: generato ma non mostrato, solo per il download */}
                            <div ref={qrWithPasscodeRef} className="hidden">
                                <QRCode value={getPortalUrlWithPasscode(site.id, site.passcode)} size={512} />
                            </div>

                            {/* Download QR Code */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleDownloadQr(qrNoPasscodeRef, false)}
                                    title="Il visitatore dovrà digitare manualmente il passcode"
                                >
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> QR senza password
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => handleDownloadQr(qrWithPasscodeRef, true)}
                                    title="Il QR contiene già il passcode: accesso immediato senza digitarlo"
                                >
                                    <Download className="mr-1.5 h-3.5 w-3.5" /> QR con password
                                </Button>
                            </div>

                            {/* Passcode info */}
                            <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                        <Key className="h-3 w-3" /> Passcode di Accesso:
                                    </span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 px-2 py-0.5 rounded border">
                                        {site.passcode}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Creato il:
                                    </span>
                                    <span>
                                        {format(new Date(site.createdAt), "dd/MM/yyyy", { locale: it })}
                                    </span>
                                </div>
                            </div>

                            {/* Buttons and Link */}
                            <div className="space-y-2">
                                <Button className="w-full justify-center" size="sm" onClick={handleCopyInvite}>
                                    {copiedInvite ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                                    Copia Testo Invito
                                </Button>
                                <Button className="w-full justify-center" size="sm" variant="outline" onClick={handleCopyLink}>
                                    {copiedLink ? <Check className="mr-1.5 h-4 w-4" /> : <LinkIcon className="mr-1.5 h-4 w-4" />}
                                    Copia Solo Link
                                </Button>
                                <a
                                    href={inviteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full inline-flex items-center justify-center text-xs text-primary font-bold hover:underline py-2"
                                >
                                    Apri nel Browser <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialog modifica info generali cantiere */}
            <Dialog open={editingDetails} onOpenChange={setEditingDetails}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleUpdateDetails}>
                        <DialogHeader>
                            <DialogTitle>Modifica Cantiere Ospite</DialogTitle>
                            <DialogDescription>
                                Aggiorna i dati generali di questo portale. Se modifichi il passcode, i vecchi inviti non saranno più validi.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Nome Cantiere / Cliente *</Label>
                                <Input
                                    id="edit-name"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-address">Indirizzo Cantiere *</Label>
                                <Input
                                    id="edit-address"
                                    value={siteAddress}
                                    onChange={(e) => setSiteAddress(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-passcode">Passcode di Accesso</Label>
                                <Input
                                    id="edit-passcode"
                                    value={sitePasscode}
                                    onChange={(e) => setSitePasscode(e.target.value)}
                                    placeholder="Es. OPI-XXXXXX"
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingDetails(false)} disabled={savingDetails}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={savingDetails}>
                                {savingDetails ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...
                                    </>
                                ) : (
                                    "Salva Modifiche"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog associazione commessa */}
            <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleAssociateJob}>
                        <DialogHeader>
                            <DialogTitle>Collega Commessa al Portale</DialogTitle>
                            <DialogDescription>
                                Associa una commessa del magazzino a questo portale cantiere ospiti. Puoi inserire delle note di accompagnamento per l'ospite.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {/* Cerca Commessa */}
                            <div className="space-y-2">
                                <Label>Seleziona Commessa</Label>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <Input
                                        placeholder="Cerca per codice o descrizione..."
                                        className="pl-8 text-xs"
                                        value={jobSearch}
                                        onChange={(e) => setJobSearch(e.target.value)}
                                    />
                                </div>
                                <div className="border rounded-md max-h-[150px] overflow-y-auto mt-2 divide-y text-xs">
                                    {loadingJobs ? (
                                        <div className="p-4 flex justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                        </div>
                                    ) : filteredAvailableJobs.length === 0 ? (
                                        <div className="p-3 text-slate-400 italic text-center">Nessuna commessa disponibile.</div>
                                    ) : (
                                        filteredAvailableJobs.map((j) => (
                                            <div
                                                key={j.id}
                                                className={`p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedJobId === j.id ? "bg-slate-50 dark:bg-slate-900 border-l-2 border-primary" : ""}`}
                                                onClick={() => setSelectedJobId(j.id)}
                                            >
                                                <span className="font-bold truncate flex-1">{j.name || j.description || "Senza nome"}</span>
                                                <span className="text-slate-400 font-mono text-[10px] shrink-0 ml-2">{j.code}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Note personalizzate */}
                            <div className="space-y-2">
                                <Label htmlFor="assoc-notes">Note ad-hoc per questa commessa cantiere</Label>
                                <Textarea
                                    id="assoc-notes"
                                    placeholder="Es. Sezione relativa alle opere del Lotto 1. Saranno visualizzabili solo le relative certificazioni."
                                    value={assocNotes}
                                    onChange={(e) => setAssocNotes(e.target.value)}
                                    className="h-20 text-xs"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAssocOpen(false)} disabled={associating}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={associating || !selectedJobId}>
                                {associating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...
                                    </>
                                ) : (
                                    "Collega"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog modifica note associazione */}
            <Dialog open={editNotesOpen} onOpenChange={setEditNotesOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleUpdateNotes}>
                        <DialogHeader>
                            <DialogTitle>Modifica Note Associazione</DialogTitle>
                            <DialogDescription>
                                Inserisci o modifica la nota personalizzata visualizzata dall'ospite per la commessa <strong>{editingAssoc?.jobCode}</strong>.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            <Textarea
                                placeholder="Inserisci delle note ad-hoc..."
                                value={editNotesText}
                                onChange={(e) => setEditNotesText(e.target.value)}
                                className="h-24 text-xs"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditNotesOpen(false)} disabled={updatingNotes}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={updatingNotes}>
                                {updatingNotes ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...
                                    </>
                                ) : (
                                    "Salva"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Disassociate Job */}
            <ConfirmDeleteDialog
                open={!!disassocItem}
                onOpenChange={(open) => !open && setDisassocItem(null)}
                onConfirm={handleDisassociate}
                title="Rimuovi associazione commessa"
                description={`Sei sicuro di voler scollegare la commessa "${disassocItem?.jobCode}" da questo portale? Gli ospiti non potranno più vedere i documenti di questa commessa su questo link.`}
                loading={disassociating}
            />

            {/* Confirm Delete Site */}
            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onConfirm={handleDeleteSite}
                title="Elimina portale cantiere ospite"
                description={`Sei sicuro di voler eliminare permanentemente questo portale cantiere ospiti? L'accesso per gli ospiti tramite link e QR code verrà disattivato immediatamente.`}
                loading={deletingSite}
            />
        </div>
    );
}

export default function GuestSiteDetailPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={
                <div className="min-h-[400px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }>
                <GuestSiteDetailContent />
            </Suspense>
        </DashboardLayout>
    );
}
