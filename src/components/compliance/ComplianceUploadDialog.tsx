"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { complianceApi, ComplianceDocument } from "@/lib/services/compliance";
import { ComplianceDocumentTypeConfig } from "@/lib/services/compliance-document-types";
import { Supplier, Brand } from "@/lib/types";
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload";
import { UploadStatusBar } from "@/components/ui/upload-status-row";

// Il tipo con cui si caricano i documenti che il produttore rilascia per un DDT preciso
const isProducerConformity = (t?: ComplianceDocumentTypeConfig) => !!t && /conformit.*produttore/i.test(t.name);

// ── Purchase search combobox ──────────────────────────────────────────────────

export function PurchaseSearchCombobox({
    supplierId,
    value,
    onChange,
}: {
    supplierId: string;
    value: string;
    onChange: (id: string, number: string) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<{ id: string; delivery_note_number: string; delivery_note_date: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [displayValue, setDisplayValue] = useState(value ? `BDL ${value}` : "");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!value) setDisplayValue("");
    }, [value]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (!supplierId) return;
        setLoading(true);
        try {
            const data = await complianceApi.searchPurchasesBySupplier(supplierId, q);
            setResults(data);
            setOpen(true);
        } finally {
            setLoading(false);
        }
    }, [supplierId]);

    return (
        <div className="relative" ref={ref}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    className="pl-9"
                    placeholder="Cerca per numero bolla/ordine..."
                    value={displayValue}
                    onChange={(e) => {
                        setDisplayValue(e.target.value);
                        setSearch(e.target.value);
                        if (e.target.value.length >= 1) doSearch(e.target.value);
                        else { setOpen(false); onChange("", ""); }
                    }}
                    onFocus={() => { if (supplierId) doSearch(search); }}
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {open && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
                    {results.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => {
                                onChange(p.id, p.delivery_note_number);
                                setDisplayValue(p.delivery_note_number);
                                setOpen(false);
                            }}
                        >
                            <span className="font-medium">{p.delivery_note_number}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                                {p.delivery_note_date ? new Date(p.delivery_note_date).toLocaleDateString("it-IT") : ""}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {open && results.length === 0 && !loading && (
                <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
                    Nessun acquisto trovato
                </div>
            )}
            {value && (
                <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { onChange("", ""); setDisplayValue(""); setSearch(""); }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

// ── Multi-upload wizard ──────────────────────────────────────────────────────

interface PendingComplianceFile {
    file: File;
    name: string;
    notes: string;
}

export function ComplianceUploadDialog({
    open,
    onOpenChange,
    supplierId,
    suppliers,
    brands,
    docTypes,
    onUploaded,
    fixedPurchase,
    initialFiles,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supplierId: string;
    suppliers: Supplier[];
    brands: Brand[];
    docTypes: ComplianceDocumentTypeConfig[];
    onUploaded: (docs: ComplianceDocument[]) => void;
    // Aperto dalla pagina di un acquisto: fornitore e bolla sono già noti e il documento è sempre specifico di quel DDT
    fixedPurchase?: { id: string; number?: string };
    initialFiles?: File[];
}) {
    const [step, setStep] = useState<1 | 2>(1);
    const [localSupplierId, setLocalSupplierId] = useState(supplierId);
    const [brandId, setBrandId] = useState("");
    const [documentTypeId, setDocumentTypeId] = useState("");
    // Variante "conformità produttore": il documento può essere la prova di una bolla di acquisto precisa
    const [linkToPurchase, setLinkToPurchase] = useState(false);
    const [linkedPurchaseId, setLinkedPurchaseId] = useState("");
    const [pendingFiles, setPendingFiles] = useState<PendingComplianceFile[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setStep(1);
            setLocalSupplierId(supplierId);
            setBrandId("");
            setDocumentTypeId("");
            setLinkToPurchase(false);
            setLinkedPurchaseId("");
            setPendingFiles((initialFiles ?? []).map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, ''), notes: "" })));
            setDragOver(false);
            batchUpload.reset();
        }
    }, [open, supplierId]);

    const effectiveSupplierId = localSupplierId;
    const producerType = isProducerConformity(docTypes.find(t => t.id === documentTypeId));
    const linked = !!fixedPurchase || (producerType && linkToPurchase);
    const purchaseIdToLink = fixedPurchase ? fixedPurchase.id : linkedPurchaseId;

    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setPendingFiles((prev) => {
            const room = MAX_BATCH_UPLOAD_FILES - prev.length;
            if (room <= 0) {
                toast.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`);
                return prev;
            }
            const selected = Array.from(files);
            if (selected.length > room) toast.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`);
            const newPending: PendingComplianceFile[] = selected.slice(0, room).map((f) => ({
                file: f,
                name: f.name.replace(/\.[^.]+$/, ''),
                notes: "",
            }));
            return [...prev, ...newPending];
        });
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    const goToStep2 = () => {
        if (!documentTypeId) {
            toast.error("Selezionare il tipo di documento.");
            return;
        }
        if (!effectiveSupplierId || pendingFiles.length === 0) return;
        if (linked && !purchaseIdToLink) {
            toast.error("Cerca e seleziona la bolla di acquisto a cui è collegato.");
            return;
        }
        if (!brandId) {
            toast.error("Selezionare la marca.");
            return;
        }
        setStep(2);
    };

    const updatePending = (idx: number, patch: Partial<PendingComplianceFile>) => {
        setPendingFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    };

    const removePending = (idx: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const batchUpload = useBatchUpload();

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0) return;
        setUploading(true);
        const supplierName = suppliers.find(s => s.id === effectiveSupplierId)?.name || effectiveSupplierId;
        const uploaded: ComplianceDocument[] = [];
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pf => {
            const result = await complianceApi.uploadFile(pf.file, supplierName, linked);
            const doc = await complianceApi.create({
                supplierId: effectiveSupplierId,
                brandId,
                documentTypeId: documentTypeId || null,
                name: pf.name.trim() || pf.file.name,
                notes: pf.notes.trim() || undefined,
                fileUrl: result.fileId,
                fileSize: pf.file.size,
                purchaseId: linked ? purchaseIdToLink : undefined,
                documentScope: linked ? "ddt_specific" : "reusable",
            });
            uploaded.push(doc);
        });
        setUploading(false);
        if (uploaded.length > 0) {
            onUploaded(uploaded);
        }
        if (failedCount === 0) {
            toast.success(okCount > 1 ? "Documenti caricati" : "Documento caricato");
            onOpenChange(false);
        } else if (okCount === 0) {
            toast.error("Nessun documento caricato, riprova");
        } else {
            toast.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`);
            setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Carica documenti</DialogTitle>
                </DialogHeader>
                {step === 1 ? (
                    <div className="space-y-4 py-2">
                        {(
                            <div className="space-y-1.5">
                                <Label>Fornitore <span className="text-destructive">*</span></Label>
                                <Select value={localSupplierId} disabled={!!fixedPurchase} onValueChange={(v) => { setLocalSupplierId(v); setLinkedPurchaseId(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona fornitore" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Marca <span className="text-destructive">*</span></Label>
                                <Select value={brandId} onValueChange={setBrandId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona marca" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {brands.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tipo documento</Label>
                                <Select value={documentTypeId} onValueChange={(v) => { setDocumentTypeId(v); setLinkToPurchase(false); setLinkedPurchaseId(""); }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {docTypes.map((t) => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {fixedPurchase && (
                            <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                                Il documento sarà collegato alla bolla{fixedPurchase.number ? <> <span className="font-medium text-foreground">{fixedPurchase.number}</span></> : ""}: specifico di quel DDT, non riutilizzabile altrove.
                            </p>
                        )}
                        {producerType && !fixedPurchase && (
                            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                                <label className="flex cursor-pointer items-start gap-2 text-sm">
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={linkToPurchase}
                                        onCheckedChange={(c) => { setLinkToPurchase(!!c); if (!c) setLinkedPurchaseId(""); }}
                                    />
                                    <span>
                                        Collegato a una bolla di acquisto
                                        <span className="block text-xs text-muted-foreground">
                                            Prova rilasciata dal produttore per quella bolla: si vedrà anche nella pagina dell&apos;acquisto e non sarà riutilizzabile altrove.
                                        </span>
                                    </span>
                                </label>
                                {linkToPurchase && (
                                    effectiveSupplierId ? (
                                        <PurchaseSearchCombobox
                                            key={effectiveSupplierId}
                                            supplierId={effectiveSupplierId}
                                            value={linkedPurchaseId}
                                            onChange={(id) => setLinkedPurchaseId(id)}
                                        />
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Scegli prima il fornitore per cercare la bolla.</p>
                                    )
                                )}
                                {linkToPurchase && <p className="text-xs text-muted-foreground">La bolla scelta vale per tutti i file di questo caricamento.</p>}
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label>File (puoi selezionarne più di uno, anche con drag&drop)</Label>
                            <div
                                className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'bg-primary/5 border-primary' : 'hover:border-primary'}`}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.PDF,image/*"
                                    className="hidden"
                                    onChange={(e) => handleFilesSelected(e.target.files)}
                                />
                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {pendingFiles.length > 0 ? `${pendingFiles.length} file selezionati` : "Clicca o trascina qui i file"}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        <p className="text-xs text-muted-foreground">Per ogni file inserisci nome e nota (opzionale).</p>
                        {pendingFiles.map((pf, idx) => (
                            <div key={idx} className="border rounded-lg p-3 space-y-2 relative">
                                <Button variant="ghost" size="icon" disabled={batchUpload.statuses[idx]?.status === 'uploading'} className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removePending(idx)}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                                <p className="text-xs text-muted-foreground truncate pr-6">{pf.file.name}</p>
                                <div className="space-y-1">
                                    <Label className="text-xs">Nome documento</Label>
                                    <Input value={pf.name} disabled={batchUpload.statuses[idx]?.status === 'uploading'} onChange={(e) => updatePending(idx, { name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Nota (opzionale)</Label>
                                    <Input value={pf.notes} disabled={batchUpload.statuses[idx]?.status === 'uploading'} onChange={(e) => updatePending(idx, { notes: e.target.value })} placeholder="Breve descrizione" />
                                </div>
                                <UploadStatusBar state={batchUpload.statuses[idx]} />
                            </div>
                        ))}
                        {pendingFiles.length === 0 && (
                            <p className="text-sm text-muted-foreground italic text-center py-4">Nessun file selezionato.</p>
                        )}
                    </div>
                )}
                <DialogFooter>
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                            <Button onClick={goToStep2} disabled={!effectiveSupplierId || !brandId || pendingFiles.length === 0}>Continua</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>Indietro</Button>
                            <Button onClick={handleUploadAll} disabled={uploading || pendingFiles.length === 0}>
                                {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Carica {pendingFiles.length > 1 ? `(${pendingFiles.length})` : ""}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

