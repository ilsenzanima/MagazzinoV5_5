"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Trash2, Loader2, Pencil } from "lucide-react"
import { JobDocument, jobDocumentsApi } from "@/lib/api"
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
import { getFileIcon } from "@/lib/file-icon"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { compressImageIfNeeded } from "@/lib/image-compress"

interface JobDocumentsProps {
  jobId: string
}

export function JobDocuments({ jobId }: JobDocumentsProps) {
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeDoc, setActiveDoc] = useState<JobDocument | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Upload form
  const [upFile, setUpFile] = useState<File | null>(null)
  const [upName, setUpName] = useState("")
  const [upNotes, setUpNotes] = useState("")
  const upRef = useRef<HTMLInputElement>(null)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const editRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useViewMode('job-documents', 'grid')

  useEffect(() => {
    if (jobId) loadDocuments()
  }, [jobId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const all = await jobDocumentsApi.getByJobId(jobId)
      setDocuments(all.filter(d => d.category !== "conformita" && d.category !== "offerte-fornitori"))
    } catch (error) {
      console.error("Failed to load documents", error)
      toast.error("Errore nel caricamento dei documenti")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!upFile || !jobId) return
    try {
      setUploading(true)
      const compressed = await compressImageIfNeeded(upFile)
      const fileExt = compressed.name.split('.').pop() || ''
      const fileName = `${jobId}/${Math.random().toString(36).substring(7)}_${compressed.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, compressed)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)

      await jobDocumentsApi.create({
        jobId,
        name: upName.trim() || upFile.name,
        notes: upNotes.trim(),
        fileUrl: publicUrl,
        fileType: fileExt,
      })

      toast.success("Documento caricato con successo")
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
      toast.success("Documento aggiornato")
      setEditOpen(false)
      loadDocuments()
    } catch {
      toast.error("Errore durante l'aggiornamento")
    } finally {
      setSaving(false)
    }
  }

  const handleOpenDocument = async (fileUrl: string) => {
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
      const path = activeDoc.fileUrl?.split('/public/documents/')[1]
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Documenti Cantiere</h2>
        <div className="flex items-center gap-2">
          {documents.length > 0 && <ViewToggle mode={viewMode} onChange={setViewMode} />}
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setUpFile(null); setUpName(""); setUpNotes(""); setUploadOpen(true) }}>
            <Upload className="mr-2 h-4 w-4" />
            Carica Documento
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
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {documents.map((doc) => (
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
              <p className="text-xs text-slate-400 shrink-0">{format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-700"
                onClick={e => openEdit(doc, e)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
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
                <p className="text-sm text-slate-600 font-medium">{upFile ? upFile.name : "Clicca per selezionare un file"}</p>
                {upFile && <p className="text-xs text-slate-400 mt-1">{(upFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nome documento</Label>
              <Input value={upName} onChange={e => setUpName(e.target.value)} placeholder="Es. Permesso di costruire" />
            </div>
            <div className="space-y-1">
              <Label>Nota (opzionale)</Label>
              <Input value={upNotes} onChange={e => setUpNotes(e.target.value)} placeholder="Breve descrizione visibile al volo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
            <Button onClick={handleUpload} disabled={!upFile || uploading}>
              {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Carica
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
