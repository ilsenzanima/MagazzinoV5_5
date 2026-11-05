"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Trash2, Loader2, Pencil, X, Download, FolderInput, FolderPlus, MoreHorizontal, ExternalLink, Search } from "lucide-react"
import { jobSiteDocumentsApi, SiteDocument } from "@/lib/services/job-site-documents"
import { jobSiteDocumentTypesApi, JobSiteDocumentType } from "@/lib/services/job-site-document-types"
import { jobSiteDocumentFoldersApi, JobSiteDocumentFolder } from "@/lib/services/job-site-document-folders"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { getFileIcon, formatFileSize } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"
import { OldRevCheckboxes, OldRevBadges } from "@/components/documents/OldRevControls"
import { PhotoGallery, PhotoGalleryImage, isImageFileType } from "@/components/ui/photo-gallery"
import { resolveDocumentDisplayUrl } from "@/lib/resolve-document-url"

interface JobDocumentsProps {
  jobId: string
  jobLabel?: string
}

interface PendingFile {
  file: File
  name: string
  notes: string
  isOld: boolean
  isRev: boolean
}

const UNTYPED_KEY = "__untyped__"
const OFFICE_EXTENSIONS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])

// Nota modificabile con un clic: si salva uscendo dal campo o con Invio, Esc annulla
function InlineNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const commit = () => { setEditing(false); onSave(draft.trim()) }
  if (editing) {
    return (
      <Input
        autoFocus
        className="h-7 w-full text-xs"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
      />
    )
  }
  return (
    <button
      type="button"
      className="block w-full truncate rounded px-1 py-0.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
      title={value || "Aggiungi una nota"}
      onClick={() => { setDraft(value); setEditing(true) }}
    >
      {value || <span className="italic text-slate-300">Aggiungi nota</span>}
    </button>
  )
}

