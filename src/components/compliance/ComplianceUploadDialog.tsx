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
import { Supplier } from "@/lib/types";
import { useBatchUpload } from "@/hooks/useBatchUpload";
import { DocumentUploadDialog, usePendingFiles } from "@/components/documents/DocumentUploadDialog";

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

// ── Caricamento documenti (modale unica) ─────────────────────────────────────

export function ComplianceUploadDialog({
    open,
    onOpenChange,
    supplierId,
    suppliers,
    docTypes,
    onUploaded,
    fixedPurchase,
    initialFiles,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supplierId: string;
    suppliers: Supplier[];
    docTypes: ComplianceDocumentTypeConfig[];
    onUploaded: (docs: ComplianceDocument[]) => void;
    // Aperto dalla pagina di un acquisto: fornitore e bolla sono già noti e il documento è sempre specifico di quel DDT
    fixedPurchase?: { id: string; number?: string };
    initialFiles?: File[];
}) {
    const [localSupplierId, setLocalSupplierId] = useState(supplierId);
    const [documentTypeId, setDocumentTypeId] = useState("");
    // Variante "conformità produttore": il documento può essere la prova di una bolla di acquisto precisa
    const [linkToPurchase, setLinkToPurchase] = useState(false);
    const [linkedPurchaseId, setLinkedPurchaseId] = useState("");
    const { files: pendingFiles, setFiles: setPendingFiles, add: addFiles, update: updatePending, remove: removePending } = usePendingFiles();
    const [uploading, setUploading] = useState(false);
    const batchUpload = useBatchUpload();

    useEffect(() => {
        if (open) {
            setLocalSupplierId(supplierId);
            setDocumentTypeId("");
            setLinkToPurchase(false);
            setLinkedPurchaseId("");
            setPendingFiles((initialFiles ?? []).map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, ''), notes: "", isOld: false, isRev: false })));
            batchUpload.reset();
        }
    }, [open, supplierId]);

    const effectiveSupplierId = localSupplierId;
    const producerType = isProducerConformity(docTypes.find(t => t.id === documentTypeId));
    const linked = !!fixedPurchase || (producerType && linkToPurchase);
    const purchaseIdToLink = fixedPurchase ? fixedPurchase.id : linkedPurchaseId;

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0) return;
        if (!documentTypeId) { toast.error("Selezionare il tipo di documento."); return; }
        if (!effectiveSupplierId) { toast.error("Selezionare il fornitore."); return; }
        if (linked && !purchaseIdToLink) {
            toast.error("Cerca e seleziona la bolla di acquisto a cui è collegato.");
            return;
        }
        setUploading(true);
        const supplierName = suppliers.find(s => s.id === effectiveSupplierId)?.name || effectiveSupplierId;
        const uploaded: ComplianceDocument[] = [];
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pf => {
            const result = await complianceApi.uploadFile(pf.file, supplierName, linked);
            const doc = await complianceApi.create({
                supplierId: effectiveSupplierId,
                brandId: null,
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

    const topSlot = (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Fornitore <span className="text-destructive">*</span></Label>
                    <Select value={localSupplierId} disabled={!!fixedPurchase || uploading} onValueChange={(v) => { setLocalSupplierId(v); setLinkedPurchaseId(""); }}>
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
                <div className="space-y-1.5">
                    <Label>Tipo documento</Label>
                    <Select value={documentTypeId} disabled={uploading} onValueChange={(v) => { setDocumentTypeId(v); setLinkToPurchase(false); setLinkedPurchaseId(""); }}>
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
        </div>
    );

    return (
        <DocumentUploadDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Carica documenti"
            topSlot={topSlot}
            accept=".pdf,.PDF,image/*"
            files={pendingFiles}
            onAddFiles={addFiles}
            onUpdateFile={updatePending}
            onRemoveFile={removePending}
            statuses={batchUpload.statuses}
            uploading={uploading}
            onSubmit={handleUploadAll}
            showOldRev={false}
            submitDisabled={!effectiveSupplierId}
        />
    );
}
