"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Upload, Trash2, File, FileImage, FileSpreadsheet, Loader2, Pencil } from "lucide-react"
import { jobCommessaDocumentsApi, JobCommessaDocument } from "@/lib/services/job-commessa-documents"
import { supabase } from "@/lib/supabase"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { notify } from "@/lib/notify"

interface Props {
    jobId: string
}

export function JobCommessaDocuments({ jobId }: Props) {
    const [documents, setDocuments] = useState<JobCommessaDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<JobCommessaDocument | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Upload form
    const [upFile, setUpFile] = useState<File | null>(null)
    const [upName, setUpName] = useState("")
    const [upNotes, setUpNotes] = useState("")
    const upRef = useRef<HTMLInputElement>(null)

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [editFile, setEditFile] = useState<File | null>(null)
    const editRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try { setLoading(true); setDocuments(await jobCommessaDocumentsApi.getByJobId(jobId)) }
        catch { notify.error("Errore nel caricamento documenti") }
        finally { setLoading(false) }
    }

    const openDoc = async (fileUrl: string) => {
        try {
            const path = fileUrl.split('/public/documents/')[1]
            if (!path) { window.open(fileUrl, '_blank'); return }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(fileUrl, '_blank'); return }
            window.open(data.signedUrl, '_blank')
        } catch { window.open(fileUrl, '_blank') }
    }

    const openEdit = (doc: JobCommessaDocument, e: React.MouseEvent) => {
        e.stopPropagation()
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditFile(null)
        setEditOpen(true)
    }

    const handleUpload = async () => {
        if (!upFile) return
        try {
            setUploading(true)
            const ext = upFile.name.split('.').pop() || ''
            const path = `jobs/${jobId}/commessa/${Math.random().toString(36).slice(2)}_${upFile.name}`
            const { error: upErr } = await supabase.storage.from('documents').upload(path, upFile)
            if (upErr) throw upErr
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
            await jobCommessaDocumentsApi.create({
                jobId,
                name: upName.trim() || upFile.name,
                notes: upNotes.trim(),
                fileUrl: publicUrl,
                fileType: ext,
                uploadedBy: '',
                uploadedByName: '',
            })
            notify.success("Documento caricato")
            setUploadOpen(false)
            await load()
        } catch (e: any) { notify.error("Errore upload: " + e.message) }
        finally { setUploading(false) }
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            let fileUrl = activeDoc.fileUrl
            let fileType = activeDoc.fileType

            if (editFile) {
                const ext = editFile.name.split('.').pop() || ''
                const path = `jobs/${jobId}/commessa/${Math.random().toString(36).slice(2)}_${editFile.name}`
                const { error: upErr } = await supabase.storage.from('documents').upload(path, editFile)
                if (upErr) throw upErr
                const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
                fileUrl = publicUrl
                fileType = ext
            }

            await jobCommessaDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
                fileUrl,
                fileType,
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
            await jobCommessaDocumentsApi.delete(activeDoc.id)
            setDocuments(d => d.filter(x => x.id !== activeDoc.id))
            setDeleteOpen(false)
            setEditOpen(false)
            setActiveDoc(null)
        } catch { notify.error("Errore eliminazione") }
    }

    const getIcon = (type?: string) => {
        const t = (type || '').toLowerCase()
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return <FileImage className="h-8 w-8 text-blue-500" />
        if (t === 'pdf') return <FileText className="h-8 w-8 text-red-500" />
        if (['xls', 'xlsx', 'csv'].includes(t)) return <FileSpreadsheet className="h-8 w-8 text-green-500" />
        return <File className="h-8 w-8 text-slate-500" />
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Documenti Commessa</h2>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setUpFile(null); setUpName(""); setUpNotes(""); setUploadOpen(true) }}>
                    <Upload className="mr-2 h-4 w-4" />Carica Documento
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : documents.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nessun documento. Carica contratti, preventivi o altro relativo alla commessa.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => (
                        <Card
                            key={doc.id}
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openDoc(doc.fileUrl)}
                        >
                            <CardContent className="p-4 flex items-start gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">{getIcon(doc.fileType)}</div>
                                <div className="flex-1 overflow-hidden min-w-0">
                                    <div className="flex justify-between items-start gap-1">
                                        <p className="font-medium truncate text-sm pr-1" title={doc.name}>{doc.name}</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
                                            onClick={e => openEdit(doc, e)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    {doc.notes && <p className="text-xs text-slate-500 mt-0.5 italic truncate">{doc.notes}</p>}
                                    <p className="text-xs text-slate-400 mt-1">{format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Carica Documento</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>File</Label>
                            <div
                                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => upRef.current?.click()}
                            >
                                <input type="file" className="hidden" ref={upRef} onChange={e => {
                                    const f = e.target.files?.[0]
                                    if (!f) return
                                    setUpFile(f)
                                    if (!upName) setUpName(f.name.replace(/\.[^.]+$/, ''))
                                }} />
                                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                                <p className="text-sm text-slate-600 font-medium">{upFile ? upFile.name : "Clicca per selezionare"}</p>
                                {upFile && <p className="text-xs text-slate-400 mt-1">{(upFile.size / 1024 / 1024).toFixed(2)} MB</p>}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Nome documento</Label>
                            <Input value={upName} onChange={e => setUpName(e.target.value)} placeholder="Es. Contratto firmato" />
                        </div>
                        <div className="space-y-1">
                            <Label>Nota (opzionale)</Label>
                            <Input value={upNotes} onChange={e => setUpNotes(e.target.value)} placeholder="Breve descrizione visibile al volo" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
                        <Button onClick={handleUpload} disabled={!upFile || uploading}>
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Carica
                        </Button>
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
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Breve descrizione" />
                        </div>
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
        </div>
    )
}
