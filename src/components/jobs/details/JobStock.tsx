"use client"

import { useState, useMemo } from "react"
import { Movement } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, ArrowRight, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"

interface JobStockProps {
  movements: Movement[]
}

export function JobStock({ movements }: JobStockProps) {
  const { userRole } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  // 1. Find Last Purchase Price per Item Code
  // We use this for fictitious items: value of the last purchase made for that item
  const lastPurchasePriceMap = new Map<string, number>()

  // movements are sorted by date desc, so the first purchase we find is the last one
  for (const m of movements) {
    if (m.itemCode && m.type === 'purchase' && m.itemPrice && m.itemPrice > 0) {
       if (!lastPurchasePriceMap.has(m.itemCode)) {
           lastPurchasePriceMap.set(m.itemCode, m.itemPrice)
       }
    }
  }

  // Calculate Current Stock at Site
  const stockMap = new Map<string, { 
    name: string, 
    code: string, 
    qty: number, 
    pieces: number,
    unit: string,
    price: number, // Specific or Average
    isFictitious: boolean,
    reference: string,
    purchaseId?: string,
    purchaseNumber?: string,
    purchaseDate?: string,
    supplierName?: string,
    deliveryNoteId?: string
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
    
    const current = stockMap.get(key)

    if (current) {
      current.qty += qtyChange
      current.pieces += piecesChange
    } else if (m.itemCode) {
      // Determine price
      let price = 0
      if (m.isFictitious) {
        price = lastPurchasePriceMap.get(m.itemCode) || 0
      } else {
        price = m.itemPrice || 0
      }

      stockMap.set(key, {
        name: m.itemName || 'Sconosciuto',
        code: m.itemCode,
        qty: qtyChange,
        pieces: piecesChange,
        unit: m.itemUnit || 'PZ',
        price: price,
        isFictitious: !!m.isFictitious,
        reference: m.reference || '',
        purchaseId: m.purchaseId,
        purchaseNumber: m.purchaseNumber,
        purchaseDate: m.purchaseDate,
        supplierName: m.supplierName,
        deliveryNoteId: m.deliveryNoteId
      })
    }
  })

  // Filter out zero quantity items, but maybe allow small float errors?
  // Sort by Name
  const currentStock = Array.from(stockMap.values())
    .filter(i => Math.abs(i.qty) > 0.001)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-8">
      {/* Current Stock Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Giacenza Attuale in Cantiere
            </h2>
            <Badge variant="outline" className="text-slate-500">
                {currentStock.length} Articoli presenti
            </Badge>
        </div>

        <div className="grid gap-4 md:hidden">
            {currentStock.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                    Nessun materiale attualmente in cantiere.
                </div>
            ) : (
                currentStock.map((item, idx) => (
                    <Card key={`mobile-${item.code}-${item.isFictitious}-${idx}`}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium text-slate-900">{item.name}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">{item.code}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-slate-900">{item.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}</div>
                                    {Math.abs(item.pieces) > 0.01 && (
                                        <div className="text-xs text-slate-500">{item.pieces.toLocaleString('it-IT', { maximumFractionDigits: 2 })} pz</div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                                <div>
                                    <span className="text-xs text-slate-500 block">Riferimento</span>
                                    {item.deliveryNoteId ? (
                                        <Link href={`/movements/${item.deliveryNoteId}`} className="text-blue-600 hover:underline">
                                            {item.reference || '-'}
                                        </Link>
                                    ) : (
                                        <span className="text-slate-700">{item.reference || '-'}</span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-slate-500 block">Valore</span>
                                    {userRole === 'user' ? (
                                        <span className="text-slate-400 italic text-xs">Riservato</span>
                                    ) : (
                                        <span className="font-medium text-slate-700">
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
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        Nessun materiale attualmente in cantiere.
                    </TableCell>
                    </TableRow>
                ) : (
                    currentStock.map((item, idx) => (
                        <TableRow key={`${item.code}-${item.isFictitious}-${idx}`}>
                        <TableCell className="font-mono text-xs">{item.code}</TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                          {item.isFictitious && (
                            <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5">
                              Fittizio
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                            {/* Bolla Reference */}
                            {item.deliveryNoteId ? (
                                <Link href={`/movements/${item.deliveryNoteId}`} className="text-blue-600 hover:underline">
                                    {item.reference || '-'}
                                </Link>
                            ) : (
                                item.reference || '-'
                            )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                             {/* Purchase Info */}
                             {item.isFictitious ? (
                                <span className="text-slate-400 italic">Fittizio</span>
                             ) : item.purchaseId ? (
                                <Link href={`/purchases/${item.purchaseId}`} className="group flex flex-col hover:bg-slate-50 p-1 rounded -ml-1 transition-colors">
                                    <span className="font-medium text-blue-600 group-hover:underline">
                                        Bolla {item.purchaseNumber || '?'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : ''} - {item.supplierName || 'Fornitore'}
                                    </span>
                                </Link>
                             ) : (
                                <span className="text-slate-400 italic">Magazzino</span>
                             )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-600">
                            {Math.abs(item.pieces) > 0.01 ? item.pieces.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-700">
                            {item.qty.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                            <div className="flex items-center justify-end gap-2">
                                {userRole === 'user' ? (
                                    <span className="text-slate-400 italic text-xs">Riservato</span>
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

      {/* Movement History Section */}
      <div className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-semibold text-slate-800">Storico Movimenti</h2>
        
        <div className="grid gap-4 md:hidden">
            {movements.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed">
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
                                        <div className="text-xs text-slate-500 font-mono">
                                            {new Date(move.date).toLocaleDateString()}
                                        </div>
                                        <div className="font-medium text-slate-900">{move.itemName || 'Articolo Cancellato'}</div>
                                    </div>
                                    <div className={`font-bold ${isSiteIn ? 'text-green-700' : 'text-orange-700'}`}>
                                        {displayQty > 0 ? '+' : ''}{displayQty} {move.itemUnit}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {isSiteIn ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex w-fit gap-1 items-center text-xs">
                                            <ArrowDownLeft className="h-3 w-3" /> In Ingresso
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 flex w-fit gap-1 items-center text-xs">
                                            <ArrowUpRight className="h-3 w-3" /> Reso
                                        </Badge>
                                    )}
                                    {move.isFictitious && (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                            Fittizio
                                        </Badge>
                                    )}
                                </div>

                                <div className="text-sm pt-2 border-t text-slate-600">
                                    <span className="text-xs text-slate-400 block mb-1">Riferimento</span>
                                    {move.deliveryNoteId ? (
                                        <Link href={`/movements/${move.deliveryNoteId}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                            {move.reference || '-'}
                                        </Link>
                                    ) : move.purchaseId && move.type === 'purchase' ? (
                                        <Link href={`/purchases/${move.purchaseId}`} className="text-blue-600 hover:underline flex items-center gap-1">
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
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
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
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex w-fit gap-1 items-center">
                                        <ArrowDownLeft className="h-3 w-3" /> In Ingresso
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 flex w-fit gap-1 items-center">
                                        <ArrowUpRight className="h-3 w-3" /> Reso
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                <span className="font-medium text-slate-900 flex items-center gap-2">
                                {move.itemName || 'Articolo Cancellato'}
                                {move.isFictitious && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] h-5 px-1.5">
                                    Fittizio
                                    </Badge>
                                )}
                                </span>
                                <span className="text-xs text-slate-500 font-mono">{move.itemCode}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">
                                {move.deliveryNoteId ? (
                                    <Link href={`/movements/${move.deliveryNoteId}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                        {move.reference || '-'}
                                    </Link>
                                ) : move.purchaseId && move.type === 'purchase' ? (
                                    <Link href={`/purchases/${move.purchaseId}`} className="text-blue-600 hover:underline flex items-center gap-1">
                                        {move.reference || '-'}
                                    </Link>
                                ) : (
                                    move.reference || '-'
                                )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                                {move.isFictitious ? (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    Fittizio
                                    </Badge>
                                ) : move.purchaseId ? (
                                    <Link href={`/purchases/${move.purchaseId}`} className="group flex flex-col hover:bg-slate-50 p-1 rounded -ml-1 transition-colors">
                                        <span className="font-medium text-blue-600 group-hover:underline">
                                            Bolla {move.purchaseNumber || '?'}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {move.purchaseDate ? new Date(move.purchaseDate).toLocaleDateString() : ''} - {move.supplierName || 'Fornitore sconosciuto'}
                                        </span>
                                    </Link>
                                ) : (
                                    <span className="text-slate-400 italic">Magazzino</span>
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
    </div>
  )
}
