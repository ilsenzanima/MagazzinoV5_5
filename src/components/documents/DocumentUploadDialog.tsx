"use client"

import { useRef, useState, type ReactNode } from "react"
import { CheckCircle2, FileText, FolderPlus, Loader2, Upload, X, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MAX_BATCH_UPLOAD_FILES, type UploadItemState } from "@/hooks/useBatchUpload"
import { notify } from "@/lib/notify"

export interface PendingFile {
  file: File
  name: string
  notes: string
  isOld: boolean
  isRev: boolean
}

// Elenco dei file scelti, con le modifiche di nome/nota/OLD/REV: lo usa il componente sotto e ogni pagina che carica documenti
export function usePendingFiles() {
  const [files, setFiles] = useState<PendingFile[]>([])

  const add = (list: FileList | File[] | null) => {
    if (!list || list.length === 0) return
    setFiles(prev => {
      const room = MAX_BATCH_UPLOAD_FILES - prev.length
      if (room <= 0) {
        notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`)
        return prev
      }
      const selected = Array.from(list)
      if (selected.length > room) notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`)
      return [
        ...prev,
        ...selected.slice(0, room).map(f => ({ file: f, name: f.name.replace(/\.[^.]+$/, ""), notes: "", isOld: false, isRev: false })),
      ]
    })
  }
  const update = (idx: number, patch: Partial<PendingFile>) => setFiles(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  const remove = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))
  const clear = () => setFiles([])

  return { files, setFiles, add, update, remove, clear }
}

export interface UploadDocType { id: string; name: string; allowsFolders?: boolean }
export interface UploadFolder { id: string; name: string; documentTypeId: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  docTypes?: UploadDocType[] // senza tipi (es. offerte fornitori) la scelta di tipo e cartella non compare
  topSlot?: ReactNode // campi in piu' sopra l'area file (es. il fornitore)
  submitDisabled?: boolean
  emptyTypesHint?: string
  typeId?: string
  onTypeChange?: (id: string) => void
  folders?: UploadFolder[]
  folderId?: string
  onFolderChange?: (id: string) => void
  onNewFolder?: (typeId: string) => void
  files: PendingFile[]
  onAddFiles: (files: FileList | File[] | null) => void
  onUpdateFile: (idx: number, patch: Partial<PendingFile>) => void
  onRemoveFile: (idx: number) => void
  statuses: UploadItemState[]
  uploading: boolean
  onSubmit: () => void
  accept?: string
  showOldRev?: boolean // colonne Old/Rev: solo dove il documento le prevede
}

const fmtSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

