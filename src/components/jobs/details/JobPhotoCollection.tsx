"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Upload, Images, CheckSquare, FolderInput, Trash2, X } from "lucide-react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { isImageFileType } from "@/components/ui/photo-gallery"
import { getFileIcon } from "@/lib/file-icon"

// Campi minimi di un documento per mostrarlo come foto (valido per ogni tipo di documento)
export interface PhotoDocLike {
  id: string
  name: string
  notes?: string
  fileUrl: string
  fileType: string
  createdAt: string
}

// Miniatura di una foto su Drive: il server la genera (e la conserva) al primo accesso
export function PhotoThumb({ doc, className = "" }: { doc: PhotoDocLike; className?: string }) {
  const [failed, setFailed] = useState(false)
  const isDrive = !!doc.fileUrl && !doc.fileUrl.includes("/")
  if (!isDrive || !isImageFileType(doc.fileType) || failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 ${className}`}>
        {getFileIcon(doc.fileType, "h-6 w-6")}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/drive/thumbnail?fileId=${encodeURIComponent(doc.fileUrl)}`}
      alt={doc.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-slate-100 object-cover dark:bg-slate-800 ${className}`}
    />
  )
}

interface JobPhotoCollectionProps<T extends PhotoDocLike> {
  title: string
  docs: T[]
  onBack: () => void
  backLabel?: string
  onAdd: () => void
  onOpen: (doc: T) => void
  menu: (doc: T) => ReactNode
  onMoveSelected: (docs: T[]) => void
  onDeleteSelected: (docs: T[]) => void
}

// Pagina di una raccolta di foto (un tipo, o una cartella di quel tipo)
export function JobPhotoCollection<T extends PhotoDocLike>({ title, docs, onBack, backLabel = "Documenti Cantiere", onAdd, onOpen, menu, onMoveSelected, onDeleteSelected }: JobPhotoCollectionProps<T>) {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Dopo uno spostamento o un'eliminazione le foto che non ci sono più escono dalla selezione
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(docs.map(d => d.id))
      const next = new Set(Array.from(prev).filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [docs])

  const selectedDocs = docs.filter(d => selected.has(d.id))
  const allSelected = docs.length > 0 && selectedDocs.length === docs.length
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />{backLabel}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {docs.length > 0 && !selectMode && (
            <Button variant="outline" onClick={() => setSelectMode(true)}>
              <CheckSquare className="mr-2 h-4 w-4" />Seleziona
            </Button>
          )}
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={onAdd}>
            <Upload className="mr-2 h-4 w-4" />Aggiungi foto
          </Button>
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
          <Images className="h-5 w-5 text-blue-600" />{title}
        </h2>
        <span className="text-sm text-slate-500">{docs.length} foto</span>
      </div>

      {selectMode && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm dark:border-blue-900 dark:bg-slate-900">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allSelected}
              onCheckedChange={v => setSelected(v ? new Set(docs.map(d => d.id)) : new Set())}
              aria-label="Seleziona tutte"
            />
            {selectedDocs.length > 0 ? `${selectedDocs.length} selezionate` : "Seleziona tutte"}
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={selectedDocs.length === 0} onClick={() => onMoveSelected(selectedDocs)}>
              <FolderInput className="mr-1.5 h-4 w-4" />Sposta
            </Button>
            <Button variant="outline" size="sm" disabled={selectedDocs.length === 0} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDeleteSelected(selectedDocs)}>
              <Trash2 className="mr-1.5 h-4 w-4" />Elimina
            </Button>
            <Button variant="ghost" size="sm" onClick={exitSelect}><X className="mr-1 h-4 w-4" />Fine</Button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed py-12 text-center text-sm text-slate-400">
          Nessuna foto in questa raccolta. Usa «Aggiungi foto» per caricarne.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {docs.map(doc => {
            const isSel = selected.has(doc.id)
            return (
              <div key={doc.id} className={`group relative overflow-hidden rounded-lg border bg-white dark:bg-slate-900 ${isSel ? "ring-2 ring-blue-500" : ""}`}>
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => (selectMode ? toggle(doc.id) : onOpen(doc))}
                  title={doc.notes ? `${doc.name} — ${doc.notes}` : doc.name}
                >
                  <PhotoThumb doc={doc} className={`aspect-square w-full transition-opacity ${isSel ? "opacity-80" : ""}`} />
                </button>
                {selectMode ? (
                  <div className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-white/90 p-0.5 shadow-sm">
                    <Checkbox checked={isSel} aria-label={`Seleziona ${doc.name}`} />
                  </div>
                ) : (
                  <div className="absolute right-1 top-1 rounded-md bg-white/90 shadow-sm dark:bg-slate-900/90">{menu(doc)}</div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{doc.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {doc.notes || format(new Date(doc.createdAt), "dd/MM/yyyy", { locale: it })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
