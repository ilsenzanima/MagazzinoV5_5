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

    // Calculate Total Value including fictitious items
    const totalValue = useMemo(() => {
        return round2(groupedStock.reduce((sum, item) => {
            if (item.isFictitious) {
                // Use batch-computed value if available, fallback to manual price
                if (item.totalValue > 0) {
                    return sum + item.totalValue
                }
                const price = fictitiousPrices[item.itemId] ?? 0
                return sum + (item.totalQty * price)
            } else {
                return sum + item.totalValue
            }
        }, 0))
    }, [groupedStock, fictitiousPrices])

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
                        {/* Mobile View - Cards with Expandable Details */}
                        <div className="space-y-2 md:hidden">
                            {filteredStock.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                                    {searchTerm ? 'Nessun risultato trovato.' : 'Nessun materiale attualmente in cantiere.'}
                                </div>
                            ) : (
                                filteredStock.map((item) => {
                                    const isExpanded = expandedItemCode === item.code
                                    return (
                                        <Card key={`mobile-${item.code}`} className="overflow-hidden">
                                            {/* Main Row - Always Visible */}
                                            <div
                                                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => toggleExpanded(item.code)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 p-0">
                                                        {isExpanded ? (
                                                            <ChevronDown className="h-4 w-4 text-slate-500" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 text-slate-500" />
                                                        )}
                                                    </Button>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-slate-900 dark:text-white truncate">
                                                            {item.name}
                                                            {item.model && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({item.model})</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{item.code}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-2">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        {item.totalQty.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                                                    </div>
                                                    {(userRole === 'admin' || userRole === 'operativo') && !item.isFictitious && (
                                                        <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                                                            {item.hasMissingPrice && (
                                                                <span title="Prezzo mancante in uno o più lotti">
                                                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                                </span>
                                                            )}
                                                            € {item.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 , useGrouping: true})}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-3">
                                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        {item.batches.length} {item.batches.length === 1 ? 'Lotto' : 'Lotti'}
                                                    </div>
                                                    {item.batches.map((batch, idx) => (
                                                        <div key={idx} className="bg-white dark:bg-slate-800 rounded-md p-2 border border-slate-200 dark:border-slate-700 text-sm space-y-1">
                                                            <div className="flex justify-between items-start">
                                                                <div className="text-slate-600 dark:text-slate-300">
                                                                    {batch.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                                                                    {Math.abs(batch.pieces) > 0.01 && (
                                                                        <span className="text-slate-400 ml-1">({batch.pieces.toLocaleString('it-IT', { maximumFractionDigits: 0 , useGrouping: true})} pz)</span>
                                                                    )}
                                                                </div>
                                                                {(userRole === 'admin' || userRole === 'operativo') && (
                                                                    <div className="text-right text-slate-600 dark:text-slate-300">
                                                                        € {(batch.qty * batch.price).toLocaleString('it-IT', { minimumFractionDigits: 2 , useGrouping: true})}
                                                                        <div className="text-xs text-slate-400">@ €{batch.price.toFixed(4)}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {batch.purchaseId && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-slate-500">Riferimento acquisto:</span>
                                                                    <Link href={`/purchases/${batch.purchaseId}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                                                        Bolla {batch.purchaseNumber} - {batch.supplierName || 'Fornitore'}
                                                                    </Link>
                                                                </div>
                                                            )}
                                                            {batch.referenceMap.size > 0 && (
                                                                <div className="flex flex-wrap items-center gap-1">
                                                                    <span className="text-xs text-slate-500">Bolle di riferimento:</span>
                                                                    {Array.from(batch.referenceMap.entries()).map(([ref, info]) => (
                                                                        <Link
                                                                            key={ref}
                                                                            href={`/movements/${info.noteId}`}
                                                                            className={`text-xs hover:underline ${info.isReturn ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}
                                                                        >
                                                                            {ref}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </Card>
                                    )
                                })
                            )}
                        </div>

                        {/* Desktop View - Table with Expandable Rows */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                        <TableHead className="w-8 text-xs font-semibold uppercase tracking-wide text-slate-600"></TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Codice</TableHead>
                                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Articolo</TableHead>
                                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">N° Lotti</TableHead>
                                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Q.tà Totale</TableHead>
                                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Valore</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStock.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                                                {searchTerm ? 'Nessun risultato trovato.' : 'Nessun materiale attualmente in cantiere.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStock.map((item) => {
                                            const isExpanded = expandedItemCode === item.code
                                            return (
                                                <Fragment key={item.code}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        onClick={() => toggleExpanded(item.code)}
                                                    >
                                                        <TableCell className="w-8 p-2">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-slate-500" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                                        <TableCell className="font-medium">
                                                            {item.name}
                                                            {item.model && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({item.model})</span>}
                                                            {item.isFictitious && (
                                                                <Badge variant="outline" className="ml-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] h-5 px-1.5">
                                                                    Fittizio
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-slate-500">{item.batches.length}</TableCell>
                                                        <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300">
                                                            {item.totalQty.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {userRole === 'user' ? (
                                                                <span className="text-slate-400 italic text-xs">Riservato</span>
                                                            ) : item.isFictitious ? (
                                                                item.totalValue > 0 ? (
                                                                    <span className="text-slate-600 dark:text-slate-400 flex items-center justify-end gap-1">
                                                                        € {item.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 , useGrouping: true})}
                                                                        <span className="text-xs text-amber-500 ml-1" title="Valore dal lotto di origine">auto</span>
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <span className="text-xs">€</span>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.00001"
                                                                            className="w-20 h-7 text-right text-sm"
                                                                            value={fictitiousPrices[item.itemId] ?? 0}
                                                                            onChange={(e) => handlePriceChange(item.itemId, e.target.value)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            placeholder="0.00"
                                                                            disabled={loadingPrices}
                                                                        />
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <span className="text-slate-600 dark:text-slate-400 flex items-center justify-end gap-1">
                                                                    {item.hasMissingPrice && (
                                                                        <span title="Prezzo mancante in uno o più lotti">
                                                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                                        </span>
                                                                    )}
                                                                    € {item.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 , useGrouping: true})}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                    {/* Expanded Batch Details */}
                                                    {isExpanded && item.batches.map((batch, idx) => (
                                                        <TableRow key={`${item.code}-batch-${idx}`} className="bg-slate-50/50 dark:bg-slate-900/50">
                                                            <TableCell></TableCell>
                                                            <TableCell colSpan={2} className="text-sm">
                                                                <div className="pl-4 flex items-center gap-2 flex-wrap">
                                                                    <span className="text-slate-400">└─</span>
                                                                    <span className="text-xs text-slate-500">Rif. Acquisto:</span>
                                                                    {batch.purchaseId ? (
                                                                        <Link href={`/purchases/${batch.purchaseId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                            Bolla {batch.purchaseNumber} - {batch.supplierName || 'Fornitore'}
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="text-slate-500">Magazzino</span>
                                                                    )}
                                                                    {batch.referenceMap.size > 0 && (
                                                                        <>
                                                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                                                            <span className="text-xs text-slate-500">Bolle:</span>
                                                                            {Array.from(batch.referenceMap.entries()).map(([ref, info]) => (
                                                                                <Link
                                                                                    key={ref}
                                                                                    href={`/movements/${info.noteId}`}
                                                                                    className={`text-xs hover:underline ${info.isReturn ? 'text-orange-600' : 'text-blue-600'}`}
                                                                                >
                                                                                    {ref}
                                                                                </Link>
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-slate-500 text-sm">
                                                                {Math.abs(batch.pieces) > 0.01 ? `${batch.pieces.toLocaleString('it-IT', { maximumFractionDigits: 0 , useGrouping: true})} pz` : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-right text-slate-600 dark:text-slate-400 text-sm">
                                                                {batch.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 , useGrouping: true})} {item.unit}
                                                            </TableCell>
                                                            <TableCell className="text-right text-slate-500 text-sm">
                                                                {(userRole === 'admin' || userRole === 'operativo') && (
                                                                    <>
                                                                        € {(batch.qty * batch.price).toLocaleString('it-IT', { minimumFractionDigits: 2 , useGrouping: true})}
                                                                        <span className="text-xs text-slate-400 ml-1">(@€{batch.price.toFixed(4)})</span>
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </Fragment>
                                            )
                                        })
                                    )}
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

