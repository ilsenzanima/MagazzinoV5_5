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
                                            onChange={(e) => setPasscode(e.target.value)}
                                            autoComplete="off"
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

    const renderJobDocuments = (job: any) => (
        <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800 shadow-sm">
            {/* Intestazione commessa */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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

                {/* Griglia delle Categorie Documenti */}
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Categoria 1: Documenti Personalizzati */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Documenti Cantiere</h5>
                        </div>
                        {job.documents.custom.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">Nessun documento inserito.</p>
                        ) : (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {job.documents.custom.map((doc: any) => (
                                    <a
                                        key={doc.id}
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer"
                                    >
                                        <div className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                                                {doc.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">{doc.typeName}</span>
                                            {doc.notes && <span className="text-[10px] text-slate-400 block italic mt-0.5 line-clamp-1">{doc.notes}</span>}
                                        </div>
                                        <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Categoria 2: Documenti Associati */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Certificati Conformità</h5>
                        </div>
                        {job.documents.associated.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">Nessun certificato associato.</p>
                        ) : (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {job.documents.associated.map((doc: any) => (
                                    <a
                                        key={doc.id}
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer"
                                    >
                                        <div className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                                                {doc.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">{doc.supplierName} · {doc.typeName}</span>
                                            {doc.notes && <span className="text-[10px] text-slate-400 block italic mt-0.5 line-clamp-1">{doc.notes}</span>}
                                        </div>
                                        <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Categoria 3: Documenti DDT/Bolle */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1.5 border-b">
                            <Truck className="h-4 w-4 text-amber-600 shrink-0" />
                            <h5 className="font-bold text-xs uppercase text-slate-400 tracking-wider">DDT e Bolle Consegna</h5>
                        </div>
                        {(job.documents.ddt.length === 0 && job.documents.internalNotes.length === 0) ? (
                            <p className="text-xs text-slate-400 italic py-2">Nessun DDT presente.</p>
                        ) : (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {/* Documenti DDT allegati da acquisti fornitori */}
                                {job.documents.ddt.map((doc: any) => (
                                    <a
                                        key={doc.id}
                                        href={doc.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer"
                                    >
                                        <div className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                                                {doc.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">{doc.supplierName} · {doc.typeName}</span>
                                            {doc.notes && <span className="text-[10px] text-slate-400 block italic mt-0.5 line-clamp-1">{doc.notes}</span>}
                                        </div>
                                        <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                    </a>
                                ))}

                                {/* Bolle interne OPI */}
                                {job.documents.internalNotes.map((note: any) => (
                                    <div
                                        key={note.id}
                                        onClick={() => handleDownloadInternalNote(note)}
                                        className="p-2 border rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-start gap-2 border text-xs group cursor-pointer"
                                    >
                                        <div className="mt-0.5 shrink-0 text-primary"><FileText className="h-5 w-5" /></div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary break-all line-clamp-2">
                                                DDT OPI {note.number}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                                                Data: {format(new Date(note.date), "dd/MM/yyyy")} · Causale: {note.causal}
                                            </span>
                                            <span className="text-[10px] text-slate-450 block italic mt-0.5 line-clamp-1">
                                                Articoli inclusi: {note.items.length} voci
                                            </span>
                                        </div>
                                        <div className="shrink-0 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

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
