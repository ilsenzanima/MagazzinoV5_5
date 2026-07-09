"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Trash2, Loader2, Pencil, X, FolderInput, FolderPlus } from "lucide-react"
import { proposalDocumentsApi, ProposalDocument } from "@/lib/services/proposal-documents"
import { proposalDocumentTypesApi, ProposalDocumentType } from "@/lib/services/proposal-document-types"
import { proposalDocumentFoldersApi, ProposalDocumentFolder } from "@/lib/services/proposal-document-folders"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { notify } from "@/lib/notify"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { getFileIcon, formatFileSize } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"
import { OldRevCheckboxes, OldRevBadges } from "@/components/documents/OldRevControls"

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
    const [viewMode, setViewMode] = useViewMode('proposal-documents')
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
            setActiveFolderByType(prev => ({ ...prev, [newFolderTypeId]: folder.id }))
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

    const renderDocCard = (doc: ProposalDocument) => (
        <Card
            key={doc.id}
            className="group hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => openDoc(doc.fileUrl)}
        >
            <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">{getFileIcon(doc.fileType)}</div>
                <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex justify-between items-start gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <p className="font-medium truncate text-sm" title={doc.name}>{doc.name}</p>
                            <OldRevBadges isOld={doc.isOld} isRev={doc.isRev} />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                            {docTypes.find(t => t.id === doc.documentTypeId)?.allowsFolders && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-700" title="Sposta in cartella" onClick={e => { e.stopPropagation(); openMove(doc) }}>
                                    <FolderInput className="h-3 w-3" />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
                                onClick={e => openEdit(doc, e)}
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    {doc.notes && <p className="text-xs text-slate-500 mt-0.5 italic truncate">{doc.notes}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                        {format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}
                        {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
                    </p>
                </div>
            </CardContent>
        </Card>
    )

    const renderDocRow = (doc: ProposalDocument) => (
        <div
            key={doc.id}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
            onClick={() => openDoc(doc.fileUrl)}
        >
            <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded shrink-0">{getFileIcon(doc.fileType)}</div>
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-medium text-sm truncate" title={doc.name}>{doc.name}</span>
                    <OldRevBadges isOld={doc.isOld} isRev={doc.isRev} />
                    <span className="text-xs text-slate-400">{format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</span>
                    {doc.fileSize != null && <span className="text-xs text-slate-400">{formatFileSize(doc.fileSize)}</span>}
                </div>
                {doc.notes && <p className="text-xs text-slate-500 italic truncate">{doc.notes}</p>}
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                {docTypes.find(t => t.id === doc.documentTypeId)?.allowsFolders && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" title="Sposta in cartella" onClick={e => { e.stopPropagation(); openMove(doc) }}>
                        <FolderInput className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700"
                    onClick={e => openEdit(doc, e)}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )

    const groups: { key: string; label: string; docs: ProposalDocument[] }[] = [
        ...docTypes.map(t => ({ key: t.id, label: t.name, docs: documents.filter(d => d.documentTypeId === t.id) })),
        ...(documents.some(d => !d.documentTypeId) ? [{ key: UNTYPED_KEY, label: "Senza tipo", docs: documents.filter(d => !d.documentTypeId) }] : []),
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Documenti Proposta</h2>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={openUpload}>
                    <Upload className="mr-2 h-4 w-4" />Carica Documenti
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : docTypes.length === 0 && documents.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nessun documento. Carica preventivi, planimetrie o altro.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex justify-end">
                        <ViewToggle mode={viewMode} onChange={setViewMode} />
                    </div>
                    {docTypes.length === 0 ? (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {documents.map(renderDocCard)}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {documents.map(renderDocRow)}
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
                                        ) : viewMode === 'grid' ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {shownDocs.map(renderDocCard)}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {shownDocs.map(renderDocRow)}
                                            </div>
                                        )}
                                    </TabsContent>
                                )
                            })}
                        </Tabs>
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
        </div>
    )
}
