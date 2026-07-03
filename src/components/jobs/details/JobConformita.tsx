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
    Download,
    FolderInput,
    FolderPlus,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { jobDocumentsApi, JobDocument } from "@/lib/api"
import { jobConformitaDocumentTypesApi, JobConformitaDocumentType } from "@/lib/services/job-conformita-document-types"
import { jobDocumentFoldersApi, JobDocumentFolder } from "@/lib/services/job-document-folders"
import { jobDdtDocumentExclusionsApi } from "@/lib/services/job-ddt-document-exclusions"
import { jobArticlesApi, JobArticle } from "@/lib/services/job-articles"
import { itemComplianceApi } from "@/lib/services/item-compliance"
import { JobDdt } from "./JobDdt"
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
import { uploadFileToDrive } from "@/lib/drive-upload"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

interface JobConformitaProps {
    jobId: string
    jobLabel?: string
    jobName?: string
}

interface PendingFile {
    file: File
    name: string
    notes: string
}

const UNTYPED_KEY = "__untyped__"
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])

// ─── Upload sezione ──────────────────────────────────────────────────────────

function OwnDocuments({ jobId, jobLabel }: { jobId: string; jobLabel?: string }) {
    const supabase = createClient()
    const [docs, setDocs] = useState<JobDocument[]>([])
    const [docTypes, setDocTypes] = useState<JobConformitaDocumentType[]>([])
    const [folders, setFolders] = useState<JobDocumentFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<JobDocument | null>(null)
    const [viewMode, setViewMode] = useViewMode('job-conformita-own-documents', 'grid')
    const [activeFolderByType, setActiveFolderByType] = useState<Record<string, string>>({})

    // Upload wizard state
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [upDocTypeId, setUpDocTypeId] = useState("")
    const [upFolderId, setUpFolderId] = useState("")
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [dragOver, setDragOver] = useState(false)
    const upRef = useRef<HTMLInputElement>(null)

    // New folder dialog
    const [newFolderOpen, setNewFolderOpen] = useState(false)
    const [newFolderTypeId, setNewFolderTypeId] = useState("")
    const [newFolderName, setNewFolderName] = useState("")
    const [creatingFolder, setCreatingFolder] = useState(false)

    // Move to folder dialog
    const [moveOpen, setMoveOpen] = useState(false)
    const [movingDoc, setMovingDoc] = useState<JobDocument | null>(null)
    const [moveFolderId, setMoveFolderId] = useState("root")
    const [moving, setMoving] = useState(false)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [editDocTypeId, setEditDocTypeId] = useState("")
    const [editFile, setEditFile] = useState<File | null>(null)
    const editRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [all, types, jobFolders] = await Promise.all([
                jobDocumentsApi.getByJobId(jobId),
                jobConformitaDocumentTypesApi.getAll(),
                jobDocumentFoldersApi.getByJobId(jobId),
            ])
            setDocs(all.filter(d => d.category === "conformita"))
            setDocTypes(types)
            setFolders(jobFolders)
        } catch {
            toast.error("Errore nel caricamento dei documenti")
        } finally {
            setLoading(false)
        }
    }

    // Percorso Drive base per un tipo documento: se il tipo consente cartelle,
    // i suoi file vivono in una sottocartella dedicata al tipo, altrimenti
    // restano nella cartella piatta "Conformità" (comportamento storico).
    const typeBaseSegments = (type?: JobConformitaDocumentType) => {
        const base = ['Cantieri', jobLabel || jobId, 'Conformità']
        return type?.allowsFolders ? [...base, type.name] : base
    }

    const openUpload = () => {
        setUpStep(1)
        setUpDocTypeId("")
        setUpFolderId("")
        setPendingFiles([])
        setDragOver(false)
        batchUpload.reset()
        setUploadOpen(true)
    }

    const openNewFolder = (typeId: string) => {
        setNewFolderTypeId(typeId)
        setNewFolderName("")
        setNewFolderOpen(true)
    }

    const handleCreateFolder = async () => {
        const name = newFolderName.trim()
        const type = docTypes.find(t => t.id === newFolderTypeId)
        if (!name || !type) return
        try {
            setCreatingFolder(true)
            const res = await fetch('/api/drive/ensure-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ segments: [...typeBaseSegments(type), name] }),
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || 'Errore creazione cartella')
            const folder = await jobDocumentFoldersApi.create({
                jobId,
                documentTypeId: newFolderTypeId,
                name,
                driveFolderId: result.folderId,
            })
            setFolders(prev => [...prev, folder])
            if (upDocTypeId === newFolderTypeId) setUpFolderId(folder.id)
            setActiveFolderByType(prev => ({ ...prev, [newFolderTypeId]: folder.id }))
            toast.success("Cartella creata")
            setNewFolderOpen(false)
        } catch {
            toast.error("Errore durante la creazione della cartella")
        } finally {
            setCreatingFolder(false)
        }
    }

    const openMove = (doc: JobDocument) => {
        setMovingDoc(doc)
        setMoveFolderId(doc.folderId || "root")
        setMoveOpen(true)
    }

    const handleMove = async () => {
        if (!movingDoc) return
        const targetFolderId = moveFolderId === "root" ? null : moveFolderId
        if (targetFolderId === (movingDoc.folderId || null)) { setMoveOpen(false); return }
        try {
            setMoving(true)
            const type = docTypes.find(t => t.id === movingDoc.conformitaDocumentTypeId)
            const targetFolder = targetFolderId ? folders.find(f => f.id === targetFolderId) : undefined
            const segments = targetFolder ? [...typeBaseSegments(type), targetFolder.name] : typeBaseSegments(type)

            // Il file su Drive va spostato solo se è un vero id Drive (non un vecchio path Supabase)
            if (movingDoc.fileUrl && !movingDoc.fileUrl.includes('/')) {
                const ensureRes = await fetch('/api/drive/ensure-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ segments }),
                })
                const ensured = await ensureRes.json()
                if (!ensureRes.ok) throw new Error(ensured.error || 'Errore risoluzione cartella')
                const moveRes = await fetch('/api/drive/move-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId: movingDoc.fileUrl, newParentId: ensured.folderId }),
                })
                const moved = await moveRes.json()
                if (!moveRes.ok) throw new Error(moved.error || 'Errore spostamento file')
            }

            await jobDocumentsApi.update(movingDoc.id, { folderId: targetFolderId })
            toast.success("Documento spostato")
            setMoveOpen(false)
            load()
        } catch {
            toast.error("Errore durante lo spostamento")
        } finally {
            setMoving(false)
        }
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
        const selectedType = docTypes.find(t => t.id === upDocTypeId)
        const selectedFolder = upFolderId ? folders.find(f => f.id === upFolderId) : undefined
        const segments = selectedFolder
            ? [...typeBaseSegments(selectedType), selectedFolder.name]
            : typeBaseSegments(selectedType)
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pf => {
            const compressed = await compressImageIfNeeded(pf.file)
            const fileExt = compressed.name.split(".").pop() || ''
            const uploaded = await uploadFileToDrive(compressed, segments)
            await jobDocumentsApi.create({
                jobId,
                name: pf.name.trim() || pf.file.name,
                notes: pf.notes.trim(),
                fileUrl: uploaded.fileId,
                fileType: fileExt,
                fileSize: compressed.size,
                category: "conformita",
                conformitaDocumentTypeId: upDocTypeId || null,
                folderId: upFolderId || null,
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
        setEditFile(null)
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            let fileUrl = activeDoc.fileUrl
            let fileType = activeDoc.fileType
            let fileSize = activeDoc.fileSize

            if (editFile) {
                const compressed = await compressImageIfNeeded(editFile)
                const fileExt = compressed.name.split('.').pop() || ''
                const uploaded = await uploadFileToDrive(compressed, ['Cantieri', jobLabel || jobId, 'Conformità'])
                fileUrl = uploaded.fileId
                fileType = fileExt
                fileSize = compressed.size
            }

            await jobDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
                conformitaDocumentTypeId: editDocTypeId || null,
                fileUrl,
                fileType,
                fileSize,
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
                    {doc.fileUrl && !doc.fileUrl.includes('/') && OFFICE_EXTENSIONS.has(doc.fileType?.toLowerCase() || '') && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Scarica" onClick={e => { e.stopPropagation(); window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank') }}>
                            <Download className="h-3 w-3 text-slate-500" />
                        </Button>
                    )}
                    {docTypes.find(t => t.id === doc.conformitaDocumentTypeId)?.allowsFolders && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Sposta in cartella" onClick={e => { e.stopPropagation(); openMove(doc) }}>
                            <FolderInput className="h-3 w-3 text-slate-500" />
                        </Button>
                    )}
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
                {doc.fileUrl && !doc.fileUrl.includes('/') && OFFICE_EXTENSIONS.has(doc.fileType?.toLowerCase() || '') && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Scarica" onClick={e => { e.stopPropagation(); window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank') }}>
                        <Download className="h-3 w-3 text-slate-500" />
                    </Button>
                )}
                {docTypes.find(t => t.id === doc.conformitaDocumentTypeId)?.allowsFolders && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Sposta in cartella" onClick={e => { e.stopPropagation(); openMove(doc) }}>
                        <FolderInput className="h-3 w-3 text-slate-500" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); openEdit(doc) }}>
                    <Pencil className="h-3 w-3 text-slate-500" />
                </Button>
            </div>
        </div>
    )

    const groups: { key: string; label: string; docs: JobDocument[] }[] = [
        ...docTypes.map(t => ({ key: t.id, label: t.name, docs: docs.filter(d => d.conformitaDocumentTypeId === t.id) })),
        ...(docs.some(d => !d.conformitaDocumentTypeId) ? [{ key: UNTYPED_KEY, label: "Senza tipo", docs: docs.filter(d => !d.conformitaDocumentTypeId) }] : []),
    ]

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Conformità Personalizzata
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
            ) : docTypes.length === 0 && docs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento caricato</p>
            ) : docTypes.length === 0 ? (
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
                    {groups.map(g => {
                        const type = docTypes.find(t => t.id === g.key)
                        const typeFolders = type ? folders.filter(f => f.documentTypeId === type.id) : []
                        const activeFolder = activeFolderByType[g.key] || 'all'
                        const shownDocs = !type?.allowsFolders
                            ? g.docs
                            : activeFolder === 'all'
                                ? g.docs
                                : activeFolder === 'root'
                                    ? g.docs.filter(d => !d.folderId)
                                    : g.docs.filter(d => d.folderId === activeFolder)
                        return (
                            <TabsContent key={g.key} value={g.key} className="pt-4 space-y-3">
                                {type?.allowsFolders && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {[{ id: 'all', name: 'Tutte' }, { id: 'root', name: 'Senza cartella' }, ...typeFolders].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => setActiveFolderByType(prev => ({ ...prev, [g.key]: f.id }))}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${activeFolder === f.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {f.name}
                                            </button>
                                        ))}
                                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => openNewFolder(g.key)}>
                                            <FolderPlus className="h-3.5 w-3.5 mr-1" />Nuova cartella
                                        </Button>
                                    </div>
                                )}
                                {shownDocs.length === 0 ? (
                                    <p className="text-sm text-slate-400 py-4 text-center">
                                        {type?.allowsFolders ? "Nessun documento in questa cartella" : "Nessun documento di questo tipo"}
                                    </p>
                                ) : viewMode === 'list' ? (
                                    <div className="space-y-1.5">
                                        {shownDocs.map(renderDocRow)}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {shownDocs.map(renderDocCard)}
                                    </div>
                                )}
                            </TabsContent>
                        )
                    })}
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
                                <Select value={upDocTypeId} onValueChange={v => { setUpDocTypeId(v); setUpFolderId("") }}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona tipo documento" /></SelectTrigger>
                                    <SelectContent>
                                        {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {docTypes.length === 0 && (
                                    <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti Conformità Cantiere per crearne uno.</p>
                                )}
                            </div>
                            {docTypes.find(t => t.id === upDocTypeId)?.allowsFolders && (
                                <div className="space-y-1">
                                    <Label>Cartella (opzionale)</Label>
                                    <div className="flex gap-2">
                                        <Select value={upFolderId || "root"} onValueChange={v => setUpFolderId(v === "root" ? "" : v)}>
                                            <SelectTrigger><SelectValue placeholder="Nessuna cartella" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="root">Nessuna cartella</SelectItem>
                                                {folders.filter(f => f.documentTypeId === upDocTypeId).map(f => (
                                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" variant="outline" size="icon" onClick={() => openNewFolder(upDocTypeId)} title="Nuova cartella">
                                            <FolderPlus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                        <div className="space-y-1.5">
                            <Label>Sostituisci file (opzionale)</Label>
                            <div
                                className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => editRef.current?.click()}
                            >
                                <input type="file" className="hidden" ref={editRef} onChange={e => setEditFile(e.target.files?.[0] || null)} />
                                <Upload className="h-6 w-6 text-slate-400 mb-1" />
                                <p className="text-sm text-slate-600">{editFile ? editFile.name : "Clicca per sostituire il file"}</p>
                                {!editFile && activeDoc && <p className="text-xs text-slate-400 mt-0.5">Attuale: {activeDoc.name}</p>}
                            </div>
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

            {/* Nuova cartella */}
            <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Nuova cartella</DialogTitle></DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label>Nome cartella</Label>
                        <Input
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="Es. Piano 1"
                            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Annulla</Button>
                        <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
                            {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crea
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sposta in cartella */}
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Sposta in cartella</DialogTitle></DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label>Cartella di destinazione</Label>
                        <Select value={moveFolderId} onValueChange={setMoveFolderId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="root">Nessuna cartella</SelectItem>
                                {folders.filter(f => f.documentTypeId === movingDoc?.conformitaDocumentTypeId).map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveOpen(false)}>Annulla</Button>
                        <Button onClick={handleMove} disabled={moving}>
                            {moving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sposta
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
    const [viewMode, setViewMode] = useViewMode('job-conformita-associated', 'list')

    // Conf. Ass. DDT: documenti di conformità tracciati automaticamente dai DDT
    const [ddtDocs, setDdtDocs] = useState<ComplianceDocument[]>([])
    const [ddtExcludedIds, setDdtExcludedIds] = useState<Set<string>>(new Set())
    const [ddtTogglingId, setDdtTogglingId] = useState<string | null>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [assocs, ddt, excluded] = await Promise.all([
                jobComplianceApi.getByJobId(jobId),
                complianceApi.getByJobIdFromDDT(jobId),
                jobDdtDocumentExclusionsApi.getExcludedIds(jobId),
            ])
            setAssociations(assocs)
            setDdtDocs(ddt)
            setDdtExcludedIds(excluded)
        } catch {
            toast.error("Errore nel caricamento delle associazioni")
        } finally {
            setLoading(false)
        }
    }

    const handleSetDdtIncluded = async (docId: string, included: boolean) => {
        try {
            setDdtTogglingId(docId)
            if (included) {
                await jobDdtDocumentExclusionsApi.include(jobId, docId)
                setDdtExcludedIds(prev => { const next = new Set(prev); next.delete(docId); return next })
            } else {
                await jobDdtDocumentExclusionsApi.exclude(jobId, docId)
                setDdtExcludedIds(prev => new Set(prev).add(docId))
            }
        } catch {
            toast.error("Errore durante l'aggiornamento dello stato")
        } finally {
            setDdtTogglingId(null)
        }
    }

    const renderDdtInclusionToggle = (doc: ComplianceDocument, isExcluded: boolean) => (
        <div className="inline-flex rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
            <button
                disabled={ddtTogglingId === doc.id}
                onClick={() => handleSetDdtIncluded(doc.id, true)}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${!isExcluded ? 'bg-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                Incluso
            </button>
            <button
                disabled={ddtTogglingId === doc.id}
                onClick={() => handleSetDdtIncluded(doc.id, false)}
                className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${isExcluded ? 'bg-slate-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                Escluso
            </button>
        </div>
    )

    const renderDdtCard = (doc: ComplianceDocument) => {
        const isExcluded = ddtExcludedIds.has(doc.id)
        return (
            <Card key={doc.id} className={`hover:shadow-sm transition-shadow ${isExcluded ? 'opacity-60' : ''}`}>
                <CardContent className="p-3 flex items-start gap-3">
                    <div className="bg-green-50 dark:bg-green-950/30 p-1.5 rounded shrink-0">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{doc.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            {doc.documentTypeName && (
                                <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                                    {doc.documentTypeName}
                                </span>
                            )}
                            {doc.purchaseNumber && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                    DDT {doc.purchaseNumber}
                                </span>
                            )}
                            <div className="ml-auto">{renderDdtInclusionToggle(doc, isExcluded)}</div>
                        </div>
                    </div>
                    {doc.fileUrl && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openDoc(doc.fileUrl)} title="Apri documento">
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    )}
                </CardContent>
            </Card>
        )
    }

    const renderDdtRow = (doc: ComplianceDocument) => {
        const isExcluded = ddtExcludedIds.has(doc.id)
        return (
            <div key={doc.id} className={`group flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow ${isExcluded ? 'opacity-60' : ''}`}>
                <div className="bg-green-50 dark:bg-green-950/30 p-1 rounded shrink-0">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {doc.documentTypeName && (
                        <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                            {doc.documentTypeName}
                        </span>
                    )}
                    {doc.purchaseNumber && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                            DDT {doc.purchaseNumber}
                        </span>
                    )}
                    {renderDdtInclusionToggle(doc, isExcluded)}
                </div>
                {doc.fileUrl && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openDoc(doc.fileUrl)} title="Apri documento">
                        <ExternalLink className="h-3 w-3 text-slate-500" />
                    </Button>
                )}
            </div>
        )
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

    const renderAssocRow = (assoc: JobComplianceAssociation) => {
        const doc = assoc.document
        const displayName = assoc.customName || doc?.name || "—"
        return (
            <div key={assoc.id} className="group flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow">
                <div className="bg-green-50 dark:bg-green-950/30 p-1 rounded shrink-0">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate" title={displayName}>{displayName}</p>
                    {assoc.customNotes && <p className="text-xs text-slate-500 italic truncate">{assoc.customNotes}</p>}
                </div>
                {doc && (
                    <div className="flex flex-wrap gap-2 shrink-0">
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
            </div>
        )
    }

    type AssocGroup =
        | { key: string; label: string; kind: 'manual'; items: JobComplianceAssociation[] }
        | { key: string; label: string; kind: 'ddt'; items: ComplianceDocument[] }

    const assocGroups: AssocGroup[] = [
        ...Object.values(
            associations.reduce((acc, assoc) => {
                const label = assoc.document?.documentTypeName || "Senza tipo"
                const key = label
                if (!acc[key]) acc[key] = { key, label, kind: 'manual', items: [] }
                acc[key].items.push(assoc)
                return acc
            }, {} as Record<string, { key: string; label: string; kind: 'manual'; items: JobComplianceAssociation[] }>)
        ),
        { key: '__ddt__', label: 'Conf. Ass. DDT', kind: 'ddt', items: ddtDocs },
    ]

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti associati dalla gestione conformità
                </h3>
                <div className="flex items-center gap-2">
                {associations.length > 0 && <ViewToggle mode={viewMode} onChange={setViewMode} />}
                <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />Associa
                </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
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
                        <TabsContent key={g.key} value={g.key} className="pt-4">
                            {g.items.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">
                                    {g.kind === 'ddt'
                                        ? "Nessun documento di conformità proveniente da DDT per questa commessa"
                                        : "Nessun documento associato"}
                                </p>
                            ) : g.kind === 'ddt' ? (
                                viewMode === 'list' ? (
                                    <div className="space-y-1.5">
                                        {g.items.map(renderDdtRow)}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {g.items.map(renderDdtCard)}
                                    </div>
                                )
                            ) : viewMode === 'list' ? (
                                <div className="space-y-1.5">
                                    {g.items.map(renderAssocRow)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {g.items.map(renderAssocCard)}
                                </div>
                            )}
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

function AssociateResultsList({
    loading,
    results,
    existingIds,
    associatingId,
    onAssociate,
    emptyMessage,
}: {
    loading: boolean
    results: ComplianceDocument[]
    existingIds: string[]
    associatingId: string | null
    onAssociate: (doc: ComplianceDocument) => void
    emptyMessage: string
}) {
    return (
        <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : results.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">{emptyMessage}</p>
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
                            disabled={already || associatingId === doc.id}
                            onClick={() => onAssociate(doc)}
                            className="shrink-0"
                        >
                            {associatingId === doc.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : already ? "Già associato" : "Associa"}
                        </Button>
                    </div>
                )
            })}
        </div>
    )
}

function AssociateDialog({
    jobId,
    existingIds: initialExistingIds,
    onClose,
    onAssociated,
}: {
    jobId: string
    existingIds: string[]
    onClose: () => void
    onAssociated: () => void
}) {
    const [existingIds, setExistingIds] = useState(initialExistingIds)
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState("all")
    const [search, setSearch] = useState("")
    const [documentTypeId, setDocumentTypeId] = useState("all")
    const [allResults, setAllResults] = useState<ComplianceDocument[]>([])
    const [loadingResults, setLoadingResults] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    // Cerca per articolo Commessa
    const [jobArticles, setJobArticles] = useState<JobArticle[]>([])
    const [loadingArticles, setLoadingArticles] = useState(true)
    const [selectedArticleId, setSelectedArticleId] = useState("")
    const [articleDocs, setArticleDocs] = useState<ComplianceDocument[]>([])
    const [loadingArticleDocs, setLoadingArticleDocs] = useState(false)

    useEffect(() => {
        suppliersApi.getAll().then(s => setSuppliers(s)).catch(() => {})
    }, [])

    useEffect(() => {
        setLoadingArticles(true)
        jobArticlesApi.getItemsForJob(jobId)
            .then(setJobArticles)
            .catch(() => toast.error("Errore nel caricamento degli articoli"))
            .finally(() => setLoadingArticles(false))
    }, [jobId])

    useEffect(() => {
        if (!selectedArticleId) { setArticleDocs([]); return }
        setLoadingArticleDocs(true)
        itemComplianceApi.getByItemId(selectedArticleId)
            .then(assocs => setArticleDocs(assocs.map(a => a.document).filter((d): d is ComplianceDocument => !!d)))
            .catch(() => toast.error("Errore nel caricamento dei certificati dell'articolo"))
            .finally(() => setLoadingArticleDocs(false))
    }, [selectedArticleId])

    useEffect(() => {
        const t = setTimeout(() => fetchResults(), 300)
        return () => clearTimeout(t)
    }, [supplierId, search])

    const fetchResults = async () => {
        try {
            setLoadingResults(true)
            let docs: ComplianceDocument[]
            if (supplierId && supplierId !== "all") {
                docs = await complianceApi.getBySupplier(supplierId, true)
                if (search) docs = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
            } else {
                docs = await complianceApi.getAll(search || undefined, true)
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
            setExistingIds(prev => [...prev, doc.id])
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
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Associa documento conformità</DialogTitle></DialogHeader>
                <Tabs defaultValue="search" className="space-y-3">
                    <TabsList>
                        <TabsTrigger value="search">Cerca tutti</TabsTrigger>
                        <TabsTrigger value="articles">Cerca per articolo Commessa</TabsTrigger>
                    </TabsList>
                    <TabsContent value="search" className="space-y-3">
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
                        <AssociateResultsList
                            loading={loadingResults}
                            results={results}
                            existingIds={existingIds}
                            associatingId={associating}
                            onAssociate={handleAssociate}
                            emptyMessage="Nessun documento trovato"
                        />
                    </TabsContent>
                    <TabsContent value="articles" className="space-y-3">
                        <Select value={selectedArticleId} onValueChange={setSelectedArticleId} disabled={loadingArticles}>
                            <SelectTrigger>
                                <SelectValue placeholder={loadingArticles ? "Caricamento articoli..." : "Seleziona un articolo..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {jobArticles.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.name}{a.model ? ` (${a.model})` : ''}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!loadingArticles && jobArticles.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Nessun articolo passato da questa commessa</p>
                        ) : !selectedArticleId ? (
                            <p className="text-sm text-slate-400 text-center py-4">Seleziona un articolo per vedere i certificati collegati</p>
                        ) : (
                            <AssociateResultsList
                                loading={loadingArticleDocs}
                                results={articleDocs}
                                existingIds={existingIds}
                                associatingId={associating}
                                onAssociate={handleAssociate}
                                emptyMessage="Nessun certificato associato a questo articolo"
                            />
                        )}
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Chiudi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ─── Componente principale ───────────────────────────────────────────────────

export function JobConformita({ jobId, jobLabel, jobName }: JobConformitaProps) {
    return (
        <Tabs defaultValue="own" className="space-y-4">
            <TabsList>
                <TabsTrigger value="own">Conformità Personalizzata</TabsTrigger>
                <TabsTrigger value="associated">Documenti associati</TabsTrigger>
                <TabsTrigger value="ddt-bolle">DDT/bolle</TabsTrigger>
            </TabsList>
            <TabsContent value="own">
                <OwnDocuments jobId={jobId} jobLabel={jobLabel} />
            </TabsContent>
            <TabsContent value="associated">
                <AssociatedDocuments jobId={jobId} />
            </TabsContent>
            <TabsContent value="ddt-bolle">
                <JobDdt jobId={jobId} jobName={jobName || jobLabel || jobId} />
            </TabsContent>
        </Tabs>
    )
}
