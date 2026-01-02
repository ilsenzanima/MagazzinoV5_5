"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Download, Trash2, File, FileImage, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react"
import { JobDocument, jobDocumentsApi } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface JobDocumentsProps {
  jobId: string
}

export function JobDocuments({ jobId }: JobDocumentsProps) {
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = useState("project")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (jobId) {
      loadDocuments()
    }
  }, [jobId])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const data = await jobDocumentsApi.getByJobId(jobId)
      setDocuments(data)
    } catch (error) {
      console.error("Failed to load documents", error)
      toast.error("Errore nel caricamento dei documenti")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!fileToUpload || !jobId) return

    try {
      setIsUploading(true)

      // 1. Upload to Supabase Storage
      const fileExt = fileToUpload.name.split('.').pop()
      const fileName = `${jobId}/${Math.random().toString(36).substring(7)}_${fileToUpload.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, fileToUpload)

      if (uploadError) throw uploadError

      // 2. Get Public URL (or just store path if private)
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      // 3. Create Record in DB
      await jobDocumentsApi.create({
        jobId,
        name: fileToUpload.name,
        fileUrl: publicUrl,
        fileType: fileExt,
        category: uploadCategory,
      })

      toast.success("Documento caricato con successo")
      setIsUploadOpen(false)
      setFileToUpload(null)
      loadDocuments()
    } catch (error: any) {
      console.error("Upload failed", error)
      toast.error("Errore durante il caricamento: " + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (doc: JobDocument) => {
    if (!confirm("Sei sicuro di voler eliminare questo documento?")) return

    try {
      // Note: We are only deleting the record from DB for now. 
      // Ideally we should also delete from Storage, but we need the path.
      // The publicUrl might contain the path.

      await jobDocumentsApi.delete(doc.id)

      // Try to delete from storage if possible (optional for now)
      // const path = doc.fileUrl.split('/documents/')[1]
      // if (path) await supabase.storage.from('documents').remove([path])

      toast.success("Documento eliminato")
      setDocuments(documents.filter(d => d.id !== doc.id))
    } catch (error) {
      console.error("Delete failed", error)
      toast.error("Errore durante l'eliminazione")
    }
  }

  const getFileIcon = (type?: string) => {
    if (!type) return <FileText className="h-8 w-8 text-slate-400" />

    const t = type.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return <FileImage className="h-8 w-8 text-blue-500" />
    if (['pdf'].includes(t)) return <FileText className="h-8 w-8 text-red-500" />
    if (['xls', 'xlsx', 'csv'].includes(t)) return <FileSpreadsheet className="h-8 w-8 text-green-500" />

    return <File className="h-8 w-8 text-slate-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800">Documenti Cantiere</h2>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Upload className="mr-2 h-4 w-4" />
              Carica Documento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carica Nuovo Documento</DialogTitle>
              <DialogDescription>
                Seleziona un file da caricare per questa commessa.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project">Progetto</SelectItem>
                    <SelectItem value="contract">Contratto</SelectItem>
                    <SelectItem value="safety">Sicurezza</SelectItem>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Upload className="h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">
                    {fileToUpload ? fileToUpload.name : "Clicca per selezionare un file"}
                  </p>
                  {fileToUpload && (
                    <p className="text-xs text-slate-400 mt-1">
                      {(fileToUpload.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Annulla</Button>
              <Button onClick={handleUpload} disabled={!fileToUpload || isUploading}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Carica
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-slate-50 p-2 rounded">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium truncate pr-2" title={doc.name}>{doc.name}</p>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Download className="h-3 w-3 text-slate-500" />
                        </Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                      {doc.category === 'project' ? 'Progetto' :
                        doc.category === 'contract' ? 'Contratto' :
                          doc.category === 'safety' ? 'Sicurezza' :
                            doc.category === 'photo' ? 'Foto' : 'Altro'}
                    </span>
                    <span className="text-xs text-slate-400">• {format(new Date(doc.createdAt), 'dd MMM yyyy', { locale: it })}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    Caricato da {doc.uploadedBy || 'Utente'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
