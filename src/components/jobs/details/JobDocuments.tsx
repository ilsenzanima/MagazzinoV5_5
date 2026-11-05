"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Trash2, Loader2, Pencil, X, Download, FolderInput, FolderPlus, MoreHorizontal, ExternalLink, Search, Images, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
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
import { jobSiteTypeNotesApi } from "@/lib/services/job-site-type-notes"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { NotchTabs, NotchHelp, NotchSearch } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { JobPhotoCollection, PhotoThumb } from "./JobPhotoCollection"

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
const PAGE_SIZE = 50

type SortKey = "name" | "type" | "folder" | "date" | "size"

// Riga della tabella: un documento, oppure una raccolta di foto (un tipo, o una cartella di quel tipo)
interface RowBase { id: string; name: string; typeId: string; typeName: string; folderId: string; folderName: string; date: string; size: number }
interface DocRow extends RowBase { kind: "doc"; doc: SiteDocument }
interface CollectionRow extends RowBase { kind: "collection"; type: JobSiteDocumentType; folder: JobSiteDocumentFolder | null; docs: SiteDocument[]; notes: string }
type TableRowData = DocRow | CollectionRow

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />
  return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
}
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  // Raccolta di foto aperta (pagina dedicata); null = tabella
  const [openCollection, setOpenCollection] = useState<{ typeId: string; folderId: string | null } | null>(null)

  // La raccolta aperta è un passo della cronologia del browser: «indietro» torna alla tabella
  // invece di uscire dalla commessa (e «avanti» la riapre).
  type CollectionRef = { typeId: string; folderId: string | null }
  useEffect(() => {
    const saved = (window.history.state as { magCollection?: CollectionRef } | null)?.magCollection
    if (saved) setOpenCollection(saved)
    const onPop = (e: PopStateEvent) => setOpenCollection((e.state as { magCollection?: CollectionRef } | null)?.magCollection ?? null)
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      // Uscendo dalla scheda (es. Dettagli o Costi) la raccolta non deve restare scritta nella voce
      // corrente della cronologia, altrimenti al ritorno sui documenti si riaprirebbe da sola
      const st = window.history.state as Record<string, unknown> | null
      if (st && "magCollection" in st) {
        const { magCollection: _removed, ...rest } = st
        window.history.replaceState(rest, "")
      }
    }
  }, [])
  const showCollection = (c: CollectionRef) => {
    window.history.pushState({ ...(window.history.state ?? {}), magCollection: c }, "")
    setOpenCollection(c)
  }
  const closeCollection = () => {
    if ((window.history.state as { magCollection?: CollectionRef } | null)?.magCollection) window.history.back()
    else setOpenCollection(null)
  }

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
  const [movingDocs, setMovingDocs] = useState<SiteDocument[]>([])
  const [bulkDeleteDocs, setBulkDeleteDocs] = useState<SiteDocument[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [folderToDelete, setFolderToDelete] = useState<JobSiteDocumentFolder | null>(null)
  const mergedFolderIds = useRef<Record<string, string[]>>({})
  // Note delle raccolte senza cartella (per tipo)
  const [typeNotes, setTypeNotes] = useState<Record<string, string>>({})
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
      const [all, types, jobFolders, notesByType] = await Promise.all([
        jobSiteDocumentsApi.getByJobId(jobId),
        jobSiteDocumentTypesApi.getAll(),
        jobSiteDocumentFoldersApi.getByJobId(jobId),
        jobSiteTypeNotesApi.getByJobId(jobId).catch(() => ({} as Record<string, string>)),
      ])
      setTypeNotes(notesByType)
      // I documenti sono condivisi con la proposta di origine: le loro cartelle possono appartenere
      // alla proposta e non alla commessa. Si caricano anche quelle e si uniscono le omonime
      // (stesso tipo e stesso nome) in una sola, per non perdere documenti né duplicare righe.
      const proposalIds = Array.from(new Set(all.map(d => d.proposalId).filter((v): v is string => !!v)))
      const proposalFolders = (await Promise.all(proposalIds.map(id => jobSiteDocumentFoldersApi.getByProposalId(id)))).flat()
      const everyFolder = new Map([...jobFolders, ...proposalFolders].map(f => [f.id, f] as const))
      const docsIn = new Map<string, number>()
      all.forEach(d => { if (d.folderId) docsIn.set(d.folderId, (docsIn.get(d.folderId) ?? 0) + 1) })
      const keyOf = (f: JobSiteDocumentFolder) => `${f.documentTypeId}|${f.name.trim().toLowerCase()}`
      const keeper = new Map<string, JobSiteDocumentFolder>()
      everyFolder.forEach(f => {
        const cur = keeper.get(keyOf(f))
        if (!cur || (docsIn.get(f.id) ?? 0) > (docsIn.get(cur.id) ?? 0)) keeper.set(keyOf(f), f)
      })
      const aliasOf = (id: string) => { const f = everyFolder.get(id); return f ? keeper.get(keyOf(f))!.id : null }
      const merged: Record<string, string[]> = {}
      everyFolder.forEach(f => { const k = keeper.get(keyOf(f))!.id; (merged[k] ||= []).push(f.id) })
      mergedFolderIds.current = merged
      setDocuments(all.map(d => (d.folderId ? { ...d, folderId: aliasOf(d.folderId) } : d)))
      setDocTypes(types)
      // La nota di una cartella unita resta quella della prima copia che ne ha una
      const withNotes = Array.from(keeper.values()).map(k => ({
        ...k,
        notes: k.notes || Array.from(everyFolder.values()).find(f => keyOf(f) === keyOf(k) && f.notes)?.notes || '',
      }))
      setFolders(withNotes.sort((a, b) => a.name.localeCompare(b.name, "it")))
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

  const openUpload = (preset?: { typeId: string; folderId: string | null }) => {
    setUpStep(1)
    setUpDocTypeId(preset?.typeId ?? "")
    setUpFolderId(preset?.folderId ?? "")
    setPendingFiles([])
    setDragOver(false)
    batchUpload.reset()
    setUploadOpen(true)
  }

  const openNewFolder = (typeId?: string) => {
    setNewFolderTypeId(typeId || docTypes.find(t => t.allowsFolders)?.id || "")
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

  const openMove = (list: SiteDocument[]) => {
    setMovingDocs(list)
    setMoveFolderId(list.length === 1 ? (list[0].folderId || "root") : "root")
    setMoveOpen(true)
  }

  const handleMove = async () => {
    if (movingDocs.length === 0) return
    const targetFolderId = moveFolderId === "root" ? null : moveFolderId
    const toMove = movingDocs.filter(d => (d.folderId || null) !== targetFolderId)
    if (toMove.length === 0) { setMoveOpen(false); return }
    let done = 0
    try {
      setMoving(true)
      const type = docTypes.find(t => t.id === toMove[0].documentTypeId)
      const targetFolder = targetFolderId ? folders.find(f => f.id === targetFolderId) : undefined
      const segments = targetFolder ? [...typeBaseSegments(type), targetFolder.name] : typeBaseSegments(type)

      // I file su Drive vanno spostati solo se hanno un vero id Drive (non un vecchio path Supabase)
      let driveFolderId: string | null = null
      if (toMove.some(isDriveFile)) {
        const ensureRes = await fetch('/api/drive/ensure-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments }),
        })
        const ensured = await ensureRes.json()
        if (!ensureRes.ok) throw new Error(ensured.error || 'Errore risoluzione cartella')
        driveFolderId = ensured.folderId
      }

      for (const doc of toMove) {
        if (driveFolderId && isDriveFile(doc)) {
          const moveRes = await fetch('/api/drive/move-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: doc.fileUrl, newParentId: driveFolderId }),
          })
          const moved = await moveRes.json()
          if (!moveRes.ok) throw new Error(moved.error || 'Errore spostamento file')
        }
        await jobSiteDocumentsApi.update(doc.id, { folderId: targetFolderId })
        done++
      }
      toast.success(toMove.length > 1 ? `${toMove.length} documenti spostati` : "Documento spostato")
      setMoveOpen(false)
    } catch {
      toast.error(toMove.length > 1 ? `Spostati ${done} documenti su ${toMove.length}: errore durante lo spostamento` : "Errore durante lo spostamento")
    } finally {
      setMoving(false)
      loadDocuments()
    }
  }

  // Nota di una raccolta (cartella, oppure tipo senza cartella) modificata direttamente in tabella
  const handleSaveCollectionNote = async (r: CollectionRow, notes: string) => {
    if (notes === r.notes) return
    try {
      if (r.folder) {
        const ids = mergedFolderIds.current[r.folder.id] ?? [r.folder.id]
        for (const id of ids) await jobSiteDocumentFoldersApi.setNotes(id, notes)
        setFolders(prev => prev.map(f => (f.id === r.folder!.id ? { ...f, notes } : f)))
      } else {
        await jobSiteTypeNotesApi.set(jobId, r.typeId, notes)
        setTypeNotes(prev => ({ ...prev, [r.typeId]: notes }))
      }
    } catch {
      toast.error("Errore nel salvataggio della nota")
    }
  }

  // Una cartella si elimina solo se è vuota: le foto vanno prima spostate o eliminate
  const askDeleteFolder = (folder: JobSiteDocumentFolder) => {
    const n = documents.filter(d => d.folderId === folder.id).length
    if (n > 0) {
      toast.error(`La cartella contiene ${n} ${n === 1 ? "documento" : "documenti"}: spostali o eliminali prima di eliminare la cartella`)
      return
    }
    setFolderToDelete(folder)
  }

  const handleDeleteFolder = async () => {
    const folder = folderToDelete
    if (!folder) return
    const ids = mergedFolderIds.current[folder.id] ?? [folder.id]
    try {
      for (const id of ids) await jobSiteDocumentFoldersApi.delete(id)
      setFolders(prev => prev.filter(f => f.id !== folder.id))
      if (folderFilter === folder.id) setFolderFilter("all")
      toast.success("Cartella eliminata")
    } catch {
      toast.error("Errore durante l'eliminazione della cartella")
    } finally {
      setFolderToDelete(null)
    }
  }

  // Eliminazione di piu' documenti insieme (selezione nella pagina delle foto)
  const handleBulkDelete = async () => {
    const list = bulkDeleteDocs
    if (list.length === 0) return
    const deleted = new Set<string>()
    for (const doc of list) {
      try {
        const path = doc.fileUrl?.includes('/public/documents/') ? doc.fileUrl.split('/public/documents/')[1] : undefined
        if (path) await supabase.storage.from('documents').remove([path])
        await jobSiteDocumentsApi.delete(doc.id)
        deleted.add(doc.id)
      } catch (error) {
        console.error("Delete failed", doc.id, error)
      }
    }
    setDocuments(prev => prev.filter(d => !deleted.has(d.id)))
    setBulkDeleteDocs([])
    if (deleted.size === list.length) toast.success(list.length > 1 ? `${list.length} documenti eliminati` : "Documento eliminato")
    else toast.error(`Eliminati ${deleted.size} documenti su ${list.length}`)
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

  const typeNameOf = (doc: SiteDocument) => docTypes.find(t => t.id === doc.documentTypeId)?.name || "Senza tipo"
  const folderNameOf = (doc: SiteDocument) => (doc.folderId ? folders.find(f => f.id === doc.folderId)?.name : undefined) || ""
  const isDriveFile = (doc: SiteDocument) => !!doc.fileUrl && !doc.fileUrl.includes('/')

  // Righe: una per raccolta di foto (il tipo e ogni sua cartella) + una per documento
  const photoTypes = docTypes.filter(t => t.isPhotoGallery)
  const photoTypeIds = new Set(photoTypes.map(t => t.id))
  const latest = (list: SiteDocument[]) => list.reduce((m, d) => (d.createdAt > m ? d.createdAt : m), "")
  const allRows: TableRowData[] = [
    ...photoTypes.flatMap(t => {
      const typeDocs = documents.filter(d => d.documentTypeId === t.id)
      const groups: { folder: JobSiteDocumentFolder | null; docs: SiteDocument[] }[] = [
        { folder: null, docs: typeDocs.filter(d => !d.folderId) },
        ...folders.filter(f => f.documentTypeId === t.id).map(f => ({ folder: f, docs: typeDocs.filter(d => d.folderId === f.id) })),
      ]
      return groups.map((g): CollectionRow => ({
        kind: "collection",
        id: `c:${t.id}:${g.folder?.id ?? "root"}`,
        type: t,
        folder: g.folder,
        docs: g.docs,
        name: g.folder ? g.folder.name : t.name,
        typeId: t.id,
        typeName: t.name,
        folderId: g.folder?.id ?? "",
        folderName: g.folder?.name ?? "",
        date: latest(g.docs),
        size: g.docs.reduce((n, d) => n + (d.fileSize ?? 0), 0),
        notes: g.folder ? (g.folder.notes ?? '') : (typeNotes[t.id] ?? ''),
      }))
    }),
    ...documents.filter(d => !photoTypeIds.has(d.documentTypeId ?? "")).map((doc): DocRow => ({
      kind: "doc",
      id: doc.id,
      doc,
      name: doc.name,
      typeId: doc.documentTypeId ?? "",
      typeName: typeNameOf(doc),
      folderId: doc.folderId ?? "",
      folderName: folderNameOf(doc),
      date: doc.createdAt,
      size: doc.fileSize ?? 0,
    })),
  ]

  const filterType = typeFilter !== "all" && typeFilter !== UNTYPED_KEY ? docTypes.find(t => t.id === typeFilter) : undefined
  const folderOptions = folders.filter(f => !filterType || f.documentTypeId === filterType.id)
  const anyFilterActive = !!search.trim() || typeFilter !== "all" || folderFilter !== "all"

  const filtered = allRows.filter(r => {
    if (typeFilter === UNTYPED_KEY ? r.typeId !== "" : typeFilter !== "all" && r.typeId !== typeFilter) return false
    if (folderFilter === "root" ? r.folderId !== "" : folderFilter !== "all" && r.folderId !== folderFilter) return false
    const q = search.trim().toLowerCase()
    if (q) {
      const inside = r.kind === "doc" ? r.doc.notes : `${r.notes} ${r.docs.map(d => `${d.name} ${d.notes}`).join(" ")}`
      if (!`${r.name} ${r.typeName} ${r.folderName} ${inside}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const cmp = (a: string, b: string) => a.localeCompare(b, "it")
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) {
      // Predefinito: prima le raccolte di foto, poi i documenti dal più recente
      if (a.kind !== b.kind) return a.kind === "collection" ? -1 : 1
      if (a.kind === "collection") return cmp(a.typeName, b.typeName) || cmp(a.folderName, b.folderName)
      return b.date.localeCompare(a.date)
    }
    let r = 0
    if (sortKey === "name") r = cmp(a.name, b.name)
    else if (sortKey === "type") r = cmp(a.typeName, b.typeName) || cmp(a.name, b.name)
    else if (sortKey === "folder") r = cmp(a.folderName || "~", b.folderName || "~") || cmp(a.name, b.name)
    else if (sortKey === "date") r = a.date.localeCompare(b.date)
    else r = a.size - b.size
    return r * (sortDir === "asc" ? 1 : -1)
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const shownDocs = sorted.filter((r): r is DocRow => r.kind === "doc").map(r => r.doc)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir(key === "date" || key === "size" ? "desc" : "asc") }
    setPage(1)
  }
  const changeType = (v: string) => { setTypeFilter(v === "all" ? "all" : v); setFolderFilter("all"); setPage(1) }
  const changeFolder = (v: string) => { setFolderFilter(v); setPage(1) }
  const resetFilters = () => { setSearch(""); setTypeFilter("all"); setFolderFilter("all"); setPage(1) }

  const openDoc = (doc: SiteDocument, siblings: SiteDocument[] = shownDocs) =>
    isImageFileType(doc.fileType) ? openGalleryForDoc(doc, siblings) : handleOpenDocument(doc.fileUrl, doc.name)

  const askDelete = (doc: SiteDocument) => { setActiveDoc(doc); setDeleteOpen(true) }

  const rowMenu = (doc: SiteDocument, siblings: SiteDocument[] = shownDocs) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDoc(doc, siblings)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
        {isDriveFile(doc) && (
          <DropdownMenuItem onClick={() => window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank')}>
            <Download className="mr-2 h-4 w-4" />Scarica
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={e => openEdit(doc, e as unknown as React.MouseEvent)}><Pencil className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
        {docTypes.find(t => t.id === doc.documentTypeId)?.allowsFolders && (
          <DropdownMenuItem onClick={() => openMove([doc])}><FolderInput className="mr-2 h-4 w-4" />Sposta in cartella</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => askDelete(doc)} className="text-red-600 focus:text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />Elimina
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const collectionMenu = (r: CollectionRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni raccolta" onClick={e => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => showCollection({ typeId: r.typeId, folderId: r.folder?.id ?? null })}><Images className="mr-2 h-4 w-4" />Apri raccolta</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openUpload({ typeId: r.typeId, folderId: r.folder?.id ?? null })}><Upload className="mr-2 h-4 w-4" />Aggiungi foto</DropdownMenuItem>
        {r.folder && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => askDeleteFolder(r.folder!)} className="text-red-600 focus:text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />Elimina cartella
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const openRow = (r: TableRowData) =>
    r.kind === "collection" ? showCollection({ typeId: r.typeId, folderId: r.folder?.id ?? null }) : openDoc(r.doc)

  const countLabel = (r: CollectionRow) => `${r.docs.length} foto`

  const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600"
  const selectCls = "h-7 border-slate-300 bg-white px-2 text-xs font-semibold uppercase"
  const sortBtn = (key: SortKey, label: string) => (
    <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}
      <SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  )
  const typeSelect = (cls?: string) => (
    <Select value={typeFilter} onValueChange={changeType}>
      <SelectTrigger aria-label="Filtra per tipo" className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti i tipi</SelectItem>
        {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
        {documents.some(d => !d.documentTypeId) && <SelectItem value={UNTYPED_KEY}>Senza tipo</SelectItem>}
      </SelectContent>
    </Select>
  )
  const folderSelect = (cls?: string) => (
    <Select value={folderFilter} onValueChange={changeFolder}>
      <SelectTrigger aria-label="Filtra per cartella" className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutte le cartelle</SelectItem>
        <SelectItem value="root">Senza cartella</SelectItem>
        {folderOptions.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  // Raccolta aperta: pagina dedicata alle foto
  const collection = openCollection
    ? (() => {
        const type = docTypes.find(t => t.id === openCollection.typeId)
        const folder = openCollection.folderId ? folders.find(f => f.id === openCollection.folderId) : undefined
        const docs = documents.filter(d => d.documentTypeId === openCollection.typeId && (d.folderId ?? null) === openCollection.folderId)
        return { type, folder, docs, title: `${type?.name ?? "Foto"}${folder ? ` › ${folder.name}` : ""}` }
      })()
    : null

  return (
    <div className="space-y-4">
      {collection ? (
        <JobPhotoCollection
          title={collection.title}
          docs={collection.docs}
          onBack={closeCollection}
          onMoveSelected={docs => openMove(docs)}
          onDeleteSelected={docs => { setBulkDeleteDocs(docs); setBulkDeleteOpen(true) }}
          onAdd={() => openUpload({ typeId: openCollection!.typeId, folderId: openCollection!.folderId })}
          onOpen={doc => openDoc(doc, collection.docs)}
          menu={doc => rowMenu(doc, collection.docs)}
        />
      ) : (
        <NotchTabs title="Documenti Cantiere">
          <NotchHelp
            title="Documenti Cantiere"
            description="Tipi di documento che puoi inserire in questa sezione."
            fetchItems={async () => (await jobSiteDocumentTypesApi.getAll()).map(t => (t.isPhotoGallery ? `${t.name} (raccolta foto)` : t.name))}
            emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Cantiere per crearne uno."
          />
          <FloatingAddButton onClick={() => openUpload()} label="Carica documenti" icon={<Upload className="h-6 w-6" />} showOnMobile />

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : allRows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-slate-500">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessun documento</h3>
                <p className="text-slate-500 dark:text-slate-400">Carica progetti, permessi, o foto del cantiere.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Ricerca e comandi */}
              <div className="flex flex-wrap items-center gap-2 empty:hidden">
                <NotchSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cerca per nome o nota" />
                {anyFilterActive && (
                  <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={resetFilters}>Azzera filtri</Button>
                )}
                {docTypes.some(t => t.allowsFolders) && (
                  <Button variant="outline" size="sm" onClick={() => openNewFolder(filterType?.allowsFolders ? filterType.id : undefined)}>
                    <FolderPlus className="mr-1.5 h-4 w-4" />Nuova cartella
                  </Button>
                )}
              </div>

              {/* Telefono: filtri */}
              <div className="grid grid-cols-2 gap-2 md:hidden">
                {typeSelect()}
                {folderSelect()}
              </div>

              {/* Tabella (PC) */}
              <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                  <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                      <TableHead className={headCls}>{sortBtn("name", "Documento")}</TableHead>
                      <TableHead className={`w-44 ${headCls}`}>
                        <div className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">{typeSelect(selectCls)}</div>
                          <button type="button" aria-label="Ordina per tipo" onClick={() => toggleSort("type")} className="shrink-0 text-slate-500 hover:text-slate-900">
                            <SortArrow active={sortKey === "type"} dir={sortDir} />
                          </button>
                        </div>
                      </TableHead>
                      <TableHead className={`w-44 ${headCls}`}>
                        <div className="flex items-center gap-1">
                          <div className="min-w-0 flex-1">{folderSelect(selectCls)}</div>
                          <button type="button" aria-label="Ordina per cartella" onClick={() => toggleSort("folder")} className="shrink-0 text-slate-500 hover:text-slate-900">
                            <SortArrow active={sortKey === "folder"} dir={sortDir} />
                          </button>
                        </div>
                      </TableHead>
                      <TableHead className={`w-28 ${headCls}`}>{sortBtn("date", "Data")}</TableHead>
                      <TableHead className={`w-28 ${headCls}`}>{sortBtn("size", "Dimensione")}</TableHead>
                      <TableHead className={`w-[22%] ${headCls}`}>Nota</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                          <FileText className="mx-auto mb-2 h-12 w-12 opacity-20" />
                          Nessun documento con questi filtri
                        </TableCell>
                      </TableRow>
                    ) : pageRows.map(r => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => openRow(r)}>
                        <TableCell className="border-r py-2">
                          {r.kind === "collection" ? (
                            <div className="flex min-w-0 items-center gap-2">
                              {r.docs[0]
                                ? <PhotoThumb doc={r.docs[0]} className="h-9 w-9 shrink-0 rounded" />
                                : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800"><Images className="h-5 w-5 text-slate-400" /></span>}
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold" title={r.name}>{r.name}</p>
                                <p className="text-xs text-blue-600">{countLabel(r)}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="shrink-0">{getFileIcon(r.doc.fileType, "h-5 w-5")}</span>
                              <span className="truncate text-sm font-medium" title={r.doc.name}>{r.doc.name}</span>
                              <OldRevBadges isOld={r.doc.isOld} isRev={r.doc.isRev} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.typeName}>{r.typeName}</TableCell>
                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.folderName}>{r.folderName || <span className="text-slate-300">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                          {r.date ? format(new Date(r.date), 'dd/MM/yyyy', { locale: it }) : <span className="text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">
                          {r.kind === "doc" ? (r.doc.fileSize != null ? formatFileSize(r.doc.fileSize) : '—') : (r.size > 0 ? formatFileSize(r.size) : '—')}
                        </TableCell>
                        <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                          {r.kind === "doc"
                            ? <InlineNote value={r.doc.notes} onSave={v => handleSaveNote(r.doc, v)} />
                            : <InlineNote value={r.notes} onSave={v => handleSaveCollectionNote(r, v)} />}
                        </TableCell>
                        <TableCell className="py-2 text-right">{r.kind === "doc" ? rowMenu(r.doc) : collectionMenu(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Elenco compatto (telefono) */}
              <div className="space-y-2 md:hidden">
                {pageRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>}
                {pageRows.map(r => r.kind === "collection" ? (
                  <div key={r.id} className="flex items-center gap-3 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => openRow(r)}>
                    {r.docs[0]
                      ? <PhotoThumb doc={r.docs[0]} className="h-12 w-12 shrink-0 rounded" />
                      : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800"><Images className="h-5 w-5 text-slate-400" /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        <span className="text-blue-600">{countLabel(r)}</span>
                        {r.folder && ` · ${r.typeName}`}
                      </p>
                      <div className="mt-1" onClick={e => e.stopPropagation()}>
                        <InlineNote value={r.notes} onSave={v => handleSaveCollectionNote(r, v)} />
                      </div>
                    </div>
                    {collectionMenu(r)}
                  </div>
                ) : (
                  <div key={r.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => openDoc(r.doc)}>
                    <span className="mt-0.5 shrink-0">{getFileIcon(r.doc.fileType, "h-5 w-5")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-medium">{r.doc.name}</p>
                        <OldRevBadges isOld={r.doc.isOld} isRev={r.doc.isRev} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {r.typeName}{r.folderName && ` · ${r.folderName}`} · {format(new Date(r.doc.createdAt), 'dd/MM/yyyy', { locale: it })}
                        {r.doc.fileSize != null && ` · ${formatFileSize(r.doc.fileSize)}`}
                      </p>
                      <div className="mt-1" onClick={e => e.stopPropagation()}>
                        <InlineNote value={r.doc.notes} onSave={v => handleSaveNote(r.doc, v)} />
                      </div>
                    </div>
                    {rowMenu(r.doc)}
                  </div>
                ))}
              </div>

              <PaginationControls
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={sorted.length}
                itemLabel="elementi"
              />
            </>
          )}
        </NotchTabs>
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

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={bulkDeleteDocs.length > 1 ? `Elimina ${bulkDeleteDocs.length} documenti` : "Elimina documento"}
        description={bulkDeleteDocs.length > 1
          ? `I ${bulkDeleteDocs.length} documenti selezionati verranno eliminati definitivamente e non potranno essere recuperati.`
          : `Il documento "${bulkDeleteDocs[0]?.name || 'selezionato'}" verrà eliminato definitivamente e non potrà essere recuperato.`}
        onConfirm={handleBulkDelete}
      />

      <ConfirmDeleteDialog
        open={!!folderToDelete}
        onOpenChange={open => { if (!open) setFolderToDelete(null) }}
        title="Elimina cartella"
        description={`La cartella "${folderToDelete?.name ?? ''}" è vuota e verrà eliminata.`}
        onConfirm={handleDeleteFolder}
      />

      {/* Nuova cartella */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuova cartella</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {docTypes.filter(t => t.allowsFolders).length > 1 && (
              <div className="space-y-1.5">
                <Label>Tipo documento</Label>
                <Select value={newFolderTypeId} onValueChange={setNewFolderTypeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {docTypes.filter(t => t.allowsFolders).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
          <DialogHeader><DialogTitle>{movingDocs.length > 1 ? `Sposta ${movingDocs.length} documenti` : "Sposta in cartella"}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Cartella di destinazione</Label>
            <Select value={moveFolderId} onValueChange={setMoveFolderId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="root">Nessuna cartella</SelectItem>
                {folders.filter(f => f.documentTypeId === movingDocs[0]?.documentTypeId).map(f => (
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
