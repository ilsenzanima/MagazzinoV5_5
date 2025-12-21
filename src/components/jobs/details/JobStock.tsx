"use client"

import { Movement } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Package, ArrowUpRight, ArrowDownLeft } from "lucide-react"

interface JobStockProps {
  movements: Movement[]
}

export function JobStock({ movements }: JobStockProps) {
  // Calculate Current Stock at Site
  const stockMap = new Map<string, { 
    name: string, 
    code: string, 
    qty: number, 
    unit: string,
    avgPrice: number 
  }>()

  movements.forEach(m => {
    // Inventory Unload = Site Load (IN)
    // Inventory Load = Site Unload (OUT)
    // However, currently we mostly have Unload (Warehouse -> Site)
    
    // Note: m.type is from Warehouse perspective
    // 'unload' -> Warehouse decreases -> Site increases
    // 'load' -> Warehouse increases -> Site decreases (Return)

    const isSiteIn = m.type === 'unload'
    const qtyChange = isSiteIn ? m.quantity : -m.quantity
    
    const current = stockMap.get(m.itemCode || '')
    if (current) {
      current.qty += qtyChange
    } else if (m.itemCode) {
      stockMap.set(m.itemCode, {
        name: m.itemName || 'Sconosciuto',
        code: m.itemCode,
        qty: qtyChange,
        unit: m.itemUnit || 'PZ',
        avgPrice: m.itemPrice || 0
      })
    }
  })

  // Filter out zero quantity items (optional, maybe we want to see history)
  // For "Giacenza", we show only > 0
  const currentStock = Array.from(stockMap.values()).filter(i => i.qty > 0)

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

        <Card>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Articolo</TableHead>
                <TableHead className="text-right">Quantità Attuale</TableHead>
                <TableHead className="text-right">Valore Stimato</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {currentStock.length === 0 ? (
                    <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                        Nessun materiale attualmente in cantiere.
                    </TableCell>
                    </TableRow>
                ) : (
                    currentStock.map((item) => (
                        <TableRow key={item.code}>
                        <TableCell className="font-mono text-xs">{item.code}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700">
                            {item.qty} {item.unit}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                            € {(item.qty * item.avgPrice).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
        <Card>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Articolo</TableHead>
                <TableHead>Riferimento</TableHead>
                <TableHead>Utente</TableHead>
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
                    movements.map((move) => (
                        <TableRow key={move.id}>
                        <TableCell className="font-mono text-xs">
                            {new Date(move.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                            {move.type === 'unload' ? (
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
                            <span className="font-medium text-slate-900">{move.itemName || 'Articolo Cancellato'}</span>
                            <span className="text-xs text-slate-500 font-mono">{move.itemCode}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-sm">
                            {move.reference || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                            {move.userName}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                            {move.quantity} {move.itemUnit}
                        </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </Card>
      </div>
    </div>
  )
}
