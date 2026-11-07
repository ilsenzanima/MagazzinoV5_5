"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Recycle, CalendarDays, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { deliveryNotesApi } from "@/lib/api"
import { DeliveryNote } from "@/lib/types"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"
import { NotchTabs, NotchActions, NotchStat } from "@/components/ui/notch-tabs"

interface JobEccedenzeProps {
    jobId: string
}

export function JobEccedenze({ jobId }: JobEccedenzeProps) {
    const [notes, setNotes] = useState<DeliveryNote[]>([])
    const [loading, setLoading] = useState(true)
    const [sortKey, setSortKey] = useState<'number' | 'date'>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (k: 'number' | 'date') => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc') }
    }
    const sorted = [...notes].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        return sortKey === 'number'
            ? dir * String(a.number).localeCompare(String(b.number), 'it', { numeric: true })
            : dir * String(a.date || '').localeCompare(String(b.date || ''))
    })
    const sortIcon = (k: 'number' | 'date') => sortKey === k
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />

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

    // Calcolo totale articoli trasportati (tutte le bolle)
    const totalItems = notes.reduce((sum, n) => sum + (n.items?.length || 0), 0)

    if (loading) {
        return (
            <NotchTabs title="Eccedenze">
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
                    <span className="ml-2 text-slate-500 text-sm">Caricamento eccedenze...</span>
                </div>
            </NotchTabs>
        )
    }

    return (
        <NotchTabs title="Eccedenze">
            <NotchActions>
                <NotchStat label="Trasporti" value={notes.length} />
                <NotchStat label="Voci totali" value={totalItems} />
            </NotchActions>
        <div className="space-y-4">
            {notes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <Recycle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Nessuna eccedenza registrata per questa commessa.</p>
                </div>
            ) : (
                <>
                    {/* Telefono: una scheda per trasporto */}
                    <div className="space-y-2 md:hidden">
                        {sorted.map(note => {
                            const dateStr = note.date ? format(new Date(note.date.split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy', { locale: it }) : '-'
                            return (
                                <Card key={note.id} className="px-3 py-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <Link href={`/movements/${note.id}`} className="flex items-center gap-1 font-mono text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                                            {note.number} <ExternalLink className="h-3 w-3" />
                                        </Link>
                                        <span className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3 w-3" />{dateStr}</span>
                                    </div>
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {(note.items || []).map(item => (
                                            <li key={item.id} className="flex justify-between gap-2">
                                                <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                                                    {item.inventoryName}{item.inventoryModel && <span className="text-slate-400"> ({item.inventoryModel})</span>}
                                                </span>
                                                <span className="shrink-0 font-semibold">{item.kgEccedenza != null ? `${item.kgEccedenza} kg` : `${item.quantity} ${item.inventoryUnit}`}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            )
                        })}
                    </div>

                    {/* Tabella: da tablet in su */}
                    <div className="hidden md:block">
                        <Table className="table-fixed border-collapse [&_td]:px-3 [&_th]:px-3">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className="w-40 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        <button type="button" onClick={() => toggleSort('number')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">N° bolla{sortIcon('number')}</button>
                                    </TableHead>
                                    <TableHead className="w-32 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                                        <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">Data{sortIcon('date')}</button>
                                    </TableHead>
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Dettagli</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.map(note => {
                                    const dateStr = note.date ? format(new Date(note.date.split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy', { locale: it }) : '-'
                                    return (
                                        <TableRow key={note.id}>
                                            <TableCell className="border-r py-3 align-top">
                                                <Link href={`/movements/${note.id}`} className="inline-flex items-center gap-1 font-mono font-medium text-blue-600 hover:underline dark:text-blue-400">
                                                    {note.number} <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            </TableCell>
                                            <TableCell className="border-r py-3 align-top text-sm text-slate-600 dark:text-slate-300">{dateStr}</TableCell>
                                            <TableCell className="py-3">
                                                <ul className="space-y-1 text-sm">
                                                    {(note.items || []).map(item => (
                                                        <li key={item.id} className="flex items-baseline justify-between gap-4">
                                                            <span className="min-w-0 text-slate-800 dark:text-slate-200">
                                                                <span className="mr-2 font-mono text-xs text-slate-400">{item.inventoryCode}</span>
                                                                <span className="font-medium">{item.inventoryName}</span>
                                                                {item.inventoryModel && <span className="ml-1 text-slate-500">({item.inventoryModel})</span>}
                                                            </span>
                                                            <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-300">
                                                                {item.kgEccedenza != null ? `${item.kgEccedenza} kg` : `${item.quantity} ${item.inventoryUnit}`}
                                                            </span>
                                                        </li>
                                                    ))}
                                                    {(!note.items || note.items.length === 0) && <li className="text-slate-400">—</li>}
                                                </ul>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
        </NotchTabs>
    )
}
