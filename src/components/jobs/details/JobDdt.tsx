"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FileText, Loader2, Truck, Building2, ArrowRightLeft } from "lucide-react"
import { deliveryNotesApi, purchasesApi } from "@/lib/api"
import { DeliveryNote, DeliveryNoteItem, Purchase } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { toast } from "sonner"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { mapDbToPurchase } from "@/lib/services/purchases"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { AdvancedSearchTab } from "@/components/purchases/AdvancedSearchTab"

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
  const [associatedDocs, setAssociatedDocs] = useState<SupplierDoc[]>([])
  const [openAssociateModal, setOpenAssociateModal] = useState(false)
  const supabase = createClient()
  const [viewMode, setViewMode] = useViewMode('job-ddt', 'grid')

  useEffect(() => {
    if (jobId) load()
  }, [jobId])

  const load = async () => {
    try {
      setLoading(true)
      const [exitNotes, saleNotes, purchases] = await Promise.all([
        deliveryNotesApi.getByJobId(jobId, "exit"),
        deliveryNotesApi.getByJobId(jobId, "sale"),
        purchasesApi.getByJobId(jobId),
      ])
      const combinedNotes = [...exitNotes, ...saleNotes].sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        if (dateB !== dateA) return dateB - dateA
        return b.number.localeCompare(a.number)
      })
      setOpiNotes(combinedNotes)

      // Raccogli tutti i purchaseId legati ai materiali movimentati nelle bolle interne
      const purchaseIds = new Set<string>()
      combinedNotes.forEach(note => {
        (note.items || []).forEach(item => {
          if (item.purchaseId) {
            purchaseIds.add(item.purchaseId)
          }
        })
      })
      const associatedIds = Array.from(purchaseIds)

      // Carica gli acquisti associati alle movimentazioni che non sono direttamente legati a questa commessa
      let extraPurchases: Purchase[] = []
      const missingIds = associatedIds.filter(id => !purchases.some(p => p.id === id))
      if (missingIds.length > 0) {
        const { data: extraDb, error: extraError } = await supabase
          .from('purchases')
          .select('*, suppliers(name), purchase_items(price, quantity), profiles(full_name)')
          .in('id', missingIds)
          .is('deleted_at', null)
        if (!extraError && extraDb) {
          extraPurchases = extraDb.map(mapDbToPurchase)
        }
      }

      // Documenti caricati direttamente in cantiere (purchases linked directly to job)
      const docs: SupplierDoc[] = []
      purchases.filter(p => p.orderType !== 'order').forEach(p => {
        (p.documentUrls || []).forEach((url, index) => docs.push({ purchase: p, url, index }))
      })
      setSupplierDocs(docs)

      // Documenti dei DDT associati manualmente alle bolle interne
      const assocDocs: SupplierDoc[] = []
      const allAvailablePurchases = [...purchases, ...extraPurchases]
      allAvailablePurchases.filter(p => p.orderType !== 'order' && associatedIds.includes(p.id)).forEach(p => {
        (p.documentUrls || []).forEach((url, index) => assocDocs.push({ purchase: p, url, index }))
      })
      setAssociatedDocs(assocDocs)
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

  const handleAssociatePurchase = async (purchaseId: string): Promise<number> => {
    try {
      // 1. Carica gli articoli dell'acquisto selezionato
      const { data: purchaseItems, error: piError } = await supabase
        .from('purchase_items')
        .select('id, inventory_id')
        .eq('purchase_id', purchaseId)
      if (piError) throw piError
      if (!purchaseItems || purchaseItems.length === 0) {
        await load()
        return 0
      }

      // 2. Raccogli gli ID di tutte le bolle interne della commessa
      const noteIds = opiNotes.map(n => n.id)
      if (noteIds.length === 0) {
        await load()
        return 0
      }

      // 3. Carica tutte le righe delle bolle interne della commessa
      const { data: noteItems, error: niError } = await supabase
        .from('delivery_note_items')
        .select('id, inventory_id')
        .in('delivery_note_id', noteIds)
      if (niError) throw niError
      if (!noteItems || noteItems.length === 0) {
        await load()
        return 0
      }

      // 4. Esegui il matching e aggiorna i record delle bolle interne
      let updatedCount = 0
      const updates = noteItems.map(async (ni) => {
        const matchingPi = purchaseItems.find(pi => pi.inventory_id === ni.inventory_id)
        if (matchingPi) {
          const { error: updateError } = await supabase
            .from('delivery_note_items')
            .update({ purchase_item_id: matchingPi.id })
            .eq('id', ni.id)
          if (!updateError) {
            updatedCount++
          }
        }
      })
      await Promise.all(updates)

      // Ricarica i dati locali
      await load()

      return updatedCount
    } catch (error) {
      console.error("Failed to associate purchase", error)
      throw error
    }
  }

  const handleDisassociatePurchase = async (purchaseId: string): Promise<void> => {
    try {
      setLoading(true)
      // 1. Carica gli articoli dell'acquisto da disassociare
      const { data: purchaseItems, error: piError } = await supabase
        .from('purchase_items')
        .select('id')
        .eq('purchase_id', purchaseId)
      if (piError) throw piError
      if (!purchaseItems || purchaseItems.length === 0) {
        toast.error("Nessun articolo trovato per questo acquisto")
        return
      }

      const piIds = purchaseItems.map(pi => pi.id)

      // 2. Raccogli gli ID di tutte le bolle interne della commessa
      const noteIds = opiNotes.map(n => n.id)
      if (noteIds.length === 0) return

      // 3. Scollega gli articoli nelle bolle interne
      const { error: updateError } = await supabase
        .from('delivery_note_items')
        .update({ purchase_item_id: null })
        .in('delivery_note_id', noteIds)
        .in('purchase_item_id', piIds)
      if (updateError) throw updateError

      toast.success("DDT disassociato con successo")
      await load()
    } catch (error) {
      console.error("Errore durante la disassociazione", error)
      toast.error("Errore durante la disassociazione")
    } finally {
      setLoading(false)
    }
  }

  const renderDocsList = (docs: SupplierDoc[], isAssociatedTab = false) => {
    if (docs.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-slate-500">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
              {isAssociatedTab ? "Nessun DDT associato" : "Nessun DDT fornitore"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {isAssociatedTab 
                ? "Nessun DDT associato alle bolle interne." 
                : "Nessun documento allegato direttamente in cantiere."}
            </p>
          </CardContent>
        </Card>
      )
    }
    if (viewMode === 'list') {
      return (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={`${doc.purchase.id}_${doc.url}_${doc.index}`} className="flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow">
              <div className="bg-slate-50 dark:bg-slate-800 p-1 rounded shrink-0 cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
                <FileText className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
                <p className="font-medium truncate text-sm">
                  {doc.purchase.supplierName || "Fornitore"} - {doc.purchase.deliveryNoteNumber}
                </p>
                <p className="text-xs text-slate-500 truncate">Allegato {doc.index + 1}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-xs text-slate-400 mr-2">{doc.purchase.deliveryNoteDate ? format(new Date(doc.purchase.deliveryNoteDate), 'dd MMM yyyy', { locale: it }) : ''}</p>
                {isAssociatedTab && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDisassociatePurchase(doc.purchase.id)}
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Disassocia
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map((doc) => (
          <Card key={`${doc.purchase.id}_${doc.url}_${doc.index}`} className="hover:shadow-md transition-shadow relative">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded shrink-0 cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
                <FileText className="h-8 w-8 text-red-500" />
              </div>
              <div className="flex-1 overflow-hidden min-w-0 cursor-pointer" onClick={() => openSupplierDoc(doc.url)}>
                <p className="font-medium truncate text-sm">
                  {doc.purchase.supplierName || "Fornitore"} - {doc.purchase.deliveryNoteNumber}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">Allegato {doc.index + 1}</p>
                <p className="text-xs text-slate-400 mt-1">{doc.purchase.deliveryNoteDate ? format(new Date(doc.purchase.deliveryNoteDate), 'dd MMM yyyy', { locale: it }) : ''}</p>
              </div>
              {isAssociatedTab && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDisassociatePurchase(doc.purchase.id)}
                  className="absolute top-2 right-2 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Disassocia
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const associatedPurchaseIds = new Set<string>()
  opiNotes.forEach(note => {
    (note.items || []).forEach(item => {
      if (item.purchaseId) {
        associatedPurchaseIds.add(item.purchaseId)
      }
    })
  })

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
              <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{supplierDocs.length + associatedDocs.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {((subTab === "opi" && opiNotes.length > 0) || (subTab === "fornitori" && (supplierDocs.length > 0 || associatedDocs.length > 0))) && (
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
      ) : (
        <div className="space-y-4">
          <Tabs defaultValue="cantiere" className="w-full">
            <div className="flex justify-between items-center gap-2 flex-wrap mb-2">
              <TabsList>
                <TabsTrigger value="cantiere">
                  DDT presso cantiere
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{supplierDocs.length}</span>
                </TabsTrigger>
                <TabsTrigger value="associati">
                  DDT associati
                  <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">{associatedDocs.length}</span>
                </TabsTrigger>
              </TabsList>
              <Button onClick={() => setOpenAssociateModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5">
                <ArrowRightLeft className="h-4 w-4" />
                Associa DDT da Acquisti
              </Button>
            </div>
            <TabsContent value="cantiere" className="pt-2">
              {renderDocsList(supplierDocs, false)}
            </TabsContent>
            <TabsContent value="associati" className="pt-2">
              {renderDocsList(associatedDocs, true)}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Modal di Associazione Manuale DDT */}
      <Dialog open={openAssociateModal} onOpenChange={setOpenAssociateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Associa DDT da Acquisti a Bolle Interne</DialogTitle>
            <DialogDescription>
              Seleziona un fornitore per visualizzare i suoi DDT. Clicca su "Associa" per collegare i materiali del DDT selezionato a quelli movimentati nelle bolle interne della commessa.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AdvancedSearchTab
              isModal={true}
              onAssociate={handleAssociatePurchase}
              associatedPurchaseIds={associatedPurchaseIds}
              jobOpiNotes={opiNotes}
            />
          </div>

          <DialogFooter>
            <Button onClick={() => setOpenAssociateModal(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

