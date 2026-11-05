"use client"

import { useState, useEffect, useMemo } from "react"
import { NotchActions, NotchButton } from "@/components/ui/notch-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { SortArrow, InlineNote, TABLE_HEAD_CLS, TABLE_SELECT_CLS } from "@/components/ui/table-bits"
import { Loader2, Plus, Search, Package } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { purchasesApi, Purchase } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"

interface JobOrdiniProps {
    jobId: string
    jobCode?: string
}

const PAGE_SIZE = 50
type SortKey = "number" | "supplier" | "date" | "amount"

const articlesOf = (o: Purchase) =>
    (o.items ?? [])
        .filter(i => i.itemName)
        .map(i => (i.itemModel ? `${i.itemName} (${i.itemModel})` : i.itemName!))
        .filter((v, idx, arr) => arr.indexOf(v) === idx)

export function JobOrdini({ jobId }: JobOrdiniProps) {
    const { userRole } = useAuth()
    const router = useRouter()
    const [orders, setOrders] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [supplierFilter, setSupplierFilter] = useState("all")
    const [sortKey, setSortKey] = useState<SortKey>("date")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const [page, setPage] = useState(1)

    const canEdit = userRole === 'admin' || userRole === 'operativo'

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const all = await purchasesApi.getByJobId(jobId)
            setOrders(all.filter(p => p.orderType === 'order'))
        } catch (err) {
            console.error("Errore caricamento ordini", err)
            notify.error("Errore nel caricamento degli ordini")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveNote = async (order: Purchase, notes: string) => {
        if (notes === (order.notes ?? "")) return
        try {
            await purchasesApi.update(order.id, { notes })
            setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, notes } : o)))
        } catch {
            notify.error("Errore nel salvataggio della nota")
        }
    }

    const suppliers = useMemo(() => {
        const m = new Map<string, string>()
        orders.forEach(o => m.set(o.supplierId, o.supplierName || "Fornitore sconosciuto"))
        return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "it"))
    }, [orders])

    const sorted = useMemo(() => {
        const q = search.trim().toLowerCase()
        const list = orders.filter(o => {
            if (supplierFilter !== "all" && o.supplierId !== supplierFilter) return false
            if (!q) return true
            return `${o.deliveryNoteNumber} ${o.supplierName ?? ""} ${o.notes ?? ""} ${articlesOf(o).join(" ")}`.toLowerCase().includes(q)
        })
        const dir = sortDir === "asc" ? 1 : -1
        return [...list].sort((a, b) => {
            let r = 0
            if (sortKey === "number") r = a.deliveryNoteNumber.localeCompare(b.deliveryNoteNumber, "it", { numeric: true })
            else if (sortKey === "supplier") r = (a.supplierName || "").localeCompare(b.supplierName || "", "it")
            else if (sortKey === "amount") r = (a.totalAmount ?? 0) - (b.totalAmount ?? 0)
            else r = a.deliveryNoteDate.localeCompare(b.deliveryNoteDate)
            return r * dir
        })
    }, [orders, search, supplierFilter, sortKey, sortDir])

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
        else { setSortKey(key); setSortDir(key === "date" || key === "amount" ? "desc" : "asc") }
        setPage(1)
    }
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}<SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    )
    const supplierSelect = (cls?: string) => (
        <Select value={supplierFilter} onValueChange={v => { setSupplierFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per fornitore" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i fornitori</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
        </Select>
    )
    const dateOf = (o: Purchase) => format(new Date(o.deliveryNoteDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: it })
    const money = (n?: number) => (n === undefined ? "—" : `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, useGrouping: true })}`)
    const anyFilter = !!search.trim() || supplierFilter !== "all"

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Caricamento ordini...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {canEdit && (
                <NotchActions>
                    <Link href={`/purchases/new?type=order&jobId=${jobId}`}>
                        <NotchButton>
                            <Plus />Nuovo ordine
                        </NotchButton>
                    </Link>
                </NotchActions>
            )}

            {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Nessun ordine per questa commessa</p>
                    {canEdit && <p className="text-sm mt-1">Usa il bottone &quot;Nuovo Ordine&quot; per crearne uno</p>}
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Cerca per numero, fornitore, articolo o nota" className="pl-8" />
                        </div>
                        {anyFilter && (
                            <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={() => { setSearch(""); setSupplierFilter("all"); setPage(1) }}>Azzera filtri</Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:hidden">{supplierSelect()}</div>

                    {/* Tabella (PC) */}
                    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={`w-36 ${TABLE_HEAD_CLS}`}>{sortBtn("number", "Ordine")}</TableHead>
                                    <TableHead className={`w-52 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{supplierSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per fornitore" onClick={() => toggleSort("supplier")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                                <SortArrow active={sortKey === "supplier"} dir={sortDir} />
                                            </button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-28 ${TABLE_HEAD_CLS}`}>{sortBtn("date", "Data")}</TableHead>
                                    <TableHead className={TABLE_HEAD_CLS}>Articoli</TableHead>
                                    {canEdit && <TableHead className={`w-32 text-right ${TABLE_HEAD_CLS}`}><span className="inline-flex justify-end">{sortBtn("amount", "Importo")}</span></TableHead>}
                                    <TableHead className={`w-[20%] ${TABLE_HEAD_CLS}`}>Nota</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={canEdit ? 6 : 5} className="py-10 text-center text-slate-400">Nessun ordine con questi filtri</TableCell>
                                    </TableRow>
                                ) : rows.map(o => {
                                    const arts = articlesOf(o)
                                    return (
                                        <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/purchases/${o.id}`)}>
                                            <TableCell className="border-r py-2 text-sm font-semibold">
                                                <span className="block truncate" title={o.deliveryNoteNumber}>{o.deliveryNoteNumber}</span>
                                                {o.convertedPurchaseNumber && <span className="block truncate text-[11px] font-normal text-emerald-600" title={`Convertito nel DDT ${o.convertedPurchaseNumber}`}>→ DDT {o.convertedPurchaseNumber}</span>}
                                            </TableCell>
                                            <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300"><span className="line-clamp-2" title={o.supplierName}>{o.supplierName || 'Fornitore sconosciuto'}</span></TableCell>
                                            <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{dateOf(o)}</TableCell>
                                            <TableCell className="border-r py-2 text-xs text-slate-600 dark:text-slate-300">
                                                <span className="line-clamp-2" title={arts.join(", ")}>{arts.length > 0 ? arts.join(", ") : <span className="text-slate-300">—</span>}</span>
                                            </TableCell>
                                            {canEdit && <TableCell className="whitespace-nowrap border-r py-2 text-right text-sm font-semibold">{money(o.totalAmount)}</TableCell>}
                                            <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                                <InlineNote value={o.notes ?? ""} disabled={!canEdit} onSave={v => handleSaveNote(o, v)} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Elenco compatto (telefono) */}
                    <div className="space-y-2 md:hidden">
                        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun ordine con questi filtri</p>}
                        {rows.map(o => (
                            <div key={o.id} className="rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => router.push(`/purchases/${o.id}`)}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">Ordine {o.deliveryNoteNumber}</p>
                                        <p className="truncate text-xs text-slate-500">{o.supplierName || 'Fornitore sconosciuto'} · {dateOf(o)}</p>
                                    </div>
                                    {canEdit && <span className="shrink-0 text-sm font-semibold">{money(o.totalAmount)}</span>}
                                </div>
                                {articlesOf(o).length > 0 && <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{articlesOf(o).join(", ")}</p>}
                                <div className="mt-1" onClick={e => e.stopPropagation()}>
                                    <InlineNote value={o.notes ?? ""} disabled={!canEdit} onSave={v => handleSaveNote(o, v)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={sorted.length} itemLabel="ordini" />
                </>
            )}
        </div>
    )
}
