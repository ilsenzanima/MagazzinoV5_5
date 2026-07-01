"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Loader2, Truck, Building2 } from "lucide-react"
import { deliveryNotesApi, purchasesApi } from "@/lib/api"
import { DeliveryNote, DeliveryNoteItem, Purchase } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { toast } from "sonner"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"

interface JobDdtProps {
  jobId: string
  jobName: string
}

type SupplierDoc = { purchase: Purchase; url: string; index: number }

export function JobDdt({ jobId, jobName }: JobDdtProps) {
  const [subTab, setSubTab] = useState<"opi" | "fornitori">("opi")
  const [loading, setLoading] = useState(true)
  const [opiNotes, setOpiNotes] = useState<DeliveryNote[]>([])
  const [supplierDocs, setSupplierDocs] = useState<SupplierDoc[]>([])
  const supabase = createClient()
  const [viewMode, setViewMode] = useViewMode('job-ddt', 'grid')

  useEffect(() => {
    if (jobId) load()
  }, [jobId])

  const load = async () => {
    try {
      setLoading(true)
      const [notes, purchases] = await Promise.all([
        deliveryNotesApi.getByJobId(jobId, "exit"),
        purchasesApi.getByJobId(jobId),
      ])
      setOpiNotes(notes)
      const docs: SupplierDoc[] = []
      purchases.filter(p => p.orderType !== 'order').forEach(p => {
        (p.documentUrls || []).forEach((url, index) => docs.push({ purchase: p, url, index }))
      })
      setSupplierDocs(docs)
    } catch (error) {
      console.error("Failed to load DDT", error)
      toast.error("Errore nel caricamento dei DDT")
    } finally {
      setLoading(false)
    }
  }

  const openOpiNote = async (note: DeliveryNote) => {
    const { generateDeliveryNotePdfBlob } = await import("@/lib/pdf/delivery-note-pdf")
    const grouped = new Map<string, DeliveryNoteItem>()
    ;(note.items || []).forEach(item => {
      const key = item.inventoryId
      if (grouped.has(key)) {
        const existing = grouped.get(key)!
        grouped.set(key, {
          ...existing,
          quantity: existing.quantity + item.quantity,
          kgEccedenza: existing.kgEccedenza != null || item.kgEccedenza != null
            ? (existing.kgEccedenza ?? 0) + (item.kgEccedenza ?? 0)
            : undefined,
        })
      } else {
        grouped.set(key, { ...item })
      }
    })
    const blob = await generateDeliveryNotePdfBlob(note, Array.from(grouped.values()))
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const openSupplierDoc = async (url: string) => {
    if (url && !url.includes('/')) {
      window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}`, '_blank')
      return
    }
    try {
      const path = url.split('/public/documents/')[1]
      if (!path) { window.open(url, '_blank'); return }
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
      if (error || !data?.signedUrl) { window.open(url, '_blank'); return }
      window.open(data.signedUrl, '_blank')
    } catch {
      window.open(url, '_blank')
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <Tabs value={subTab} onValueChange={v => setSubTab(v as "opi" | "fornitori")}>
          <TabsList>
            <TabsTrigger value="opi">
              DDT OPI
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{opiNotes.length}</span>
            </TabsTrigger>
            <TabsTrigger value="fornitori">
              DDT Fornitori
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{supplierDocs.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {((subTab === "opi" && opiNotes.length > 0) || (subTab === "fornitori" && supplierDocs.length > 0)) && (
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : subTab === "opi" ? (
        opiNotes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-slate-500">
              <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessun DDT OPI</h3>
              <p className="text-slate-500 dark:text-slate-400">Nessuna uscita di magazzino destinata a questa commessa.</p>
            </CardContent>
          </Card>
        ) : viewMode === 'list' ? (
          <div className="space-y-1.5">
            {opiNotes.map(note => (
              <div key={note.id} className="flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openOpiNote(note)}>
                <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded shrink-0">
                  <Truck className="h-5 w-5 text-blue-500" />
                </div>
                <p className="font-medium text-sm flex-1 min-w-0 truncate">DDT {note.number}</p>
                <p className="text-xs text-slate-400 shrink-0">{format(new Date(note.date), 'dd MMM yyyy', { locale: it })}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opiNotes.map(note => (
              <Card key={note.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openOpiNote(note)}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">
                    <Truck className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="flex-1 overflow-hidden min-w-0">
                    <p className="font-medium truncate text-sm">DDT {note.number}</p>
                    <p className="text-xs text-slate-400 mt-1">{format(new Date(note.date), 'dd MMM yyyy', { locale: it })}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : supplierDocs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-slate-500">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessun DDT fornitore</h3>
            <p className="text-slate-500 dark:text-slate-400">Nessun documento allegato agli acquisti di questa commessa.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="space-y-1.5">
          {supplierDocs.map((doc) => (
            <div key={`${doc.purchase.id}_${doc.index}`} className="flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
              <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded shrink-0">
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">
                  {doc.purchase.supplierName || "Fornitore"} - {doc.purchase.deliveryNoteNumber}
                </p>
                <p className="text-xs text-slate-500 truncate">Allegato {doc.index + 1}</p>
              </div>
              <p className="text-xs text-slate-400 shrink-0">{format(new Date(doc.purchase.deliveryNoteDate), 'dd MMM yyyy', { locale: it })}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplierDocs.map((doc) => (
            <Card key={`${doc.purchase.id}_${doc.index}`} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0">
                  <FileText className="h-8 w-8 text-red-500" />
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                  <p className="font-medium truncate text-sm">
                    {doc.purchase.supplierName || "Fornitore"} - {doc.purchase.deliveryNoteNumber}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">Allegato {doc.index + 1}</p>
                  <p className="text-xs text-slate-400 mt-1">{format(new Date(doc.purchase.deliveryNoteDate), 'dd MMM yyyy', { locale: it })}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
