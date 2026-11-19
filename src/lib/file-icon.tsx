import { FileText, File, FileImage, FileSpreadsheet, FileArchive, FileCode, Presentation, Ruler, type LucideIcon } from "lucide-react"

// Ogni tipo di file ha una tessera colorata con il simbolo in tinta scura: leggibile su sfondo chiaro e scuro
interface FileStyle { Icon: LucideIcon; tile: string }
const STYLES: Record<string, FileStyle> = {
  pdf: { Icon: FileText, tile: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" },
  word: { Icon: FileText, tile: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  excel: { Icon: FileSpreadsheet, tile: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300" },
  powerpoint: { Icon: Presentation, tile: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" },
  image: { Icon: FileImage, tile: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
  archive: { Icon: FileArchive, tile: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  cad: { Icon: Ruler, tile: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" },
  text: { Icon: FileCode, tile: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  other: { Icon: File, tile: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200" },
}

function kindOf(ext: string): keyof typeof STYLES {
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'dot', 'dotx', 'odt', 'rtf'].includes(ext)) return 'word'
  if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(ext)) return 'excel'
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'powerpoint'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'tif', 'tiff', 'svg'].includes(ext)) return 'image'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (['dwg', 'dxf', 'dwf'].includes(ext)) return 'cad'
  if (['txt', 'xml', 'json', 'md', 'log'].includes(ext)) return 'text'
  return 'other'
}

// `className` dà la dimensione della tessera (es. "h-5 w-5"); il simbolo occupa il 70%
export function getFileIcon(type?: string, className = "h-8 w-8") {
  const { Icon, tile } = STYLES[type ? kindOf(type.toLowerCase().replace('.', '')) : 'other']
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md ${tile} ${className}`} aria-hidden>
      <Icon className="h-[70%] w-[70%]" strokeWidth={2.25} />
    </span>
  )
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
