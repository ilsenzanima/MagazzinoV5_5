"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Upload, Images } from "lucide-react"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { SiteDocument } from "@/lib/services/job-site-documents"
import { isImageFileType } from "@/components/ui/photo-gallery"
import { getFileIcon } from "@/lib/file-icon"

// Miniatura di una foto su Drive: il server la genera (e la conserva) al primo accesso
export function PhotoThumb({ doc, className = "" }: { doc: SiteDocument; className?: string }) {
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

interface JobPhotoCollectionProps {
  title: string
  docs: SiteDocument[]
  onBack: () => void
  onAdd: () => void
  onOpen: (doc: SiteDocument) => void
  menu: (doc: SiteDocument) => ReactNode
}

// Pagina di una raccolta di foto (un tipo, o una cartella di quel tipo)
export function JobPhotoCollection({ title, docs, onBack, onAdd, onOpen, menu }: JobPhotoCollectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-600" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />Documenti Cantiere
        </Button>
        <div className="ml-auto">
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

      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed py-12 text-center text-sm text-slate-400">
          Nessuna foto in questa raccolta. Usa «Aggiungi foto» per caricarne.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {docs.map(doc => (
            <div key={doc.id} className="group relative overflow-hidden rounded-lg border bg-white dark:bg-slate-900">
              <button type="button" className="block w-full" onClick={() => onOpen(doc)} title={doc.notes ? `${doc.name} — ${doc.notes}` : doc.name}>
                <PhotoThumb doc={doc} className="aspect-square w-full" />
              </button>
              <div className="absolute right-1 top-1 rounded-md bg-white/90 shadow-sm dark:bg-slate-900/90">{menu(doc)}</div>
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{doc.name}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {doc.notes || format(new Date(doc.createdAt), "dd/MM/yyyy", { locale: it })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
