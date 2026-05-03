"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Users, Tag, ExternalLink, X, Clock } from "lucide-react"
import { purchasesApi, attendanceApi, correctionsApi, Movement, Purchase } from "@/lib/api"
import { salApi, SalItem, WorkerHoursSalData } from "@/lib/services/sal"
import { notify } from "@/lib/notify"

interface JobSALProps {
    jobId: string
    movements: Movement[]
}

interface SalRow {
    id: string
    type: 'movement' | 'purchase'
    date: string
    description: string
    detail?: string
    amount: number
    salNames: string[]
    url: string
}

export function JobSAL({ jobId, movements }: JobSALProps) {
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [salItems, setSalItems] = useState<SalItem[]>([])
    const [loading, setLoading] = useState(true)

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [activeFilter, setActiveFilter] = useState<'all' | 'none' | string>('all')

    const [isAddSalOpen, setIsAddSalOpen] = useState(false)
    const [addSalName, setAddSalName] = useState('')
    const [addSalMode, setAddSalMode] = useState<'new' | 'existing'>('new')
    const [isSaving, setIsSaving] = useState(false)

    const [isWorkerHoursOpen, setIsWorkerHoursOpen] = useState(false)
    const [whDateFrom, setWhDateFrom] = useState('')
    const [whDateTo, setWhDateTo] = useState('')
    const [whSalName, setWhSalName] = useState('')
    const [whPreview, setWhPreview] = useState<WorkerHoursSalData | null>(null)
    const [whLoading, setWhLoading] = useState(false)
    const [whSaving, setWhSaving] = useState(false)
    const [whDateHint, setWhDateHint] = useState<{ first: string | null; last: string | null } | null>(null)

    const [viewingWH, setViewingWH] = useState<WorkerHoursSalData | null>(null)

    const [isManageSalOpen, setIsManageSalOpen] = useState(false)
    const [editingNames, setEditingNames] = useState<Record<string, string>>({})
    const [manageSaving, setManageSaving] = useState<string | null>(null)

    const loadData = async () => {
        try {
            setLoading(true)
            const [purData, salData] = await Promise.all([
                purchasesApi.getByJobId(jobId),
                salApi.getByJobId(jobId),
            ])
            setPurchases(purData)
            setSalItems(salData)
        } catch (e) {
            console.error('Failed to load SAL data', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [jobId])

    const salTagMap = useMemo(() => {
        const map = new Map<string, string[]>()
        salItems.filter(s => s.itemType !== 'worker_hours' && s.itemId).forEach(s => {
            const key = `${s.itemType}:${s.itemId}`
            const existing = map.get(key) || []
            if (!existing.includes(s.salName)) map.set(key, [...existing, s.salName])
        })
        return map
    }, [salItems])

    const salNames = useMemo(() => {
        const names = [...new Set(salItems.map(s => s.salName))]
        return names.sort()
    }, [salItems])

    const workerHoursSalItems = useMemo(() =>
        salItems.filter(s => s.itemType === 'worker_hours'),
        [salItems]
    )

    const allRows: SalRow[] = useMemo(() => {
        const rows: SalRow[] = []

        movements.forEach(m => {
            const movType = m.type === 'exit' ? 'Uscita' : m.type === 'entry' ? 'Rientro' : m.type
            // Use Math.abs because stock_movements_view stores exit quantities as negative
            // Only 'entry' (rientro/reso) reduces job cost → negative
            const sign = m.type === 'entry' ? -1 : 1
            const itemLabel = [m.itemName, m.itemModel].filter(Boolean).join(' — ')
            rows.push({
                id: m.id,
                type: 'movement',
                date: m.date,
                description: m.reference ? `${movType} — Bolla ${m.reference}` : movType,
                detail: itemLabel || m.notes || undefined,
                amount: sign * Math.abs(m.quantity || 0) * (m.itemPrice || 0),
                salNames: salTagMap.get(`movement:${m.id}`) || [],
                url: `/jobs/${jobId}?tab=stock`,
            })
        })

        purchases.forEach(p => {
            rows.push({
                id: p.id,
                type: 'purchase',
                date: p.deliveryNoteDate || p.createdAt,
                description: `DDT ${p.deliveryNoteNumber || p.id.slice(0, 8)}`,
                detail: p.supplierName,
                amount: p.totalAmount || 0,
                salNames: salTagMap.get(`purchase:${p.id}`) || [],
                url: `/purchases/${p.id}`,
            })
        })

        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [movements, purchases, salTagMap, jobId])

    const filteredRows = useMemo(() => {
        if (activeFilter === 'all') return allRows
        if (activeFilter === 'none') return allRows.filter(r => r.salNames.length === 0)
        return allRows.filter(r => r.salNames.includes(activeFilter))
    }, [allRows, activeFilter])

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRows.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredRows.map(r => r.id)))
        }
    }

    const handleOpenAddSal = () => {
        setAddSalName('')
        setAddSalMode(salNames.length > 0 ? 'existing' : 'new')
        setIsAddSalOpen(true)
    }

    const handleAddSal = async () => {
        const name = addSalName.trim()
        if (!name) return
        try {
            setIsSaving(true)
            const items = allRows
                .filter(r => selectedIds.has(r.id))
                .map(r => ({ itemType: r.type, itemId: r.id }))
            await salApi.tagItems(jobId, name, items)
            setIsAddSalOpen(false)
            setSelectedIds(new Set())
            await loadData()
            notify.success(`${items.length} voci aggiunte al SAL "${name}"`)
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'aggiunta al SAL")
        } finally {
            setIsSaving(false)
        }
    }

    const handleRemoveFromSal = async (row: SalRow, salName: string) => {
        try {
            await salApi.deleteItemsByJobSalAndRef(jobId, salName, row.type, row.id)
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante la rimozione dal SAL")
        }
    }

    const handleLoadWHPreview = async () => {
        if (!whDateFrom || !whDateTo) return
        try {
            setWhLoading(true)
            const [attData, corrData] = await Promise.all([
                attendanceApi.getByJobIdAndDateRange(jobId, whDateFrom, whDateTo),
                correctionsApi.getByJobIdAndDateRange(jobId, whDateFrom, whDateTo),
            ])

            // Build per-worker map
            const wMap = new Map<string, {
                workerName: string
                hourlyRate: number
                trasfertaRate: number
                dayMap: Map<string, { normal: number; transfer: number }>
            }>()

            attData.filter(a => a.status === 'presence' || a.status === 'transfer').forEach(a => {
                if (!a.workerId) return
                if (!wMap.has(a.workerId)) {
                    wMap.set(a.workerId, {
                        workerName: a.workerName || a.workerId,
                        hourlyRate: a.hourlyRate ?? 25,
                        trasfertaRate: a.trasfertaRate ?? 50,
                        dayMap: new Map(),
                    })
                }
                const entry = wMap.get(a.workerId)!
                const day = entry.dayMap.get(a.date) || { normal: 0, transfer: 0 }
                if (a.status === 'transfer') day.transfer += a.hours
                else day.normal += a.hours
                entry.dayMap.set(a.date, day)
            })

            corrData.forEach(c => {
                if (!c.workerId || !wMap.has(c.workerId)) return
                const entry = wMap.get(c.workerId)!
                const day = entry.dayMap.get(c.date) || { normal: 0, transfer: 0 }
                day.normal = Math.max(0, day.normal + c.hoursDelta)
                entry.dayMap.set(c.date, day)
            })

            let grandTotal = 0
            const workers = Array.from(wMap.entries()).map(([workerId, e]) => {
                const days = Array.from(e.dayMap.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, h]) => ({ date, normalHours: h.normal, transferHours: h.transfer }))
                const totalNormal = days.reduce((s, d) => s + d.normalHours, 0)
                const totalTransfer = days.reduce((s, d) => s + d.transferHours, 0)
                const totalCost = totalNormal * e.hourlyRate + totalTransfer * e.trasfertaRate
                grandTotal += totalCost
                return {
                    workerId,
                    workerName: e.workerName,
                    days,
                    totalNormal,
                    totalTransfer,
                    hourlyRate: e.hourlyRate,
                    trasfertaRate: e.trasfertaRate,
                    totalCost,
                }
            })

            setWhPreview({ dateFrom: whDateFrom, dateTo: whDateTo, workers, grandTotal })
        } catch (e) {
            console.error(e)
            notify.error("Errore nel caricamento delle presenze")
        } finally {
            setWhLoading(false)
        }
    }

    const handleSaveWorkerHours = async () => {
        if (!whPreview || !whSalName.trim()) return
        try {
            setWhSaving(true)
            await salApi.addWorkerHours(jobId, whSalName.trim(), whPreview)
            setIsWorkerHoursOpen(false)
            setWhPreview(null)
            setWhDateFrom('')
            setWhDateTo('')
            setWhSalName('')
            await loadData()
            notify.success("Ore operai aggiunte al SAL")
        } catch (e) {
            console.error(e)
            notify.error("Errore durante il salvataggio delle ore operai")
        } finally {
            setWhSaving(false)
        }
    }

    const handleOpenWorkerHours = async () => {
        setWhDateFrom('')
        setWhDateTo('')
        setWhSalName(salNames[0] || '')
        setWhPreview(null)
        setWhDateHint(null)
        setIsWorkerHoursOpen(true)
        try {
            const range = await attendanceApi.getJobPresenceDateRange(jobId)
            setWhDateHint(range)
        } catch { /* non bloccante */ }
    }

    const handleRenameSal = async (oldName: string) => {
        const newName = (editingNames[oldName] || '').trim()
        if (!newName || newName === oldName) return
        try {
            setManageSaving(oldName)
            await salApi.renameSal(jobId, oldName, newName)
            await loadData()
            setEditingNames(prev => { const n = { ...prev }; delete n[oldName]; return n })
            if (activeFilter === oldName) setActiveFilter(newName)
        } catch (e) {
            console.error(e)
            notify.error("Errore durante la rinomina del SAL")
        } finally {
            setManageSaving(null)
        }
    }

    const handleDeleteSal = async (name: string) => {
        if (!confirm(`Eliminare il SAL "${name}" e tutte le sue voci?`)) return
        try {
            setManageSaving(name)
            await salApi.deleteSal(jobId, name)
            await loadData()
            if (activeFilter === name) setActiveFilter('all')
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'eliminazione del SAL")
        } finally {
            setManageSaving(null)
        }
    }

    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })

    if (loading) return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Filter tabs */}
            <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'none', ...salNames]).map(f => (
                    <Button
                        key={f}
                        variant={activeFilter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setActiveFilter(f); setSelectedIds(new Set()) }}
                        className={activeFilter === f ? "bg-blue-600" : ""}
                    >
                        {f === 'all' ? 'Tutti' : f === 'none' ? 'Senza SAL' : f}
                    </Button>
                ))}
            </div>

            {/* Actions bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm text-slate-500">
                    {filteredRows.length} voci
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        size="sm"
                        onClick={handleOpenAddSal}
                        disabled={selectedIds.size === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
                        title={selectedIds.size === 0 ? "Seleziona prima alcune voci" : ""}
                    >
                        <Tag className="h-4 w-4 mr-1" />
                        Aggiungi al SAL
                        {selectedIds.size > 0 && <span className="ml-1 text-xs opacity-80">({selectedIds.size})</span>}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenWorkerHours}
                        disabled={salNames.length === 0}
                        title={salNames.length === 0 ? "Crea prima un SAL aggiungendo voci materiali" : ""}
                    >
                        <Users className="h-4 w-4 mr-1" />
                        Ore operai al SAL
                    </Button>
                    {salNames.length > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setEditingNames(Object.fromEntries(salNames.map(n => [n, n])))
                                setIsManageSalOpen(true)
                            }}
                        >
                            Gestisci SAL
                        </Button>
                    )}
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                    <th className="p-3 w-8">
                                        <Checkbox
                                            checked={filteredRows.length > 0 && selectedIds.size === filteredRows.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Data</th>
                                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Tipo</th>
                                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Descrizione</th>
                                    <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">Importo</th>
                                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">SAL</th>
                                    <th className="w-8 p-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-slate-400">
                                            Nessuna voce trovata
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map(row => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                                            onClick={() => window.open(row.url, '_blank')}
                                        >
                                            <td className="p-3" onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedIds.has(row.id)}
                                                    onCheckedChange={() => toggleSelect(row.id)}
                                                />
                                            </td>
                                            <td className="p-3 text-slate-500 whitespace-nowrap">
                                                {new Date(row.date).toLocaleDateString('it-IT')}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant="outline" className={row.type === 'purchase' ? 'border-purple-300 text-purple-700' : 'border-blue-300 text-blue-700'}>
                                                    {row.type === 'purchase' ? 'Acquisto' : 'Movimento'}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium text-slate-800 dark:text-slate-200">{row.description}</div>
                                                {row.detail && <div className="text-xs text-slate-400">{row.detail}</div>}
                                            </td>
                                            <td className={`p-3 text-right font-mono ${row.amount < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {row.amount !== 0 ? `€ ${fmt(row.amount)}` : '—'}
                                            </td>
                                            <td className="p-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex flex-wrap gap-1">
                                                    {row.salNames.map(name => (
                                                        <span key={name} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1.5 py-0.5">
                                                            {name}
                                                            <button
                                                                onClick={() => handleRemoveFromSal(row, name)}
                                                                className="hover:text-red-500"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Worker hours SAL items */}
            {workerHoursSalItems.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-600" />
                            Ore Operai nel SAL
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-2 font-medium text-slate-500">SAL</th>
                                    <th className="text-left p-2 font-medium text-slate-500">Periodo</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Costo</th>
                                    <th className="w-8 p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {workerHoursSalItems.map(item => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => item.workerHoursData && setViewingWH(item.workerHoursData)}
                                    >
                                        <td className="p-2">
                                            <span className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">{item.salName}</span>
                                        </td>
                                        <td className="p-2 text-slate-500">
                                            {item.dateFrom && item.dateTo
                                                ? `${new Date(item.dateFrom).toLocaleDateString('it-IT')} – ${new Date(item.dateTo).toLocaleDateString('it-IT')}`
                                                : '—'}
                                        </td>
                                        <td className="p-2 text-right font-medium">
                                            {item.workerHoursData ? `€ ${fmt(item.workerHoursData.grandTotal)}` : '—'}
                                        </td>
                                        <td className="p-2">
                                            <button
                                                onClick={e => { e.stopPropagation(); salApi.deleteItem(item.id).then(loadData) }}
                                                className="text-slate-300 hover:text-red-500"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* Add SAL Dialog */}
            <Dialog open={isAddSalOpen} onOpenChange={setIsAddSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aggiungi al SAL</DialogTitle>
                        <DialogDescription>
                            Assegna le {selectedIds.size} voci selezionate a un SAL.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {salNames.length > 0 && (
                            <div className="flex gap-2">
                                <Button
                                    variant={addSalMode === 'existing' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAddSalMode('existing')}
                                >SAL esistente</Button>
                                <Button
                                    variant={addSalMode === 'new' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setAddSalMode('new')}
                                >Nuovo SAL</Button>
                            </div>
                        )}
                        {addSalMode === 'existing' && salNames.length > 0 ? (
                            <div className="space-y-2">
                                <Label>Seleziona SAL</Label>
                                <Select value={addSalName} onValueChange={setAddSalName}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona un SAL" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {salNames.map(n => (
                                            <SelectItem key={n} value={n}>{n}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Nome SAL</Label>
                                <Input
                                    placeholder="Es. SAL 1, SAL Luglio, ..."
                                    value={addSalName}
                                    onChange={e => setAddSalName(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddSalOpen(false)}>Annulla</Button>
                        <Button onClick={handleAddSal} disabled={!addSalName.trim() || isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Conferma
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Worker Hours Dialog */}
            <Dialog open={isWorkerHoursOpen} onOpenChange={setIsWorkerHoursOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Aggiungi Ore Operai al SAL</DialogTitle>
                        <DialogDescription>
                            Seleziona il periodo e il SAL di riferimento, poi carica le presenze.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {whDateHint?.first && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded p-2">
                                <span>Prima presenza registrata:</span>
                                <button
                                    className="font-semibold text-blue-600 hover:underline"
                                    onClick={() => { setWhDateFrom(whDateHint.first!); setWhPreview(null) }}
                                >
                                    {new Date(whDateHint.first).toLocaleDateString('it-IT')}
                                </button>
                                <span className="mx-1">—</span>
                                <span>Ultima:</span>
                                <button
                                    className="font-semibold text-blue-600 hover:underline"
                                    onClick={() => { setWhDateTo(whDateHint.last!); setWhPreview(null) }}
                                >
                                    {new Date(whDateHint.last!).toLocaleDateString('it-IT')}
                                </button>
                                <button
                                    className="ml-auto text-blue-600 hover:underline font-medium"
                                    onClick={() => { setWhDateFrom(whDateHint.first!); setWhDateTo(whDateHint.last!); setWhPreview(null) }}
                                >
                                    Usa entrambe
                                </button>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Data inizio</Label>
                                <Input type="date" value={whDateFrom} onChange={e => { setWhDateFrom(e.target.value); setWhPreview(null) }} />
                            </div>
                            <div className="space-y-2">
                                <Label>Data fine</Label>
                                <Input type="date" value={whDateTo} onChange={e => { setWhDateTo(e.target.value); setWhPreview(null) }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>SAL di destinazione</Label>
                            <Select value={whSalName} onValueChange={setWhSalName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona un SAL" />
                                </SelectTrigger>
                                <SelectContent>
                                    {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={handleLoadWHPreview}
                            disabled={!whDateFrom || !whDateTo || whLoading}
                            variant="outline"
                        >
                            {whLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Carica Presenze
                        </Button>

                        {whPreview && (
                            <div className="space-y-3">
                                <WorkerHoursTable data={whPreview} />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWorkerHoursOpen(false)}>Annulla</Button>
                        <Button
                            onClick={handleSaveWorkerHours}
                            disabled={!whPreview || !whSalName.trim() || whSaving || whPreview.workers.length === 0}
                        >
                            {whSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Salva nel SAL
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Gestisci SAL Dialog */}
            <Dialog open={isManageSalOpen} onOpenChange={setIsManageSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gestisci SAL</DialogTitle>
                        <DialogDescription>Rinomina o elimina i SAL esistenti.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {salNames.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Nessun SAL creato.</p>
                        ) : (
                            salNames.map(name => (
                                <div key={name} className="flex items-center gap-2">
                                    <Input
                                        value={editingNames[name] ?? name}
                                        onChange={e => setEditingNames(prev => ({ ...prev, [name]: e.target.value }))}
                                        className="flex-1"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={manageSaving === name || (editingNames[name] || '').trim() === name || !(editingNames[name] || '').trim()}
                                        onClick={() => handleRenameSal(name)}
                                    >
                                        {manageSaving === name ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rinomina'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={manageSaving === name}
                                        onClick={() => handleDeleteSal(name)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManageSalOpen(false)}>Chiudi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Worker Hours Dialog */}
            <Dialog open={!!viewingWH} onOpenChange={open => !open && setViewingWH(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Ore Operai</DialogTitle>
                        {viewingWH && (
                            <DialogDescription>
                                {new Date(viewingWH.dateFrom).toLocaleDateString('it-IT')} – {new Date(viewingWH.dateTo).toLocaleDateString('it-IT')}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    {viewingWH && <WorkerHoursTable data={viewingWH} readOnly />}
                </DialogContent>
            </Dialog>
        </div>
    )
}

function WorkerHoursTable({ data, readOnly = false }: { data: WorkerHoursSalData; readOnly?: boolean }) {
    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })

    const allDates = [...new Set(
        data.workers.flatMap(w => w.days.map(d => d.date))
    )].sort()

    if (data.workers.length === 0) {
        return <p className="text-sm text-slate-400 text-center py-4">Nessuna presenza nel periodo selezionato.</p>
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                        <th className="text-left p-2 border border-slate-200 dark:border-slate-700 font-semibold">Data</th>
                        {data.workers.map(w => (
                            <th key={w.workerId} className="text-center p-2 border border-slate-200 dark:border-slate-700 font-semibold capitalize">
                                {w.workerName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {allDates.map(date => (
                        <tr key={date} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2 border border-slate-200 dark:border-slate-700 text-slate-500 whitespace-nowrap">
                                {new Date(date).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </td>
                            {data.workers.map(w => {
                                const day = w.days.find(d => d.date === date)
                                const total = day ? day.normalHours + day.transferHours : 0
                                return (
                                    <td key={w.workerId} className="text-center p-2 border border-slate-200 dark:border-slate-700">
                                        {total > 0 ? (
                                            <div>
                                                <span>{total}h</span>
                                                {day && day.transferHours > 0 && (
                                                    <span className="text-slate-400 ml-1">(T)</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-200">—</span>
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                        <td className="p-2 border border-slate-200 dark:border-slate-700">Totale</td>
                        {data.workers.map(w => (
                            <td key={w.workerId} className="text-center p-2 border border-slate-200 dark:border-slate-700">
                                <div>{(w.totalNormal + w.totalTransfer).toFixed(1)}h</div>
                                <div className="text-slate-500 font-normal">€ {fmt(w.totalCost)}</div>
                            </td>
                        ))}
                    </tr>
                </tbody>
                <tfoot>
                    <tr className="bg-blue-600 text-white">
                        <td className="p-2 font-semibold">Totale Complessivo</td>
                        <td colSpan={data.workers.length} className="text-right p-2 font-bold">
                            € {fmt(data.grandTotal)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
