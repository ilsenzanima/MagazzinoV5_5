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
    MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { jobDocumentsApi, JobDocument } from "@/lib/api"
import { jobConformitaDocumentTypesApi, JobConformitaDocumentType } from "@/lib/services/job-conformita-document-types"
import { jobDocumentFoldersApi, JobDocumentFolder } from "@/lib/services/job-document-folders"
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
import { supplierGroupsApi } from "@/lib/services/supplier-groups"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { SortArrow, InlineNote, TABLE_HEAD_CLS, TABLE_SELECT_CLS } from "@/components/ui/table-bits"
import { HelpTip } from "@/components/ui/help-tip"
import { PhotoGallery, PhotoGalleryImage, isImageFileType } from "@/components/ui/photo-gallery"
import { resolveDocumentDisplayUrl } from "@/lib/resolve-document-url"

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
const OWN_PAGE_SIZE = 50
type OwnSortKey = "name" | "type" | "folder" | "date" | "size"
type AssocSortKey = "name" | "type" | "brand" | "origin"
interface AssocRow {
    id: string
    kind: "manual" | "ddt"
    name: string
    original: string
    typeName: string
    brand: string
    origin: string
    notes: string
    fileUrl: string
    assoc?: JobComplianceAssociation
}
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
    // Filtri e ordinamento della tabella
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [folderFilter, setFolderFilter] = useState("all")
    const [sortKey, setSortKey] = useState<OwnSortKey>("date")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const [page, setPage] = useState(1)

    // Galleria foto
    const [galleryImages, setGalleryImages] = useState<PhotoGalleryImage[]>([])
    const [galleryIndex, setGalleryIndex] = useState(0)
    const [galleryOpen, setGalleryOpen] = useState(false)

    const openGalleryForDoc = async (doc: JobDocument, siblingDocs: JobDocument[]) => {
        const imageDocs = siblingDocs.filter(d => isImageFileType(d.fileType))
        const startIndex = Math.max(0, imageDocs.findIndex(d => d.id === doc.id))
        const resolved = await Promise.all(imageDocs.map(async d => ({
            url: await resolveDocumentDisplayUrl(supabase, d.fileUrl),
            name: d.name,
        })))
        setGalleryImages(resolved)
        setGalleryIndex(startIndex)
        setGalleryOpen(true)
    }

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
            setTypeFilter(newFolderTypeId)
            setFolderFilter(folder.id)
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
        if (!upDocTypeId) {
            toast.error("Selezionare il tipo di documento.")
            return
        }
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
        if (!editDocTypeId) {
            toast.error("Selezionare il tipo di documento.")
            return
        }
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

    const handleSaveNote = async (doc: JobDocument, notes: string) => {
        if (notes === (doc.notes ?? "")) return
        try {
            await jobDocumentsApi.update(doc.id, { notes })
            setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, notes } : d)))
        } catch {
            toast.error("Errore nel salvataggio della nota")
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

    const typeNameOf = (d: JobDocument) => docTypes.find(t => t.id === d.conformitaDocumentTypeId)?.name || "Senza tipo"
    const folderNameOf = (d: JobDocument) => (d.folderId ? folders.find(f => f.id === d.folderId)?.name : undefined) || ""
    const filterType = typeFilter !== "all" && typeFilter !== UNTYPED_KEY ? docTypes.find(t => t.id === typeFilter) : undefined
    const folderOptions = folders.filter(f => !filterType || f.documentTypeId === filterType.id)
    const anyFilter = !!search.trim() || typeFilter !== "all" || folderFilter !== "all"

    const sorted = (() => {
        const q = search.trim().toLowerCase()
        const list = docs.filter(d => {
            if (typeFilter === UNTYPED_KEY ? !!d.conformitaDocumentTypeId : typeFilter !== "all" && d.conformitaDocumentTypeId !== typeFilter) return false
            if (folderFilter === "root" ? !!d.folderId : folderFilter !== "all" && d.folderId !== folderFilter) return false
            return !q || `${d.name} ${d.notes ?? ""} ${typeNameOf(d)} ${folderNameOf(d)}`.toLowerCase().includes(q)
        })
        const dir = sortDir === "asc" ? 1 : -1
        return [...list].sort((x, y) => {
            let r = 0
            if (sortKey === "name") r = x.name.localeCompare(y.name, "it")
            else if (sortKey === "type") r = typeNameOf(x).localeCompare(typeNameOf(y), "it") || x.name.localeCompare(y.name, "it")
            else if (sortKey === "folder") r = (folderNameOf(x) || "~").localeCompare(folderNameOf(y) || "~", "it")
            else if (sortKey === "size") r = (x.fileSize ?? 0) - (y.fileSize ?? 0)
            else r = x.createdAt.localeCompare(y.createdAt)
            return r * dir
        })
    })()
    const totalPages = Math.max(1, Math.ceil(sorted.length / OWN_PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const rows = sorted.slice((currentPage - 1) * OWN_PAGE_SIZE, currentPage * OWN_PAGE_SIZE)
    const toggleSort = (key: OwnSortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
        else { setSortKey(key); setSortDir(key === "date" || key === "size" ? "desc" : "asc") }
        setPage(1)
    }
    const openRow = (d: JobDocument) => (isImageFileType(d.fileType) ? openGalleryForDoc(d, sorted) : openDoc(d.fileUrl))
    const isDriveFile = (d: JobDocument) => !!d.fileUrl && !d.fileUrl.includes('/')

    const sortBtn = (key: OwnSortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}<SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    )
    const typeSelect = (cls?: string) => (
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setFolderFilter("all"); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per tipo" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                {docs.some(d => !d.conformitaDocumentTypeId) && <SelectItem value={UNTYPED_KEY}>Senza tipo</SelectItem>}
            </SelectContent>
        </Select>
    )
    const folderSelect = (cls?: string) => (
        <Select value={folderFilter} onValueChange={v => { setFolderFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per cartella" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutte le cartelle</SelectItem>
                <SelectItem value="root">Senza cartella</SelectItem>
                {folderOptions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
        </Select>
    )

    const rowMenu = (doc: JobDocument) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => openRow(doc)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
                {isDriveFile(doc) && (
                    <DropdownMenuItem onClick={() => window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank')}>
                        <Download className="mr-2 h-4 w-4" />Scarica
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openEdit(doc)}><Pencil className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
                {docTypes.find(t => t.id === doc.conformitaDocumentTypeId)?.allowsFolders && (
                    <DropdownMenuItem onClick={() => openMove(doc)}><FolderInput className="mr-2 h-4 w-4" />Sposta in cartella</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setActiveDoc(doc); setDeleteOpen(true) }} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />Elimina
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Conformità Personalizzata
                    <HelpTip
                        title="Conformità Personalizzata"
                        description="Tipi di documento che puoi inserire in questa sezione."
                        fetchItems={async () => (await jobConformitaDocumentTypesApi.getAll()).map(t => t.name)}
                        emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Conformità Cantiere per crearne uno."
                    />
                </h3>
                <Button size="sm" variant="outline" onClick={openUpload}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />Carica
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : docs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento caricato</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Cerca per nome o nota" className="pl-8" />
                        </div>
                        {anyFilter && (
                            <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={() => { setSearch(""); setTypeFilter("all"); setFolderFilter("all"); setPage(1) }}>Azzera filtri</Button>
                        )}
                        {docTypes.some(t => t.allowsFolders) && (
                            <Button variant="outline" size="sm" onClick={() => openNewFolder(filterType?.allowsFolders ? filterType.id : (docTypes.find(t => t.allowsFolders)?.id ?? ""))}>
                                <FolderPlus className="mr-1.5 h-4 w-4" />Nuova cartella
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:hidden">{typeSelect()}{folderSelect()}</div>

                    {/* Tabella (PC) */}
                    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={TABLE_HEAD_CLS}>{sortBtn("name", "Documento")}</TableHead>
                                    <TableHead className={`w-44 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{typeSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "type"} dir={sortDir} /></button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-44 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{folderSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per cartella" onClick={() => toggleSort("folder")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "folder"} dir={sortDir} /></button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-28 ${TABLE_HEAD_CLS}`}>{sortBtn("date", "Data")}</TableHead>
                                    <TableHead className={`w-28 ${TABLE_HEAD_CLS}`}>{sortBtn("size", "Dimensione")}</TableHead>
                                    <TableHead className={`w-[20%] ${TABLE_HEAD_CLS}`}>Nota</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-400">Nessun documento con questi filtri</TableCell></TableRow>
                                ) : rows.map(d => (
                                    <TableRow key={d.id} className="cursor-pointer" onClick={() => openRow(d)}>
                                        <TableCell className="border-r py-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="shrink-0">{getFileIcon(d.fileType, "h-5 w-5")}</span>
                                                <span className="truncate text-sm font-medium" title={d.name}>{d.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={typeNameOf(d)}>{typeNameOf(d)}</TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={folderNameOf(d)}>{folderNameOf(d) || <span className="text-slate-300">—</span>}</TableCell>
                                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{format(new Date(d.createdAt), "dd/MM/yyyy", { locale: it })}</TableCell>
                                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{d.fileSize != null ? formatFileSize(d.fileSize) : "—"}</TableCell>
                                        <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                            <InlineNote value={d.notes ?? ""} onSave={v => handleSaveNote(d, v)} />
                                        </TableCell>
                                        <TableCell className="py-2 text-right">{rowMenu(d)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Elenco compatto (telefono) */}
                    <div className="space-y-2 md:hidden">
                        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>}
                        {rows.map(d => (
                            <div key={d.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => openRow(d)}>
                                <span className="mt-0.5 shrink-0">{getFileIcon(d.fileType, "h-5 w-5")}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{d.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {typeNameOf(d)}{folderNameOf(d) && ` · ${folderNameOf(d)}`} · {format(new Date(d.createdAt), "dd/MM/yyyy", { locale: it })}
                                        {d.fileSize != null && ` · ${formatFileSize(d.fileSize)}`}
                                    </p>
                                    <div className="mt-1" onClick={e => e.stopPropagation()}>
                                        <InlineNote value={d.notes ?? ""} onSave={v => handleSaveNote(d, v)} />
                                    </div>
                                </div>
                                {rowMenu(d)}
                            </div>
                        ))}
                    </div>

                    <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={sorted.length} itemLabel="documenti" />
                </>
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
                                <SelectTrigger><SelectValue placeholder="Seleziona tipo documento" /></SelectTrigger>
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

            {galleryOpen && (
                <PhotoGallery
                    images={galleryImages}
                    index={galleryIndex}
                    onIndexChange={setGalleryIndex}
                    onClose={() => setGalleryOpen(false)}
                />
            )}
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
    // Filtri e ordinamento della tabella
    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [originFilter, setOriginFilter] = useState("all")
    const [sortKey, setSortKey] = useState<AssocSortKey>("name")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
    const [page, setPage] = useState(1)

    // Conf. Ass. DDT: documenti di conformità tracciati automaticamente dai DDT associati manualmente
    const [ddtDocs, setDdtDocs] = useState<ComplianceDocument[]>([])

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [assocs, ddt] = await Promise.all([
                jobComplianceApi.getByJobId(jobId),
                complianceApi.getByJobIdFromDDT(jobId),
            ])
            setAssociations(assocs)
            setDdtDocs(ddt)
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

    const handleSaveAssocNote = async (assoc: JobComplianceAssociation, notes: string) => {
        if (notes === (assoc.customNotes ?? "")) return
        try {
            await jobComplianceApi.update(assoc.id, { customNotes: notes || null })
            setAssociations(prev => prev.map(x => (x.id === assoc.id ? { ...x, customNotes: notes || undefined } : x)))
        } catch {
            toast.error("Errore nel salvataggio della nota")
        }
    }

    const openEditAssoc = (assoc: JobComplianceAssociation) => {
        setEditing(assoc)
        setEditName(assoc.customName || "")
        setEditNotes(assoc.customNotes || "")
        setEditOpen(true)
    }

    const handleAssociated = () => {
        load()
    }

    // Una riga per ogni documento: associato a mano dalla gestione conformità, oppure tracciato dai DDT
    const allRows: AssocRow[] = [
        ...associations.map((assoc): AssocRow => ({
            id: assoc.id,
            kind: "manual",
            name: assoc.customName || assoc.document?.name || "—",
            original: assoc.customName && assoc.document?.name ? assoc.document.name : "",
            typeName: assoc.document?.documentTypeName || "Senza tipo",
            brand: assoc.document?.brandName || "",
            origin: "Associato",
            notes: assoc.customNotes || "",
            fileUrl: assoc.document?.fileUrl || "",
            assoc,
        })),
        ...ddtDocs.map((d): AssocRow => ({
            id: `ddt-${d.id}`,
            kind: "ddt",
            name: d.name,
            original: "",
            typeName: d.documentTypeName || "Senza tipo",
            brand: "",
            origin: d.purchaseNumber ? `Da DDT ${d.purchaseNumber}` : "Da DDT",
            notes: d.notes || "",
            fileUrl: d.fileUrl || "",
        })),
    ]
    const typeOptions = Array.from(new Set(allRows.map(r => r.typeName))).sort((x, y) => x.localeCompare(y, "it"))
    const anyFilter = !!search.trim() || typeFilter !== "all" || originFilter !== "all"

    const sorted = (() => {
        const q = search.trim().toLowerCase()
        const list = allRows.filter(r => {
            if (typeFilter !== "all" && r.typeName !== typeFilter) return false
            if (originFilter !== "all" && r.kind !== originFilter) return false
            return !q || `${r.name} ${r.original} ${r.typeName} ${r.brand} ${r.origin} ${r.notes}`.toLowerCase().includes(q)
        })
        const dir = sortDir === "asc" ? 1 : -1
        return [...list].sort((x, y) => {
            const key = sortKey === "name" ? "name" : sortKey === "type" ? "typeName" : sortKey === "brand" ? "brand" : "origin"
            const xv = x[key] || "~"
            const yv = y[key] || "~"
            return xv.localeCompare(yv, "it") * dir || x.name.localeCompare(y.name, "it")
        })
    })()
    const totalPages = Math.max(1, Math.ceil(sorted.length / OWN_PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const rows = sorted.slice((currentPage - 1) * OWN_PAGE_SIZE, currentPage * OWN_PAGE_SIZE)
    const toggleSort = (key: AssocSortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
        else { setSortKey(key); setSortDir("asc") }
        setPage(1)
    }
    const sortBtn = (key: AssocSortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}<SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    )
    const typeSelect = (cls?: string) => (
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per tipo" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {typeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
        </Select>
    )
    const originSelect = (cls?: string) => (
        <Select value={originFilter} onValueChange={v => { setOriginFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per origine" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Ogni origine</SelectItem>
                <SelectItem value="manual">Associati</SelectItem>
                <SelectItem value="ddt">Da DDT</SelectItem>
            </SelectContent>
        </Select>
    )
    const rowMenu = (r: AssocRow) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                {r.fileUrl && <DropdownMenuItem onClick={() => openDoc(r.fileUrl)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>}
                {r.assoc && (
                    <>
                        <DropdownMenuItem onClick={() => openEditAssoc(r.assoc!)}><Pencil className="mr-2 h-4 w-4" />Personalizza</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setToDisassociate(r.assoc!); setDisassociateOpen(true) }} className="text-red-600 focus:text-red-600">
                            <Unlink className="mr-2 h-4 w-4" />Disassocia
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
    const hasMenu = (r: AssocRow) => !!r.fileUrl || !!r.assoc

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti associati dalla gestione conformità
                </h3>
                <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />Associa
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : allRows.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento associato</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Cerca per nome, marca o nota" className="pl-8" />
                        </div>
                        {anyFilter && (
                            <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={() => { setSearch(""); setTypeFilter("all"); setOriginFilter("all"); setPage(1) }}>Azzera filtri</Button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:hidden">{typeSelect()}{originSelect()}</div>

                    {/* Tabella (PC) */}
                    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={TABLE_HEAD_CLS}>{sortBtn("name", "Documento")}</TableHead>
                                    <TableHead className={`w-48 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{typeSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "type"} dir={sortDir} /></button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-36 ${TABLE_HEAD_CLS}`}>{sortBtn("brand", "Marca")}</TableHead>
                                    <TableHead className={`w-44 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{originSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per origine" onClick={() => toggleSort("origin")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "origin"} dir={sortDir} /></button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-[24%] ${TABLE_HEAD_CLS}`}>Nota</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-400">Nessun documento con questi filtri</TableCell></TableRow>
                                ) : rows.map(r => (
                                    <TableRow key={r.id} className={r.fileUrl ? "cursor-pointer" : ""} onClick={() => r.fileUrl && openDoc(r.fileUrl)}>
                                        <TableCell className="border-r py-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium" title={r.name}>{r.name}</p>
                                                    {r.original && <p className="truncate text-[11px] text-slate-400" title={`Originale: ${r.original}`}>Originale: {r.original}</p>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.typeName}>{r.typeName}</TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.brand}>{r.brand || <span className="text-slate-300">—</span>}</TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.origin}>{r.origin}</TableCell>
                                        <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                            <InlineNote value={r.notes} disabled={!r.assoc} onSave={v => handleSaveAssocNote(r.assoc!, v)} />
                                        </TableCell>
                                        <TableCell className="py-2 text-right">{hasMenu(r) && rowMenu(r)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Elenco compatto (telefono) */}
                    <div className="space-y-2 md:hidden">
                        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>}
                        {rows.map(r => (
                            <div key={r.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => r.fileUrl && openDoc(r.fileUrl)}>
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{r.name}</p>
                                    <p className="text-xs text-slate-500">{r.typeName}{r.brand && ` · ${r.brand}`} · {r.origin}</p>
                                    <div className="mt-1" onClick={e => e.stopPropagation()}>
                                        <InlineNote value={r.notes} disabled={!r.assoc} onSave={v => handleSaveAssocNote(r.assoc!, v)} />
                                    </div>
                                </div>
                                {hasMenu(r) && rowMenu(r)}
                            </div>
                        ))}
                    </div>

                    <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={sorted.length} itemLabel="documenti" />
                </>
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
        Promise.all([suppliersApi.getAll(), supplierGroupsApi.getHiddenFromPurchasesIds()])
            .then(([s, hiddenIds]) => setSuppliers(s.filter(sup => !hiddenIds.includes(sup.id))))
            .catch(() => {})
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
