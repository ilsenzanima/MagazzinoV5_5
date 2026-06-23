import { FileText, File, FileImage, FileSpreadsheet } from "lucide-react"

export function getFileIcon(type?: string, className = "h-8 w-8") {
  if (!type) return <FileText className={`${className} text-slate-400`} />
  const t = type.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(t)) return <FileImage className={`${className} text-blue-500`} />
  if (t === 'pdf') return <FileText className={`${className} text-red-500`} />
  if (['xls', 'xlsx', 'csv'].includes(t)) return <FileSpreadsheet className={`${className} text-green-500`} />
  return <File className={`${className} text-slate-500`} />
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
