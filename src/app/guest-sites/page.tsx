"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Search,
    Building2,
    Calendar,
    Link as LinkIcon,
    ArrowRight,
    Key,
    MapPin,
    Grid,
    List,
} from "lucide-react";
import { toast } from "sonner";
import { guestSitesApi } from "@/lib/services/guest-sites";
import { GuestSite } from "@/lib/types";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";
import { useAuth } from "@/components/auth-provider";

function GuestSitesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userRole } = useAuth();
    const [sites, setSites] = useState<GuestSite[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [viewMode, setViewMode] = useViewMode("guest-sites", "grid");

    // Keep the URL in sync with the search term so browser back/forward
    // restores the exact view instead of resetting it.
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        const query = params.toString();
        router.replace(query ? `/guest-sites?${query}` : "/guest-sites", { scroll: false });
    }, [search, router]);

    // Site creation dialog
    const [formOpen, setFormOpen] = useState(false);
    const [siteName, setSiteName] = useState("");
    const [siteAddress, setSiteAddress] = useState("");
    const [sitePasscode, setSitePasscode] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete confirm state
    const [deleteSite, setDeleteSite] = useState<GuestSite | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (userRole && userRole !== "admin" && userRole !== "operativo") {
            router.replace("/dashboard");
            return;
        }
        loadSites();
    }, [userRole]);

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

    const openCreateDialog = () => {
        setSiteName("");
        setSiteAddress("");
        setSitePasscode("");
        setFormOpen(true);
    };

    const handleCreateSite = async (e: React.FormEvent) => {
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
            const created = await guestSitesApi.create({
                name,
                address,
                passcode: passcode || undefined, // Lascia generare al database se vuoto
            });
            toast.success("Cantiere ospite creato con successo");
            setFormOpen(false);
            loadSites();
            // Vai al dettaglio del cantiere appena creato
            router.push(`/guest-sites/${created.id}`);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Errore durante il salvataggio");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSite = async () => {
        if (!deleteSite) return;
        try {
            setDeleting(true);
            await guestSitesApi.delete(deleteSite.id);
            toast.success("Cantiere ospite eliminato");
            setDeleteSite(null);
            loadSites();
        } catch (e: any) {
            console.error(e);
            toast.error("Errore durante l'eliminazione");
        } finally {
            setDeleting(false);
        }
    };

    const filteredSites = sites.filter((site) => {
        const query = search.toLowerCase();
        return (
            site.name.toLowerCase().includes(query) ||
            site.address.toLowerCase().includes(query) ||
            (site.passcode && site.passcode.toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Cantieri Ospiti</h1>
                        <p className="text-sm text-muted-foreground">
                            Gestisci i portali ad-hoc per i clienti ed ospiti dei cantieri.
                        </p>
                    </div>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuovo Portale Cantiere
                </Button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-lg border">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cerca cantiere, indirizzo o passcode..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Visualizzazione:</span>
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                </div>
            </div>

            {/* Content List/Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-slate-500 font-medium">Caricamento cantieri...</span>
                </div>
            ) : filteredSites.length === 0 ? (
                <Card className="border-dashed py-12 flex flex-col items-center justify-center text-center">
                    <Building2 className="h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="font-semibold text-lg">Nessun cantiere ospite</h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
                        {search ? "Nessun risultato corrisponde alla ricerca corrente." : "Crea un nuovo cantiere ospite per generare un portale di conformità ad-hoc per esterni."}
                    </p>
                    {!search && (
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Crea Primo Portale
                        </Button>
                    )}
                </Card>
            ) : viewMode === "grid" ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSites.map((site) => (
                        <Card
                            key={site.id}
                            className="group hover:shadow-md transition-all border border-slate-200 dark:border-slate-800 flex flex-col cursor-pointer"
                            onClick={() => router.push(`/guest-sites/${site.id}`)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                                            {site.name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-1.5 text-xs text-slate-500">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{site.address}</span>
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-4 flex-1 flex flex-col justify-between gap-4">
                                <div className="space-y-2 text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded border">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Codice Accesso:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{site.passcode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-medium">Creato il:</span>
                                        <span>
                                            {format(new Date(site.createdAt), "dd/MM/yyyy", { locale: it })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs pt-2 border-t mt-auto">
                                    <span className="text-slate-500">Gestisci associazioni e QR Code</span>
                                    <Button variant="ghost" size="sm" className="h-8 p-0 px-2 group-hover:text-primary">
                                        Gestisci <ArrowRight className="ml-1 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-950 rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-xs text-slate-700 dark:text-slate-300 uppercase bg-slate-50 dark:bg-slate-900 border-b">
                                <tr>
                                    <th className="px-6 py-3.5 font-bold">Cantiere</th>
                                    <th className="px-6 py-3.5 font-bold">Indirizzo</th>
                                    <th className="px-6 py-3.5 font-bold">Passcode</th>
                                    <th className="px-6 py-3.5 text-center font-bold">Data Creazione</th>
                                    <th className="px-6 py-3.5 text-right font-bold">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredSites.map((site) => (
                                    <tr
                                        key={site.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                                        onClick={() => router.push(`/guest-sites/${site.id}`)}
                                    >
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                                            {site.name}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate">{site.address}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {site.passcode}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {format(new Date(site.createdAt), "dd MMM yyyy", { locale: it })}
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => router.push(`/guest-sites/${site.id}`)}
                                                    title="Gestisci"
                                                >
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive text-slate-400"
                                                    onClick={() => setDeleteSite(site)}
                                                    title="Elimina"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Creation Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleCreateSite}>
                        <DialogHeader>
                            <DialogTitle>Nuovo Portale Cantiere</DialogTitle>
                            <DialogDescription>
                                Inserisci le informazioni per creare un portale ospite. Verrà generato automaticamente un link e un codice passcode per l'accesso.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Cantiere / Cliente *</Label>
                                <Input
                                    id="name"
                                    placeholder="Es. Ospedale Niguarda - Blocco B"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Indirizzo Cantiere *</Label>
                                <Input
                                    id="address"
                                    placeholder="Es. Piazza Ospedale Maggiore, 3 - Milano"
                                    value={siteAddress}
                                    onChange={(e) => setSiteAddress(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="passcode" className="flex items-center gap-1.5">
                                    Codice di Accesso (Passcode) <span className="text-[10px] text-muted-foreground">(opzionale)</span>
                                </Label>
                                <Input
                                    id="passcode"
                                    placeholder="Lascia vuoto per generare automaticamente (es. OPI-XXXXXX)"
                                    value={sitePasscode}
                                    onChange={(e) => setSitePasscode(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                                Annulla
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...
                                    </>
                                ) : (
                                    "Crea Portale"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete */}
            <ConfirmDeleteDialog
                open={!!deleteSite}
                onOpenChange={(open) => !open && setDeleteSite(null)}
                onConfirm={handleDeleteSite}
                title="Elimina cantiere ospite"
                description={`Sei sicuro di voler eliminare il portale cantiere "${deleteSite?.name}"? Tutti i collegamenti alle commesse e i codici di accesso verranno eliminati permanentemente.`}
                loading={deleting}
            />
        </div>
    );
}

export default function GuestSitesPage() {
    return (
        <DashboardLayout>
            <Suspense fallback={
                <div className="min-h-[400px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }>
                <GuestSitesContent />
            </Suspense>
        </DashboardLayout>
    );
}
