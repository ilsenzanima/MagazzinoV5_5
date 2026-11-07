"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Trash2, Loader2, Pencil, X, FolderInput, FolderPlus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
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
    const [movingDoc, setMovingDoc] = useState<ProposalDocument | null>(null)
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

    useEffect(() => { load() }, [proposalId])

    const load = async () => {
        try {
            setLoading(true)
            const [docs, types, proposalFolders] = await Promise.all([
                proposalDocumentsApi.getByProposalId(proposalId),
                proposalDocumentTypesApi.getAll(),
                proposalDocumentFoldersApi.getByProposalId(proposalId),
            ])
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
        setEditFile(null)
        setEditIsOld(doc.isOld)
        setEditIsRev(doc.isRev)
        setEditOpen(true)
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

    const openMove = (doc: ProposalDocument) => {
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

            await proposalDocumentsApi.update(movingDoc.id, { folderId: targetFolderId })
            notify.success("Documento spostato")
            setMoveOpen(false)
            await load()
        } catch {
            notify.error("Errore durante lo spostamento")
        } finally {
            setMoving(false)
        }
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

    const shown = useMemo(() => {
        const words = search.toLowerCase().split(/\s+/).filter(Boolean)
        const dir = sortDir === 'asc' ? 1 : -1
        return documents.filter(d => {
            if (typeFilter === UNTYPED_KEY ? !!d.documentTypeId : typeFilter !== 'all' && d.documentTypeId !== typeFilter) return false
            if (folderFilter === 'root' ? !!d.folderId : folderFilter !== 'all' && d.folderId !== folderFilter) return false
            const target = `${d.name} ${d.notes || ''} ${docTypes.find(t => t.id === d.documentTypeId)?.name || ''}`.toLowerCase()
            return words.every(w => target.includes(w))
        }).sort((x, y) => sortKey === 'name'
            ? dir * x.name.localeCompare(y.name, 'it', { numeric: true })
            : sortKey === 'size'
                ? dir * ((x.fileSize ?? 0) - (y.fileSize ?? 0))
                : dir * String(x.createdAt).localeCompare(String(y.createdAt)))
    }, [documents, docTypes, search, typeFilter, folderFilter, sortKey, sortDir])

    const hasUntyped = documents.some(d => !d.documentTypeId)
    const folderTypes = docTypes.filter(t => t.allowsFolders)
    const folderTypeForNew = (typeFilter !== 'all' && folderTypes.find(t => t.id === typeFilter)?.id) || folderTypes[0]?.id
    const headCls = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600"

    return (
        <NotchTabs title="Documenti commessa">
            <NotchActions>
                <NotchSearch value={search} onChange={setSearch} placeholder="Cerca per nome o nota" />
                <NotchStat label="Documenti" value={String(documents.length)} />
            </NotchActions>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : (
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className={headCls}>{sortBtn('name', 'Documento')}</TableHead>
                            <TableHead className={`w-44 ${headCls}`}>
                                <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setFolderFilter('all') }}>
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
                            {folders.length > 0 && (
                                <TableHead className={`w-44 ${headCls}`}>
                                    <Select value={folderFilter} onValueChange={setFolderFilter}>
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
                            )}
                            <TableHead className={`w-28 ${headCls}`}>{sortBtn('date', 'Data')}</TableHead>
                            <TableHead className={`w-28 ${headCls}`}>{sortBtn('size', 'Dimensione')}</TableHead>
                            <TableHead className={`w-[22%] ${headCls}`}>Nota</TableHead>
                            <TableHead className="w-20" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shown.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={folders.length > 0 ? 7 : 6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    {documents.length === 0 ? 'Nessun documento. Carica preventivi, planimetrie o altro.' : 'Nessun documento corrisponde ai filtri.'}
                                </TableCell>
                            </TableRow>
                        ) : shown.map(doc => (
                            <TableRow key={doc.id} className="cursor-pointer" onClick={() => isImageFileType(doc.fileType) ? openGalleryForDoc(doc, shown) : openDoc(doc.fileUrl)}>
                                <TableCell className="border-r py-2">
                                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                        <span className="shrink-0">{getFileIcon(doc.fileType)}</span>
                                        <span className="truncate" title={doc.name}>{doc.name}</span>
                                        <OldRevBadges isOld={doc.isOld} isRev={doc.isRev} />
                                    </span>
                                </TableCell>
                                <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300">{docTypes.find(t => t.id === doc.documentTypeId)?.name || <span className="text-slate-300">—</span>}</TableCell>
                                {folders.length > 0 && (
                                    <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300">{folders.find(f => f.id === doc.folderId)?.name || <span className="text-slate-300">—</span>}</TableCell>
                                )}
                                <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: it })}</TableCell>
                                <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{doc.fileSize != null ? formatFileSize(doc.fileSize) : <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className="truncate border-r py-2 text-sm text-slate-500" title={doc.notes || undefined}>{doc.notes || <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-0.5">
                                        {docTypes.find(t => t.id === doc.documentTypeId)?.allowsFolders && (
                                            <button type="button" title="Sposta in cartella" onClick={() => openMove(doc)} className="p-1 text-slate-400 hover:text-slate-800"><FolderInput className="h-4 w-4" /></button>
                                        )}
                                        <button type="button" title="Modifica" onClick={e => openEdit(doc, e)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <FloatingAddButton
                label="Carica documenti"
                icon={<Upload className="h-6 w-6" />}
                showOnMobile
                {...(folderTypeForNew
                    ? { actions: [
                        { label: "Carica documenti", onClick: openUpload },
                        { label: "Nuova cartella", onClick: () => openNewFolder(folderTypeForNew) },
                    ] }
                    : { onClick: openUpload })}
            />

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
                                    <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti Offerte per crearne uno.</p>
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
        </NotchTabs>
    )
}
