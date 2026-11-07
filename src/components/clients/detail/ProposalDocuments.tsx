"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Trash2, Loader2, Pencil, X, FolderInput, FolderPlus, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Images, ExternalLink, Download } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { JobPhotoCollection, PhotoThumb } from "@/components/jobs/details/JobPhotoCollection"
import { InlineNote } from "@/components/jobs/details/JobDocuments"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { useHistoryStep } from "@/hooks/useHistoryStep"
import { proposalDocumentsApi, ProposalDocument } from "@/lib/services/proposal-documents"
import { proposalDocumentTypesApi, ProposalDocumentType } from "@/lib/services/proposal-document-types"
import { proposalDocumentFoldersApi, ProposalDocumentFolder } from "@/lib/services/proposal-document-folders"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { notify } from "@/lib/notify"
import { NotchTabs, NotchSearch, NotchStat, NotchActions } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getFileIcon, formatFileSize } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"
import { OldRevCheckboxes, OldRevBadges } from "@/components/documents/OldRevControls"
import { PhotoGallery, PhotoGalleryImage, isImageFileType } from "@/components/ui/photo-gallery"
import { resolveDocumentDisplayUrl } from "@/lib/resolve-document-url"

interface Props {
    proposalId: string
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

export function ProposalDocuments({ proposalId }: Props) {
    const [documents, setDocuments] = useState<ProposalDocument[]>([])
    const [docTypes, setDocTypes] = useState<ProposalDocumentType[]>([])
    const [folders, setFolders] = useState<ProposalDocumentFolder[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<ProposalDocument | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [typeNotes, setTypeNotes] = useState<Record<string, string>>({})
    const [typeFilter, setTypeFilter] = useState("all")
    const [folderFilter, setFolderFilter] = useState("all")
    const [sortKey, setSortKey] = useState<'name' | 'date' | 'size'>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [galleryImages, setGalleryImages] = useState<PhotoGalleryImage[]>([])
    const [galleryIndex, setGalleryIndex] = useState(0)
    const [galleryOpen, setGalleryOpen] = useState(false)

    const openGalleryForDoc = async (doc: ProposalDocument, siblingDocs: ProposalDocument[]) => {
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
    const [movingDocs, setMovingDocs] = useState<ProposalDocument[]>([])
    const [bulkDeleteDocs, setBulkDeleteDocs] = useState<ProposalDocument[]>([])
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
    // Raccolta di foto aperta: un passo della cronologia, cosi «indietro» torna alla tabella
    const [openCollection, showCollection, closeCollection] = useHistoryStep<{ typeId: string; folderId: string | null }>("magCommessaCollection")
    const [moveFolderId, setMoveFolderId] = useState("root")
    const [moving, setMoving] = useState(false)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [editDocTypeId, setEditDocTypeId] = useState("")
    const [editIsOld, setEditIsOld] = useState(false)
    const [editIsRev, setEditIsRev] = useState(false)
    const [editFile, setEditFile] = useState<File | null>(null)
    const editRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [proposalId])

    const load = async () => {
        try {
            setLoading(true)
            const [docs, types, proposalFolders, notesByType] = await Promise.all([
                proposalDocumentsApi.getByProposalId(proposalId),
                proposalDocumentTypesApi.getAll(),
                proposalDocumentFoldersApi.getByProposalId(proposalId),
                Promise.resolve({} as Record<string, string>).catch(() => ({} as Record<string, string>)),
            ])
            setTypeNotes(notesByType)
            setDocuments(docs)
            setDocTypes(types)
            setFolders(proposalFolders)
        } catch { notify.error("Errore nel caricamento documenti") }
        finally { setLoading(false) }
    }

    // Percorso Drive base per un tipo documento: se il tipo consente cartelle,
    // i suoi file vivono in una sottocartella dedicata al tipo, altrimenti
    // restano nella cartella piatta "Documenti" (comportamento storico).
    const typeBaseSegments = (type?: ProposalDocumentType) => {
        const base = ['Proposte', proposalId, 'Documenti']
        return type?.allowsFolders ? [...base, type.name] : base
    }

    const openDoc = async (fileUrl: string) => {
        if (fileUrl && !fileUrl.includes('/')) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(fileUrl)}&fileName=documento`, '_blank')
            return
        }
        try {
            const path = fileUrl.split('/public/documents/')[1]
            if (!path) { window.open(fileUrl, '_blank'); return }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(fileUrl, '_blank'); return }
            window.open(data.signedUrl, '_blank')
        } catch { window.open(fileUrl, '_blank') }
    }

    const openEdit = (doc: ProposalDocument, e: React.MouseEvent) => {
        e.stopPropagation()
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditDocTypeId(doc.documentTypeId || "")
        setEditIsOld(doc.isOld || false)
        setEditIsRev(doc.isRev || false)
        setEditFile(null)
        setEditOpen(true)
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
            const folder = await proposalDocumentFoldersApi.create({
                proposalId,
                documentTypeId: newFolderTypeId,
                name,
                driveFolderId: result.folderId,
            })
            setFolders(prev => [...prev, folder])
            if (upDocTypeId === newFolderTypeId) setUpFolderId(folder.id)
            setFolderFilter(folder.id)
            notify.success("Cartella creata")
            setNewFolderOpen(false)
        } catch {
            notify.error("Errore durante la creazione della cartella")
        } finally {
            setCreatingFolder(false)
        }
    }

    const handleSaveNote = async (doc: ProposalDocument, notes: string) => {
        if (notes === doc.notes) return
        try {
            await proposalDocumentsApi.update(doc.id, { notes })
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, notes } : d))
        } catch { notify.error("Errore nel salvataggio della nota") }
    }

    // Nota di una raccolta (cartella, oppure tipo senza cartella) modificata direttamente in tabella
    const handleSaveCollectionNote = async (r: { typeId: string; notes: string; folder?: ProposalDocumentFolder | null }, notes: string) => {
        if (notes === r.notes) return
        try {
            if (r.folder) {
                await proposalDocumentFoldersApi.setNotes(r.folder.id, notes)
                setFolders(prev => prev.map(f => (f.id === r.folder!.id ? { ...f, notes } : f)))
            } else {
                // I tipi dei Documenti commessa non hanno raccolte senza cartella: niente nota di tipo
                setTypeNotes(prev => ({ ...prev, [r.typeId]: notes }))
            }
        } catch { notify.error("Errore nel salvataggio della nota") }
    }

    const isDriveFile = (doc: ProposalDocument) => !!doc.fileUrl && !doc.fileUrl.includes('/')

    const openMove = (list: ProposalDocument[]) => {
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
                await proposalDocumentsApi.update(doc.id, { folderId: targetFolderId })
                done++
            }
            notify.success(toMove.length > 1 ? `${toMove.length} documenti spostati` : "Documento spostato")
            setMoveOpen(false)
        } catch {
            notify.error(toMove.length > 1 ? `Spostati ${done} documenti su ${toMove.length}: errore durante lo spostamento` : "Errore durante lo spostamento")
        } finally {
            setMoving(false)
            await load()
        }
    }

    const handleBulkDelete = async () => {
        const list = bulkDeleteDocs
        if (list.length === 0) return
        const deleted = new Set<string>()
        for (const doc of list) {
            try {
                const path = doc.fileUrl?.includes('/public/documents/') ? doc.fileUrl.split('/public/documents/')[1] : undefined
                if (path) await supabase.storage.from('documents').remove([path])
                await proposalDocumentsApi.delete(doc.id)
                deleted.add(doc.id)
            } catch (error) {
                console.error("Delete failed", doc.id, error)
            }
        }
        setDocuments(prev => prev.filter(d => !deleted.has(d.id)))
        setBulkDeleteDocs([])
        if (deleted.size === list.length) notify.success(list.length > 1 ? `${list.length} documenti eliminati` : "Documento eliminato")
        else notify.error(`Eliminati ${deleted.size} documenti su ${list.length}`)
    }

    // Una cartella si elimina solo se e' vuota: le foto vanno prima spostate o eliminate
    const deleteFolder = async (folder: ProposalDocumentFolder) => {
        if (documents.some(d => d.folderId === folder.id)) {
            notify.error("La cartella non e' vuota: sposta o elimina prima le foto")
            return
        }
        if (!confirm(`Eliminare la cartella "${folder.name}"?`)) return
        try {
            await proposalDocumentFoldersApi.delete(folder.id)
            await load()
        } catch { notify.error("Errore durante l'eliminazione della cartella") }
    }

    const handleFilesSelected = (files: FileList | null) => {
        if (!files || files.length === 0) return
        setPendingFiles(prev => {
            const room = MAX_BATCH_UPLOAD_FILES - prev.length
            if (room <= 0) {
                notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`)
                return prev
            }
            const selected = Array.from(files)
            if (selected.length > room) notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`)
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
            notify.error("Selezionare il tipo di documento.")
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
            const ext = compressed.name.split('.').pop() || ''
            const uploaded = await uploadFileToDrive(compressed, segments)
            await proposalDocumentsApi.create({
                proposalId,
                documentTypeId: upDocTypeId || null,
                folderId: upFolderId || null,
                name: pf.name.trim() || pf.file.name,
                notes: pf.notes.trim(),
                fileUrl: uploaded.fileId,
                fileType: ext,
                fileSize: compressed.size,
                uploadedBy: '',
                uploadedByName: '',
                isOld: pf.isOld,
                isRev: pf.isRev,
            })
        })
        setUploading(false)
        if (failedCount === 0) {
            notify.success(okCount > 1 ? "Documenti caricati" : "Documento caricato")
            setUploadOpen(false)
        } else if (okCount === 0) {
            notify.error("Nessun documento caricato, riprova")
        } else {
            notify.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`)
            setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'))
        }
        await load()
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        if (!editDocTypeId) {
            notify.error("Selezionare il tipo di documento.")
            return
        }
        try {
            setSaving(true)
            let fileUrl = activeDoc.fileUrl
            let fileType = activeDoc.fileType
            let fileSize = activeDoc.fileSize

            if (editFile) {
                const compressed = await compressImageIfNeeded(editFile)
                const ext = compressed.name.split('.').pop() || ''
                const uploaded = await uploadFileToDrive(compressed, ['Proposte', proposalId, 'Documenti'])
                fileUrl = uploaded.fileId
                fileType = ext
                fileSize = compressed.size
            }

            await proposalDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
                documentTypeId: editDocTypeId || null,
                fileUrl,
                fileType,
                fileSize,
                isOld: editIsOld,
                isRev: editIsRev,
            })
            notify.success("Documento aggiornato")
            setEditOpen(false)
            await load()
        } catch (e: any) { notify.error("Errore: " + e.message) }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!activeDoc) return
        try {
            const path = activeDoc.fileUrl?.split('/public/documents/')[1]
            if (path) await supabase.storage.from('documents').remove([path])
            await proposalDocumentsApi.delete(activeDoc.id)
            setDocuments(d => d.filter(x => x.id !== activeDoc.id))
            setDeleteOpen(false)
            setEditOpen(false)
            setActiveDoc(null)
        } catch { notify.error("Errore eliminazione") }
    }

    const toggleSort = (k: 'name' | 'date' | 'size') => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc') }
    }
    const sortBtn = (k: 'name' | 'date' | 'size', label: string) => (
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}
            {sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </button>
    )

    type Row = {
        id: string; kind: 'doc' | 'collection'; name: string; typeId: string; typeName: string; folderId: string; folderName: string
        date: string; size: number; notes: string; docs: ProposalDocument[]; doc?: ProposalDocument; folder?: ProposalDocumentFolder | null
    }
    const typeNameOf = (d: ProposalDocument) => docTypes.find(t => t.id === d.documentTypeId)?.name || 'Senza tipo'
    const folderNameOf = (d: ProposalDocument) => (d.folderId ? folders.find(f => f.id === d.folderId)?.name : undefined) || ''
    const latest = (list: ProposalDocument[]) => list.reduce((m, d) => (d.createdAt > m ? d.createdAt : m), '')

    // Righe: una per raccolta di foto (il tipo e ogni sua cartella) + una per documento
    const photoTypes = docTypes.filter(t => t.isPhotoGallery)
    const photoTypeIds = new Set(photoTypes.map(t => t.id))
    const allRows: Row[] = [
        ...photoTypes.flatMap(t => {
            const typeDocs = documents.filter(d => d.documentTypeId === t.id)
            const groups: { folder: ProposalDocumentFolder | null; docs: ProposalDocument[] }[] = [
                { folder: null, docs: typeDocs.filter(d => !d.folderId) },
                ...folders.filter(f => f.documentTypeId === t.id).map(f => ({ folder: f, docs: typeDocs.filter(d => d.folderId === f.id) })),
            ]
            return groups.map((g): Row => ({
                id: `c:${t.id}:${g.folder?.id ?? 'root'}`, kind: 'collection', name: g.folder ? g.folder.name : t.name,
                typeId: t.id, typeName: t.name, folderId: g.folder?.id ?? '', folderName: g.folder?.name ?? '',
                date: latest(g.docs), size: g.docs.reduce((n, d) => n + (d.fileSize ?? 0), 0),
                notes: g.folder ? (g.folder.notes ?? '') : (typeNotes[t.id] ?? ''), docs: g.docs, folder: g.folder,
            }))
        }),
        ...documents.filter(d => !photoTypeIds.has(d.documentTypeId ?? '')).map((doc): Row => ({
            id: doc.id, kind: 'doc', name: doc.name, typeId: doc.documentTypeId ?? '', typeName: typeNameOf(doc),
            folderId: doc.folderId ?? '', folderName: folderNameOf(doc), date: doc.createdAt, size: doc.fileSize ?? 0,
            notes: doc.notes || '', docs: [doc], doc,
        })),
    ]

    const rows = useMemo(() => {
        const words = search.toLowerCase().split(/\s+/).filter(Boolean)
        const dir = sortDir === 'asc' ? 1 : -1
        return allRows.filter(r => {
            if (typeFilter === UNTYPED_KEY ? r.typeId !== '' : typeFilter !== 'all' && r.typeId !== typeFilter) return false
            if (folderFilter === 'root' ? r.folderId !== '' : folderFilter !== 'all' && r.folderId !== folderFilter) return false
            const target = `${r.name} ${r.typeName} ${r.folderName} ${r.notes} ${r.kind === 'collection' ? r.docs.map(d => d.name).join(' ') : ''}`.toLowerCase()
            return words.every(w => target.includes(w))
        }).sort((x, y) => sortKey === 'name'
            ? dir * x.name.localeCompare(y.name, 'it', { numeric: true })
            : sortKey === 'size' ? dir * (x.size - y.size) : dir * x.date.localeCompare(y.date))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documents, docTypes, folders, search, typeFilter, folderFilter, sortKey, sortDir])
    const shownDocs = rows.filter(r => r.kind === 'doc').map(r => r.doc!)
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    const anyFilterActive = !!search.trim() || typeFilter !== 'all' || folderFilter !== 'all'
    const resetFilters = () => { setSearch(''); setTypeFilter('all'); setFolderFilter('all'); setPage(1) }

    const hasUntyped = documents.some(d => !d.documentTypeId)
    const folderTypes = docTypes.filter(t => t.allowsFolders)
    const folderTypeForNew = (typeFilter !== 'all' && folderTypes.find(t => t.id === typeFilter)?.id) || folderTypes[0]?.id
    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600"

    const openDocument = (doc: ProposalDocument, siblings: ProposalDocument[] = shownDocs) =>
        isImageFileType(doc.fileType) ? openGalleryForDoc(doc, siblings) : openDoc(doc.fileUrl)
    const askDeleteDoc = (doc: ProposalDocument) => { setBulkDeleteDocs([doc]); setBulkDeleteOpen(true) }

    const rowMenu = (doc: ProposalDocument, siblings: ProposalDocument[] = shownDocs) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => openDocument(doc, siblings)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
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
                <DropdownMenuItem onClick={() => askDeleteDoc(doc)} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />Elimina
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const collectionMenu = (r: Row) => (
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
                        <DropdownMenuItem onClick={() => deleteFolder(r.folder!)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />Elimina cartella
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )

    // Raccolta aperta: pagina dedicata alle foto
    const collection = openCollection
        ? (() => {
            const type = docTypes.find(t => t.id === openCollection.typeId)
            const folder = openCollection.folderId ? folders.find(f => f.id === openCollection.folderId) : undefined
            const docs = documents.filter(d => d.documentTypeId === openCollection.typeId && (d.folderId ?? null) === openCollection.folderId)
            return { type, folder, docs, title: `${type?.name ?? 'Foto'}${folder ? ` › ${folder.name}` : ''}` }
        })()
        : null

    return (
        <>
            {collection ? (
                <JobPhotoCollection
                    title={collection.title}
                    docs={collection.docs}
                    onBack={closeCollection}
                    backLabel="Documenti commessa"
                    onMoveSelected={docs => openMove(docs)}
                    onDeleteSelected={docs => { setBulkDeleteDocs(docs); setBulkDeleteOpen(true) }}
                    onAdd={() => openUpload({ typeId: openCollection!.typeId, folderId: openCollection!.folderId })}
                    onOpen={doc => openDocument(doc, collection.docs)}
                    menu={doc => rowMenu(doc, collection.docs)}
                />
            ) : (
                <NotchTabs title="Documenti commessa">
                    <NotchActions>
                        <NotchSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cerca per nome o nota" />
                        <NotchStat label="Documenti" value={String(documents.length)} />
                    </NotchActions>

                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
                    ) : (
                        <>
                        <div className="flex flex-wrap items-center gap-2 empty:hidden">
                            {anyFilterActive && (
                                <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={resetFilters}>Azzera filtri</Button>
                            )}
                            {folderTypes.length > 0 && (
                                <Button variant="outline" size="sm" onClick={() => openNewFolder(folderTypeForNew)}>
                                    <FolderPlus className="mr-1.5 h-4 w-4" />Nuova cartella
                                </Button>
                            )}
                        </div>
                        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={headCls}>{sortBtn('name', 'Documento')}</TableHead>
                                    <TableHead className={`w-44 ${headCls}`}>
                                        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setFolderFilter('all'); setPage(1) }}>
                                            <SelectTrigger aria-label="Filtra per tipo" className="h-7 min-w-0 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                                                <SelectValue>{typeFilter === 'all' ? 'Tipo' : typeFilter === UNTYPED_KEY ? 'Senza tipo' : docTypes.find(t => t.id === typeFilter)?.name}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tutti i tipi</SelectItem>
                                                {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                {hasUntyped && <SelectItem value={UNTYPED_KEY}>Senza tipo</SelectItem>}
                                            </SelectContent>
                                        </Select>
                                    </TableHead>
                                    <TableHead className={`w-44 ${headCls}`}>
                                        <Select value={folderFilter} onValueChange={v => { setFolderFilter(v); setPage(1) }}>
                                            <SelectTrigger aria-label="Filtra per cartella" className="h-7 min-w-0 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                                                <SelectValue>{folderFilter === 'all' ? 'Cartella' : folderFilter === 'root' ? 'Senza cartella' : folders.find(f => f.id === folderFilter)?.name}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tutte le cartelle</SelectItem>
                                                <SelectItem value="root">Senza cartella</SelectItem>
                                                {folders.filter(f => typeFilter === 'all' || f.documentTypeId === typeFilter).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>{sortBtn('date', 'Data')}</TableHead>
                                    <TableHead className={`w-28 ${headCls}`}>{sortBtn('size', 'Dimensione')}</TableHead>
                                    <TableHead className={`w-[22%] ${headCls}`}>Nota</TableHead>
                                    <TableHead className="w-14" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                            {documents.length === 0 ? 'Nessun documento. Carica preventivi, planimetrie o altro.' : 'Nessun documento corrisponde ai filtri.'}
                                        </TableCell>
                                    </TableRow>
                                ) : pageRows.map(r => (
                                    <TableRow key={r.id} className="cursor-pointer" onClick={() => r.kind === 'collection' ? showCollection({ typeId: r.typeId, folderId: r.folder?.id ?? null }) : openDocument(r.doc!)}>
                                        <TableCell className="border-r py-2">
                                            {r.kind === 'collection' ? (
                                                <div className="flex min-w-0 items-center gap-2">
                                                    {r.docs[0]
                                                        ? <PhotoThumb doc={r.docs[0]} className="h-9 w-9 shrink-0 rounded" />
                                                        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800"><Images className="h-5 w-5 text-slate-400" /></span>}
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold" title={r.name}>{r.name}</p>
                                                        <p className="text-xs text-blue-600">{r.docs.length} foto</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="shrink-0">{getFileIcon(r.doc!.fileType, "h-5 w-5")}</span>
                                                    <span className="truncate text-sm font-medium" title={r.doc!.name}>{r.doc!.name}</span>
                                                    <OldRevBadges isOld={r.doc!.isOld} isRev={r.doc!.isRev} />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.typeName}>{r.typeName}</TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.folderName}>{r.folderName || <span className="text-slate-300">—</span>}</TableCell>
                                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{r.date ? format(new Date(r.date), 'dd/MM/yyyy', { locale: it }) : <span className="text-slate-300">—</span>}</TableCell>
                                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{r.size > 0 ? formatFileSize(r.size) : <span className="text-slate-300">—</span>}</TableCell>
                                        <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                            {r.kind === 'doc'
                                                ? <InlineNote value={r.doc!.notes} onSave={v => handleSaveNote(r.doc!, v)} />
                                                : <InlineNote value={r.notes} onSave={v => handleSaveCollectionNote(r, v)} />}
                                        </TableCell>
                                        <TableCell className="py-2 text-right">{r.kind === 'doc' ? rowMenu(r.doc!) : collectionMenu(r)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>

                        {/* Elenco compatto (telefono) */}
                        <div className="space-y-2 md:hidden">
                            {pageRows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>}
                            {pageRows.map(r => r.kind === 'collection' ? (
                                <div key={r.id} className="flex items-center gap-3 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => showCollection({ typeId: r.typeId, folderId: r.folder?.id ?? null })}>
                                    {r.docs[0]
                                        ? <PhotoThumb doc={r.docs[0]} className="h-12 w-12 shrink-0 rounded" />
                                        : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800"><Images className="h-5 w-5 text-slate-400" /></span>}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{r.name}</p>
                                        <p className="text-xs text-slate-500"><span className="text-blue-600">{r.docs.length} foto</span>{r.folder && ` · ${r.typeName}`}</p>
                                        <div className="mt-1" onClick={e => e.stopPropagation()}>
                                            <InlineNote value={r.notes} onSave={v => handleSaveCollectionNote(r, v)} />
                                        </div>
                                    </div>
                                    {collectionMenu(r)}
                                </div>
                            ) : (
                                <div key={r.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => openDocument(r.doc!)}>
                                    <span className="mt-0.5 shrink-0">{getFileIcon(r.doc!.fileType, "h-5 w-5")}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <p className="truncate text-sm font-medium">{r.doc!.name}</p>
                                            <OldRevBadges isOld={r.doc!.isOld} isRev={r.doc!.isRev} />
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {r.typeName}{r.folderName && ` · ${r.folderName}`} · {format(new Date(r.doc!.createdAt), 'dd/MM/yyyy', { locale: it })}
                                            {r.doc!.fileSize != null && ` · ${formatFileSize(r.doc!.fileSize)}`}
                                        </p>
                                        <div className="mt-1" onClick={e => e.stopPropagation()}>
                                            <InlineNote value={r.doc!.notes} onSave={v => handleSaveNote(r.doc!, v)} />
                                        </div>
                                    </div>
                                    {rowMenu(r.doc!)}
                                </div>
                            ))}
                        </div>

                        <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} itemLabel="elementi" />
                        </>
                    )}

                    <FloatingAddButton onClick={() => openUpload()} label="Carica documenti" icon={<Upload className="h-6 w-6" />} showOnMobile />
                </NotchTabs>
            )}

            {/* Upload dialog - step 1: tipo + file multipli */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Carica Documenti</DialogTitle></DialogHeader>
                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>Tipo documento *</Label>
                                <Select value={upDocTypeId} onValueChange={v => { setUpDocTypeId(v); setUpFolderId("") }}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona tipo documento" /></SelectTrigger>
                                    <SelectContent>
                                        {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {docTypes.length === 0 && (
                                    <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti per crearne uno.</p>
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
                description={`Eliminare "${activeDoc?.name}"? L'azione è irreversibile.`}
                onConfirm={handleDelete}
            />

            <ConfirmDeleteDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={bulkDeleteDocs.length > 1 ? `Elimina ${bulkDeleteDocs.length} documenti` : "Elimina documento"}
                description={bulkDeleteDocs.length > 1
                    ? `I ${bulkDeleteDocs.length} documenti selezionati verranno eliminati definitivamente e non potranno essere recuperati.`
                    : `Il documento "${bulkDeleteDocs[0]?.name || 'selezionato'}" verra eliminato definitivamente e non potra essere recuperato.`}
                onConfirm={handleBulkDelete}
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
        </>
    )
}
