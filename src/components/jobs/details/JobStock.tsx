"use client"

import { Fragment, useState, useMemo, useEffect, useCallback } from "react"
import { Movement } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, ArrowRight, AlertTriangle, ArrowUpRight, ArrowDownLeft, History, Search, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { fictitiousPricesApi } from "@/lib/services/fictitiousPrices"
import { notify } from "@/lib/notify"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { itemTypesApi } from "@/lib/services/inventory"
import { loadJobPriceMap } from "@/lib/services/job-price-lookup"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { NotchTabs, NotchActions, NotchSearch, NotchStat } from "@/components/ui/notch-tabs"

// Rounds to 2 decimals to avoid floating-point noise (e.g. 30.950000000000003)
// when accumulating quantities/pieces from many movements in JS.
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface JobStockProps {
    movements: Movement[]
    jobId: string
}

export function JobStock({ movements, jobId }: JobStockProps) {
    const { userRole } = useAuth()
    const [searchTerm, setSearchTerm] = useState("")
    const [tab, setTab] = useState("stock")
    const [officialPrices, setOfficialPrices] = useState<Map<string, number>>(new Map())
    const [itemMeta, setItemMeta] = useState<Map<string, { image?: string; type?: string }>>(new Map())
    const [typeImages, setTypeImages] = useState<Map<string, string>>(new Map())
    const [sortKey, setSortKey] = useState<'name' | 'model' | 'batches' | 'qty' | 'value'>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [priceFilter, setPriceFilter] = useState<'all' | 'missing'>('all')
    const toggleSort = (k: typeof sortKey) => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir('asc') }
    }
    const [expandedItemCode, setExpandedItemCode] = useState<string | null>(null)
    const [fictitiousPrices, setFictitiousPrices] = useState<Record<string, number>>({})
    const [loadingPrices, setLoadingPrices] = useState(true)

    // Toggle expanded item - only one at a time
    const toggleExpanded = (code: string) => {
        setExpandedItemCode(prev => prev === code ? null : code)
    }

    // Load saved fictitious prices
    useEffect(() => {
        const loadPrices = async () => {
            try {
                const prices = await fictitiousPricesApi.getByJob(jobId)
                setFictitiousPrices(prices)
            } catch (error) {
                console.error('Error loading fictitious prices:', error)
                notify.error("Errore nel caricamento dei prezzi fittizi")
            } finally {
                setLoadingPrices(false)
            }
        }
        loadPrices()
    }, [jobId])

    // Prezzi di commessa, gli stessi usati in Economico > Costi (prezzo impostato in Analisi costi,
    // altrimenti prezzo massimo d'acquisto, altrimenti prezzo dell'offerta): solo admin e operativo
    const priceIdsKey = useMemo(() => Array.from(new Set(movements.map(m => m.itemId).filter(Boolean))).sort().join(','), [movements])
    useEffect(() => {
        if (userRole !== 'admin' && userRole !== 'operativo') return
        loadJobPriceMap(jobId, priceIdsKey ? priceIdsKey.split(',') : [])
            .then(setOfficialPrices)
            .catch(() => { /* non bloccante: si usa il prezzo del lotto */ })
    }, [jobId, userRole, priceIdsKey])

    // Foto e tipologia degli articoli
    useEffect(() => {
        const ids = Array.from(new Set(movements.map(m => m.itemId).filter(Boolean)))
        if (ids.length === 0) return
        supabase.from('inventory').select('id, image_url, category').in('id', ids).then(({ data }) => {
            const m = new Map<string, { image?: string; type?: string }>()
            ;(data || []).forEach((r: any) => m.set(r.id, { image: r.image_url || undefined, type: r.category || undefined }))
            setItemMeta(m)
        })
        itemTypesApi.getAll().then(ts => setTypeImages(new Map(ts.filter(t => t.imageUrl).map(t => [t.name, t.imageUrl as string])))).catch(() => { })
    }, [movements])

    // Debounced save function
    const savePriceDebounced = useCallback(
        (() => {
            let timeoutId: NodeJS.Timeout
            return (itemId: string, price: number) => {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(async () => {
                    try {
                        await fictitiousPricesApi.setPrice(jobId, itemId, price)
                    } catch (error) {
                        console.error('Error saving fictitious price:', error)
                        notify.error("Errore nel salvataggio del prezzo fittizio")
                    }
                }, 1000) // Save after 1 second of inactivity
            }
        })(),
        [jobId]
    )

    const handlePriceChange = (itemId: string, value: string) => {
        const price = parseFloat(value) || 0
        setFictitiousPrices(prev => ({ ...prev, [itemId]: price }))
        savePriceDebounced(itemId, price)
    }

    if (!movements) return null;

    // 1. Find Last Purchase Price per Item Code - Memoized
    // We use this for fictitious items: value of the last purchase made for that item
    const lastPurchasePriceMap = useMemo(() => {
        const map = new Map<string, number>()
        // movements are sorted by date desc, so the first purchase we find is the last one
        for (const m of movements) {
            if (m.itemCode && m.type === 'purchase' && m.itemPrice && m.itemPrice > 0) {
                if (!map.has(m.itemCode)) {
                    map.set(m.itemCode, m.itemPrice)
                }
            }
        }
        return map
    }, [movements])

    // Batch type for individual lots
    interface Batch {
        sourceKey: string
        qty: number
        pieces: number
        price: number
        referenceMap: Map<string, { noteId: string, isReturn: boolean }>
        purchaseId?: string
        purchaseNumber?: string
        purchaseDate?: string
        supplierName?: string
    }

    // Grouped item type
    interface GroupedItem {
        itemId: string
        name: string
        model?: string
        code: string
        unit: string
        isFictitious: boolean
        totalQty: number
        totalPieces: number
        totalValue: number
        hasMissingPrice: boolean
        batches: Batch[]
    }

    // Calculate Current Stock at Site - Grouped by Item Code
    const groupedStock = useMemo(() => {
        const map = new Map<string, GroupedItem>()

        movements.forEach(m => {
            const isSiteIn = ['purchase', 'unload', 'exit', 'sale'].includes(m.type)
            const qtyChange = isSiteIn ? Math.abs(m.quantity) : -Math.abs(m.quantity)

            let piecesChange = 0
            if (m.pieces !== undefined && m.pieces !== null) {
                piecesChange = isSiteIn ? Math.abs(m.pieces) : -Math.abs(m.pieces)
            } else if (m.coefficient && m.coefficient !== 0) {
                const p = m.quantity / m.coefficient
                piecesChange = isSiteIn ? Math.abs(p) : -Math.abs(p)
            }

            const sourceKey = m.purchaseId || m.reference || 'unknown'
            const groupKey = `${m.itemCode}-${!!m.isFictitious}`

            if (!m.itemCode) return

            const price = m.itemPrice || 0

            const current = map.get(groupKey)

            if (current) {
                // Find or create batch
                let batch = current.batches.find(b => b.sourceKey === sourceKey)
                if (batch) {
                    batch.qty = round2(batch.qty + qtyChange)
                    batch.pieces = round2(batch.pieces + piecesChange)
                    if (m.reference && m.deliveryNoteId) {
                        batch.referenceMap.set(m.reference, { noteId: m.deliveryNoteId, isReturn: !isSiteIn })
                    }
                } else {
                    const referenceMap = new Map<string, { noteId: string, isReturn: boolean }>()
                    if (m.reference && m.deliveryNoteId) {
                        referenceMap.set(m.reference, { noteId: m.deliveryNoteId, isReturn: !isSiteIn })
                    }
                    current.batches.push({
                        sourceKey,
                        qty: qtyChange,
                        pieces: piecesChange,
                        price,
                        referenceMap,
                        purchaseId: m.purchaseId,
                        purchaseNumber: m.purchaseNumber,
                        purchaseDate: m.purchaseDate,
                        supplierName: m.supplierName
                    })
                }
            } else {
                const referenceMap = new Map<string, { noteId: string, isReturn: boolean }>()
                if (m.reference && m.deliveryNoteId) {
                    referenceMap.set(m.reference, { noteId: m.deliveryNoteId, isReturn: !isSiteIn })
                }

                map.set(groupKey, {
                    itemId: m.itemId || '',
                    name: m.itemName || 'Sconosciuto',
                    model: m.itemModel,
                    code: m.itemCode,
                    unit: m.itemUnit || 'PZ',
                    isFictitious: !!m.isFictitious,
                    totalQty: 0,
                    totalPieces: 0,
                    totalValue: 0,
                    hasMissingPrice: false,
                    batches: [{
                        sourceKey,
                        qty: qtyChange,
                        pieces: piecesChange,
                        price,
                        referenceMap,
                        purchaseId: m.purchaseId,
                        purchaseNumber: m.purchaseNumber,
                        purchaseDate: m.purchaseDate,
                        supplierName: m.supplierName
                    }]
                })
            }
        })

        // Calculate totals and filter out empty batches
        map.forEach((item, key) => {
            item.batches = item.batches.filter(b => Math.abs(b.qty) > 0.001)
            item.totalQty = round2(item.batches.reduce((sum, b) => sum + b.qty, 0))
            item.totalPieces = round2(item.batches.reduce((sum, b) => sum + b.pieces, 0))
            item.totalValue = round2(item.batches.reduce((sum, b) => sum + (b.qty * b.price), 0))
            // Check if any batch has missing price (price === 0)
            item.hasMissingPrice = item.batches.some(b => b.price === 0)

            // Remove items with no remaining stock
            if (Math.abs(item.totalQty) <= 0.001) {
                map.delete(key)
            }
        })

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
    }, [movements])

    // Filter by search term - split into words for fuzzy matching
    const filteredStock = useMemo(() => {
        if (!searchTerm.trim()) return groupedStock
        const words = searchTerm.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0)
        if (words.length === 0) return groupedStock

        return groupedStock.filter(item => {
            const searchTarget = `${item.name} ${item.code} ${item.model || ''}`.toLowerCase()
            // All words must match somewhere in the target
            return words.every(word => searchTarget.includes(word))
        })
    }, [groupedStock, searchTerm])

    // Valore di un articolo: prezzo di commessa (come in Economico > Costi) x quantita' in cantiere (per i fittizi senza prezzo vale quello inserito a mano)
    const itemValue = (item: GroupedItem): number | null => {
        const p = officialPrices.get(item.itemId)
        if (p !== undefined) return round2(item.totalQty * p)
        if (item.isFictitious) return round2(item.totalQty * (fictitiousPrices[item.itemId] ?? 0))
        // come in Economico > Costi: senza prezzo di commessa resta il prezzo del lotto
        return item.totalValue > 0 ? item.totalValue : null
    }
    const totalValue = useMemo(() => round2(groupedStock.reduce((sum, i) => sum + (itemValue(i) ?? 0), 0)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [groupedStock, fictitiousPrices, officialPrices])

    // Ordinamento e filtro prezzo
    const rows = useMemo(() => {
        let r = filteredStock
        if (priceFilter === 'missing') r = r.filter(i => itemValue(i) === null)
        const dir = sortDir === 'asc' ? 1 : -1
        return [...r].sort((a, b) => {
            switch (sortKey) {
                case 'model': return dir * (a.model || '').localeCompare(b.model || '', 'it', { numeric: true })
                case 'batches': return dir * (a.batches.length - b.batches.length)
                case 'qty': return dir * (a.totalQty - b.totalQty)
                case 'value': return dir * ((itemValue(a) ?? -1) - (itemValue(b) ?? -1))
                default: return dir * a.name.localeCompare(b.name, 'it', { numeric: true })
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredStock, sortKey, sortDir, priceFilter, officialPrices, fictitiousPrices])

    const sortIcon = (k: typeof sortKey) => sortKey === k
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
    const sortHead = (k: typeof sortKey, label: string, cls = '') => (
        <TableHead className={`border-r text-xs font-semibold uppercase tracking-wide text-slate-600 ${cls}`}>
            <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 ${cls.includes('text-right') ? 'flex-row-reverse' : ''}`}>
                {label}{sortIcon(k)}
            </button>
        </TableHead>
    )
    const thumb = (item: GroupedItem) => {
        const meta = itemMeta.get(item.itemId)
        return <StockThumb name={item.name} image={meta?.image} typeImage={meta?.type ? typeImages.get(meta.type) : undefined} />
    }
    const valueCell = (item: GroupedItem) => {
        if (userRole === 'user') return <span className="text-xs italic text-slate-400">Riservato</span>
        const v = itemValue(item)
        if (officialPrices.get(item.itemId) === undefined && item.isFictitious) {
            return (
                <div className="flex items-center justify-end gap-1">
                    <span className="text-xs">€</span>
                    <Input
                        type="number" min="0" step="0.00001" className="h-7 w-20 text-right text-sm"
                        value={fictitiousPrices[item.itemId] ?? 0}
                        onChange={(e) => handlePriceChange(item.itemId, e.target.value)}
                        placeholder="0.00" disabled={loadingPrices}
                    />
                </div>
            )
        }
        return v === null
            ? <span className="text-slate-400" title="Prezzo non definito nell'Analisi costi della commessa">—</span>
            : <span className="font-medium">€ {v.toLocaleString('it-IT', { minimumFractionDigits: 2, useGrouping: true })}</span>
    }


    // Count unique items (for display)
    const realItemsCount = groupedStock.filter(i => !i.isFictitious).length
    const fictItemsCount = groupedStock.filter(i => i.isFictitious).length

    const canSeeValue = userRole === 'admin' || userRole === 'operativo'
    return (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
            <NotchTabs
                title="Materiali"
                value={tab}
                onValueChange={setTab}
                items={[
                    { value: "stock", label: `Giacenza (${groupedStock.length})`, icon: <Package /> },
                    { value: "history", label: `Storico (${movements.length})`, icon: <History /> },
                ]}
            >
                <NotchActions>
                    {canSeeValue && (
                        <NotchStat label="Valore totale" value={`€ ${totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })}`} />
                    )}
                    <NotchStat label="Articoli" value={`${realItemsCount}${fictItemsCount > 0 ? ` + ${fictItemsCount} fittizi` : ''}`} />
                    {tab === "stock" && <NotchSearch value={searchTerm} onChange={setSearchTerm} placeholder="Cerca materiale per nome o codice" />}
                </NotchActions>

                {/* Tab: Giacenza Attuale */}
                <TabsContent value="stock" className="mt-6">
                    <div className="space-y-4">
                        {/* Telefono: una scheda per articolo */}
                        <div className="space-y-2 md:hidden">
                            {rows.length === 0 ? (
                                <div className="rounded-lg border border-dashed bg-slate-50 py-8 text-center text-slate-400 dark:border-slate-700 dark:bg-muted dark:text-slate-500">
                                    {searchTerm || priceFilter === 'missing' ? 'Nessun risultato trovato.' : 'Nessun materiale attualmente in cantiere.'}
                                </div>
                            ) : rows.map(item => (
                                <Card key={`mobile-${item.code}-${item.isFictitious}`} className="px-3 py-2.5">
                                    <div className="flex items-center gap-3">
                                        {thumb(item)}
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium text-slate-900 dark:text-white">{item.name}</div>
                                            {item.model && <div className="truncate text-xs text-slate-500">{item.model}</div>}
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="font-bold text-slate-900 dark:text-white">
                                                {item.totalQty.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} {item.unit}
                                            </div>
                                            <div className="text-xs text-slate-500">{valueCell(item)}</div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Tabella: da tablet in su */}
                        <div className="hidden md:block">
                            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                                <TableHeader>
                                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                        <TableHead className="w-14 border-r" />
                                        {sortHead('name', 'Nome')}
                                        {sortHead('model', 'Modello / variante', 'w-56')}
                                        {sortHead('batches', 'N° lotti', 'w-24 text-right')}
                                        {sortHead('qty', 'Q.tà totale', 'w-36 text-right')}
                                        <TableHead className="w-44 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            <div className="flex items-center justify-end gap-1">
                                                {userRole !== 'user' && (
                                                    <Select value={priceFilter} onValueChange={v => setPriceFilter(v as 'all' | 'missing')}>
                                                        <SelectTrigger className="h-7 min-w-0 flex-1 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                                                            <SelectValue>{priceFilter === 'all' ? 'Valore' : 'Senza prezzo'}</SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">Tutti i valori</SelectItem>
                                                            <SelectItem value="missing">Senza prezzo</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                {userRole === 'user' && 'Valore'}
                                                <button type="button" aria-label="Ordina per valore" onClick={() => toggleSort('value')} className="shrink-0 text-slate-500 hover:text-slate-900">
                                                    {sortIcon('value')}
                                                </button>
                                            </div>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                                                {searchTerm || priceFilter === 'missing' ? 'Nessun risultato trovato.' : 'Nessun materiale attualmente in cantiere.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : rows.map(item => (
                                        <TableRow key={`${item.code}-${item.isFictitious}`}>
                                            <TableCell className="border-r py-1.5">{thumb(item)}</TableCell>
                                            <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">
                                                {item.name}
                                                {item.isFictitious && (
                                                    <Badge variant="outline" className="ml-2 h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Fittizio</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{item.model || <span className="text-slate-300">—</span>}</TableCell>
                                            <TableCell className="border-r py-2 text-right text-slate-500">{item.batches.length}</TableCell>
                                            <TableCell className="border-r py-2 text-right font-bold text-slate-700 dark:text-slate-300">
                                                {item.totalQty.toLocaleString('it-IT', { maximumFractionDigits: 2, useGrouping: true })} {item.unit}
                                                {Math.abs(item.totalPieces) > 0.01 && (
                                                    <div className="text-xs font-normal text-slate-400">{item.totalPieces.toLocaleString('it-IT', { maximumFractionDigits: 0, useGrouping: true })} pz</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2 text-right text-slate-700 dark:text-slate-300">{valueCell(item)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                {/* Tab: Storico Movimenti */}
                <TabsContent value="history" className="mt-6">
                    <div className="space-y-4">

                        <div className="grid gap-4 md:hidden">
                            {movements.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                                    Nessun movimento registrato.
                                </div>
                            ) : (
                                movements.map((move) => {
                                    const isSiteIn = ['purchase', 'unload', 'exit', 'sale'].includes(move.type)
                                    const displayQty = isSiteIn ? Math.abs(move.quantity) : -Math.abs(move.quantity)

                                    return (
                                        <Card key={`mobile-hist-${move.id}`}>
                                            <CardContent className="p-4 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                            {new Date(move.date).toLocaleDateString()}
                                                        </div>
                                                        <div className="font-medium text-slate-900 dark:text-white">
                                                            {move.itemName || 'Articolo Cancellato'}
                                                            {move.itemModel && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({move.itemModel})</span>}
                                                        </div>
                                                    </div>
                                                    <div className={`font-bold ${isSiteIn ? 'text-green-700' : 'text-orange-700'}`}>
                                                        {displayQty > 0 ? '+' : ''}{displayQty} {move.itemUnit}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {isSiteIn ? (
                                                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 flex w-fit gap-1 items-center text-xs">
                                                            <ArrowDownLeft className="h-3 w-3" /> In Ingresso
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 flex w-fit gap-1 items-center text-xs">
                                                            <ArrowUpRight className="h-3 w-3" /> Reso
                                                        </Badge>
                                                    )}
                                                    {move.isFictitious && (
                                                        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs">
                                                            Fittizio
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="text-sm pt-2 border-t dark:border-slate-700 text-slate-600 dark:text-slate-400">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Riferimento</span>
                                                    {move.deliveryNoteId ? (
                                                        <Link href={`/movements/${move.deliveryNoteId}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                                            {move.reference || '-'}
                                                        </Link>
                                                    ) : move.purchaseId && move.type === 'purchase' ? (
                                                        <Link href={`/purchases/${move.purchaseId}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                                            {move.reference || '-'}
                                                        </Link>
                                                    ) : (
                                                        move.reference || '-'
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })
                            )}
                        </div>

                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Data</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Articolo</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bolla di riferimento</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Riferimento Acquisto</TableHead>
                                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Quantità</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                                                Nessun movimento registrato.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        movements.map((move) => {
                                            const isSiteIn = ['purchase', 'unload', 'exit', 'sale'].includes(move.type)
                                            const displayQty = isSiteIn ? Math.abs(move.quantity) : -Math.abs(move.quantity)

                                            return (
                                                <TableRow key={move.id}>
                                                    <TableCell className="font-mono text-xs">
                                                        {new Date(move.date).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {isSiteIn ? (
                                                            <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 flex w-fit gap-1 items-center">
                                                                <ArrowDownLeft className="h-3 w-3" /> In Ingresso
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 flex w-fit gap-1 items-center">
                                                                <ArrowUpRight className="h-3 w-3" /> Reso
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                                {move.itemName || 'Articolo Cancellato'}
                                                                {move.itemModel && <span className="text-slate-500 dark:text-slate-400 font-normal">({move.itemModel})</span>}
                                                                {move.isFictitious && (
                                                                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] h-5 px-1.5">
                                                                        Fittizio
                                                                    </Badge>
                                                                )}
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{move.itemCode}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {move.deliveryNoteId ? (
                                                            <Link href={`/movements/${move.deliveryNoteId}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                                                {move.reference || '-'}
                                                            </Link>
                                                        ) : move.purchaseId && move.type === 'purchase' ? (
                                                            <Link href={`/purchases/${move.purchaseId}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                                                {move.reference || '-'}
                                                            </Link>
                                                        ) : (
                                                            move.reference || '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                        {move.isFictitious ? (
                                                            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                                                Fittizio
                                                            </Badge>
                                                        ) : move.purchaseId ? (
                                                            <Link href={`/purchases/${move.purchaseId}`} className="group flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded -ml-1 transition-colors">
                                                                <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                                                    Bolla {move.purchaseNumber || '?'}
                                                                </span>
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                    {move.purchaseDate ? new Date(move.purchaseDate).toLocaleDateString() : ''} - {move.supplierName || 'Fornitore sconosciuto'}
                                                                </span>
                                                            </Link>
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-500 italic">Magazzino</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-bold ${isSiteIn ? 'text-green-700' : 'text-orange-700'}`}>
                                                        {displayQty > 0 ? '+' : ''}{displayQty} {move.itemUnit}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
            </NotchTabs>
        </Tabs>
    )
}

// Miniatura dell'articolo: foto propria, altrimenti quella della tipologia, altrimenti un segnaposto
function StockThumb({ name, image, typeImage }: { name: string; image?: string; typeImage?: string }) {
    const [err, setErr] = useState(false)
    const own = !!image && !err
    const src = own ? image! : (typeImage || "/placeholder.svg")
    const placeholder = !own && !typeImage
    return (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <Image src={src} alt={name} fill sizes="40px" className={placeholder ? "object-contain p-1.5 opacity-50" : "object-cover"} onError={() => setErr(true)} />
        </div>
    )
}
