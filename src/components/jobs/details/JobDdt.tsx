"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Loader2, Truck, Building2, ArrowRightLeft, Search } from "lucide-react"
import { deliveryNotesApi, purchasesApi } from "@/lib/api"
import { DeliveryNote, DeliveryNoteItem, Purchase } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { NotchSearch } from "@/components/ui/notch-tabs"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { SortArrow, TABLE_HEAD_CLS, TABLE_SELECT_CLS } from "@/components/ui/table-bits"
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

const DDT_PAGE_SIZE = 50
const NOTE_TYPE_LABEL: Record<string, string> = { exit: "Uscita", sale: "Vendita" }
// Materiali di una bolla interna: dalle righe, senza doppioni
const materialsOf = (n: DeliveryNote): string[] =>
  n.itemNames?.length ? n.itemNames : Array.from(new Set((n.items ?? []).map(i => i.inventoryName).filter((v): v is string => !!v)))
const fmtDate = (d?: string) => (d ? format(new Date(d), 'dd/MM/yyyy', { locale: it }) : '')

function useTableControls<K extends string>(initialKey: K, initialDir: "asc" | "desc") {
  const [sortKey, setSortKey] = useState<K>(initialKey)
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir)
  const [page, setPage] = useState(1)
  const toggle = (key: K, defaultDir: "asc" | "desc" = "asc") => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir(defaultDir) }
    setPage(1)
  }
  return { sortKey, sortDir, page, setPage, toggle }
}

type DdtOrigin = "opi" | "cantiere" | "associato"
const ORIGIN_LABEL: Record<DdtOrigin, string> = { opi: "DDT OPI", cantiere: "Fornitore · in cantiere", associato: "Fornitore · associato" }
interface DdtRow {
  id: string
  origin: DdtOrigin
  title: string
  supplier: string
  date: string
  materials: string
  subtitle: string
  note?: DeliveryNote
  doc?: SupplierDoc
}

