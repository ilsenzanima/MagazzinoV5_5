"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Recycle, CalendarDays, Truck, ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { deliveryNotesApi } from "@/lib/api"
import { DeliveryNote } from "@/lib/types"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"

interface JobEccedenzeProps {
    jobId: string
}

export function JobEccedenze({ jobId }: JobEccedenzeProps) {
    const [notes, setNotes] = useState<DeliveryNote[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const data = await deliveryNotesApi.getWasteByJobId(jobId)
                setNotes(data)
            } catch (err) {
                console.error("Errore caricamento eccedenze:", err)
                notify.error("Errore nel caricamento delle eccedenze")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [jobId])

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    // Calcolo totale articoli trasportati (tutte le bolle)
    const totalItems = notes.reduce((sum, n) => sum + (n.items?.length || 0), 0)

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
                <span className="ml-2 text-slate-500 text-sm">Caricamento eccedenze...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-violet-200 dark:border-violet-800">
                <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                        <Recycle className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Trasporti Eccedenze</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{notes.length}</p>
                        </div>
                        <div className="ml-auto text-right text-sm text-slate-500 dark:text-slate-400">
                            <p>{totalItems} voci totali</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {notes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <Recycle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Nessuna eccedenza registrata per questa commessa.</p>
                </div>
            ) : (
                <>
                    {/* Mobile View */}
                    <div className="space-y-2 md:hidden">
                        {notes.map(note => {
                            const isExpanded = expandedId === note.id
                            const dateStr = note.date
                                ? format(new Date(note.date.split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy', { locale: it })
                                : '-'
                            return (
                                <Card key={note.id} className="overflow-hidden">
                                    <div
                                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => toggleExpand(note.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 p-0">
                                                {isExpanded
                                                    ? <ChevronDown className="h-4 w-4 text-slate-500" />
                                                    : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                            </Button>
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-900 dark:text-white font-mono text-sm">
                                                    {note.number}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {dateStr}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                                                {note.items?.length || 0} voci
                                            </Badge>
                                            <Link href={`/movements/${note.id}`} onClick={e => e.stopPropagation()}>
                                                <ExternalLink className="h-4 w-4 text-slate-400 hover:text-violet-600" />
                                            </Link>
                                        </div>
                                    </div>
                                    {isExpanded && note.items && note.items.length > 0 && (
                                        <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                                            {note.pickupLocation && (
                                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Truck className="h-3 w-3" />
                                                    <span className="font-medium">Da:</span> {note.pickupLocation}
                                                </div>
                                            )}
                                            {note.deliveryLocation && (
                                                <div className="text-xs text-slate-500">
                                                    <span className="font-medium">A:</span> {note.deliveryLocation}
                                                </div>
                                            )}
                                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-1">
                                                Materiali
                                            </div>
                                            {note.items.map(item => (
                                                <div key={item.id} className="bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700 text-sm flex justify-between">
                                                    <div>
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            {item.inventoryName}
                                                        </span>
                                                        {item.inventoryModel && (
                                                            <span className="text-slate-400 ml-1">({item.inventoryModel})</span>
                                                        )}
                                                        <div className="text-xs font-mono text-slate-400">{item.inventoryCode}</div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        {item.kgEccedenza != null ? (
                                                            <div className="text-violet-600 dark:text-violet-400 font-bold">
                                                                {item.kgEccedenza} kg
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-700 dark:text-slate-300 font-bold">
                                                                {item.quantity} {item.inventoryUnit}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            )
                        })}
                    </div>

                    {/* Desktop View */}
                    <Card className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>N° Bolla</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Causale</TableHead>
                                    <TableHead>Partenza</TableHead>
                                    <TableHead>Destinazione</TableHead>
                                    <TableHead className="text-right">Voci</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {notes.map(note => {
                                    const isExpanded = expandedId === note.id
                                    const dateStr = note.date
                                        ? format(new Date(note.date.split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy', { locale: it })
                                        : '-'
                                    return (
                                        <>
                                            <TableRow
                                                key={note.id}
                                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                                onClick={() => toggleExpand(note.id)}
                                            >
                                                <TableCell className="w-8 p-2">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                        {isExpanded
                                                            ? <ChevronDown className="h-4 w-4 text-slate-500" />
                                                            : <ChevronRight className="h-4 w-4 text-slate-500" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-mono font-medium text-slate-900 dark:text-white">
                                                    {note.number}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                    {dateStr}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                                    {note.causal || '-'}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-500 max-w-[180px] truncate">
                                                    {note.pickupLocation || '-'}
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-500 max-w-[180px] truncate">
                                                    {note.deliveryLocation || '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge className="bg-violet-100 text-violet-700 border-violet-200">
                                                        {note.items?.length || 0}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/movements/${note.id}`} onClick={e => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 p-0">
                                                            <ExternalLink className="h-3.5 w-3.5 text-slate-400 hover:text-violet-600" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>

                                            {/* Expanded: righe materiali */}
                                            {isExpanded && note.items && note.items.map(item => (
                                                <TableRow key={`${note.id}-${item.id}`} className="bg-violet-50/40 dark:bg-violet-900/10">
                                                    <TableCell></TableCell>
                                                    <TableCell colSpan={2} className="text-sm pl-8">
                                                        <div className="flex items-center gap-2 text-slate-400">
                                                            <span>└─</span>
                                                            <span className="font-mono text-xs text-slate-400">{item.inventoryCode}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell colSpan={3} className="text-sm">
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            {item.inventoryName}
                                                        </span>
                                                        {item.inventoryModel && (
                                                            <span className="text-slate-400 ml-1 font-normal">({item.inventoryModel})</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {item.kgEccedenza != null ? (
                                                            <div className="font-bold text-violet-600 dark:text-violet-400">
                                                                {item.kgEccedenza} kg
                                                            </div>
                                                        ) : (
                                                            <div className="font-bold text-slate-700 dark:text-slate-300">
                                                                {item.quantity} {item.inventoryUnit}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell></TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </>
            )}
        </div>
    )
}
