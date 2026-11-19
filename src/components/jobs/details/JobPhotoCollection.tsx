"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Upload, Images, CheckSquare, FolderInput, Trash2, X, Download, Printer, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { downloadDocuments, downloadPhotosPdf, printPhotos } from "@/lib/document-actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NotchActions, NotchButton, NotchSearch } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { PhoneSearchPortal, usePhone } from "@/components/layout/mobile-actions"
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

type SortKey = "recent" | "oldest" | "name_asc" | "name_desc" | "number"

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Più recenti" },
  { value: "oldest", label: "Meno recenti" },
  { value: "name_asc", label: "Nome A → Z" },
  { value: "name_desc", label: "Nome Z → A" },
  { value: "number", label: "Numero nel nome" },
]

const byName = (a: string, b: string) => a.localeCompare(b, "it", { numeric: true, sensitivity: "base" })
// Primo numero scritto nel nome (es. «Foto 12» -> 12); senza numero va in fondo
const firstNumber = (name: string) => {
  const m = name.match(/\d+/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
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
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("recent")
  const phone = usePhone()
  const [busy, setBusy] = useState<"print" | "pdf" | "zip" | null>(null)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? docs.filter(d => `${d.name} ${d.notes ?? ""}`.toLowerCase().includes(q)) : [...docs]
    const time = (d: T) => new Date(d.createdAt).getTime() || 0
    list.sort((a, b) => {
      switch (sort) {
        case "oldest": return time(a) - time(b)
        case "name_asc": return byName(a.name, b.name)
        case "name_desc": return byName(b.name, a.name)
        case "number": return firstNumber(a.name) - firstNumber(b.name) || byName(a.name, b.name)
        default: return time(b) - time(a)
      }
    })
    return list
  }, [docs, search, sort])

  // Dopo uno spostamento o un'eliminazione le foto che non ci sono più escono dalla selezione
  useEffect(() => {
    setSelected(prev => {
      const ids = new Set(docs.map(d => d.id))
      const next = new Set(Array.from(prev).filter(id => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [docs])

  const selectedDocs = shown.filter(d => selected.has(d.id))
  const allSelected = shown.length > 0 && selectedDocs.length === shown.length
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const runAction = async (kind: "print" | "pdf" | "zip") => {
    setBusy(kind)
    const t = kind === "zip" ? null : toast.loading(kind === "print" ? "Preparo la stampa…" : "Creo il PDF…")
    try {
      const failed = kind === "print" ? await printPhotos(selectedDocs)
        : kind === "pdf" ? await downloadPhotosPdf(selectedDocs, `${title || "foto"}.pdf`)
        : (await downloadDocuments(selectedDocs), [] as string[])
      if (failed.length > 0) toast.error(`Non inserite (${failed.length}): ${failed.join(", ")}`)
    } catch (e) {
      console.error(e)
      toast.error("Operazione non riuscita")
    } finally { if (t) toast.dismiss(t); setBusy(null) }
  }
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }

  const sortSelect = (
    <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
      <SelectTrigger className="h-9 w-[190px] rounded-full border-slate-300 bg-white text-slate-800" aria-label="Ordina le foto">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      {/* Ricerca, ordinamento e selezione stanno nella striscia in alto (su telefono: Cerca e Azioni della barra in basso) */}
      <NotchSearch value={search} onChange={setSearch} placeholder="Cerca per nome o nota..." />
      {phone
        ? <PhoneSearchPortal title={title}>{sortSelect}</PhoneSearchPortal>
        : <NotchActions>{sortSelect}</NotchActions>}
      {docs.length > 0 && !selectMode && (
        <NotchActions>
          <NotchButton type="button" onClick={() => setSelectMode(true)}>
            <CheckSquare />Seleziona
          </NotchButton>
        </NotchActions>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />{backLabel}
        </Button>
      </div>

      <div className="flex items-baseline gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
          <Images className="h-5 w-5 text-blue-600" />{title}
        </h2>
        <span className="text-sm text-slate-500">{search.trim() ? `${shown.length} di ${docs.length} foto` : `${docs.length} foto`}</span>
      </div>

      {selectMode && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm dark:border-blue-900 dark:bg-slate-900">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allSelected}
              onCheckedChange={v => setSelected(v ? new Set(shown.map(d => d.id)) : new Set())}
              aria-label="Seleziona tutte"
            />
            {selectedDocs.length > 0 ? `${selectedDocs.length} selezionate` : "Seleziona tutte"}
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={selectedDocs.length === 0 || busy !== null} onClick={() => runAction("print")}>
              {busy === "print" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}Stampa
            </Button>
            <Button variant="outline" size="sm" disabled={selectedDocs.length === 0 || busy !== null} onClick={() => runAction("pdf")}>
              {busy === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}PDF
            </Button>
            <Button variant="outline" size="sm" disabled={selectedDocs.length === 0 || busy !== null} onClick={() => runAction("zip")}>
              {busy === "zip" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}Scarica
            </Button>
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

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed py-12 text-center text-sm text-slate-400">
          {docs.length === 0 ? "Nessuna foto in questa raccolta. Usa il pulsante blu in basso per caricarne." : "Nessuna foto corrisponde alla ricerca."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.map(doc => {
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

      <FloatingAddButton onClick={onAdd} label="Aggiungi foto" icon={<Upload className="h-6 w-6" />} />
    </div>
  )
}
