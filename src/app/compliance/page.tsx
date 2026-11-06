"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
} from "lucide-react";
import { suppliersApi } from "@/lib/services/suppliers";
import { supplierGroupsApi } from "@/lib/services/supplier-groups";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { toast } from "sonner";
import {
    complianceApi,
    ComplianceDocument,
} from "@/lib/services/compliance";
import { complianceDocumentTypesApi, ComplianceDocumentTypeConfig } from "@/lib/services/compliance-document-types";
import { Supplier } from "@/lib/types";
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload";
import { UploadStatusBar } from "@/components/ui/upload-status-row";
import { ComplianceUploadDialog, PurchaseSearchCombobox } from "@/components/compliance/ComplianceUploadDialog";

// ── Document form dialog ──────────────────────────────────────────────────────

interface DocFormData {
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
    suppliers,
    docTypes,
    editing,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    supplierId: string;
    suppliers: Supplier[];
    docTypes: ComplianceDocumentTypeConfig[];
    editing: ComplianceDocument;
    onSaved: (doc: ComplianceDocument) => void;
}) {
    const [form, setForm] = useState<DocFormData>({
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
        if (!form.name.trim()) {
            setError("Il nome è obbligatorio.");
            return;
        }
        if (!form.documentTypeId) {
            setError("Il tipo di documento è obbligatorio.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            let fileUrl = editing.fileUrl;
            let fileSize = editing.fileSize;
            if (form.file) {
                const supplierName = suppliers.find(s => s.id === supplierId)?.name || supplierId;
                const uploaded = await complianceApi.uploadFile(form.file, supplierName, editing.documentScope === "ddt_specific");
                fileUrl = uploaded.fileId;
                fileSize = form.file.size;
            }
            const doc = await complianceApi.update(editing.id, {
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

// ── Apertura documento ────────────────────────────────────────────────────────

async function openComplianceDocument(doc: ComplianceDocument) {
    if (!doc.fileUrl.includes('/')) {
        window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&fileName=${encodeURIComponent(doc.name)}`, '_blank');
        return;
    }
    try {
        const path = doc.fileUrl.split('/public/documents/')[1];
        if (!path) { window.open(doc.fileUrl, '_blank'); return; }
        const { data, error } = await createClient().storage.from('documents').createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) { window.open(doc.fileUrl, '_blank'); return; }
        window.open(data.signedUrl, '_blank');
    } catch {
        window.open(doc.fileUrl, '_blank');
    }
}

// ── Pulsanti di riga ──────────────────────────────────────────────────────────

// Nota modificabile direttamente dalla tabella: clic per scrivere, Invio o clic fuori per salvare, Esc per annullare
function NoteCell({ doc, onSaved }: { doc: ComplianceDocument; onSaved: (doc: ComplianceDocument) => void }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(doc.notes || "");
    const [saving, setSaving] = useState(false);
    const done = useRef(false);

    const start = (e: React.MouseEvent) => {
        e.stopPropagation();
        done.current = false;
        setValue(doc.notes || "");
        setEditing(true);
    };

    const save = async () => {
        if (done.current) return;
        done.current = true;
        const next = value.trim();
        if (next === (doc.notes || "")) { setEditing(false); return; }
        setSaving(true);
        try {
            const updated = await complianceApi.update(doc.id, { notes: next });
            onSaved(updated);
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : "Errore durante il salvataggio della nota");
        } finally {
            setSaving(false);
            setEditing(false);
        }
    };

    if (editing) {
        return (
            <Textarea
                autoFocus
                rows={3}
                value={value}
                disabled={saving}
                className="resize-none break-words text-xs"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
                    if (e.key === "Escape") { done.current = true; setEditing(false); }
                }}
            />
        );
    }
    return (
        <button type="button" onClick={start} title="Clicca per modificare la nota" className="group block w-full rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
            {doc.notes
                ? <span className="line-clamp-3 whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{doc.notes}</span>
                : <span className="text-slate-300 group-hover:text-slate-500">Aggiungi nota</span>}
        </button>
    );
}

function RowActions({
    doc,
    onEdit,
    onDelete,
}: {
    doc: ComplianceDocument;
    onEdit: (doc: ComplianceDocument) => void;
    onDelete: (doc: ComplianceDocument) => void;
}) {
    return (
        <div className="flex items-center justify-end gap-0.5">
            {doc.purchaseId && (
                <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7 text-blue-500 hover:text-blue-600" asChild title="Vai all'acquisto">
                    <a href={`/purchases/${doc.purchaseId}`} target="_blank" rel="noopener noreferrer" aria-label="Vai all'acquisto" onClick={(e) => e.stopPropagation()}>
                        <Receipt className="h-3.5 w-3.5" />
                    </a>
                </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7" onClick={(e) => { e.stopPropagation(); onEdit(doc); }} title="Modifica" aria-label="Modifica">
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 md:size-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(doc); }} title="Elimina" aria-label="Elimina">
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
    if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
type SortKey = "name" | "type" | "supplier" | "date";
type Check = "all" | "notype";

function ComplianceContent() {
    const { userRole } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (userRole && userRole !== "admin" && userRole !== "operativo") {
            router.replace("/dashboard");
        }
    }, [userRole, router]);

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [docTypes, setDocTypes] = useState<ComplianceDocumentTypeConfig[]>([]);
    const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [supplierId, setSupplierId] = useState(searchParams.get("fornitore") || searchParams.get("supplier") || "");
    const [typeId, setTypeId] = useState(searchParams.get("tipo") || "");
    const [check, setCheck] = useState<Check>((searchParams.get("controllo") as Check) || "all");
    const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) || "date");
    const [sortDir, setSortDir] = useState<"asc" | "desc">(searchParams.get("dir") === "asc" ? "asc" : "desc");
    const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
    const [deletingDoc, setDeletingDoc] = useState<ComplianceDocument | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadDocuments = () => {
        setLoadingDocs(true);
        setLoadError(null);
        complianceApi.getAllDocuments()
            .then(setDocuments)
            .catch((e) => { console.error(e); setLoadError(e.message || "Errore durante il caricamento dei documenti"); })
            .finally(() => setLoadingDocs(false));
    };

    useEffect(() => {
        Promise.all([suppliersApi.getAll(), supplierGroupsApi.getHiddenFromPurchasesIds()])
            .then(([allSuppliers, hiddenIds]) => setSuppliers(allSuppliers.filter(s => !hiddenIds.includes(s.id))))
            .catch(console.error);
        complianceDocumentTypesApi.getAll().then(setDocTypes).catch(console.error);
        loadDocuments();
    }, []);

    // L'indirizzo segue filtri, ordinamento e pagina: indietro/avanti del browser ritrovano la stessa vista
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set("q", search);
        if (supplierId) params.set("fornitore", supplierId);
        if (typeId) params.set("tipo", typeId);
        if (check !== "all") params.set("controllo", check);
        if (sortKey !== "date") params.set("sort", sortKey);
        if (sortDir !== "desc") params.set("dir", sortDir);
        if (page !== 1) params.set("page", String(page));
        const query = params.toString();
        router.replace(query ? `/compliance?${query}` : "/compliance", { scroll: false });
    }, [search, supplierId, typeId, check, sortKey, sortDir, page, router]);

    const supplierName = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const nameOf = (d: ComplianceDocument) => supplierName.get(d.supplierId) || "";

    // Controlli: documenti a cui manca il tipo
    const noTypeCount = documents.filter(d => !d.documentTypeId).length;

    const filtered = useMemo(() => {
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const list = documents.filter(d => {
            if (supplierId && d.supplierId !== supplierId) return false;
            if (typeId === "none" ? !!d.documentTypeId : typeId && d.documentTypeId !== typeId) return false;
            if (check === "notype" && d.documentTypeId) return false;
            if (words.length === 0) return true;
            const hay = [d.name, d.notes, d.documentTypeName, d.purchaseNumber, supplierName.get(d.supplierId)]
                .join(" ").toLowerCase();
            return words.every(w => hay.includes(w));
        });
        const dir = sortDir === "asc" ? 1 : -1;
        const byDate = (a: ComplianceDocument, b: ComplianceDocument) => a.createdAt.localeCompare(b.createdAt);
        return [...list].sort((a, b) => {
            let r: number;
            if (sortKey === "name") r = a.name.localeCompare(b.name, "it");
            else if (sortKey === "type") r = (a.documentTypeName || "~").localeCompare(b.documentTypeName || "~", "it") || -byDate(a, b);
            else if (sortKey === "supplier") r = nameOf(a).localeCompare(nameOf(b), "it") || -byDate(a, b);
            else r = byDate(a, b);
            return r * dir;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documents, search, supplierId, typeId, check, sortKey, sortDir, supplierName]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
        else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
        setPage(1);
    };
    const change = (setter: (v: string) => void) => (v: string) => { setter(v === "all" ? "" : v); setPage(1); };

    const anyFilterActive = !!(search || supplierId || typeId || check !== "all");
    const resetFilters = () => { setSearch(""); setSupplierId(""); setTypeId(""); setCheck("all"); setPage(1); };

    const handleSaved = (doc: ComplianceDocument) => {
        setDocuments(prev => prev.map(d => (d.id === doc.id ? doc : d)));
    };

    const handleUploaded = (docs: ComplianceDocument[]) => {
        setDocuments(prev => [...docs, ...prev]);
    };

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

    const supplierOptions = [{ value: "all", label: "Tutti i fornitori" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))];
    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600";
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            <SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    );
    const selectCls = "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase";

    const typeSelect = (cls?: string) => (
        <Select value={typeId || "all"} onValueChange={change(setTypeId)}>
            <SelectTrigger aria-label="Filtra per tipo" className={cls}><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                <SelectItem value="none">Senza tipo</SelectItem>
            </SelectContent>
        </Select>
    );
    const checkSelect = (
        <Select value={check} onValueChange={(v) => { setCheck(v as Check); setPage(1); }}>
            <SelectTrigger aria-label="Da sistemare" className="hidden w-48 shrink-0 border-none bg-slate-100 dark:bg-muted md:flex md:rounded-full md:bg-white md:dark:bg-white md:text-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i documenti</SelectItem>
                <SelectItem value="notype">Da sistemare: senza tipo ({noTypeCount})</SelectItem>
            </SelectContent>
        </Select>
    );

    const docBadges = (d: ComplianceDocument) =>
        d.documentScope === "ddt_specific" && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30">Specifico DDT</span>
        );

    return (
        <DashboardLayout>
            <ListPageHeader
                strip
                title="Gestione conformità"
                actions={
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto md:hidden" onClick={() => setUploadOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Carica documento
                    </Button>
                }
                search={{ id: "compliance-search", label: "Cerca documenti", value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Cerca per nome, fornitore, bolla, note..." }}
                searchActions={
                    <>
                        {checkSelect}
                        {anyFilterActive && (
                            <Button variant="ghost" className="hidden shrink-0 text-xs text-slate-600 md:inline-flex md:text-slate-200 md:hover:bg-slate-700 md:hover:text-white" onClick={resetFilters}>
                                Azzera filtri
                            </Button>
                        )}
                    </>
                }
            >
                {/* Telefono: filtri */}
                <div className="grid grid-cols-2 gap-2 md:hidden">
                    <SearchableSelect
                        options={supplierOptions}
                        value={supplierId}
                        onValueChange={change(setSupplierId)}
                        placeholder="Fornitore"
                        searchPlaceholder="Scrivi per cercare fornitore..."
                    />
                    {typeSelect()}
                    <Select value={check} onValueChange={(v) => { setCheck(v as Check); setPage(1); }}>
                        <SelectTrigger aria-label="Da sistemare"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti</SelectItem>
                            <SelectItem value="notype">Senza tipo ({noTypeCount})</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </ListPageHeader>

            {loadingDocs && documents.length === 0 ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <p className="max-w-md text-sm text-red-600">{loadError}</p>
                    <Button variant="outline" onClick={loadDocuments}>Riprova</Button>
                </div>
            ) : (
                <div className={loadingDocs ? "opacity-60 transition-opacity" : "transition-opacity"}>
                    {/* Tabella: da tablet in su */}
                    <div className="mb-4 hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={`w-44 ${headCls}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{typeSelect(selectCls)}</div>
                                            <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                                <SortArrow active={sortKey === "type"} dir={sortDir} />
                                            </button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={headCls}>{sortBtn("name", "Documento")}</TableHead>
                                    <TableHead className={`w-52 ${headCls}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">
                                                <SearchableSelect
                                                    options={supplierOptions}
                                                    value={supplierId}
                                                    onValueChange={change(setSupplierId)}
                                                    placeholder="Fornitore"
                                                    searchPlaceholder="Scrivi per cercare fornitore..."
                                                    className={selectCls}
                                                    contentClassName="min-w-[20rem]"
                                                />
                                            </div>
                                            <button type="button" aria-label="Ordina per fornitore" onClick={() => toggleSort("supplier")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                                <SortArrow active={sortKey === "supplier"} dir={sortDir} />
                                            </button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-64 ${headCls}`}>Note</TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>Bolla</TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Data")}</TableHead>
                                    <TableHead className="w-28" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                            <ShieldCheck className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                            Nessun documento trovato
                                        </TableCell>
                                    </TableRow>
                                ) : rows.map((d) => (
                                    <TableRow key={d.id} className="cursor-pointer" onClick={() => openComplianceDocument(d)}>
                                        <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                                            {d.documentTypeName || <span className="font-medium text-amber-600">Senza tipo</span>}
                                        </TableCell>
                                        <TableCell className="border-r py-2">
                                            <div className="flex items-center gap-2">
                                                <span className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white" title={d.name}>{d.name}</span>
                                                {docBadges(d)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            <span className="line-clamp-2" title={nameOf(d)}>{nameOf(d) || <span className="text-slate-300">—</span>}</span>
                                        </TableCell>
                                        <TableCell className="border-r py-1" onClick={(e) => e.stopPropagation()}>
                                            <NoteCell doc={d} onSaved={handleSaved} />
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            {d.purchaseNumber || <span className="text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                                            {format(new Date(d.createdAt), "dd/MM/yyyy", { locale: it })}
                                        </TableCell>
                                        <TableCell className="py-2"><RowActions doc={d} onEdit={(doc) => { setEditingDoc(doc); setDialogOpen(true); }} onDelete={setDeletingDoc} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Schede: telefono */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
                        {rows.length === 0 ? (
                            <div className="col-span-full py-10 text-center text-slate-400 dark:text-slate-500">
                                <ShieldCheck className="mx-auto mb-2 h-12 w-12 opacity-20" />
                                <p>Nessun documento trovato</p>
                            </div>
                        ) : rows.map((d) => (
                            <Card key={d.id} className="border-slate-200 dark:border-slate-700">
                                <CardContent className="space-y-2 p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <button type="button" className="min-w-0 text-left" onClick={() => openComplianceDocument(d)}>
                                            <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">{d.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {d.documentTypeName || "Senza tipo"} · {format(new Date(d.createdAt), "dd/MM/yyyy", { locale: it })}
                                            </p>
                                        </button>
                                        {docBadges(d)}
                                    </div>
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between gap-3"><span className="text-slate-500">Fornitore</span><span className="text-right font-medium">{nameOf(d) || "—"}</span></div>
                                        {d.purchaseNumber && <div className="flex justify-between gap-3"><span className="text-slate-500">Bolla</span><span className="text-right font-medium">{d.purchaseNumber}</span></div>}
                                    </div>
                                    <NoteCell doc={d} onSaved={handleSaved} />
                                    <RowActions doc={d} onEdit={(doc) => { setEditingDoc(doc); setDialogOpen(true); }} onDelete={setDeletingDoc} />
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <PaginationControls
                        page={currentPage}
                        totalPages={totalPages}
                        loading={loadingDocs}
                        onPageChange={setPage}
                        totalItems={filtered.length}
                        itemLabel="documenti"
                    />
                </div>
            )}

            {/* Pulsante «carica» sempre visibile (PC) */}
            <FloatingAddButton onClick={() => setUploadOpen(true)} label="Carica documento" />

            {/* Multi upload dialog */}
            <ComplianceUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                supplierId={supplierId}
                suppliers={suppliers}
                docTypes={docTypes}
                onUploaded={handleUploaded}
            />

            {/* Edit dialog */}
            {editingDoc && (
                <DocumentFormDialog
                    open={dialogOpen}
                    onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingDoc(null); }}
                    supplierId={editingDoc.supplierId}
                    suppliers={suppliers}
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

export default function CompliancePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-slate-500 font-medium">Caricamento conformità...</span>
                </div>
            </div>
        }>
            <ComplianceContent />
        </Suspense>
    );
}