// Un'unica tabella per tutti i DDT della commessa: bolle interne (OPI), DDT fornitori in cantiere e associati.
// L'origine si sceglie con il filtro in testa alla colonna.
function DdtTable({ rows: allRows, onOpenNote, onOpenUrl, onDisassociate }: {
  rows: DdtRow[]
  onOpenNote: (n: DeliveryNote) => void
  onOpenUrl: (url: string) => void
  onDisassociate: (purchaseId: string) => void
}) {
  type K = "title" | "origin" | "supplier" | "date"
  const [search, setSearch] = useState("")
  const [originFilter, setOriginFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const { sortKey, sortDir, page, setPage, toggle } = useTableControls<K>("date", "desc")

  const suppliers = Array.from(new Set(allRows.map(r => r.supplier).filter(Boolean))).sort((x, y) => x.localeCompare(y, "it"))
  const sorted = (() => {
    const q = search.trim().toLowerCase()
    const list = allRows.filter(r => {
      if (originFilter !== "all" && r.origin !== originFilter) return false
      if (supplierFilter !== "all" && r.supplier !== supplierFilter) return false
      return !q || `${r.title} ${r.supplier} ${r.subtitle} ${r.materials}`.toLowerCase().includes(q)
    })
    const dir = sortDir === "asc" ? 1 : -1
    return [...list].sort((x, y) => {
      let r = 0
      if (sortKey === "title") r = x.title.localeCompare(y.title, "it", { numeric: true })
      else if (sortKey === "origin") r = ORIGIN_LABEL[x.origin].localeCompare(ORIGIN_LABEL[y.origin], "it") || x.title.localeCompare(y.title, "it", { numeric: true })
      else if (sortKey === "supplier") r = (x.supplier || "~").localeCompare(y.supplier || "~", "it")
      else r = (x.date || "").localeCompare(y.date || "")
      return r * dir
    })
  })()
  const totalPages = Math.max(1, Math.ceil(sorted.length / DDT_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const rows = sorted.slice((currentPage - 1) * DDT_PAGE_SIZE, currentPage * DDT_PAGE_SIZE)
  const anyFilter = !!search.trim() || originFilter !== "all" || supplierFilter !== "all"
  const open = (r: DdtRow) => (r.note ? onOpenNote(r.note) : r.doc ? onOpenUrl(r.doc.url) : undefined)
  const icon = (r: DdtRow, cls: string) => (r.origin === "opi" ? <Truck className={`${cls} text-blue-500`} /> : <FileText className={`${cls} text-red-500`} />)

  const sortBtn = (key: K, label: string, d: "asc" | "desc" = "asc") => (
    <button type="button" onClick={() => toggle(key, d)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
      {label}<SortArrow active={sortKey === key} dir={sortDir} />
    </button>
  )
  const originSelect = (cls?: string) => (
    <Select value={originFilter} onValueChange={v => { setOriginFilter(v); setPage(1) }}>
      <SelectTrigger aria-label="Filtra per origine" className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutte le origini</SelectItem>
        {(Object.keys(ORIGIN_LABEL) as DdtOrigin[]).map(o => <SelectItem key={o} value={o}>{ORIGIN_LABEL[o]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const supplierSelect = (cls?: string) => (
    <Select value={supplierFilter} onValueChange={v => { setSupplierFilter(v); setPage(1) }}>
      <SelectTrigger aria-label="Filtra per fornitore" className={cls}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti i fornitori</SelectItem>
        {suppliers.map(sp => <SelectItem key={sp} value={sp}>{sp}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <NotchSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cerca per numero, fornitore o materiale" />
        {anyFilter && (
          <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={() => { setSearch(""); setOriginFilter("all"); setSupplierFilter("all"); setPage(1) }}>Azzera filtri</Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:hidden">{originSelect()}{supplierSelect()}</div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
              <TableHead className={`w-52 ${TABLE_HEAD_CLS}`}>{sortBtn("title", "DDT")}</TableHead>
              <TableHead className={`w-52 ${TABLE_HEAD_CLS}`}>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">{originSelect(TABLE_SELECT_CLS)}</div>
                  <button type="button" aria-label="Ordina per origine" onClick={() => toggle("origin")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "origin"} dir={sortDir} /></button>
                </div>
              </TableHead>
              <TableHead className={`w-48 ${TABLE_HEAD_CLS}`}>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">{supplierSelect(TABLE_SELECT_CLS)}</div>
                  <button type="button" aria-label="Ordina per fornitore" onClick={() => toggle("supplier")} className="shrink-0 text-slate-500 hover:text-slate-900"><SortArrow active={sortKey === "supplier"} dir={sortDir} /></button>
                </div>
              </TableHead>
              <TableHead className={`w-28 ${TABLE_HEAD_CLS}`}>{sortBtn("date", "Data", "desc")}</TableHead>
              <TableHead className={TABLE_HEAD_CLS}>Materiali</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-slate-400">Nessun DDT con questi filtri</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r)}>
                <TableCell className="border-r py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {icon(r, "h-4 w-4 shrink-0")}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" title={r.title}>{r.title}</p>
                      {r.subtitle && <p className="truncate text-xs text-slate-500" title={r.subtitle}>{r.subtitle}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300">{ORIGIN_LABEL[r.origin]}</TableCell>
                <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={r.supplier}>{r.supplier || <span className="text-slate-300">—</span>}</TableCell>
                <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{fmtDate(r.date) || <span className="text-slate-300">—</span>}</TableCell>
                <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="line-clamp-2" title={r.materials}>{r.materials || <span className="text-slate-300">—</span>}</span>
                </TableCell>
                <TableCell className="py-2 text-right" onClick={e => e.stopPropagation()}>
                  {r.origin === "associato" && r.doc && (
                    <Button variant="ghost" size="sm" onClick={() => onDisassociate(r.doc!.purchase.id)} className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30">Disassocia</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun DDT con questi filtri</p>}
        {rows.map(r => (
          <div key={r.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => open(r)}>
            <span className="mt-0.5 shrink-0">{icon(r, "h-5 w-5")}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-slate-500">{ORIGIN_LABEL[r.origin]}{r.supplier && ` · ${r.supplier}`}{r.date && ` · ${fmtDate(r.date)}`}</p>
              {r.materials && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{r.materials}</p>}
            </div>
            {r.origin === "associato" && r.doc && (
              <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onDisassociate(r.doc!.purchase.id) }} className="h-7 shrink-0 text-xs text-red-600 hover:bg-red-50 hover:text-red-700">Disassocia</Button>
            )}
          </div>
        ))}
      </div>

      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={sorted.length} itemLabel="DDT" />
    </div>
  )
}

export function JobDdt({ jobId, jobName }: JobDdtProps) {
  const [loading, setLoading] = useState(true)
  const [opiNotes, setOpiNotes] = useState<DeliveryNote[]>([])
  const [supplierDocs, setSupplierDocs] = useState<SupplierDoc[]>([])
  const [associatedDocs, setAssociatedDocs] = useState<SupplierDoc[]>([])
  const [sitePurchases, setSitePurchases] = useState<Purchase[]>([])
  const [openAssociateModal, setOpenAssociateModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (jobId) load()
  }, [jobId])

  const load = async () => {
    try {
      setLoading(true)
      // Carica bolle interne, acquisti diretti del cantiere, e acquisti associati manualmente tramite il tag notes
      const [exitNotes, saleNotes, directPurchases, manuallyAssociatedDb] = await Promise.all([
        deliveryNotesApi.getByJobId(jobId, "exit"),
        deliveryNotesApi.getByJobId(jobId, "sale"),
        purchasesApi.getByJobId(jobId),
        supabase
          .from('purchases')
          .select('*, suppliers(name), purchase_items(price, quantity, inventory(name, model)), profiles(full_name)')
          .like('notes', `%[associated_job:${jobId}]%`)
          .is('deleted_at', null)
      ])

      const combinedNotes = [...exitNotes, ...saleNotes].sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        if (dateB !== dateA) return dateB - dateA
        return b.number.localeCompare(a.number)
      })
      setOpiNotes(combinedNotes)

      // DDT presso cantiere: acquisti legati direttamente alla commessa che NON contengono il tag di associazione manuale
      const cantierePurchases = directPurchases.filter(p => !p.notes?.includes(`[associated_job:${jobId}]`)).filter(p => p.orderType !== 'order')
      const docs: SupplierDoc[] = []
      cantierePurchases.forEach(p => {
        (p.documentUrls || []).forEach((url, index) => docs.push({ purchase: p, url, index }))
      })
      setSupplierDocs(docs)
      setSitePurchases(cantierePurchases)

      // DDT associati: acquisti associati manualmente
      const manuallyAssociatedPurchases = (manuallyAssociatedDb.data || []).map((p: any) => ({
        ...mapDbToPurchase(p),
        items: (p.purchase_items ?? []).map((i: any) => ({
          price: i.price,
          quantity: i.quantity,
          itemName: i.inventory?.name,
          itemModel: i.inventory?.model,
        }))
      }))

      const assocDocs: SupplierDoc[] = []
      manuallyAssociatedPurchases.filter(p => p.orderType !== 'order').forEach(p => {
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
      // 1. Carica l'acquisto per leggerne le note attuali
      const { data: purchaseData, error: pLoadError } = await supabase
        .from('purchases')
        .select('notes')
        .eq('id', purchaseId)
        .single()
      if (pLoadError) throw pLoadError

      // 2. Aggiorna le note inserendo il tag di associazione
      const currentNotes = purchaseData.notes || ""
      const assocTag = `[associated_job:${jobId}]`
      if (!currentNotes.includes(assocTag)) {
        const newNotes = currentNotes ? `${currentNotes} ${assocTag}` : assocTag
        const { error: pUpdateError } = await supabase
          .from('purchases')
          .update({ notes: newNotes })
          .eq('id', purchaseId)
        if (pUpdateError) throw pUpdateError
      }

      // 3. Carica gli articoli dell'acquisto selezionato
      const { data: purchaseItems, error: piError } = await supabase
        .from('purchase_items')
        .select('id, item_id')
        .eq('purchase_id', purchaseId)
      if (piError) throw piError
      if (!purchaseItems || purchaseItems.length === 0) {
        await load()
        return 0
      }

      // 4. Raccogli gli ID di tutte le bolle interne della commessa
      const noteIds = opiNotes.map(n => n.id)
      if (noteIds.length === 0) {
        await load()
        return 0
      }

      // 5. Carica tutte le righe delle bolle interne della commessa
      const { data: noteItems, error: niError } = await supabase
        .from('delivery_note_items')
        .select('id, inventory_id')
        .in('delivery_note_id', noteIds)
      if (niError) throw niError
      if (!noteItems || noteItems.length === 0) {
        await load()
        return 0
      }

      // 6. Esegui il matching e aggiorna i record delle bolle interne
      let updatedCount = 0
      const updates = noteItems.map(async (ni) => {
        const matchingPi = purchaseItems.find(pi => pi.item_id === ni.inventory_id)
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

      // 1. Rimuovi il tag [associated_job:jobId] dalle note dell'acquisto
      const { data: purchaseData, error: pLoadError } = await supabase
        .from('purchases')
        .select('notes')
        .eq('id', purchaseId)
        .single()
      if (pLoadError) throw pLoadError

      const currentNotes = purchaseData.notes || ""
      const assocTag = `[associated_job:${jobId}]`
      if (currentNotes.includes(assocTag)) {
        const newNotes = currentNotes
          .replace(assocTag, "")
          .replace(/\s+/g, ' ')
          .trim()
        const { error: pUpdateError } = await supabase
          .from('purchases')
          .update({ notes: newNotes })
          .eq('id', purchaseId)
        if (pUpdateError) throw pUpdateError
      }

      // 2. Carica gli articoli dell'acquisto da disassociare
      const { data: purchaseItems, error: piError } = await supabase
        .from('purchase_items')
        .select('id')
        .eq('purchase_id', purchaseId)
      if (piError) throw piError

      if (purchaseItems && purchaseItems.length > 0) {
        const piIds = purchaseItems.map(pi => pi.id)

        // 3. Raccogli gli ID di tutte le bolle interne della commessa
        const noteIds = opiNotes.map(n => n.id)
        if (noteIds.length > 0) {
          // Scollega gli articoli nelle bolle interne
          const { error: updateError } = await supabase
            .from('delivery_note_items')
            .update({ purchase_item_id: null })
            .in('delivery_note_id', noteIds)
            .in('purchase_item_id', piIds)
          if (updateError) throw updateError
        }
      }

      toast.success("DDT disassociato con successo")
      await load()
    } catch (error) {
      console.error("Errore durante la disassociazione", error)
      toast.error("Errore durante la disassociazione")
    } finally {
      setLoading(false)
    }
  }

  const getMatchedMaterialsLabel = (purchase: Purchase, index: number) => {
    // 1. Raccogli tutti i nomi unici dei materiali nelle bolle interne (OPI) della commessa
    const opiMaterialNames = new Set<string>()
    opiNotes.forEach(note => {
      (note.items || []).forEach(item => {
        const name = item.inventoryName
        if (name) opiMaterialNames.add(name.toLowerCase().trim())
      })
    })

    // 2. Trova gli articoli dell'acquisto che hanno un nome presente in opiMaterialNames
    const matchedNames: string[] = []
    ;(purchase.items || []).forEach(item => {
      if (item.itemName) {
        const nameClean = item.itemName.toLowerCase().trim()
        if (opiMaterialNames.has(nameClean)) {
          const fullName = item.itemModel 
            ? `${item.itemName} (${item.itemModel})`
            : item.itemName
          if (!matchedNames.includes(fullName)) {
            matchedNames.push(fullName)
          }
        }
      }
    })

    // 3. Se non c'è corrispondenza o non ci sono articoli nell'acquisto, mostra "Allegato X"
    if (matchedNames.length === 0) {
      return `Allegato ${index + 1}`
    }
    return matchedNames.join(', ')
  }

  const associatedPurchaseIds = new Set<string>(
    associatedDocs.map(doc => doc.purchase.id)
  )

  const ddtRows: DdtRow[] = [
    ...opiNotes.map((n): DdtRow => ({
      id: `opi_${n.id}`,
      origin: "opi",
      title: `DDT ${n.number}`,
      supplier: "",
      date: n.date,
      materials: materialsOf(n).join(", "),
      subtitle: [NOTE_TYPE_LABEL[n.type] ?? n.type, n.causal].filter(Boolean).join(" · "),
      note: n,
    })),
    ...supplierDocs.map((d): DdtRow => ({
      id: `sup_${d.purchase.id}_${d.url}_${d.index}`,
      origin: "cantiere",
      title: `DDT ${d.purchase.deliveryNoteNumber}`,
      supplier: d.purchase.supplierName || "Fornitore",
      date: d.purchase.deliveryNoteDate || "",
      materials: getMatchedMaterialsLabel(d.purchase, d.index),
      subtitle: "",
      doc: d,
    })),
    ...associatedDocs.map((d): DdtRow => ({
      id: `ass_${d.purchase.id}_${d.url}_${d.index}`,
      origin: "associato",
      title: `DDT ${d.purchase.deliveryNoteNumber}`,
      supplier: d.purchase.supplierName || "Fornitore",
      date: d.purchase.deliveryNoteDate || "",
      materials: getMatchedMaterialsLabel(d.purchase, d.index),
      subtitle: "",
      doc: d,
    })),
  ]

  return (
    <div className="space-y-4">
      <FloatingAddButton onClick={() => setOpenAssociateModal(true)} label="Associa DDT" icon={<ArrowRightLeft className="h-6 w-6" />} showOnMobile />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : ddtRows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-slate-500">
            <Truck className="mx-auto mb-2 h-12 w-12 opacity-20" />
            <h3 className="mb-1 text-lg font-medium text-slate-900 dark:text-white">Nessun DDT</h3>
            <p className="text-slate-500 dark:text-slate-400">Nessuna bolla interna, DDT fornitore in cantiere o DDT associato per questa commessa.</p>
          </CardContent>
        </Card>
      ) : (
        <DdtTable rows={ddtRows} onOpenNote={openOpiNote} onOpenUrl={openSupplierDoc} onDisassociate={handleDisassociatePurchase} />
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
              sitePurchases={sitePurchases}
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

