"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Movement } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, ArrowRight, AlertTriangle, ArrowUpRight, ArrowDownLeft, History } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { fictitiousPricesApi } from "@/lib/services/fictitiousPrices"

interface JobStockProps {
    movements: Movement[]
    jobId: string
}

export function JobStock({ movements, jobId }: JobStockProps) {
    const { userRole } = useAuth()
    const [searchTerm, setSearchTerm] = useState("")
    const [fictitiousPrices, setFictitiousPrices] = useState<Record<string, number>>({})
    const [loadingPrices, setLoadingPrices] = useState(true)

    // Load saved fictitious prices
    useEffect(() => {
        const loadPrices = async () => {
            try {
                const prices = await fictitiousPricesApi.getByJob(jobId)
                setFictitiousPrices(prices)
            } catch (error) {
                console.error('Error loading fictitious prices:', error)
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

    // Calculate Current Stock at Site - Memoized
    const stockMap = useMemo(() => {
        const map = new Map<string, {
            itemId: string,
            name: string,
            model?: string,
            code: string,
            qty: number,
            pieces: number,
            unit: string,
            price: number, // Specific or Average
            isFictitious: boolean,
            references: Set<string>, // Multiple delivery notes
            deliveryNoteIds: Set<string>,
            purchaseId?: string,
            purchaseNumber?: string,
            purchaseDate?: string,
            supplierName?: string
        }>()

        movements.forEach(m => {
            // Determine direction relative to Job Site
            // Purchase -> Job In (+)
            // Warehouse Unload (Out from Wh) -> Job In (+)
            // Warehouse Exit (Out from Wh) -> Job In (+)
            // Warehouse Load (In to Wh) -> Job Out (-)
            // Warehouse Entry (In to Wh) -> Job Out (-)

            const isSiteIn = ['purchase', 'unload', 'exit'].includes(m.type)

            // We normalize quantity to be positive for input, negative for output
            // We use Math.abs to ignore the sign coming from the View (which is Warehouse-centric)
            const qtyChange = isSiteIn ? Math.abs(m.quantity) : -Math.abs(m.quantity)

            // Calculate pieces change
            let piecesChange = 0;
            if (m.pieces !== undefined && m.pieces !== null) {
                piecesChange = isSiteIn ? Math.abs(m.pieces) : -Math.abs(m.pieces);
            } else if (m.coefficient && m.coefficient !== 0) {
                // Fallback if pieces is missing but we have coefficient
                const p = m.quantity / m.coefficient;
                piecesChange = isSiteIn ? Math.abs(p) : -Math.abs(p);
            }

            // Group by Item + Fictitious + Source (Purchase/Bolla)
            // Use Reference/PurchaseId to separate batches
            const sourceKey = m.purchaseId || m.reference || 'unknown'
            const key = `${m.itemCode}-${!!m.isFictitious}-${sourceKey}`


            const current = map.get(key)

            if (current) {
                current.qty += qtyChange
                current.pieces += piecesChange
                // Add reference to existing Set
                if (m.reference) current.references.add(m.reference)
                if (m.deliveryNoteId) current.deliveryNoteIds.add(m.deliveryNoteId)
            } else if (m.itemCode) {
                // Determine price - Fittizi sempre a 0
                let price = 0
                if (!m.isFictitious) {
                    price = m.itemPrice || 0
                }

                const references = new Set<string>()
                const deliveryNoteIds = new Set<string>()
                if (m.reference) references.add(m.reference)
                if (m.deliveryNoteId) deliveryNoteIds.add(m.deliveryNoteId)

                map.set(key, {
                    itemId: m.itemId || '',
                    name: m.itemName || 'Sconosciuto',
                    model: m.itemModel,
                    code: m.itemCode,
                    qty: qtyChange,
                    pieces: piecesChange,
                    unit: m.itemUnit || 'PZ',
                    price: price,
                    isFictitious: !!m.isFictitious,
                    references,
                    deliveryNoteIds,
                    purchaseId: m.purchaseId,
                    purchaseNumber: m.purchaseNumber,
                    purchaseDate: m.purchaseDate,
                    supplierName: m.supplierName
                })
            }
        })
        return map
    }, [movements, lastPurchasePriceMap])

    // Filter out zero quantity items, but maybe allow small float errors?
    // Sort by Name - Memoized
    const currentStock = useMemo(() => {
        return Array.from(stockMap.values())
            .filter(i => Math.abs(i.qty) > 0.001)
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [stockMap])

    // Calculate Total Value including fictitious items
    const totalValue = useMemo(() => {
        return currentStock.reduce((sum, item) => {
            if (item.isFictitious) {
                // Use fictitious price from state
                const price = fictitiousPrices[item.itemId] ?? 0
                return sum + (item.qty * price)
            } else {
                return sum + (item.qty * item.price)
            }
        }, 0)
    }, [currentStock, fictitiousPrices])

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            {(userRole === 'admin' || userRole === 'operativo') && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Valore Totale Cantiere</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        € {totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                                <p>{currentStock.filter(i => !i.isFictitious).length} articoli reali</p>
                                <p>{currentStock.filter(i => i.isFictitious).length} articoli fittizi</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <Tabs defaultValue="stock" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="stock" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Giacenza Attuale
                        <Badge variant="secondary" className="ml-1 text-xs">
                            {currentStock.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Storico Movimenti
                        <Badge variant="secondary" className="ml-1 text-xs">
                            {movements.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                {/* Tab: Giacenza Attuale */}
                <TabsContent value="stock" className="mt-6">
                    <div className="space-y-4">

                        <div className="grid gap-4 md:hidden">
                            {currentStock.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                                    Nessun materiale attualmente in cantiere.
                                </div>
                            ) : (
                                currentStock.map((item, idx) => (
                                    <Card key={`mobile-${item.code}-${item.isFictitious}-${idx}`}>
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                        {item.name}
                                                        {item.model && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({item.model})</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{item.code}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-slate-900 dark:text-white">{item.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}</div>
                                                    {Math.abs(item.pieces) > 0.01 && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.pieces.toLocaleString('it-IT', { maximumFractionDigits: 2 })} pz</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t dark:border-slate-700">
                                                <div>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Riferimento</span>
                                                    {item.references.size > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Array.from(item.references).map((ref, refIdx) => {
                                                                const noteId = Array.from(item.deliveryNoteIds)[refIdx]
                                                                return noteId ? (
                                                                    <Link key={ref} href={`/movements/${noteId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                        {ref}
                                                                    </Link>
                                                                ) : (
                                                                    <span key={ref} className="text-slate-700 dark:text-slate-300">{ref}</span>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-700 dark:text-slate-300">-</span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Valore</span>
                                                    {userRole === 'user' ? (
                                                        <span className="text-slate-400 italic text-xs">Riservato</span>
                                                    ) : (
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                                            € {(item.qty * item.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>

                        <Card className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Codice</TableHead>
                                        <TableHead>Articolo</TableHead>
                                        <TableHead>Bolla di riferimento</TableHead>
                                        <TableHead>Riferimento Acquisto</TableHead>
                                        <TableHead className="text-right">Quantità Attuale</TableHead>
                                        <TableHead className="text-right">Valore Stimato</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentStock.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                                                Nessun materiale attualmente in cantiere.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentStock.map((item, idx) => (
                                            <TableRow key={`${item.code}-${item.isFictitious}-${idx}`}>
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
                                                <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                    {/* Bolla Reference - Multiple */}
                                                    {item.references.size > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Array.from(item.references).map((ref, refIdx) => {
                                                                const noteId = Array.from(item.deliveryNoteIds)[refIdx]
                                                                return noteId ? (
                                                                    <Link key={ref} href={`/movements/${noteId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                                        {ref}
                                                                    </Link>
                                                                ) : (
                                                                    <span key={ref}>{ref}</span>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                    {/* Purchase Info */}
                                                    {item.isFictitious ? (
                                                        <span className="text-slate-400 dark:text-slate-500 italic">Fittizio</span>
                                                    ) : item.purchaseId ? (
                                                        <Link href={`/purchases/${item.purchaseId}`} className="group flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded -ml-1 transition-colors">
                                                            <span className="font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                                                                Bolla {item.purchaseNumber || '?'}
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                                {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : ''} - {item.supplierName || 'Fornitore'}
                                                            </span>
                                                        </Link>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-500 italic">Magazzino</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-slate-600 dark:text-slate-400">
                                                    {Math.abs(item.pieces) > 0.01 ? item.pieces.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-700 dark:text-slate-300">
                                                    {item.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {userRole === 'user' ? (
                                                            <span className="text-slate-400 italic text-xs">Riservato</span>
                                                        ) : item.isFictitious ? (
                                                            (userRole === 'admin' || userRole === 'operativo') ? (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs text-slate-400">P.U.</span>
                                                                        <span className="text-xs">€</span>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.00001"
                                                                            className="w-20 h-7 text-right text-sm"
                                                                            value={fictitiousPrices[item.itemId] ?? 0}
                                                                            onChange={(e) => handlePriceChange(item.itemId, e.target.value)}
                                                                            placeholder="0.00"
                                                                            disabled={loadingPrices}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                        Tot: € {(item.qty * (fictitiousPrices[item.itemId] ?? 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-xs">
                                                                    € {(item.qty * (fictitiousPrices[item.itemId] ?? 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <>
                                                                {(!item.price || item.price === 0) && (
                                                                    <div className="group relative">
                                                                        <AlertTriangle className="h-4 w-4 text-amber-500 cursor-help" />
                                                                        <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 bg-slate-800 text-white text-xs rounded p-1 text-center z-10">
                                                                            Prezzo mancante
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                € {(item.qty * item.price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </Card>
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
                                    const isSiteIn = ['purchase', 'unload', 'exit'].includes(move.type)
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

                        <Card className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Articolo</TableHead>
                                        <TableHead>Bolla di riferimento</TableHead>
                                        <TableHead>Riferimento Acquisto</TableHead>
                                        <TableHead className="text-right">Quantità</TableHead>
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
                                            const isSiteIn = ['purchase', 'unload', 'exit'].includes(move.type)
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
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