export function JobDocuments({ jobId, jobLabel }: JobDocumentsProps) {
  const [documents, setDocuments] = useState<SiteDocument[]>([])
  const [docTypes, setDocTypes] = useState<JobSiteDocumentType[]>([])
  const [folders, setFolders] = useState<JobSiteDocumentFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeDoc, setActiveDoc] = useState<SiteDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  // Filtri della tabella
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [folderFilter, setFolderFilter] = useState<string>("all")

  // Galleria foto
  const [galleryImages, setGalleryImages] = useState<PhotoGalleryImage[]>([])
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const openGalleryForDoc = async (doc: SiteDocument, siblingDocs: SiteDocument[]) => {
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
  const [movingDoc, setMovingDoc] = useState<SiteDocument | null>(null)
  const [moveFolderId, setMoveFolderId] = useState("root")
  const [moving, setMoving] = useState(false)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editDocTypeId, setEditDocTypeId] = useState("")
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editIsOld, setEditIsOld] = useState(false)
  const [editIsRev, setEditIsRev] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (jobId) loadDocuments()
  }, [jobId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const [all, types, jobFolders] = await Promise.all([
        jobSiteDocumentsApi.getByJobId(jobId),
        jobSiteDocumentTypesApi.getAll(),
        jobSiteDocumentFoldersApi.getByJobId(jobId),
      ])
      setDocuments(all)
      setDocTypes(types)
      setFolders(jobFolders)
    } catch (error) {
      console.error("Failed to load documents", error)
      toast.error("Errore nel caricamento dei documenti")
    } finally {
      setLoading(false)
    }
  }

  // Percorso Drive base per un tipo documento: se il tipo consente cartelle,
  // i suoi file vivono in una sottocartella dedicata al tipo, altrimenti
  // restano nella cartella piatta "Documenti" (comportamento storico).
  const typeBaseSegments = (type?: JobSiteDocumentType) => {
    const base = ['Cantieri', jobLabel || jobId, 'Documenti']
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
      const folder = await jobSiteDocumentFoldersApi.create({
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

  const openMove = (doc: SiteDocument) => {
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
      const type = docTypes.find(t => t.id === movingDoc.documentTypeId)
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

      await jobSiteDocumentsApi.update(movingDoc.id, { folderId: targetFolderId })
      toast.success("Documento spostato")
      setMoveOpen(false)
      loadDocuments()
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
        isOld: false,
        isRev: false,
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
    if (pendingFiles.length === 0 || !jobId) return
    setUploading(true)
    const selectedType = docTypes.find(t => t.id === upDocTypeId)
    const selectedFolder = upFolderId ? folders.find(f => f.id === upFolderId) : undefined
    const segments = selectedFolder
      ? [...typeBaseSegments(selectedType), selectedFolder.name]
      : typeBaseSegments(selectedType)
    const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pf => {
      const compressed = await compressImageIfNeeded(pf.file)
      const fileExt = compressed.name.split('.').pop() || ''
      const uploaded = await uploadFileToDrive(compressed, segments)

      await jobSiteDocumentsApi.create({
        jobId,
        documentTypeId: upDocTypeId || null,
        folderId: upFolderId || null,
        name: pf.name.trim() || pf.file.name,
        notes: pf.notes.trim(),
        fileUrl: uploaded.fileId,
        fileType: fileExt,
        fileSize: compressed.size,
        uploadedBy: '',
        uploadedByName: '',
        isOld: pf.isOld,
        isRev: pf.isRev,
      })
    })
    setUploading(false)
    if (failedCount === 0) {
      toast.success(okCount > 1 ? "Documenti caricati con successo" : "Documento caricato con successo")
      setUploadOpen(false)
    } else if (okCount === 0) {
      toast.error("Nessun documento caricato, riprova")
    } else {
      toast.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`)
      setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'))
    }
    loadDocuments()
  }

  const openEdit = (doc: SiteDocument, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveDoc(doc)
    setEditName(doc.name)
    setEditNotes(doc.notes || "")
    setEditDocTypeId(doc.documentTypeId || "")
    setEditFile(null)
    setEditIsOld(doc.isOld)
    setEditIsRev(doc.isRev)
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
        const uploaded = await uploadFileToDrive(compressed, ['Cantieri', jobLabel || jobId, 'Documenti'])
        fileUrl = uploaded.fileId
        fileType = fileExt
        fileSize = compressed.size
      }

      await jobSiteDocumentsApi.update(activeDoc.id, {
        name: editName.trim() || activeDoc.name,
        notes: editNotes.trim(),
        documentTypeId: editDocTypeId || null,
        fileUrl,
        fileType,
        fileSize,
        isOld: editIsOld,
        isRev: editIsRev,
      })
      toast.success("Documento aggiornato")
      setEditOpen(false)
      loadDocuments()
    } catch {
      toast.error("Errore durante l'aggiornamento")
    } finally {
      setSaving(false)
    }
  }

  // Nota modificata direttamente in tabella
  const handleSaveNote = async (doc: SiteDocument, notes: string) => {
    if (notes === doc.notes) return
    try {
      await jobSiteDocumentsApi.update(doc.id, { notes })
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, notes } : d))
    } catch {
      toast.error("Errore nel salvataggio della nota")
    }
  }

  const handleOpenDocument = async (fileUrl: string, fileName?: string) => {
    if (fileUrl && !fileUrl.includes('/')) {
      window.open(`/api/drive/download?fileId=${encodeURIComponent(fileUrl)}&fileName=${encodeURIComponent(fileName || 'documento')}`, '_blank');
      return;
    }
    try {
      const path = fileUrl.split('/public/documents/')[1];
      if (!path) { window.open(fileUrl, '_blank'); return; }
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) { window.open(fileUrl, '_blank'); return; }
      window.open(data.signedUrl, '_blank');
    } catch {
      window.open(fileUrl, '_blank');
    }
  };

  const handleDelete = async () => {
    if (!activeDoc) return

    try {
      const path = activeDoc.fileUrl?.includes('/public/documents/') ? activeDoc.fileUrl.split('/public/documents/')[1] : undefined
      if (path) await supabase.storage.from('documents').remove([path])
      await jobSiteDocumentsApi.delete(activeDoc.id)
      setDeleteOpen(false)
      setEditOpen(false)
      toast.success("Documento eliminato")
      setDocuments(documents.filter(d => d.id !== activeDoc.id))
      setActiveDoc(null)
    } catch (error) {
      console.error("Delete failed", error)
      toast.error("Errore durante l'eliminazione")
    }
  }

  const typeName = (doc: SiteDocument) => docTypes.find(t => t.id === doc.documentTypeId)?.name || "Senza tipo"
  const folderName = (doc: SiteDocument) => (doc.folderId ? folders.find(f => f.id === doc.folderId)?.name : undefined) || ""
  const isDriveFile = (doc: SiteDocument) => !!doc.fileUrl && !doc.fileUrl.includes('/')

  const filterType = typeFilter !== "all" && typeFilter !== UNTYPED_KEY ? docTypes.find(t => t.id === typeFilter) : undefined
  const filterFolders = filterType ? folders.filter(f => f.documentTypeId === filterType.id) : []
  const shownDocs = documents.filter(d => {
    if (typeFilter === UNTYPED_KEY ? !!d.documentTypeId : typeFilter !== "all" && d.documentTypeId !== typeFilter) return false
    if (filterType?.allowsFolders && folderFilter !== "all") {
      if (folderFilter === "root" ? !!d.folderId : d.folderId !== folderFilter) return false
    }
    const q = search.trim().toLowerCase()
    if (q && !`${d.name} ${d.notes} ${typeName(d)} ${folderName(d)}`.toLowerCase().includes(q)) return false
    return true
  })

  const openDoc = (doc: SiteDocument) =>
    isImageFileType(doc.fileType) ? openGalleryForDoc(doc, shownDocs) : handleOpenDocument(doc.fileUrl, doc.name)

  const askDelete = (doc: SiteDocument) => { setActiveDoc(doc); setDeleteOpen(true) }

  const rowMenu = (doc: SiteDocument) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDoc(doc)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
        {isDriveFile(doc) && (
          <DropdownMenuItem onClick={() => window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank')}>
            <Download className="mr-2 h-4 w-4" />Scarica
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={e => openEdit(doc, e as unknown as React.MouseEvent)}><Pencil className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
        {docTypes.find(t => t.id === doc.documentTypeId)?.allowsFolders && (
          <DropdownMenuItem onClick={() => openMove(doc)}><FolderInput className="mr-2 h-4 w-4" />Sposta in cartella</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => askDelete(doc)} className="text-red-600 focus:text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Documenti Cantiere</h2>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Carica Documenti
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-slate-500">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessun documento</h3>
            <p className="text-slate-500 dark:text-slate-400">Carica progetti, permessi, o foto del cantiere.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filtri */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca per nome o nota" className="pl-8" />
            </div>
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setFolderFilter("all") }}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                {documents.some(d => !d.documentTypeId) && <SelectItem value={UNTYPED_KEY}>Senza tipo</SelectItem>}
              </SelectContent>
            </Select>
            {filterType?.allowsFolders && (
              <>
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le cartelle</SelectItem>
                    <SelectItem value="root">Senza cartella</SelectItem>
                    {filterFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => openNewFolder(filterType.id)}>
                  <FolderPlus className="mr-1.5 h-4 w-4" />Nuova cartella
                </Button>
              </>
            )}
            <span className="ml-auto text-xs text-slate-500">{shownDocs.length} di {documents.length}</span>
          </div>

          {shownDocs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>
          ) : (
            <>
              {/* Tabella (PC) */}
              <div className="hidden rounded-md border bg-white dark:bg-slate-900 md:block">
                <Table className="table-fixed [&_td]:px-3 [&_th]:px-3">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Documento</TableHead>
                      <TableHead className="w-40 text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo</TableHead>
                      <TableHead className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-600">Cartella</TableHead>
                      <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-slate-600">Data</TableHead>
                      <TableHead className="w-24 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Dimensione</TableHead>
                      <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wide text-slate-600">Nota</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownDocs.map(doc => (
                      <TableRow key={doc.id} className="cursor-pointer" onClick={() => openDoc(doc)}>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</span>
                            <span className="truncate text-sm font-medium" title={doc.name}>{doc.name}</span>
                            <OldRevBadges isOld={doc.isOld} isRev={doc.isRev} />
                          </div>
                        </TableCell>
                        <TableCell className="truncate text-sm text-slate-600 dark:text-slate-300" title={typeName(doc)}>{typeName(doc)}</TableCell>
                        <TableCell className="truncate text-sm text-slate-600 dark:text-slate-300" title={folderName(doc)}>{folderName(doc) || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: it })}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm text-slate-600 dark:text-slate-300">{doc.fileSize != null ? formatFileSize(doc.fileSize) : '—'}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <InlineNote value={doc.notes} onSave={v => handleSaveNote(doc, v)} />
                        </TableCell>
                        <TableCell className="text-right">{rowMenu(doc)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Elenco compatto (telefono) */}
              <div className="space-y-2 md:hidden">
                {shownDocs.map(doc => (
                  <div key={doc.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => openDoc(doc)}>
                    <span className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-medium">{doc.name}</p>
                        <OldRevBadges isOld={doc.isOld} isRev={doc.isRev} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {typeName(doc)}{folderName(doc) && ` · ${folderName(doc)}`} · {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: it })}
                        {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
                      </p>
                      <div className="mt-1" onClick={e => e.stopPropagation()}>
                        <InlineNote value={doc.notes} onSave={v => handleSaveNote(doc, v)} />
                      </div>
                    </div>
                    {rowMenu(doc)}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Upload dialog - step 1: tipo + file multipli */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Carica Documenti</DialogTitle></DialogHeader>
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
                  <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti Cantiere per crearne uno.</p>
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
                  <OldRevCheckboxes
                    idPrefix={`up-${idx}`}
                    isOld={pf.isOld}
                    isRev={pf.isRev}
                    onOldChange={v => updatePending(idx, { isOld: v })}
                    onRevChange={v => updatePending(idx, { isRev: v })}
                  />
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
          <DialogHeader><DialogTitle>Modifica Documento</DialogTitle></DialogHeader>
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
            <div className="space-y-1">
              <Label>Nome documento</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nota</Label>
              <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Breve descrizione" />
            </div>
            <OldRevCheckboxes
              idPrefix="edit"
              isOld={editIsOld}
              isRev={editIsRev}
              onOldChange={setEditIsOld}
              onRevChange={setEditIsRev}
            />
            <div className="space-y-1">
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
        description={`Il documento "${activeDoc?.name || 'selezionato'}" verrà eliminato definitivamente e non potrà essere recuperato.`}
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
                {folders.filter(f => f.documentTypeId === movingDoc?.documentTypeId).map(f => (
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