// Modale unica per caricare documenti: tipo e cartella in alto, area di trascinamento, tabella con una riga per file
export function DocumentUploadDialog({
  open, onOpenChange, title = "Carica documenti", docTypes, topSlot, submitDisabled, emptyTypesHint, typeId = "", onTypeChange,
  folders = [], folderId = "", onFolderChange, onNewFolder, files, onAddFiles, onUpdateFile, onRemoveFile,
  statuses, uploading, onSubmit, accept, showOldRev = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const types = docTypes ?? []
  const type = types.find(t => t.id === typeId)
  const typeFolders = folders.filter(f => f.documentTypeId === typeId)
  const done = statuses.filter(s => s.status === "done").length
  const busy = (i: number) => uploading && statuses[i]?.status === "uploading"

  return (
    <Dialog open={open} onOpenChange={v => { if (!uploading) onOpenChange(v) }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {topSlot}
          {docTypes && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo documento</Label>
              <Select value={typeId} onValueChange={v => { onTypeChange?.(v); onFolderChange?.("") }} disabled={uploading}>
                <SelectTrigger><SelectValue placeholder="Seleziona il tipo" /></SelectTrigger>
                <SelectContent>{types.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
              {types.length === 0 && emptyTypesHint && <p className="text-xs text-slate-400">{emptyTypesHint}</p>}
            </div>
            {type?.allowsFolders && (
              <div className="space-y-1">
                <Label>Cartella (facoltativa)</Label>
                <div className="flex gap-2">
                  <Select value={folderId || "root"} onValueChange={v => onFolderChange?.(v === "root" ? "" : v)} disabled={uploading}>
                    <SelectTrigger><SelectValue placeholder="Nessuna cartella" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Nessuna cartella</SelectItem>
                      {typeFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {onNewFolder && (
                    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => onNewFolder(typeId)} title="Nuova cartella" disabled={uploading}>
                      <FolderPlus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>}

          <div
            className={`flex cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors ${files.length === 0 ? "flex-col px-6 py-10" : "flex-row px-4 py-3"} ${dragOver ? "border-blue-400 bg-blue-50 dark:bg-blue-950" : "border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"}`}
            onClick={() => !uploading && inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (!uploading) onAddFiles(e.dataTransfer.files) }}
          >
            <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={e => { onAddFiles(e.target.files); e.target.value = "" }} />
            <Upload className={files.length === 0 ? "h-9 w-9 text-slate-400" : "h-5 w-5 text-slate-400"} />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{files.length === 0 ? "Trascina qui i file o clicca per sceglierli" : "Aggiungi altri file"}</p>
              {files.length === 0 && <p className="text-xs text-slate-400">Fino a {MAX_BATCH_UPLOAD_FILES} file alla volta</p>}
            </div>
          </div>

          {files.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-muted">
                      <th className="px-3 py-2">Nome documento</th>
                      <th className="w-64 px-2 py-2">Nota</th>
                      {showOldRev && <th className="w-14 px-2 py-2 text-center" title='Mostra il banner "OLD"'>Old</th>}
                      {showOldRev && <th className="w-14 px-2 py-2 text-center" title='Mostra il banner "REV"'>Rev</th>}
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {files.map((pf, idx) => {
                      const st = statuses[idx]
                      return (
                        <tr key={`${pf.file.name}-${idx}`} className={st?.status === "done" ? "bg-green-50/50 dark:bg-green-950/20" : undefined}>
                          <td className="px-3 py-2 align-top">
                            <Input value={pf.name} disabled={busy(idx) || st?.status === "done"} onChange={e => onUpdateFile(idx, { name: e.target.value })} className="h-8" />
                            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-400"><FileText className="h-3 w-3 shrink-0" />{pf.file.name} · {fmtSize(pf.file.size)}</p>
                            {st?.status === "error" && st.error && <p className="mt-0.5 text-[11px] font-medium text-red-500">{st.error}</p>}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <Input value={pf.notes} disabled={busy(idx) || st?.status === "done"} onChange={e => onUpdateFile(idx, { notes: e.target.value })} placeholder="Breve descrizione" className="h-8" />
                          </td>
                          {showOldRev && <td className="px-2 py-2 text-center align-top"><div className="flex h-8 items-center justify-center"><Checkbox checked={pf.isOld} disabled={uploading} onCheckedChange={v => onUpdateFile(idx, { isOld: v === true })} aria-label="Banner OLD" /></div></td>}
                          {showOldRev && <td className="px-2 py-2 text-center align-top"><div className="flex h-8 items-center justify-center"><Checkbox checked={pf.isRev} disabled={uploading} onCheckedChange={v => onUpdateFile(idx, { isRev: v === true })} aria-label="Banner REV" /></div></td>}
                          <td className="px-2 py-2 align-top">
                            <div className="flex h-8 items-center justify-center">
                              {st?.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                : st?.status === "done" ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                : st?.status === "error" ? <XCircle className="h-4 w-4 text-red-500" />
                                : <button type="button" disabled={uploading} onClick={() => onRemoveFile(idx)} className="text-slate-400 hover:text-red-600 disabled:opacity-40" title="Togli"><X className="h-4 w-4" /></button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {uploading && (
                <div className="flex items-center gap-3 border-t bg-slate-50 px-3 py-2 dark:bg-muted">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(done / files.length) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{done} di {files.length}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Annulla</Button>
          <Button onClick={onSubmit} disabled={uploading || files.length === 0 || submitDisabled}>
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Carica{files.length > 1 ? ` ${files.length} file` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
