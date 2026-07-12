"use client";

import { useState, useEffect, use, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Loader2,
    Lock,
    Building2,
    Calendar,
    FileText,
    Download,
    ExternalLink,
    AlertCircle,
    Truck,
    ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { getFileIcon, formatFileSize } from "@/lib/file-icon";
import { PhotoGallery, PhotoGalleryImage, isImageFileType } from "@/components/ui/photo-gallery";

interface Props {
    params: Promise<{ id: string }>;
}

function GuestPortalContent({ params }: Props) {
    const { id: siteId } = use(params);
    const searchParams = useSearchParams();

    const [passcode, setPasscode] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [siteData, setSiteData] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [activeJobId, setActiveJobId] = useState<string>("");

    // Galleria foto: elenco immagini della cartella corrente + indice attivo
    const [galleryImages, setGalleryImages] = useState<PhotoGalleryImage[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [galleryOpen, setGalleryOpen] = useState(false);

    const openGallery = (images: PhotoGalleryImage[], startIndex: number) => {
        setGalleryImages(images);
        setGalleryIndex(startIndex);
        setGalleryOpen(true);
    };

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    useEffect(() => {
        // Priorità 1: codice passato via QR/link diretto (?code=...)
        const codeFromUrl = searchParams.get("code");
        if (codeFromUrl) {
            setPasscode(codeFromUrl);
            verifyAndLoad(codeFromUrl);
            // Ripulisce l'URL per non lasciare il passcode visibile nella barra indirizzi/cronologia
            window.history.replaceState({}, "", `/cantiere-ospite/${siteId}`);
            return;
        }

        // Priorità 2: passcode già salvato in sessionStorage per questo cantiere
        const savedPasscode = sessionStorage.getItem(`opi_guest_passcode_${siteId}`);
        if (savedPasscode) {
            setPasscode(savedPasscode);
            verifyAndLoad(savedPasscode);
        } else {
            setCheckingAuth(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteId]);

    const verifyAndLoad = async (codeToVerify: string) => {
        setLoadingData(true);
        try {
            const response = await fetch("/api/guest/compliance-site", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteId, passcode: codeToVerify }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Codice di accesso non valido");
            }

            setSiteData(result.site);
            setJobs(result.jobs);
            setActiveJobId(result.jobs?.[0]?.jobId || "");
            setIsAuthenticated(true);
            sessionStorage.setItem(`opi_guest_passcode_${siteId}`, codeToVerify);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Errore durante la verifica del codice");
            sessionStorage.removeItem(`opi_guest_passcode_${siteId}`);
            setIsAuthenticated(false);
        } finally {
            setLoadingData(false);
            setCheckingAuth(false);
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const code = passcode.trim();
        if (!code) {
            toast.error("Inserisci il codice di accesso");
            return;
        }
        verifyAndLoad(code);
    };

    // Funzione per generare al volo il PDF istituzionale per le bolle interne
    const handleDownloadInternalNote = async (note: any) => {
        try {
            const { generateDeliveryNotePdfBlob } = await import("@/lib/pdf/delivery-note-pdf");

            // Ricrea il formato dati atteso dal generatore PDF
            const noteData = {
                id: note.id,
                number: note.number,
                date: note.date,
                type: note.type,
                causal: note.causal,
                pickupLocation: note.pickupLocation,
                deliveryLocation: note.deliveryLocation,
                notes: note.notes,
            };

            const itemsData = note.items.map((item: any) => ({
                id: item.id,
                quantity: item.quantity,
                pieces: item.pieces,
                coefficient: item.coefficient,
                inventoryName: item.name,
                inventoryModel: item.model,
                inventoryCode: item.code,
                inventoryUnit: item.unit,
            }));

            const blob = await generateDeliveryNotePdfBlob(noteData as any, itemsData);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
        } catch (error) {
            console.error("Failed to generate PDF", error);
            toast.error("Errore nella generazione del PDF della bolla");
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mt-2 text-sm text-slate-500">Verifica in corso...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        // Schermata di Login
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 font-sans">
                <div className="w-full max-w-md space-y-6">
                    {/* Brand Logo Header */}
                    <div className="flex flex-col items-center gap-3 mb-2">
                        <div className="bg-white rounded-xl px-6 py-3 shadow-md shadow-primary/10 border border-slate-100">
                            <Image src="/logo_header.png" alt="OPI Firesafe" width={220} height={49} className="h-10 w-auto" priority />
                        </div>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Accesso Portale Conformità</span>
                    </div>

                    <Card className="border-slate-200/80 dark:border-slate-800 shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg text-center">Inserisci codice di accesso</CardTitle>
                            <CardDescription className="text-center text-xs">
                                Digita la password alfanumerica fornita per consultare i documenti di questo cantiere.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="passcode-input" className="sr-only">Codice di accesso (Passcode)</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="passcode-input"
                                            className="pl-9 font-mono text-center tracking-widest text-lg font-bold uppercase"
                                            placeholder="OPI-XXXXXX"
                                            value={passcode}
                                            onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                                            autoComplete="off"
                                            autoCapitalize="characters"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={loadingData}>
                                    {loadingData ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifica in corso
                                        </>
                                    ) : (
                                        "Accedi al Portale"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <p className="text-center text-[10px] text-slate-400">
                        In caso di problemi di accesso, contatta il referente del cantiere OPI Firesafe S.r.l.
                    </p>
                </div>
            </div>
        );
    }

    const renderDocLink = (doc: any, images?: PhotoGalleryImage[], imageIndex?: number) => {
        const asImage = images && imageIndex !== undefined;
        const content = (
            <>
                <div className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</div>
                <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                        {doc.name}
                    </span>
                    {doc.notes && <span className="text-[10px] text-slate-400 block italic mt-0.5 line-clamp-1">{doc.notes}</span>}
                </div>
                <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="h-3.5 w-3.5" />
                </div>
            </>
        );
        const className = "p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer w-full text-left";
        if (asImage) {
            return (
                <button key={doc.id} onClick={() => openGallery(images!, imageIndex!)} className={className}>
                    {content}
                </button>
            );
        }
        return (
            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={className}>
                {content}
            </a>
        );
    };

    const renderJobDocuments = (job: any) => {
        const customGroups: any[] = job.documents.custom || [];

        // Certificati Conformità: raggruppati per tipo di conformità, e come sottocartella per fornitore
        const conformitaByType = new Map<string, { typeName: string; bySupplier: Map<string, any[]> }>();
        for (const doc of job.documents.associated) {
            const typeKey = doc.typeName || "Generico";
            if (!conformitaByType.has(typeKey)) conformitaByType.set(typeKey, { typeName: typeKey, bySupplier: new Map() });
            const typeGroup = conformitaByType.get(typeKey)!;
            const supplierKey = doc.supplierName || "Sconosciuto";
            if (!typeGroup.bySupplier.has(supplierKey)) typeGroup.bySupplier.set(supplierKey, []);
            typeGroup.bySupplier.get(supplierKey)!.push(doc);
        }
        const conformitaGroups = Array.from(conformitaByType.values());

        // DDT e Bolle Consegna: raggruppati per fornitore (le bolle interne sotto "OPI")
        const ddtBySupplier = new Map<string, { kind: "doc" | "note"; item: any }[]>();
        for (const doc of job.documents.ddt) {
            const key = doc.supplierName || "Sconosciuto";
            if (!ddtBySupplier.has(key)) ddtBySupplier.set(key, []);
            ddtBySupplier.get(key)!.push({ kind: "doc", item: doc });
        }
        for (const note of job.documents.internalNotes) {
            if (!ddtBySupplier.has("OPI")) ddtBySupplier.set("OPI", []);
            ddtBySupplier.get("OPI")!.push({ kind: "note", item: note });
        }
        const ddtGroups = Array.from(ddtBySupplier.entries()).map(([supplierName, items]) => ({ supplierName, items }));

        const macroSections = [
            {
                id: `macro-custom-${job.jobId}`,
                label: "Documenti Cantiere",
                icon: FileText,
                iconColor: "text-primary",
                items: customGroups.map((g: any) => ({
                    id: `custom-${job.jobId}-${g.typeId || "untyped"}`,
                    label: g.typeName,
                    count: g.folders.reduce((sum: number, f: any) => sum + f.documents.length, 0),
                })),
            },
            {
                id: `macro-associated-${job.jobId}`,
                label: "Certificati Conformità",
                icon: ShieldCheck,
                iconColor: "text-emerald-600",
                items: conformitaGroups.map((g) => ({
                    id: `associated-${job.jobId}-${g.typeName}`,
                    label: g.typeName,
                    count: Array.from(g.bySupplier.values()).reduce((sum, arr) => sum + arr.length, 0),
                })),
            },
            {
                id: `macro-ddt-${job.jobId}`,
                label: "DDT e Bolle Consegna",
                icon: Truck,
                iconColor: "text-amber-600",
                items: ddtGroups.map((g) => ({
                    id: `ddt-${job.jobId}-${g.supplierName}`,
                    label: g.supplierName,
                    count: g.items.length,
                })),
            },
        ];

        return (
            <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm">
                {/* Intestazione commessa */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-t-xl p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {job.code}
                            </span>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {job.name || job.description}
                            </h4>
                        </div>
                        {job.description && job.name && job.description !== job.name && (
                            <p className="text-xs text-slate-500 mt-1">{job.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                                Periodo: {job.startDate ? format(new Date(job.startDate), "dd/MM/yyyy") : "N/D"} - {job.endDate ? format(new Date(job.endDate), "dd/MM/yyyy") : "N/D"}
                            </span>
                        </div>
                    </div>
                </div>

                <CardContent className="p-5 space-y-4">
                    {/* Note ad-hoc */}
                    {job.customNotes && (
                        <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 p-3.5 rounded-lg">
                            <span className="text-[9px] text-blue-500 dark:text-blue-400 font-extrabold uppercase tracking-wide">Commento informativo della direzione cantiere</span>
                            <p className="text-sm text-blue-900 dark:text-blue-300 mt-1 whitespace-pre-wrap font-medium leading-relaxed italic">
                                &ldquo;{job.customNotes}&rdquo;
                            </p>
                        </div>
                    )}

                    {/* Layout a due colonne: indice a sinistra (sempre visibile), contenuto a capitoli a destra */}
                    <div className="grid gap-6 md:grid-cols-[220px_1fr] items-start">
                        {/* Indice a macro-categorie */}
                        <nav className="hidden md:block sticky top-4 space-y-3 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
                            {macroSections.map((macro) => (
                                <div key={macro.id}>
                                    <button
                                        onClick={() => scrollToSection(macro.id)}
                                        className="w-full text-left px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-primary transition-colors flex items-center gap-1.5"
                                    >
                                        <macro.icon className={`h-3.5 w-3.5 shrink-0 ${macro.iconColor}`} />
                                        <span className="truncate">{macro.label}</span>
                                    </button>
                                    <div className="mt-0.5 space-y-0.5">
                                        {macro.items.map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => scrollToSection(s.id)}
                                                className="w-full text-left pl-6 pr-2 py-1 rounded text-xs font-medium text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-between gap-2"
                                            >
                                                <span className="truncate">{s.label}</span>
                                                <span className="text-[10px] text-slate-400 shrink-0">{s.count}</span>
                                            </button>
                                        ))}
                                        {macro.items.length === 0 && (
                                            <p className="pl-6 pr-2 py-1 text-[11px] text-slate-300 italic">Vuoto</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </nav>

                        {/* Contenuto a capitoli, in un unico elenco continuo, raggruppato per macro-categoria */}
                        <div className="space-y-10 min-w-0">
                            {/* Macro-categoria: Documenti Cantiere */}
                            <div id={`macro-custom-${job.jobId}`} className="space-y-6 scroll-mt-4">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" /> Documenti Cantiere
                                </h3>
                                {customGroups.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2 pl-1">Nessun documento inserito.</p>
                                ) : customGroups.map((g: any) => (
                                    <div key={g.typeId || "untyped"} id={`custom-${job.jobId}-${g.typeId || "untyped"}`} className="space-y-3 scroll-mt-4 pl-1">
                                        <div className="flex items-center gap-2 pb-1.5 border-b">
                                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">{g.typeName}</h5>
                                        </div>
                                        <div className="space-y-4">
                                            {g.folders.map((f: any) => {
                                                const imagesInFolder: PhotoGalleryImage[] = f.documents
                                                    .filter((d: any) => isImageFileType(d.fileType))
                                                    .map((d: any) => ({ url: d.fileUrl, name: d.name }));
                                                return (
                                                    <div key={f.folderId || "root"} className="space-y-2">
                                                        {f.folderName && (
                                                            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                                                                📁 {f.folderName}
                                                            </p>
                                                        )}
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {f.documents.map((doc: any) => {
                                                                const isImg = isImageFileType(doc.fileType);
                                                                const imgIndex = isImg ? imagesInFolder.findIndex(im => im.url === doc.fileUrl) : undefined;
                                                                return renderDocLink(doc, isImg ? imagesInFolder : undefined, imgIndex);
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Macro-categoria: Certificati Conformità (tipo -> fornitore) */}
                            <div id={`macro-associated-${job.jobId}`} className="space-y-6 scroll-mt-4">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Certificati Conformità
                                </h3>
                                {conformitaGroups.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2 pl-1">Nessun certificato associato.</p>
                                ) : conformitaGroups.map((g) => (
                                    <div key={g.typeName} id={`associated-${job.jobId}-${g.typeName}`} className="space-y-3 scroll-mt-4 pl-1">
                                        <div className="flex items-center gap-2 pb-1.5 border-b">
                                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">{g.typeName}</h5>
                                        </div>
                                        <div className="space-y-4">
                                            {Array.from(g.bySupplier.entries()).map(([supplierName, docs]: [string, any[]]) => (
                                                <div key={supplierName} className="space-y-2">
                                                    <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                                                        📁 {supplierName}
                                                    </p>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {docs.map((doc: any) => renderDocLink(doc))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Macro-categoria: DDT e Bolle Consegna (per fornitore, OPI per le bolle interne) */}
                            <div id={`macro-ddt-${job.jobId}`} className="space-y-6 scroll-mt-4">
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-amber-600" /> DDT e Bolle Consegna
                                </h3>
                                {ddtGroups.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2 pl-1">Nessun DDT presente.</p>
                                ) : ddtGroups.map((g) => (
                                    <div key={g.supplierName} id={`ddt-${job.jobId}-${g.supplierName}`} className="space-y-3 scroll-mt-4 pl-1">
                                        <div className="flex items-center gap-2 pb-1.5 border-b">
                                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">{g.supplierName}</h5>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {g.items.map(({ kind, item }) =>
                                                kind === "doc" ? (
                                                    renderDocLink(item)
                                                ) : (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleDownloadInternalNote(item)}
                                                        className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer"
                                                    >
                                                        <div className="mt-0.5 shrink-0 text-primary"><FileText className="h-5 w-5" /></div>
                                                        <div className="min-w-0 flex-1">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                                                                DDT {item.number} DEL {format(new Date(item.date), "dd/MM/yyyy")}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                                                                Causale: {item.causal}
                                                            </span>
                                                            <span className="text-[10px] text-slate-450 block italic mt-0.5 line-clamp-1">
                                                                Articoli inclusi: {item.items.length} voci
                                                            </span>
                                                        </div>
                                                        <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Portale Cantiere Ospite (Autenticato)
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-12">
            {/* Header istituzionale stile DDT OPI Firesafe */}
            <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 shadow-sm py-5">
                <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col items-center md:items-start gap-1.5">
                        <Image src="/logo_header.png" alt="OPI Firesafe" width={180} height={40} className="h-8 w-auto" priority />
                        <p className="text-[10px] text-slate-400 font-medium">
                            Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)
                        </p>
                        <p className="text-[9px] text-slate-400">
                            Tel. 0432-1901608 - email: amministrazione@opifiresafe.com
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                sessionStorage.removeItem(`opi_guest_passcode_${siteId}`);
                                setIsAuthenticated(false);
                            }}
                        >
                            Esci dal portale
                        </Button>
                    </div>
                </div>
            </header>

            {/* Dettaglio Cantiere Ospite */}
            <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
                {/* Box Informazioni Cantiere */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex items-start gap-3.5">
                            <div className="bg-primary/5 p-3 rounded-lg text-primary shrink-0 border border-primary/10">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cantiere consultazione ospiti</span>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 truncate">{siteData.name}</h2>
                                <p className="text-sm text-slate-500 mt-1">{siteData.address}</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Accesso Autorizzato
                        </div>
                    </div>
                </div>

                {/* Sezione Commesse */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white px-1">Storico Lavorazioni & Certificazioni</h3>

                    {jobs.length === 0 ? (
                        <div className="bg-white dark:bg-slate-950 border border-dashed rounded-lg p-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                            <AlertCircle className="h-8 w-8 opacity-30 text-slate-500" />
                            <p className="font-semibold text-slate-700 dark:text-slate-300">Nessuna lavorazione collegata</p>
                            <p className="text-xs text-slate-400">Non sono ancora presenti documenti o commesse associate a questo cantiere.</p>
                        </div>
                    ) : jobs.length === 1 ? (
                        renderJobDocuments(jobs[0])
                    ) : (
                        <Tabs value={activeJobId} onValueChange={setActiveJobId} className="space-y-4">
                            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0">
                                {jobs.map((job) => (
                                    <TabsTrigger
                                        key={job.jobId}
                                        value={job.jobId}
                                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border rounded-md px-3 py-1.5 text-xs font-semibold"
                                    >
                                        {job.code} · {job.name || job.description || "Senza nome"}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {jobs.map((job) => (
                                <TabsContent key={job.jobId} value={job.jobId} className="mt-0">
                                    {renderJobDocuments(job)}
                                </TabsContent>
                            ))}
                        </Tabs>
                    )}
                </div>
            </main>

            {galleryOpen && (
                <PhotoGallery
                    images={galleryImages}
                    index={galleryIndex}
                    onIndexChange={setGalleryIndex}
                    onClose={() => setGalleryOpen(false)}
                />
            )}
        </div>
    );
}

export default function GuestPortalPage({ params }: Props) {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <GuestPortalContent params={params} />
        </Suspense>
    );
}
