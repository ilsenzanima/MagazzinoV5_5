"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect, useMemo, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Plus,
    Loader2,
    Trash2,
    Building2,
    Copy,
    Link as LinkIcon,
    ExternalLink,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { guestSitesApi, MIN_PASSCODE_LENGTH } from "@/lib/services/guest-sites";
import { GuestSite } from "@/lib/types";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const PAGE_SIZE = 50;

type SortKey = "name" | "address" | "date";
type Check = "all" | "nojobs";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

const portalUrl = (siteId: string) => `${window.location.origin}/cantiere-ospite/${siteId}`;

function JobBadges({ codes }: { codes: string[] }) {
    if (codes.length === 0) {
        return <span className="text-xs font-medium text-amber-600">Nessuna commessa</span>;
    }
    const shown = codes.slice(0, 2);
    const more = codes.length - shown.length;
    return (
        <div className="flex flex-wrap gap-1">
            {shown.map((c) => (
                <span key={c} className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{c}</span>
            ))}
            {more > 0 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800" title={codes.slice(2).join(", ")}>+{more}</span>
            )}
        </div>
    );
}

function GuestSitesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userRole } = useAuth();
    const [sites, setSites] = useState<GuestSite[]>([]);
    const [jobCodes, setJobCodes] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [check, setCheck] = useState<Check>(searchParams.get("controllo") === "nojobs" ? "nojobs" : "all");
    const [sortKey, setSortKey] = useState<SortKey>((["name", "address", "date"].includes(searchParams.get("sort") || "") ? searchParams.get("sort") : "date") as SortKey);
    const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : searchParams.get("dir") === "desc" ? "desc" : "desc");
    const [page, setPage] = useState(Math.max(1, parseInt(searchParams.get("page") || "1") || 1));

    // L'indirizzo segue ricerca, controllo, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (check !== "all") params.set("controllo", check);
        if (sortKey !== "date") params.set("sort", sortKey);
        if (sortDir !== "desc") params.set("dir", sortDir);
        if (page !== 1) params.set("page", String(page));
        const query = params.toString();
        router.replace(query ? `/guest-sites?${query}` : "/guest-sites", { scroll: false });
    }, [search, check, sortKey, sortDir, page, router]);

    // Creazione
    const [formOpen, setFormOpen] = useState(false);
    const [siteName, setSiteName] = useState("");
    const [siteAddress, setSiteAddress] = useState("");
    const [sitePasscode, setSitePasscode] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Eliminazione
    const [deleteSite, setDeleteSite] = useState<GuestSite | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadSites = async () => {
        try {
            setLoading(true);
            setLoadError(null);
            const [data, codes] = await Promise.all([guestSitesApi.getAll(), guestSitesApi.getJobCodesBySite()]);
            setSites(data);
            setJobCodes(codes);
        } catch (e: any) {
            console.error(e);
            setLoadError(e.message || "Errore nel caricamento dei cantieri ospiti");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userRole) return;
        if (userRole !== "admin" && userRole !== "operativo") {
            router.replace("/dashboard");
            return;
        }
        loadSites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userRole]);

    const noJobsCount = sites.filter((s) => !(jobCodes[s.id]?.length)).length;

    const filtered = useMemo(() => {
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const list = sites.filter((s) => {
            const codes = jobCodes[s.id] || [];
            if (check === "nojobs" && codes.length > 0) return false;
            if (words.length === 0) return true;
            const hay = [s.name, s.address, s.passcode, ...codes].join(" ").toLowerCase();
            return words.every((w) => hay.includes(w));
        });
        const dir = sortDir === "asc" ? 1 : -1;
        return [...list].sort((a, b) => {
            let r: number;
            if (sortKey === "name") r = a.name.localeCompare(b.name, "it");
            else if (sortKey === "address") r = a.address.localeCompare(b.address, "it");
            else r = a.createdAt.localeCompare(b.createdAt);
            return r * dir;
        });
    }, [sites, jobCodes, search, check, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
        setPage(1);
    };

    const anyFilterActive = !!(search || check !== "all");
    const resetFilters = () => { setSearch(""); setCheck("all"); setPage(1); };

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
        if (passcode && passcode.length < MIN_PASSCODE_LENGTH) {
            toast.error(`Il codice di accesso deve avere almeno ${MIN_PASSCODE_LENGTH} caratteri`);
            return;
        }

        try {
            setSubmitting(true);
            const created = await guestSitesApi.create({
                name,
                address,
                passcode: passcode || undefined, // vuoto: lo genera il servizio
            });
            toast.success("Cantiere ospite creato con successo");
            setFormOpen(false);
            // Si passa subito al dettaglio per collegare le commesse
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
            setSites((prev) => prev.filter((s) => s.id !== deleteSite.id));
            toast.success("Cantiere ospite eliminato");
            setDeleteSite(null);
        } catch (e: any) {
            console.error(e);
            toast.error("Errore durante l'eliminazione");
        } finally {
            setDeleting(false);
        }
    };

    const copy = (text: string, message: string) => {
        navigator.clipboard.writeText(text).then(
            () => toast.success(message),
            () => toast.error("Copia non riuscita")
        );
    };

    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );

    const checkSelect = (cls: string) => (
        <Select value={check} onValueChange={(v) => { setCheck(v as Check); setPage(1); }}>
            <SelectTrigger aria-label="Da sistemare" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i cantieri</SelectItem>
                <SelectItem value="nojobs">Da sistemare: senza commesse ({noJobsCount})</SelectItem>
            </SelectContent>
        </Select>
    );

    const rowActions = (site: GuestSite) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7" title="Copia il link del portale" aria-label="Copia il link del portale" onClick={() => copy(portalUrl(site.id), "Link copiato negli appunti")}>
                <LinkIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7" title="Apri il portale" aria-label="Apri il portale" onClick={() => window.open(portalUrl(site.id), "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7 text-slate-400 hover:bg-destructive/10 hover:text-destructive" title="Elimina" aria-label="Elimina" onClick={() => setDeleteSite(site)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );

    const passcodeCell = (site: GuestSite) => (
        <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">{site.passcode}</span>
            <button type="button" aria-label="Copia il codice" title="Copia il codice" className="text-slate-400 hover:text-slate-900" onClick={() => copy(site.passcode, "Codice copiato")}>
                <Copy className="h-3.5 w-3.5" />
            </button>
        </span>
    );

    return (
        <>
            <ListPageHeader
                strip
                title="Cantieri ospiti"
                actions={
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto md:hidden" onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuovo portale
                    </Button>
                }
                search={{ id: "guest-sites-search", label: "Cerca cantieri", value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Cerca per cantiere, indirizzo, codice o commessa..." }}
                searchActions={
                    <>
                        {checkSelect("hidden w-56 shrink-0 border-none bg-slate-100 dark:bg-muted md:flex md:rounded-full md:bg-white md:dark:bg-white md:text-slate-800")}
                        {anyFilterActive && (
                            <Button variant="ghost" className="shrink-0 text-xs text-slate-600 md:text-slate-200 md:hover:bg-slate-700 md:hover:text-white" onClick={resetFilters}>
                                Azzera filtri
                            </Button>
                        )}
                    </>
                }
            >
                {/* Telefono: filtro */}
                <div className="md:hidden">{checkSelect("")}</div>
            </ListPageHeader>

            {loading && sites.length === 0 ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <p className="max-w-md text-sm text-red-600">{loadError}</p>
                    <Button variant="outline" onClick={loadSites}>Riprova</Button>
                </div>
            ) : (
                <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                    {/* Tabella: da tablet in su */}
                    <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={headCls}>{sortBtn("name", "Cantiere")}</TableHead>
                                    <TableHead className={`w-1/4 ${headCls}`}>{sortBtn("address", "Indirizzo")}</TableHead>
                                    <TableHead className={`w-52 ${headCls}`}>Commesse collegate</TableHead>
                                    <TableHead className={`w-44 ${headCls}`}>Codice di accesso</TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Creato il")}</TableHead>
                                    <TableHead className="w-32" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                            <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                            {sites.length === 0 ? "Nessun cantiere ospite: creane uno con il pulsante +" : "Nessun cantiere trovato"}
                                        </TableCell>
                                    </TableRow>
                                ) : rows.map((site) => (
                                    <TableRow key={site.id} className="cursor-pointer" onClick={() => router.push(`/guest-sites/${site.id}`)}>
                                        <TableCell className="border-r py-2">
                                            <span className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white" title={site.name}>{site.name}</span>
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            <span className="line-clamp-2" title={site.address}>{site.address}</span>
                                        </TableCell>
                                        <TableCell className="border-r py-2"><JobBadges codes={jobCodes[site.id] || []} /></TableCell>
                                        <TableCell className="border-r py-2">{passcodeCell(site)}</TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            {format(new Date(site.createdAt), "dd/MM/yyyy", { locale: it })}
                                        </TableCell>
                                        <TableCell className="py-2">{rowActions(site)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Schede: telefono */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
                        {rows.length === 0 ? (
                            <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                                <Building2 className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                <p>{sites.length === 0 ? "Nessun cantiere ospite" : "Nessun cantiere trovato"}</p>
                            </div>
                        ) : rows.map((site) => (
                            <Card key={site.id} className="cursor-pointer border-slate-200 dark:border-slate-700" onClick={() => router.push(`/guest-sites/${site.id}`)}>
                                <CardContent className="space-y-2 p-3">
                                    <div>
                                        <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">{site.name}</p>
                                        <p className="text-xs text-slate-500">{site.address}</p>
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Commesse</span><JobBadges codes={jobCodes[site.id] || []} /></div>
                                        <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Codice</span>{passcodeCell(site)}</div>
                                        <div className="flex justify-between gap-3"><span className="text-slate-500">Creato il</span><span className="font-medium">{format(new Date(site.createdAt), "dd/MM/yyyy", { locale: it })}</span></div>
                                    </div>
                                    {rowActions(site)}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <PaginationControls
                        page={currentPage}
                        totalPages={totalPages}
                        loading={loading}
                        onPageChange={setPage}
                        totalItems={filtered.length}
                        itemLabel="cantieri"
                    />
                </div>
            )}

            {/* Pulsante «nuovo» sempre visibile (PC) */}
            <FloatingAddButton onClick={openCreateDialog} label="Nuovo portale" />

            {/* Creazione */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-w-md">
                    <form onSubmit={handleCreateSite}>
                        <DialogHeader>
                            <DialogTitle>Nuovo portale cantiere</DialogTitle>
                            <DialogDescription>
                                Verranno creati un link e un codice di accesso. Dopo il salvataggio potrai collegare le commesse da mostrare all&apos;ospite.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome cantiere / cliente *</Label>
                                <Input
                                    id="name"
                                    placeholder="Es. Ospedale Niguarda - Blocco B"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Indirizzo cantiere *</Label>
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
                                    Codice di accesso <span className="text-[10px] text-muted-foreground">(opzionale, minimo {MIN_PASSCODE_LENGTH} caratteri)</span>
                                </Label>
                                <Input
                                    id="passcode"
                                    placeholder="Lascia vuoto per generarlo (es. OPI-XXXXXXXX)"
                                    value={sitePasscode}
                                    onChange={(e) => setSitePasscode(e.target.value)}
                                    autoComplete="off"
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
                                    "Crea portale"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Conferma eliminazione */}
            <ConfirmDeleteDialog
                open={!!deleteSite}
                onOpenChange={(open) => !open && setDeleteSite(null)}
                onConfirm={handleDeleteSite}
                title="Elimina cantiere ospite"
                description={`Il portale "${deleteSite?.name}" smetterà di funzionare subito: link, QR code e codice di accesso non daranno più accesso. I documenti e le commesse non vengono toccati.`}
                loading={deleting}
            />
        </>
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
