"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Trash2, Loader2, Pencil, X } from "lucide-react"
import { JobDocument, jobDocumentsApi } from "@/lib/api"
import { jobSiteDocumentTypesApi, JobSiteDocumentType } from "@/lib/services/job-site-document-types"
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
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { compressImageIfNeeded } from "@/lib/image-compress"

interface JobDocumentsProps {
  jobId: string
  jobLabel?: string
}

interface PendingFile {
  file: File
  name: string
  notes: string
}

const UNTYPED_KEY = "__untyped__"

export function JobDocuments({ jobId, jobLabel }: JobDocumentsProps) {
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [docTypes, setDocTypes] = useState<JobSiteDocumentType[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeDoc, setActiveDoc] = useState<JobDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const [viewMode, setViewMode] = useViewMode('job-documents', 'grid')

  // Upload wizard state
  const [upStep, setUpStep] = useState<1 | 2>(1)
  const [upDocTypeId, setUpDocTypeId] = useState("")
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const upRef = useRef<HTMLInputElement>(null)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editDocTypeId, setEditDocTypeId] = useState("")
  const [editFile, setEditFile] = useState<File | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (jobId) loadDocuments()
  }, [jobId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const [all, types] = await Promise.all([
        jobDocumentsApi.getByJobId(jobId),
        jobSiteDocumentTypesApi.getAll(),
      ])
      setDocuments(all.filter(d => d.category !== "conformita" && d.category !== "offerte-fornitori"))
      setDocTypes(types)
    } catch (error) {
      console.error("Failed to load documents", error)
      toast.error("Errore nel caricamento dei documenti")
    } finally {
      setLoading(false)
    }
  }

  const openUpload = () => {
    setUpStep(1)
    setUpDocTypeId("")
    setPendingFiles([])
    setDragOver(false)
    setUploadOpen(true)
  }

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const newPending: PendingFile[] = Array.from(files).map(f => ({
      file: f,
      name: f.name.replace(/\.[^.]+$/, ''),
      notes: "",
    }))
    setPendingFiles(prev => [...prev, ...newPending])
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

  const handleUploadAll = async () => {
    if (pendingFiles.length === 0 || !jobId) return
    try {
      setUploading(true)
      for (const pf of pendingFiles) {
        const compressed = await compressImageIfNeeded(pf.file)
        const fileExt = compressed.name.split('.').pop() || ''
        const formData = new FormData()
        formData.append('file', compressed)
        formData.append('folderPath', JSON.stringify(['Cantieri', jobLabel || jobId, 'Documenti']))
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
        const uploaded = await res.json()
        if (!res.ok) throw new Error(uploaded.error || 'Errore upload su Google Drive')

        await jobDocumentsApi.create({
          jobId,
          documentTypeId: upDocTypeId || null,
          name: pf.name.trim() || pf.file.name,
          notes: pf.notes.trim(),
          fileUrl: uploaded.fileId,
          fileType: fileExt,
          fileSize: compressed.size,
        })
      }
      toast.success(pendingFiles.length > 1 ? "Documenti caricati con successo" : "Documento caricato con successo")
      setUploadOpen(false)
      loadDocuments()
    } catch (error: any) {
      console.error("Upload failed", error)
      toast.error("Errore durante il caricamento: " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const openEdit = (doc: JobDocument, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveDoc(doc)
    setEditName(doc.name)
    setEditNotes(doc.notes || "")
    setEditDocTypeId(doc.documentTypeId || "")
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
        const formData = new FormData()
        formData.append('file', compressed)
        formData.append('folderPath', JSON.stringify(['Cantieri', jobLabel || jobId, 'Documenti']))
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
        const uploaded = await res.json()
        if (!res.ok) throw new Error(uploaded.error || 'Errore upload su Google Drive')
        fileUrl = uploaded.fileId
        fileType = fileExt
        fileSize = compressed.size
      }

      await jobDocumentsApi.update(activeDoc.id, {
        name: editName.trim() || activeDoc.name,
        notes: editNotes.trim(),
        documentTypeId: editDocTypeId || null,
        fileUrl,
        fileType,
        fileSize,
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
      await jobDocumentsApi.delete(activeDoc.id)
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

  const renderDocCard = (doc: JobDocument) => (
    <Card
      key={doc.id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => handleOpenDocument(doc.fileUrl)}
    >
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
              onClick={e => openEdit(doc, e)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
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

  const renderDocRow = (doc: JobDocument) => (
    <div
      key={doc.id}
      className="flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => handleOpenDocument(doc.fileUrl)}
    >
      <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded shrink-0">
        {getFileIcon(doc.fileType, "h-5 w-5")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm" title={doc.name}>{doc.name}</p>
        {doc.notes && <p className="text-xs text-slate-500 italic truncate">{doc.notes}</p>}
      </div>
      <p className="text-xs text-slate-400 shrink-0">
        {format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}
        {doc.fileSize != null && ` · ${formatFileSize(doc.fileSize)}`}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
        onClick={e => openEdit(doc, e)}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  )

  const groups: { key: string; label: string; docs: JobDocument[] }[] = [
    ...docTypes.map(t => ({ key: t.id, label: t.name, docs: documents.filter(d => d.documentTypeId === t.id) })),
    { key: UNTYPED_KEY, label: "Senza tipo", docs: documents.filter(d => !d.documentTypeId) },
  ].filter(g => g.docs.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Documenti Cantiere</h2>
        <div className="flex items-center gap-2">
          {documents.length > 0 && <ViewToggle mode={viewMode} onChange={setViewMode} />}
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
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessun documento</h3>
            <p className="text-slate-500 dark:text-slate-400">Carica progetti, permessi, o foto del cantiere.</p>
          </CardContent>
        </Card>
      ) : groups.length <= 1 ? (
        viewMode === 'list' ? (
          <div className="space-y-1.5">
            {documents.map(renderDocRow)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map(renderDocCard)}
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
          {groups.map(g => (
            <TabsContent key={g.key} value={g.key} className="pt-4">
              {viewMode === 'list' ? (
                <div className="space-y-1.5">
                  {g.docs.map(renderDocRow)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.docs.map(renderDocCard)}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Upload dialog - step 1: tipo + file multipli */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Carica Documenti</DialogTitle></DialogHeader>
          {upStep === 1 ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Tipo documento</Label>
                <Select value={upDocTypeId} onValueChange={setUpDocTypeId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona tipo documento" /></SelectTrigger>
                  <SelectContent>
                    {docTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {docTypes.length === 0 && (
                  <p className="text-xs text-slate-400">Nessun tipo configurato. Vai in Impostazioni &gt; Dati &gt; Documenti Cantiere per crearne uno.</p>
                )}
              </div>
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
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => removePending(idx)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <p className="text-xs text-slate-400 truncate pr-6">{pf.file.name}</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome documento</Label>
                    <Input value={pf.name} onChange={e => updatePending(idx, { name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nota (opzionale)</Label>
                    <Input value={pf.notes} onChange={e => updatePending(idx, { notes: e.target.value })} placeholder="Breve descrizione" />
                  </div>
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
                <SelectTrigger><SelectValue placeholder="Nessun tipo" /></SelectTrigger>
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
    </div>
  )
}
