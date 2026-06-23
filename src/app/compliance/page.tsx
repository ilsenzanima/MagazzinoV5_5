"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    Plus,
    Loader2,
    FileText,
    Trash2,
    Pencil,
    ExternalLink,
    Search,
    Upload,
    ShieldCheck,
    Receipt,
    X,
} from "lucide-react";
import { suppliersApi } from "@/lib/services/suppliers";
import { brandsApi } from "@/lib/services/inventory";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";
import { PageSizeSelector } from "@/components/ui/page-size-selector";
import { usePageSize } from "@/hooks/usePageSize";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { toast } from "sonner";
import {
    complianceApi,
    ComplianceDocument,
} from "@/lib/services/compliance";
import { complianceDocumentTypesApi, ComplianceDocumentTypeConfig } from "@/lib/services/compliance-document-types";
import { Supplier, Brand } from "@/lib/types";

const UNTYPED_KEY = "__untyped__";

function formatFileSize(bytes: number | null): string {
    if (bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Purchase search combobox ──────────────────────────────────────────────────

function PurchaseSearchCombobox({
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

// ── Document form dialog ──────────────────────────────────────────────────────

interface DocFormData {
    brandId: string;
    documentTypeId: string;
    name: string;
    notes: string;
    purchaseId: string;
    purchaseNumber: string;
    file: File | null;
}

function DocumentFormDialog({
    open,
    onOpenChange,
    supplierId,
    brands,
    docTypes,
    editing,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supplierId: string;
    brands: Brand[];
    docTypes: ComplianceDocumentTypeConfig[];
    editing: ComplianceDocument;
    onSaved: (doc: ComplianceDocument) => void;
}) {
    const [form, setForm] = useState<DocFormData>({
        brandId: "",
        documentTypeId: "",
        name: "",
        notes: "",
        purchaseId: "",
        purchaseNumber: "",
        file: null,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && editing) {
            setForm({
                brandId: editing.brandId,
                documentTypeId: editing.documentTypeId || "",
                name: editing.name,
                notes: editing.notes || "",
                purchaseId: editing.purchaseId || "",
                purchaseNumber: editing.purchaseNumber || "",
                file: null,
            });
            setError("");
        }
    }, [open, editing]);

    const handleSave = async () => {
        if (!form.brandId || !form.name.trim()) {
            setError("Marca e nome sono obbligatori.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            let fileUrl = editing.fileUrl;
            let fileSize = editing.fileSize;
            if (form.file) {
                fileUrl = await complianceApi.uploadFile(form.file);
                fileSize = form.file.size;
            }
            const doc = await complianceApi.update(editing.id, {
                brandId: form.brandId,
                documentTypeId: form.documentTypeId || null,
                name: form.name.trim(),
                notes: form.notes.trim(),
                fileUrl,
                fileSize,
                purchaseId: form.purchaseId || null,
            });
            onSaved(doc);
            onOpenChange(false);
        } catch (e: any) {
            setError(e.message || "Errore durante il salvataggio.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Modifica documento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Marca <span className="text-destructive">*</span></Label>
                            <Select value={form.brandId} onValueChange={(v) => setForm(f => ({ ...f, brandId: v }))}>
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
                            <Select value={form.documentTypeId} onValueChange={(v) => setForm(f => ({ ...f, documentTypeId: v }))}>
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
                    <div className="space-y-1.5">
                        <Label>Nome documento <span className="text-destructive">*</span></Label>
                        <Input
                            placeholder="Es. DOP Geberit 2024"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Note</Label>
                        <Textarea
                            placeholder="Note aggiuntive..."
                            rows={3}
                            className="resize-none break-words"
                            value={form.notes}
                            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Associa a acquisto (opzionale)</Label>
                        <PurchaseSearchCombobox
                            supplierId={supplierId}
                            value={form.purchaseId}
                            onChange={(id, num) => setForm(f => ({ ...f, purchaseId: id, purchaseNumber: num }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Sostituisci file (opzionale)</Label>
                        <div
                            className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            {form.file ? (
                                <p className="text-sm font-medium">{form.file.name}</p>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <Upload className="h-6 w-6" />
                                    <p className="text-sm">Clicca per selezionare un file PDF</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.PDF,image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setForm(prev => ({ ...prev, file: f }));
                            }}
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salva modifiche
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Multi-upload wizard ──────────────────────────────────────────────────────

interface PendingComplianceFile {
    file: File;
    name: string;
    notes: string;
}

function MultiUploadDialog({
    open,
    onOpenChange,
    supplierId,
    suppliers,
    brands,
    docTypes,
    onUploaded,
    onSupplierSelected,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supplierId: string;
    suppliers: Supplier[];
    brands: Brand[];
    docTypes: ComplianceDocumentTypeConfig[];
    onUploaded: (docs: ComplianceDocument[]) => void;
    onSupplierSelected: (id: string) => void;
}) {
    const [step, setStep] = useState<1 | 2>(1);
    const [localSupplierId, setLocalSupplierId] = useState(supplierId);
    const [brandId, setBrandId] = useState("");
    const [documentTypeId, setDocumentTypeId] = useState("");
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
            setPendingFiles([]);
            setDragOver(false);
        }
    }, [open, supplierId]);

    const effectiveSupplierId = localSupplierId;

    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const newPending: PendingComplianceFile[] = Array.from(files).map((f) => ({
            file: f,
            name: f.name.replace(/\.[^.]+$/, ''),
            notes: "",
        }));
        setPendingFiles((prev) => [...prev, ...newPending]);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
    };

    const goToStep2 = () => {
        if (!effectiveSupplierId || !brandId || pendingFiles.length === 0) return;
        setStep(2);
    };

    const updatePending = (idx: number, patch: Partial<PendingComplianceFile>) => {
        setPendingFiles((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    };

    const removePending = (idx: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0) return;
        try {
            setUploading(true);
            const uploaded: ComplianceDocument[] = [];
            for (const pf of pendingFiles) {
                const fileUrl = await complianceApi.uploadFile(pf.file);
                const doc = await complianceApi.create({
                    supplierId: effectiveSupplierId,
                    brandId,
                    documentTypeId: documentTypeId || null,
                    name: pf.name.trim() || pf.file.name,
                    notes: pf.notes.trim() || undefined,
                    fileUrl,
                    fileSize: pf.file.size,
                });
                uploaded.push(doc);
            }
            if (!supplierId) onSupplierSelected(effectiveSupplierId);
            onUploaded(uploaded);
            toast.success(uploaded.length > 1 ? "Documenti caricati" : "Documento caricato");
            onOpenChange(false);
        } catch (e: any) {
            toast.error(e.message || "Errore durante il caricamento");
        } finally {
            setUploading(false);
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
                        {!supplierId && (
                            <div className="space-y-1.5">
                                <Label>Fornitore <span className="text-destructive">*</span></Label>
                                <Select value={localSupplierId} onValueChange={setLocalSupplierId}>
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
                                <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
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
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removePending(idx)}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                                <p className="text-xs text-muted-foreground truncate pr-6">{pf.file.name}</p>
                                <div className="space-y-1">
                                    <Label className="text-xs">Nome documento</Label>
                                    <Input value={pf.name} onChange={(e) => updatePending(idx, { name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Nota (opzionale)</Label>
                                    <Input value={pf.notes} onChange={(e) => updatePending(idx, { notes: e.target.value })} placeholder="Breve descrizione" />
                                </div>
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

// ── Document card ─────────────────────────────────────────────────────────────

function DocumentCard({
    doc,
    onEdit,
    onDelete,
}: {
    doc: ComplianceDocument;
    onEdit: (doc: ComplianceDocument) => void;
    onDelete: (doc: ComplianceDocument) => void;
}) {
    const supabase = createClient();

    const openDocument = async () => {
        try {
            const path = doc.fileUrl.split('/public/documents/')[1];
            if (!path) { window.open(doc.fileUrl, '_blank'); return; }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
            if (error || !data?.signedUrl) { window.open(doc.fileUrl, '_blank'); return; }
            window.open(data.signedUrl, '_blank');
        } catch {
            window.open(doc.fileUrl, '_blank');
        }
    };

    return (
        <Card className="group">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 shrink-0 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{doc.name}</span>
                                {doc.brandName && (
                                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full shrink-0">
                                        {doc.brandName}
                                    </span>
                                )}
                            </div>
                            {doc.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.notes}</p>
                            )}
                            {doc.purchaseNumber && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Acquisto: <span className="font-medium">{doc.purchaseNumber}</span>
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(doc.createdAt).toLocaleDateString("it-IT")}
                                {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={openDocument} title="Apri PDF">
                            <FileText className="h-4 w-4" />
                        </Button>
                        {doc.purchaseId && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" asChild title="Vai all'acquisto">
                                <a href={`/purchases/${doc.purchaseId}`} target="_blank" rel="noopener noreferrer">
                                    <Receipt className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(doc)} title="Modifica">
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(doc)} title="Elimina">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Document list row ─────────────────────────────────────────────────────────

function DocumentRow({
    doc,
    onEdit,
    onDelete,
}: {
    doc: ComplianceDocument;
    onEdit: (doc: ComplianceDocument) => void;
    onDelete: (doc: ComplianceDocument) => void;
}) {
    const supabase = createClient();

    const openDocument = async () => {
        try {
            const path = doc.fileUrl.split('/public/documents/')[1];
            if (!path) { window.open(doc.fileUrl, '_blank'); return; }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
            if (error || !data?.signedUrl) { window.open(doc.fileUrl, '_blank'); return; }
            window.open(data.signedUrl, '_blank');
        } catch {
            window.open(doc.fileUrl, '_blank');
        }
    };

    return (
        <div className="flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card hover:bg-accent/30 transition-colors">
            <div className="shrink-0 mt-0.5 h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-medium text-sm">{doc.name}</span>
                    {doc.brandName && (
                        <span className="text-xs text-muted-foreground">{doc.brandName}</span>
                    )}
                    {doc.purchaseNumber && (
                        <span className="text-xs text-muted-foreground">Acquisto: <span className="font-medium">{doc.purchaseNumber}</span></span>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString("it-IT")}</span>
                    {doc.fileSize != null && <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>}
                </div>
                {doc.notes && (
                    <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">{doc.notes}</p>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={openDocument} title="Apri PDF">
                    <FileText className="h-3.5 w-3.5" />
                </Button>
                {doc.purchaseId && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-600" asChild title="Vai all'acquisto">
                        <a href={`/purchases/${doc.purchaseId}`} target="_blank" rel="noopener noreferrer">
                            <Receipt className="h-3.5 w-3.5" />
                        </a>
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(doc)} title="Modifica">
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(doc)} title="Elimina">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ── Document type tabs content ────────────────────────────────────────────────

function DocumentTypeTabs({
    docs,
    docTypes,
    viewMode,
    pageSize,
    onEdit,
    onDelete,
}: {
    docs: ComplianceDocument[];
    docTypes: ComplianceDocumentTypeConfig[];
    viewMode: 'grid' | 'list';
    pageSize: number;
    onEdit: (doc: ComplianceDocument) => void;
    onDelete: (doc: ComplianceDocument) => void;
}) {
    const groups = [
        ...docTypes.map(t => ({ key: t.id, label: t.name, docs: docs.filter(d => d.documentTypeId === t.id) })),
        { key: UNTYPED_KEY, label: "Senza tipo", docs: docs.filter(d => !d.documentTypeId) },
    ].filter(g => g.docs.length > 0);
    const [pages, setPages] = useState<Record<string, number>>({});

    const getPage = (key: string) => pages[key] ?? 1;
    const setPage = (key: string, p: number) => setPages(prev => ({ ...prev, [key]: p }));

    return (
        <Tabs defaultValue={groups[0]?.key} onValueChange={() => {}}>
            <TabsList className="flex-wrap h-auto gap-1">
                {groups.map(({ key, label, docs: groupDocs }) => (
                    <TabsTrigger key={key} value={key}>
                        {label}
                        <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                            {groupDocs.length}
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>
            {groups.map(({ key, docs: typeDocs }) => {
                const currentPage = getPage(key);
                const totalPages = Math.ceil(typeDocs.length / pageSize);
                const paginated = typeDocs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                return (
                    <TabsContent key={key} value={key}>
                        <div className="pt-4 space-y-3">
                            {viewMode === 'grid' ? (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {paginated.map((doc) => (
                                        <DocumentCard key={doc.id} doc={doc} onEdit={onEdit} onDelete={onDelete} />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {paginated.map((doc) => (
                                        <DocumentRow key={doc.id} doc={doc} onEdit={onEdit} onDelete={onDelete} />
                                    ))}
                                </div>
                            )}
                            {totalPages > 1 && (
                                <PaginationControls
                                    page={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={(p) => setPage(key, p)}
                                />
                            )}
                        </div>
                    </TabsContent>
                );
            })}
        </Tabs>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompliancePage() {
    const { userRole } = useAuth();
    const router = useRouter();
    const [viewMode, setViewMode] = useViewMode('compliance');
    const [pageSize, setPageSize] = usePageSize('compliance');

    useEffect(() => {
        if (userRole && userRole !== "admin" && userRole !== "operativo") {
            router.replace("/dashboard");
        }
    }, [userRole, router]);

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [docTypes, setDocTypes] = useState<ComplianceDocumentTypeConfig[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
    const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
    const [search, setSearch] = useState("");
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
    const [deletingDoc, setDeletingDoc] = useState<ComplianceDocument | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        suppliersApi.getAll().then(setSuppliers).catch(console.error);
        brandsApi.getAll().then(setBrands).catch(console.error);
        complianceDocumentTypesApi.getAll().then(setDocTypes).catch(console.error);
    }, []);

    useEffect(() => {
        if (!selectedSupplierId) {
            setDocuments([]);
            return;
        }
        setLoadingDocs(true);
        complianceApi.getBySupplier(selectedSupplierId)
            .then(setDocuments)
            .catch(console.error)
            .finally(() => setLoadingDocs(false));
    }, [selectedSupplierId]);

    const handleSaved = (doc: ComplianceDocument) => {
        setDocuments(prev => {
            const idx = prev.findIndex(d => d.id === doc.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = doc;
                return next;
            }
            return [doc, ...prev];
        });
    };

    const handleUploaded = (docs: ComplianceDocument[]) => {
        setDocuments(prev => [...docs, ...prev]);
    };

    const filteredDocuments = search.trim()
        ? documents.filter(d => d.name.toLowerCase().includes(search.trim().toLowerCase()))
        : documents;

    const handleDelete = async () => {
        if (!deletingDoc) return;
        setDeleting(true);
        try {
            await complianceApi.delete(deletingDoc.id);
            setDocuments(prev => prev.filter(d => d.id !== deletingDoc.id));
            setDeletingDoc(null);
            toast.success("Documento eliminato");
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : "Errore durante l'eliminazione del documento");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        <div>
                            <h1 className="text-2xl font-bold">Gestione conformità</h1>
                            <p className="text-sm text-muted-foreground">Documenti di conformità per fornitore</p>
                        </div>
                    </div>
                    <Button onClick={() => setUploadOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Carica documento
                    </Button>
                </div>

                {/* Supplier selector */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="max-w-sm flex-1 space-y-1.5">
                                <Label className="text-sm font-medium">Seleziona fornitore</Label>
                                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Scegli un fornitore..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedSupplierId && (
                                <div className="max-w-sm flex-1 space-y-1.5">
                                    <Label className="text-sm font-medium">Cerca documento</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            className="pl-9"
                                            placeholder="Cerca per nome..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Documents area */}
                {selectedSupplierId && (
                    <>
                        {loadingDocs ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : documents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                                <FileText className="h-10 w-10 opacity-30" />
                                <p className="text-sm">Nessun documento caricato per questo fornitore.</p>
                                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Carica il primo documento
                                </Button>
                            </div>
                        ) : filteredDocuments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                                <Search className="h-10 w-10 opacity-30" />
                                <p className="text-sm">Nessun documento trovato per &quot;{search}&quot;.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-end gap-2">
                                    <PageSizeSelector value={pageSize} onChange={setPageSize} />
                                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                                </div>
                                <DocumentTypeTabs
                                    docs={filteredDocuments}
                                    docTypes={docTypes}
                                    viewMode={viewMode}
                                    pageSize={pageSize}
                                    onEdit={(doc) => { setEditingDoc(doc); setDialogOpen(true); }}
                                    onDelete={setDeletingDoc}
                                />
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Multi upload dialog */}
            <MultiUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                supplierId={selectedSupplierId}
                suppliers={suppliers}
                brands={brands}
                docTypes={docTypes}
                onUploaded={handleUploaded}
                onSupplierSelected={setSelectedSupplierId}
            />

            {/* Edit dialog */}
            {editingDoc && (
                <DocumentFormDialog
                    open={dialogOpen}
                    onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingDoc(null); }}
                    supplierId={selectedSupplierId}
                    brands={brands}
                    docTypes={docTypes}
                    editing={editingDoc}
                    onSaved={handleSaved}
                />
            )}

            {/* Delete confirm */}
            <AlertDialog open={!!deletingDoc} onOpenChange={(v) => !v && setDeletingDoc(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Elimina documento</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sei sicuro di voler eliminare <strong>{deletingDoc?.name}</strong>?
                            Questa azione non può essere annullata.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Elimina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
}
