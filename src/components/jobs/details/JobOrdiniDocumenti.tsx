"use client"

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, FileText, Pencil, Trash2 } from "lucide-react"
import { jobDocumentsApi } from "@/lib/api"
import type { JobDocument } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { getFileIcon } from "@/lib/file-icon"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { JobOrdini } from "@/components/jobs/details/JobOrdini"

interface PendingFile {
    file: File
    name: string
    notes: string
}

const CATEGORY = "offerte-fornitori"

interface Props {
    jobId: string
    jobCode?: string
}

export function JobOrdiniDocumenti({ jobId, jobCode }: Props) {
    const [documents, setDocuments] = useState<JobDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<JobDocument | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [viewMode, setViewMode] = useViewMode('job-ordini-documenti', 'grid')
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Upload wizard
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [dragOver, setDragOver] = useState(false)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")

    useEffect(() => {
        if (jobId) load()
    }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const all = await jobDocumentsApi.getByJobId(jobId)
            setDocuments(all.filter(d => d.category === CATEGORY))
        } catch (error) {
            console.error("Failed to load offerte fornitori", error)
            notify.error("Errore nel caricamento delle offerte fornitori")
        } finally {
            setLoading(false)
        }
    }

    const openUpload = () => {
        setUpStep(1)
        setPendingFiles([])
        setUploadOpen(true)
    }

    const addFiles = (files: FileList | File[]) => {
        const arr = Array.from(files).map(file => ({
            file,
            name: file.name.replace(/\.[^.]+$/, ''),
            notes: "",
        }))
        setPendingFiles(prev => [...prev, ...arr])
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

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0 || !jobId) return
        try {
            setUploading(true)
            for (const pending of pendingFiles) {
                const fileExt = pending.file.name.split('.').pop() || ''
                const path = `jobs/${jobId}/offerte-fornitori/${Math.random().toString(36).substring(7)}_${pending.file.name}`
                const { error: uploadError } = await supabase.storage.from('documents').upload(path, pending.file)
                if (uploadError) throw uploadError
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

                await jobDocumentsApi.create({
                    jobId,
                    name: pending.name.trim() || pending.file.name,
                    notes: pending.notes.trim(),
                    fileUrl: publicUrl,
                    fileType: fileExt,
                    category: CATEGORY,
                })
            }
            notify.success("Documenti caricati con successo")
            setUploadOpen(false)
            load()
        } catch (error) {
            console.error("Upload failed", error)
            notify.error("Errore durante il caricamento")
        } finally {
            setUploading(false)
        }
    }

    const openEdit = (doc: JobDocument) => {
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            await jobDocumentsApi.update(activeDoc.id, {
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
            await jobDocumentsApi.delete(activeDoc.id)
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

    const renderDocCard = (doc: JobDocument) => (
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

    const renderDocRow = (doc: JobDocument) => (
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
        <Tabs defaultValue="offerte" className="space-y-4">
            <TabsList>
                <TabsTrigger value="offerte">Offerte Fornitori</TabsTrigger>
                <TabsTrigger value="conferme">Conferme d&apos;ordine</TabsTrigger>
            </TabsList>

            <TabsContent value="offerte" className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Offerte Fornitori</h2>
                    <div className="flex items-center gap-2">
                        <ViewToggle mode={viewMode} onChange={setViewMode} />
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openUpload}>
                            <Upload className="mr-2 h-4 w-4" />
                            Carica Documenti
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
                            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessuna offerta fornitore</h3>
                            <p className="text-slate-500 dark:text-slate-400">Carica le offerte ricevute dai fornitori per questa commessa.</p>
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
            </TabsContent>

            <TabsContent value="conferme" className="space-y-4">
                <JobOrdini jobId={jobId} jobCode={jobCode} />
            </TabsContent>

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Carica Offerte Fornitori</DialogTitle></DialogHeader>
                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
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
                            {pendingFiles.length > 0 && (
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {pendingFiles.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                                            <span className="truncate">{p.file.name}</span>
                                            <button onClick={() => removePending(i)} className="text-slate-400 hover:text-red-600 ml-2">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
                            {pendingFiles.map((p, i) => (
                                <div key={i} className="space-y-2 border rounded-lg p-3">
                                    <p className="text-xs text-slate-400 truncate">{p.file.name}</p>
                                    <div className="space-y-1">
                                        <Label>Nome documento</Label>
                                        <Input value={p.name} onChange={e => updatePending(i, { name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Nota (opzionale)</Label>
                                        <Input value={p.notes} onChange={e => updatePending(i, { notes: e.target.value })} />
                                    </div>
                                </div>
                            ))}
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
                                <Button onClick={handleUploadAll} disabled={uploading}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Carica
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
        </Tabs>
    )
}
