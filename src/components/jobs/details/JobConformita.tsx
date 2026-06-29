"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Upload,
    Loader2,
    Trash2,
    Link2,
    Unlink,
    Search,
    Pencil,
    ExternalLink,
    ShieldCheck,
    X,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { jobDocumentsApi, JobDocument } from "@/lib/api"
import { jobConformitaDocumentTypesApi, JobConformitaDocumentType } from "@/lib/services/job-conformita-document-types"
import {
    complianceApi,
    jobComplianceApi,
    JobComplianceAssociation,
    ComplianceDocument,
} from "@/lib/services/compliance"
import { suppliersApi } from "@/lib/services/suppliers"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getFileIcon, formatFileSize } from "@/lib/file-icon"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

interface JobConformitaProps {
    jobId: string
    jobLabel?: string
}

interface PendingFile {
    file: File
    name: string
    notes: string
}

const UNTYPED_KEY = "__untyped__"

// ─── Upload sezione ──────────────────────────────────────────────────────────

function OwnDocuments({ jobId, jobLabel }: { jobId: string; jobLabel?: string }) {
    const supabase = createClient()
    const [docs, setDocs] = useState<JobDocument[]>([])
    const [docTypes, setDocTypes] = useState<JobConformitaDocumentType[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<JobDocument | null>(null)
    const [viewMode, setViewMode] = useViewMode('job-conformita-own-documents', 'grid')

    // Upload wizard state
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [upDocTypeId, setUpDocTypeId] = useState("")
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [dragOver, setDragOver] = useState(false)
    const upRef = useRef<HTMLInputElement>(null)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [editDocTypeId, setEditDocTypeId] = useState("")
    const editRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [all, types] = await Promise.all([
                jobDocumentsApi.getByJobId(jobId),
                jobConformitaDocumentTypesApi.getAll(),
            ])
            setDocs(all.filter(d => d.category === "conformita"))
            setDocTypes(types)
        } catch {
            toast.error("Errore nel caricamento dei documenti")
        } finally {
            setLoading(false)
        }
    }

    const openUpload = () => {
        setUpStep(1)
        setUpDocTypeId("")
        setPendingFiles([])
        setDragOver(false)
        batchUpload.reset()
        setUploadOpen(true)
    }

    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return
        setPendingFiles(prev => {
            const room = MAX_BATCH_UPLOAD_FILES - prev.length
            if (room <= 0) {
                toast.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`)
                return prev
            }
            const selected = Array.from(files)
            if (selected.length > room) toast.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`)
            const newPending: PendingFile[] = selected.slice(0, room).map(f => ({
                file: f,
                name: f.name.replace(/\.[^.]+$/, ''),
                notes: "",
            }))
            return [...prev, ...newPending]
        })
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragOver(false)
        handleFilesSelected(e.dataTransfer.files)
    }

    const goToStep2 = () => {
        if (pendingFiles.length === 0) return
        setUpStep(2)
    }

    const updatePending = (idx: number, patch: Partial<PendingFile>) => {
        setPendingFiles(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
    }

    const removePending = (idx: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== idx))
    }

    const batchUpload = useBatchUpload()

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0) return
        setUploading(true)
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pf => {
            const compressed = await compressImageIfNeeded(pf.file)
            const fileExt = compressed.name.split(".").pop() || ''
            const formData = new FormData()
            formData.append('file', compressed)
            formData.append('folderPath', JSON.stringify(['Cantieri', jobLabel || jobId, 'Conformità']))
            const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
            const uploaded = await res.json()
            if (!res.ok) throw new Error(uploaded.error || 'Errore upload su Google Drive')
            await jobDocumentsApi.create({
                jobId,
                name: pf.name.trim() || pf.file.name,
                notes: pf.notes.trim(),
                fileUrl: uploaded.fileId,
                fileType: fileExt,
                fileSize: compressed.size,
                category: "conformita",
                conformitaDocumentTypeId: upDocTypeId || null,
            })
        })
        setUploading(false)
        if (failedCount === 0) {
            toast.success(okCount > 1 ? "Documenti caricati" : "Documento caricato")
            setUploadOpen(false)
        } else if (okCount === 0) {
            toast.error("Nessun documento caricato, riprova")
        } else {
            toast.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`)
            setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'))
        }
        load()
    }

    const openEdit = (doc: JobDocument) => {
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditDocTypeId(doc.conformitaDocumentTypeId || "")
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            await jobDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
                conformitaDocumentTypeId: editDocTypeId || null,
            })
            toast.success("Documento aggiornato")
            setEditOpen(false)
            load()
        } catch {
            toast.error("Errore durante l'aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!activeDoc) return
        try {
            await jobDocumentsApi.delete(activeDoc.id)
            setDocs(docs.filter(d => d.id !== activeDoc.id))
            toast.success("Documento eliminato")
        } catch {
            toast.error("Errore eliminazione")
        } finally {
            setDeleteOpen(false)
            setEditOpen(false)
            setActiveDoc(null)
        }
    }

    const openDoc = async (url: string) => {
        if (url && !url.includes('/')) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento`, '_blank')
            return
        }
        try {
            const path = url.split("/public/documents/")[1]
            if (!path) { window.open(url, "_blank"); return }
            const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(url, "_blank"); return }
            window.open(data.signedUrl, "_blank")
        } catch { window.open(url, "_blank") }
    }

    const renderDocCard = (doc: JobDocument) => (
        <Card key={doc.id} className="group hover:shadow-md transition-shadow cursor-pointer" onClick={() => openDoc(doc.fileUrl)}>
            <CardContent className="p-3 flex items-start gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded shrink-0">
                    {getFileIcon(doc.fileType, "h-7 w-7")}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                    {doc.notes && <p className="text-xs text-slate-500 mt-0.5 italic truncate">{doc.notes}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(doc.createdAt), "dd MMM yyyy", { locale: it })}
                        {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
                    </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openEdit(doc) }}>
                        <Pencil className="h-3 w-3 text-slate-500" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )

    const renderDocRow = (doc: JobDocument) => (
        <div key={doc.id} className="group flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openDoc(doc.fileUrl)}>
            <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded shrink-0">
                {getFileIcon(doc.fileType, "h-5 w-5")}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                {doc.notes && <p className="text-xs text-slate-500 italic truncate">{doc.notes}</p>}
            </div>
            <p className="text-xs text-slate-400 shrink-0">
                {format(new Date(doc.createdAt), "dd MMM yyyy", { locale: it })}
                {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
            </p>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openEdit(doc) }}>
                    <Pencil className="h-3 w-3 text-slate-500" />
                </Button>
            </div>
        </div>
    )

    const groups: { key: string; label: string; docs: JobDocument[] }[] = [
        ...docTypes.map(t => ({ key: t.id, label: t.name, docs: docs.filter(d => d.conformitaDocumentTypeId === t.id) })),
        { key: UNTYPED_KEY, label: "Senza tipo", docs: docs.filter(d => !d.conformitaDocumentTypeId) },
    ].filter(g => g.docs.length > 0)

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti caricati
                </h3>
                <div className="flex items-center gap-2">
                    {docs.length > 0 && <ViewToggle mode={viewMode} onChange={setViewMode} />}
                    <Button size="sm" variant="outline" onClick={openUpload}>
                        <Upload className="h-3.5 w-3.5 mr-1.5" />Carica
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : docs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento caricato</p>
            ) : groups.length === 0 ? (
                viewMode === 'list' ? (
                    <div className="space-y-1.5">
                        {docs.map(renderDocRow)}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {docs.map(renderDocCard)}
                    </div>
                )
            ) : (
                <Tabs defaultValue={groups[0]?.key}>
                    <TabsList className="flex-wrap h-auto gap-1">
                        {groups.map(g => (
                            <TabsTrigger key={g.key} value={g.key}>
                                {g.label}
                                <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                                    {g.docs.length}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {groups.map(g => (
                        <TabsContent key={g.key} value={g.key} className="pt-4">
                            {viewMode === 'list' ? (
                                <div className="space-y-1.5">
                                    {g.docs.map(renderDocRow)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {g.docs.map(renderDocCard)}
                                </div>
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Upload dialog - step 1: tipo + file multipli */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Carica documenti conformità</DialogTitle></DialogHeader>
                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>Tipo documento</Label>
                                <Select value={upDocTypeId} onValueChange={setUpDocTypeId}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona tipo documento" /></SelectTrigger>
                                    <SelectContent>
                                        {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {docTypes.length === 0 && (
                                    <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti Conformità Cantiere per crearne uno.</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>File (puoi selezionarne più di uno, anche con drag&drop)</Label>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'bg-blue-50 border-blue-400 dark:bg-blue-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    onClick={() => upRef.current?.click()}
                                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                >
                                    <input type="file" multiple className="hidden" ref={upRef} onChange={e => handleFilesSelected(e.target.files)} />
                                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                                    <p className="text-sm text-slate-600 font-medium">
                                        {pendingFiles.length > 0 ? `${pendingFiles.length} file selezionati` : "Clicca o trascina qui i file"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <p className="text-xs text-slate-500">Per ogni file inserisci nome e nota (opzionale).</p>
                            {pendingFiles.map((pf, idx) => (
                                <div key={idx} className="border rounded-lg p-3 space-y-2 relative">
                                    <Button variant="ghost" size="icon" disabled={batchUpload.statuses[idx]?.status === 'uploading'} className="absolute top-1 right-1 h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => removePending(idx)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                    <p className="text-xs text-slate-400 truncate pr-6">{pf.file.name}</p>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nome documento</Label>
                                        <Input value={pf.name} disabled={batchUpload.statuses[idx]?.status === 'uploading'} onChange={e => updatePending(idx, { name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nota (opzionale)</Label>
                                        <Input value={pf.notes} disabled={batchUpload.statuses[idx]?.status === 'uploading'} onChange={e => updatePending(idx, { notes: e.target.value })} placeholder="Breve descrizione" />
                                    </div>
                                    <UploadStatusBar state={batchUpload.statuses[idx]} />
                                </div>
                            ))}
                            {pendingFiles.length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">Nessun file selezionato.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        {upStep === 1 ? (
                            <>
                                <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
                                <Button onClick={goToStep2} disabled={pendingFiles.length === 0}>Continua</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setUpStep(1)}>Indietro</Button>
                                <Button onClick={handleUploadAll} disabled={uploading || pendingFiles.length === 0}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Carica {pendingFiles.length > 1 ? `(${pendingFiles.length})` : ""}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Modifica documento</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Tipo documento</Label>
                            <Select value={editDocTypeId} onValueChange={setEditDocTypeId}>
                                <SelectTrigger><SelectValue placeholder="Nessun tipo" /></SelectTrigger>
                                <SelectContent>
                                    {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nome documento</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nota</Label>
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Breve descrizione" />
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 sm:mr-auto"
                            onClick={() => { setEditOpen(false); setDeleteOpen(true) }}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />Elimina
                        </Button>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Elimina documento"
                description={`Il documento "${activeDoc?.name}" verrà eliminato definitivamente.`}
                onConfirm={handleDelete}
            />
        </div>
    )
}

// ─── Documenti associati ─────────────────────────────────────────────────────

function AssociatedDocuments({ jobId }: { jobId: string }) {
    const supabase = createClient()
    const [associations, setAssociations] = useState<JobComplianceAssociation[]>([])
    const [loading, setLoading] = useState(true)
    const [searchOpen, setSearchOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [disassociateOpen, setDisassociateOpen] = useState(false)
    const [editing, setEditing] = useState<JobComplianceAssociation | null>(null)
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [toDisassociate, setToDisassociate] = useState<JobComplianceAssociation | null>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            setAssociations(await jobComplianceApi.getByJobId(jobId))
        } catch {
            toast.error("Errore nel caricamento delle associazioni")
        } finally {
            setLoading(false)
        }
    }

    const openDoc = async (url: string) => {
        if (url && !url.includes('/')) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento`, '_blank')
            return
        }
        try {
            const path = url.split("/public/documents/")[1]
            if (!path) { window.open(url, "_blank"); return }
            const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(url, "_blank"); return }
            window.open(data.signedUrl, "_blank")
        } catch { window.open(url, "_blank") }
    }

    const handleSaveEdit = async () => {
        if (!editing) return
        try {
            setSaving(true)
            await jobComplianceApi.update(editing.id, {
                customName: editName.trim() || null,
                customNotes: editNotes.trim() || null,
            })
            toast.success("Aggiornato")
            setEditOpen(false)
            load()
        } catch {
            toast.error("Errore aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleDisassociate = async () => {
        if (!toDisassociate) return
        try {
            await jobComplianceApi.disassociate(toDisassociate.id)
            setAssociations(associations.filter(a => a.id !== toDisassociate.id))
            toast.success("Documento disassociato")
        } catch {
            toast.error("Errore disassociazione")
        } finally {
            setDisassociateOpen(false)
            setToDisassociate(null)
        }
    }

    const handleAssociated = () => {
        setSearchOpen(false)
        load()
    }

    const renderAssocCard = (assoc: JobComplianceAssociation) => {
        const doc = assoc.document
        const displayName = assoc.customName || doc?.name || "—"
        return (
            <Card key={assoc.id} className="group hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-start gap-3">
                    <div className="bg-green-50 dark:bg-green-950/30 p-1.5 rounded shrink-0">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{displayName}</p>
                        {assoc.customName && doc?.name && (
                            <p className="text-xs text-slate-400">Originale: {doc.name}</p>
                        )}
                        {assoc.customNotes && (
                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{assoc.customNotes}</p>
                        )}
                        {doc && (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {doc.brandName && (
                                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                                        {doc.brandName}
                                    </span>
                                )}
                                <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                                    {doc.documentTypeName}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                        {doc?.fileUrl && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDoc(doc.fileUrl)}>
                                <ExternalLink className="h-3 w-3 text-slate-500" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditing(assoc)
                            setEditName(assoc.customName || "")
                            setEditNotes(assoc.customNotes || "")
                            setEditOpen(true)
                        }}>
                            <Pencil className="h-3 w-3 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setToDisassociate(assoc); setDisassociateOpen(true) }}>
                            <Unlink className="h-3 w-3 text-red-500" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const assocGroups: { key: string; label: string; items: JobComplianceAssociation[] }[] = Object.values(
        associations.reduce((acc, assoc) => {
            const label = assoc.document?.documentTypeName || "Senza tipo"
            const key = label
            if (!acc[key]) acc[key] = { key, label, items: [] }
            acc[key].items.push(assoc)
            return acc
        }, {} as Record<string, { key: string; label: string; items: JobComplianceAssociation[] }>)
    )

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti associati dalla gestione conformità
                </h3>
                <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />Associa
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : associations.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento associato</p>
            ) : assocGroups.length === 0 ? (
                <div className="space-y-2">
                    {associations.map(renderAssocCard)}
                </div>
            ) : (
                <Tabs defaultValue={assocGroups[0]?.key}>
                    <TabsList className="flex-wrap h-auto gap-1">
                        {assocGroups.map(g => (
                            <TabsTrigger key={g.key} value={g.key}>
                                {g.label}
                                <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                                    {g.items.length}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {assocGroups.map(g => (
                        <TabsContent key={g.key} value={g.key} className="pt-4 space-y-2">
                            {g.items.map(renderAssocCard)}
                        </TabsContent>
                    ))}
                </Tabs>
            )}

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Personalizza documento associato</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Nome personalizzato</Label>
                            <Input
                                placeholder={editing?.document?.name || "Nome originale"}
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                            />
                            {editing?.document?.name && (
                                <p className="text-xs text-slate-400">Originale: {editing.document.name}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Note personalizzate</Label>
                            <Textarea
                                placeholder="Note per questa commessa (non modificano le note originali)"
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disassociate confirm */}
            <ConfirmDeleteDialog
                open={disassociateOpen}
                onOpenChange={setDisassociateOpen}
                title="Disassocia documento"
                description={`Il documento "${toDisassociate?.customName || toDisassociate?.document?.name}" verrà rimosso da questa commessa. Il documento originale non sarà modificato.`}
                onConfirm={handleDisassociate}
            />

            {/* Search & associate dialog */}
            {searchOpen && (
                <AssociateDialog
                    jobId={jobId}
                    existingIds={associations.map(a => a.complianceDocumentId)}
                    onClose={() => setSearchOpen(false)}
                    onAssociated={handleAssociated}
                />
            )}
        </div>
    )
}

// ─── Dialogo di ricerca e associazione ───────────────────────────────────────

function AssociateDialog({
    jobId,
    existingIds,
    onClose,
    onAssociated,
}: {
    jobId: string
    existingIds: string[]
    onClose: () => void
    onAssociated: () => void
}) {
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState("all")
    const [search, setSearch] = useState("")
    const [documentTypeId, setDocumentTypeId] = useState("all")
    const [allResults, setAllResults] = useState<ComplianceDocument[]>([])
    const [loadingResults, setLoadingResults] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    useEffect(() => {
        suppliersApi.getAll().then(s => setSuppliers(s)).catch(() => {})
    }, [])

    useEffect(() => {
        const t = setTimeout(() => fetchResults(), 300)
        return () => clearTimeout(t)
    }, [supplierId, search])

    const fetchResults = async () => {
        try {
            setLoadingResults(true)
            let docs: ComplianceDocument[]
            if (supplierId && supplierId !== "all") {
                docs = await complianceApi.getBySupplier(supplierId)
                if (search) docs = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
            } else {
                docs = await complianceApi.getAll(search || undefined)
            }
            setAllResults(docs)
        } catch {
            toast.error("Errore ricerca documenti")
        } finally {
            setLoadingResults(false)
        }
    }

    const availableTypes = Array.from(
        new Map(allResults.map(d => [d.documentTypeId || d.documentTypeName, d.documentTypeName])).entries()
    ).map(([id, name]) => ({ id, name }))

    useEffect(() => {
        if (documentTypeId !== "all" && !availableTypes.some(t => t.id === documentTypeId)) {
            setDocumentTypeId("all")
        }
    }, [allResults])

    const results = documentTypeId === "all"
        ? allResults
        : allResults.filter(d => (d.documentTypeId || d.documentTypeName) === documentTypeId)

    const handleAssociate = async (doc: ComplianceDocument) => {
        try {
            setAssociating(doc.id)
            await jobComplianceApi.associate(jobId, doc.id)
            toast.success("Documento associato")
            onAssociated()
        } catch (e: any) {
            if (e?.code === "23505") toast.error("Documento già associato")
            else toast.error("Errore associazione")
        } finally {
            setAssociating(null)
        }
    }

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Associa documento conformità</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger><SelectValue placeholder="Tutti i fornitori" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i fornitori</SelectItem>
                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
                            <SelectTrigger><SelectValue placeholder="Tutti i tipi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i tipi</SelectItem>
                                {availableTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            className="pl-8"
                            placeholder="Cerca per nome..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                        {loadingResults ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                        ) : results.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Nessun documento trovato</p>
                        ) : results.map(doc => {
                            const already = existingIds.includes(doc.id)
                            return (
                                <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{doc.name}</p>
                                        <p className="text-xs text-slate-400">{doc.brandName} · {doc.documentTypeName}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={already ? "ghost" : "outline"}
                                        disabled={already || associating === doc.id}
                                        onClick={() => handleAssociate(doc)}
                                        className="shrink-0"
                                    >
                                        {associating === doc.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : already ? "Già associato" : "Associa"}
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Chiudi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Componente principale ───────────────────────────────────────────────────

export function JobConformita({ jobId, jobLabel }: JobConformitaProps) {
    return (
        <Tabs defaultValue="own" className="space-y-4">
            <TabsList>
                <TabsTrigger value="own">Documenti caricati</TabsTrigger>
                <TabsTrigger value="associated">Documenti associati</TabsTrigger>
            </TabsList>
            <TabsContent value="own">
                <OwnDocuments jobId={jobId} jobLabel={jobLabel} />
            </TabsContent>
            <TabsContent value="associated">
                <AssociatedDocuments jobId={jobId} />
            </TabsContent>
        </Tabs>
    )
}
