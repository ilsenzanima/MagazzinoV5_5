"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, FileText, Pencil, Trash2, X } from "lucide-react"
import { costAnalysisDocumentsApi, CostAnalysisDocument } from "@/lib/services/cost-analysis-documents"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { getFileIcon } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

interface PendingFile {
    file: File
    name: string
    notes: string
}

interface Props {
    jobId?: string
    proposalId?: string
    jobLabel?: string
}

export function CostAnalysisDocuments({ jobId, proposalId, jobLabel }: Props) {
    const [documents, setDocuments] = useState<CostAnalysisDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<CostAnalysisDocument | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [viewMode, setViewMode] = useViewMode('cost-analysis-documents', 'grid')
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Upload wizard
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [dragOver, setDragOver] = useState(false)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")

    const ownerId = jobId || proposalId
    const folderPath = jobId ? ['Cantieri', jobLabel || jobId, 'Analisi Costi di Terzi'] : ['Proposte', proposalId || '', 'Analisi Costi di Terzi']

    useEffect(() => {
        if (ownerId) load()
    }, [ownerId])

    const load = async () => {
        try {
            setLoading(true)
            const all = jobId ? await costAnalysisDocumentsApi.getByJobId(jobId) : await costAnalysisDocumentsApi.getByProposalId(proposalId!)
            setDocuments(all)
        } catch (error) {
            console.error("Failed to load analisi costi di terzi", error)
            notify.error("Errore nel caricamento delle analisi costi di terzi")
        } finally {
            setLoading(false)
        }
    }

    const openUpload = () => {
        setUpStep(1)
        setPendingFiles([])
        batchUpload.reset()
        setUploadOpen(true)
    }

    const addFiles = (files: FileList | File[]) => {
        setPendingFiles(prev => {
            const room = MAX_BATCH_UPLOAD_FILES - prev.length
            if (room <= 0) {
                notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`)
                return prev
            }
            const selected = Array.from(files)
            if (selected.length > room) notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`)
            const arr = selected.slice(0, room).map(file => ({
                file,
                name: file.name.replace(/\.[^.]+$/, ''),
                notes: "",
            }))
            return [...prev, ...arr]
        })
    }

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) addFiles(e.target.files)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
    }

    const goToStep2 = () => {
        if (pendingFiles.length === 0) return
        setUpStep(2)
    }

    const updatePending = (index: number, patch: Partial<PendingFile>) => {
        setPendingFiles(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
    }

    const removePending = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    const batchUpload = useBatchUpload()

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0 || !ownerId) return
        setUploading(true)
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pending => {
            const compressed = await compressImageIfNeeded(pending.file)
            const fileExt = compressed.name.split('.').pop() || ''
            const uploaded = await uploadFileToDrive(compressed, folderPath)

            await costAnalysisDocumentsApi.create({
                jobId,
                proposalId,
                name: pending.name.trim() || pending.file.name,
                notes: pending.notes.trim(),
                fileUrl: uploaded.fileId,
                fileType: fileExt,
            })
        })
        setUploading(false)
        if (failedCount === 0) {
            notify.success(okCount > 1 ? "Documenti caricati con successo" : "Documento caricato con successo")
            setUploadOpen(false)
        } else if (okCount === 0) {
            notify.error("Nessun documento caricato, riprova")
        } else {
            notify.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`)
            setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'))
        }
        load()
    }

    const openEdit = (doc: CostAnalysisDocument) => {
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            await costAnalysisDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
            })
            notify.success("Documento aggiornato")
            setEditOpen(false)
            load()
        } catch {
            notify.error("Errore durante l'aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleOpenDocument = async (fileUrl: string) => {
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
        } catch {
            window.open(fileUrl, '_blank')
        }
    }

    const handleDelete = async () => {
        if (!activeDoc) return
        try {
            const path = activeDoc.fileUrl?.split('/public/documents/')[1]
            if (path) await supabase.storage.from('documents').remove([path])
            await costAnalysisDocumentsApi.delete(activeDoc.id)
            setDeleteOpen(false)
            setEditOpen(false)
            notify.success("Documento eliminato")
            setDocuments(documents.filter(d => d.id !== activeDoc.id))
            setActiveDoc(null)
        } catch (error) {
            console.error("Delete failed", error)
            notify.error("Errore durante l'eliminazione")
        }
    }

    const renderDocCard = (doc: CostAnalysisDocument) => (
        <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleOpenDocument(doc.fileUrl)}>
            <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">
                    {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                    <div className="flex justify-between items-start gap-1">
                        <p className="font-medium truncate text-sm pr-1" title={doc.name}>{doc.name}</p>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
                            onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                    </div>
                    {doc.notes && <p className="text-xs text-slate-500 mt-0.5 italic truncate">{doc.notes}</p>}
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</p>
                </div>
            </CardContent>
        </Card>
    )

    const renderDocRow = (doc: CostAnalysisDocument) => (
        <div
            key={doc.id}
            className="flex items-center gap-3 p-3 border rounded-lg bg-white dark:bg-slate-800 hover:shadow-sm transition-shadow cursor-pointer"
            onClick={() => handleOpenDocument(doc.fileUrl)}
        >
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">
                {getFileIcon(doc.fileType)}
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
                <p className="font-medium truncate text-sm" title={doc.name}>{doc.name}</p>
                {doc.notes && <p className="text-xs text-slate-500 italic truncate">{doc.notes}</p>}
            </div>
            <p className="text-xs text-slate-400 shrink-0">{format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</p>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-700"
                onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>
        </div>
    )

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Analisi Costi di Terzi</h2>
                <div className="flex items-center gap-2">
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={openUpload}>
                        <Upload className="mr-2 h-4 w-4" />
                        Carica Analisi Costi
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : documents.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessuna analisi costi caricata</h3>
                        <p className="text-slate-500 dark:text-slate-400">Carica qui le analisi costi fornite da terzi (es. dal cliente o da un consulente).</p>
                    </CardContent>
                </Card>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(renderDocCard)}
                </div>
            ) : (
                <div className="space-y-2">
                    {documents.map(renderDocRow)}
                </div>
            )}

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Carica Analisi Costi di Terzi</DialogTitle></DialogHeader>
                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>File (puoi selezionarne più di uno, anche con drag&drop)</Label>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'bg-blue-50 border-blue-400 dark:bg-blue-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                >
                                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFilesSelected} />
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
                            {pendingFiles.map((p, i) => (
                                <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                                    {!uploading && (
                                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => removePending(i)}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <p className="text-xs text-slate-400 truncate pr-6">{p.file.name}</p>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nome documento</Label>
                                        <Input value={p.name} disabled={batchUpload.statuses[i]?.status === 'uploading'} onChange={e => updatePending(i, { name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nota (opzionale)</Label>
                                        <Input value={p.notes} disabled={batchUpload.statuses[i]?.status === 'uploading'} onChange={e => updatePending(i, { notes: e.target.value })} placeholder="Breve descrizione" />
                                    </div>
                                    <UploadStatusBar state={batchUpload.statuses[i]} />
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
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Carica {pendingFiles.length > 1 ? `(${pendingFiles.length})` : ""}
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
                            <Label>Nome documento</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Nota</Label>
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} />
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
        </div>
    )
}
