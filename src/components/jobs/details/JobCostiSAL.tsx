"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Tag, X, Clock, ChevronDown, ChevronRight, PlusCircle, Settings, Users, Package, Euro, ReceiptText } from "lucide-react"
import { purchasesApi, attendanceApi, correctionsApi, Movement, Purchase } from "@/lib/api"
import { salApi, salCostsApi, SalItem, SalCost, WorkerHoursSalData } from "@/lib/services/sal"
import { notify } from "@/lib/notify"

interface JobCostiSALProps {
    jobId: string
    materialCost: number
    movements: Movement[]
}

interface SalRow {
    id: string
    type: 'movement' | 'purchase'
    date: string
    description: string
    detail?: string
    pieces?: number   // signed: positive = uscita, negative = reso
    unit?: string
    amount: number
    salNames: string[]
}

interface WorkerCostRow {
    workerId: string
    workerName: string
    normalHours: number
    transferHours: number
    normalCost: number
    trasfertaCost: number
    total: number
}

// ─── Collapsible section wrapper ────────────────────────────────────────────
function Section({
    icon, title, total, expanded, onToggle, badge, actions, children,
}: {
    icon: React.ReactNode
    title: string
    total?: number
    expanded: boolean
    onToggle: () => void
    badge?: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
}) {
    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })
    return (
        <Card>
            <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={onToggle}
            >
                <div className="text-blue-600">{icon}</div>
                <div className="flex-1 font-semibold text-slate-800 dark:text-slate-100">{title}</div>
                {badge}
                {total !== undefined && (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 ml-auto mr-2">
                        € {fmt(total)}
                    </span>
                )}
                {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
                {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
            </div>
            {expanded && (
                <CardContent className="pt-0 pb-4 px-4">
                    {children}
                </CardContent>
            )}
        </Card>
    )
}

// ─── Worker hours cross-table ────────────────────────────────────────────────
function WorkerHoursTable({ data }: { data: WorkerHoursSalData }) {
    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })
    const allDates = [...new Set(data.workers.flatMap(w => w.days.map(d => d.date)))].sort()
    if (data.workers.length === 0) {
        return <p className="text-sm text-slate-400 text-center py-4">Nessuna presenza nel periodo.</p>
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
                                            <span>{total}h{day && day.transferHours > 0 ? <span className="text-slate-400"> (T)</span> : null}</span>
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
                        <td colSpan={data.workers.length} className="text-right p-2 font-bold">€ {fmt(data.grandTotal)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}

// ─── Main component ──────────────────────────────────────────────────────────
export function JobCostiSAL({ jobId, movements }: JobCostiSALProps) {
    // ── Data ──────────────────────────────────────────────────────────────────
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [salItems, setSalItems] = useState<SalItem[]>([])
    const [salCosts, setSalCosts] = useState<SalCost[]>([])
    const [workerCosts, setWorkerCosts] = useState<WorkerCostRow[]>([])
    const [loading, setLoading] = useState(true)

    // ── Layout ────────────────────────────────────────────────────────────────
    const [expanded, setExpanded] = useState({ materiali: true, ore: true, altri: true, totali: true })
    const toggle = (k: keyof typeof expanded) => setExpanded(p => ({ ...p, [k]: !p[k] }))

    // ── SAL filter ────────────────────────────────────────────────────────────
    const [activeFilter, setActiveFilter] = useState<'all' | string>('all')

    // ── Materials section ─────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isAddSalOpen, setIsAddSalOpen] = useState(false)
    const [addSalName, setAddSalName] = useState('')
    const [addSalMode, setAddSalMode] = useState<'new' | 'existing'>('new')
    const [isSaving, setIsSaving] = useState(false)

    // ── Worker hours section ──────────────────────────────────────────────────
    const [isWorkerHoursOpen, setIsWorkerHoursOpen] = useState(false)
    const [whDateFrom, setWhDateFrom] = useState('')
    const [whDateTo, setWhDateTo] = useState('')
    const [whSalName, setWhSalName] = useState('')
    const [whPreview, setWhPreview] = useState<WorkerHoursSalData | null>(null)
    const [whLoading, setWhLoading] = useState(false)
    const [whSaving, setWhSaving] = useState(false)
    const [whDateHint, setWhDateHint] = useState<{ first: string | null; last: string | null } | null>(null)
    const [viewingWH, setViewingWH] = useState<WorkerHoursSalData | null>(null)
    const [viewingWHTitle, setViewingWHTitle] = useState('')

    // ── Other costs section ───────────────────────────────────────────────────
    const [isAddCostOpen, setIsAddCostOpen] = useState(false)
    const [newCostDesc, setNewCostDesc] = useState('')
    const [newCostAmount, setNewCostAmount] = useState('')
    const [newCostSal, setNewCostSal] = useState('__none__')
    const [costSaving, setCostSaving] = useState(false)
    const [editingCostSal, setEditingCostSal] = useState<string | null>(null)
    const [editCostSalValue, setEditCostSalValue] = useState('')

    // ── Manage SAL dialog ─────────────────────────────────────────────────────
    const [isManageSalOpen, setIsManageSalOpen] = useState(false)
    const [editingNames, setEditingNames] = useState<Record<string, string>>({})
    const [manageSaving, setManageSaving] = useState<string | null>(null)

    // ── Load data ──────────────────────────────────────────────────────────────
    const loadData = async () => {
        try {
            setLoading(true)
            const [purData, salData, costData, wcData] = await Promise.all([
                purchasesApi.getByJobId(jobId),
                salApi.getByJobId(jobId),
                salCostsApi.getByJobId(jobId),
                attendanceApi.getWorkerCostsByJobId(jobId),
            ])
            setPurchases(purData)
            setSalItems(salData)
            setSalCosts(costData)
            setWorkerCosts(wcData.rows)
        } catch (e) {
            console.error('Failed to load SAL data', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [jobId])

    // ── Derived: SAL names ─────────────────────────────────────────────────────
    const salNames = useMemo(() => {
        const names = [...new Set(salItems.map(s => s.salName))].sort()
        return names
    }, [salItems])

    // ── Derived: tag map (itemType:itemId → salNames[]) ───────────────────────
    const salTagMap = useMemo(() => {
        const map = new Map<string, string[]>()
        salItems.filter(s => s.itemType !== 'worker_hours' && s.itemId).forEach(s => {
            const key = `${s.itemType}:${s.itemId}`
            const existing = map.get(key) || []
            if (!existing.includes(s.salName)) map.set(key, [...existing, s.salName])
        })
        return map
    }, [salItems])

    // ── Derived: all material rows ────────────────────────────────────────────
    const allMaterialRows: SalRow[] = useMemo(() => {
        const rows: SalRow[] = []
        movements.forEach(m => {
            const movType = m.type === 'exit' ? 'Uscita' : m.type === 'entry' ? 'Rientro' : m.type
            const sign = m.type === 'entry' ? -1 : 1
            const itemLabel = [m.itemName, m.itemModel].filter(Boolean).join(' — ')
            rows.push({
                id: m.id,
                type: 'movement',
                date: m.date,
                description: m.reference ? `${movType} — Bolla ${m.reference}` : movType,
                detail: itemLabel || undefined,
                // pieces: already quantity×coefficient in stock_movements_view (negative for exits)
                pieces: sign * Math.abs(m.pieces ?? (Math.abs(m.quantity || 0) * (m.coefficient || 1))),
                unit: m.itemUnit,
                amount: sign * Math.abs(m.quantity || 0) * (m.itemPrice || 0),
                salNames: salTagMap.get(`movement:${m.id}`) || [],
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
            })
        })
        return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [movements, purchases, salTagMap])

    // ── Derived: filtered material rows ──────────────────────────────────────
    const filteredMaterialRows = useMemo(() => {
        if (activeFilter === 'all') return allMaterialRows
        return allMaterialRows.filter(r => r.salNames.includes(activeFilter))
    }, [allMaterialRows, activeFilter])

    // ── Derived: filtered worker rows ─────────────────────────────────────────
    const filteredWorkerRows = useMemo(() => {
        if (activeFilter === 'all') return workerCosts
        // Aggregate from worker_hours SAL items for this SAL
        const whItems = salItems.filter(s => s.itemType === 'worker_hours' && s.salName === activeFilter)
        const wMap = new Map<string, WorkerCostRow>()
        for (const item of whItems) {
            if (!item.workerHoursData) continue
            for (const w of item.workerHoursData.workers) {
                if (!wMap.has(w.workerId)) {
                    wMap.set(w.workerId, {
                        workerId: w.workerId,
                        workerName: w.workerName,
                        normalHours: 0,
                        transferHours: 0,
                        normalCost: 0,
                        trasfertaCost: 0,
                        total: 0,
                    })
                }
                const e = wMap.get(w.workerId)!
                e.normalHours += w.totalNormal
                e.transferHours += w.totalTransfer
                e.normalCost += w.totalNormal * w.hourlyRate
                e.trasfertaCost += w.totalTransfer * w.trasfertaRate
                e.total += w.totalCost
            }
        }
        return Array.from(wMap.values()).sort((a, b) => b.total - a.total)
    }, [workerCosts, salItems, activeFilter])

    // ── Derived: filtered other costs ─────────────────────────────────────────
    const filteredCosts = useMemo(() => {
        if (activeFilter === 'all') return salCosts
        return salCosts.filter(c => c.salName === activeFilter)
    }, [salCosts, activeFilter])

    // ── Derived: totals ───────────────────────────────────────────────────────
    const materialTotal = useMemo(
        () => filteredMaterialRows.reduce((s, r) => s + r.amount, 0),
        [filteredMaterialRows]
    )
    const workerTotal = useMemo(
        () => filteredWorkerRows.reduce((s, r) => s + r.total, 0),
        [filteredWorkerRows]
    )
    const otherCostsTotal = useMemo(
        () => filteredCosts.reduce((s, c) => s + c.amount, 0),
        [filteredCosts]
    )
    const grandTotal = materialTotal + workerTotal + otherCostsTotal

    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })

    // ── Materials: toggle selection ───────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const toggleSelectAll = () => {
        setSelectedIds(selectedIds.size === filteredMaterialRows.length
            ? new Set()
            : new Set(filteredMaterialRows.map(r => r.id)))
    }

    // ── Materials: add to SAL ─────────────────────────────────────────────────
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
            const items = allMaterialRows.filter(r => selectedIds.has(r.id)).map(r => ({ itemType: r.type, itemId: r.id }))
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

    // ── Worker hours: load preview ─────────────────────────────────────────────
    const handleLoadWHPreview = async () => {
        if (!whDateFrom || !whDateTo) return
        try {
            setWhLoading(true)
            const [attData, corrData] = await Promise.all([
                attendanceApi.getByJobIdAndDateRange(jobId, whDateFrom, whDateTo),
                correctionsApi.getByJobIdAndDateRange(jobId, whDateFrom, whDateTo),
            ])
            const wMap = new Map<string, { workerName: string; hourlyRate: number; trasfertaRate: number; dayMap: Map<string, { normal: number; transfer: number }> }>()
            attData.filter(a => a.status === 'presence' || a.status === 'transfer').forEach(a => {
                if (!a.workerId) return
                if (!wMap.has(a.workerId)) {
                    wMap.set(a.workerId, { workerName: a.workerName || a.workerId, hourlyRate: a.hourlyRate ?? 25, trasfertaRate: a.trasfertaRate ?? 50, dayMap: new Map() })
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
                const days = Array.from(e.dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, h]) => ({ date, normalHours: h.normal, transferHours: h.transfer }))
                const totalNormal = days.reduce((s, d) => s + d.normalHours, 0)
                const totalTransfer = days.reduce((s, d) => s + d.transferHours, 0)
                const totalCost = totalNormal * e.hourlyRate + totalTransfer * e.trasfertaRate
                grandTotal += totalCost
                return { workerId, workerName: e.workerName, days, totalNormal, totalTransfer, hourlyRate: e.hourlyRate, trasfertaRate: e.trasfertaRate, totalCost }
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
            setWhPreview(null); setWhDateFrom(''); setWhDateTo(''); setWhSalName('')
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
        setWhDateFrom(''); setWhDateTo('')
        setWhSalName(activeFilter !== 'all' ? activeFilter : (salNames[0] || ''))
        setWhPreview(null); setWhDateHint(null)
        setIsWorkerHoursOpen(true)
        try {
            const range = await attendanceApi.getJobPresenceDateRange(jobId)
            setWhDateHint(range)
        } catch { /* non bloccante */ }
    }

    // ── Worker: click row to view hours ───────────────────────────────────────
    const handleViewWorkerDetail = (row: WorkerCostRow) => {
        if (activeFilter !== 'all') {
            // Build WorkerHoursSalData for this specific worker from salItems
            const whItems = salItems.filter(s => s.itemType === 'worker_hours' && s.salName === activeFilter)
            const allDays: WorkerHoursSalData['workers'][0]['days'] = []
            let totalNormal = 0, totalTransfer = 0, totalCost = 0
            let hourlyRate = 25, trasfertaRate = 50
            for (const item of whItems) {
                const w = item.workerHoursData?.workers.find(w => w.workerId === row.workerId)
                if (!w) continue
                allDays.push(...w.days)
                totalNormal += w.totalNormal
                totalTransfer += w.totalTransfer
                totalCost += w.totalCost
                hourlyRate = w.hourlyRate
                trasfertaRate = w.trasfertaRate
            }
            setViewingWH({
                dateFrom: whItems[0]?.dateFrom || '',
                dateTo: whItems[whItems.length - 1]?.dateTo || '',
                workers: [{ workerId: row.workerId, workerName: row.workerName, days: allDays.sort((a, b) => a.date.localeCompare(b.date)), totalNormal, totalTransfer, hourlyRate, trasfertaRate, totalCost }],
                grandTotal: totalCost,
            })
        } else {
            // Build a simple summary view from workerCosts data (no daily breakdown)
            setViewingWH({
                dateFrom: '', dateTo: '',
                workers: [{
                    workerId: row.workerId,
                    workerName: row.workerName,
                    days: [],
                    totalNormal: row.normalHours,
                    totalTransfer: row.transferHours,
                    hourlyRate: row.normalHours > 0 ? row.normalCost / row.normalHours : 0,
                    trasfertaRate: row.transferHours > 0 ? row.trasfertaCost / row.transferHours : 0,
                    totalCost: row.total,
                }],
                grandTotal: row.total,
            })
        }
        setViewingWHTitle(row.workerName)
    }

    // ── Other costs: add ──────────────────────────────────────────────────────
    const handleAddCost = async () => {
        const desc = newCostDesc.trim()
        const amount = parseFloat(newCostAmount.replace(',', '.'))
        if (!desc || isNaN(amount)) return
        try {
            setCostSaving(true)
            const salNameVal = newCostSal === '__none__' ? null : newCostSal
            await salCostsApi.add(jobId, desc, amount, salNameVal)
            setIsAddCostOpen(false)
            setNewCostDesc(''); setNewCostAmount(''); setNewCostSal('__none__')
            await loadData()
            notify.success("Costo aggiunto")
        } catch (e) {
            console.error(e)
            notify.error("Errore durante il salvataggio del costo")
        } finally {
            setCostSaving(false)
        }
    }
    const handleUpdateCostSal = async (costId: string, salName: string | null) => {
        try {
            await salCostsApi.updateSal(costId, salName)
            setEditingCostSal(null)
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'aggiornamento del SAL")
        }
    }
    const handleDeleteCost = async (costId: string) => {
        try {
            await salCostsApi.delete(costId)
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'eliminazione del costo")
        }
    }

    // ── Manage SAL ────────────────────────────────────────────────────────────
    const handleRenameSal = async (oldName: string) => {
        const newName = (editingNames[oldName] || '').trim()
        if (!newName || newName === oldName) return
        try {
            setManageSaving(oldName)
            await salApi.renameSal(jobId, oldName, newName)
            await salCostsApi.renameSalInCosts(jobId, oldName, newName)
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

    // ─────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    )

    return (
        <div className="space-y-4">

            {/* ── SAL filter bar ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 mr-1">SAL:</span>
                <Button
                    key="all"
                    variant={activeFilter === 'all' ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setActiveFilter('all'); setSelectedIds(new Set()) }}
                    className={activeFilter === 'all' ? "bg-blue-600" : ""}
                >
                    Tutti
                </Button>
                {salNames.map(f => (
                    <Button
                        key={f}
                        variant={activeFilter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setActiveFilter(f); setSelectedIds(new Set()) }}
                        className={activeFilter === f ? "bg-blue-600" : ""}
                    >
                        {f}
                    </Button>
                ))}
                {salNames.length > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-slate-700 ml-auto"
                        onClick={() => {
                            setEditingNames(Object.fromEntries(salNames.map(n => [n, n])))
                            setIsManageSalOpen(true)
                        }}
                    >
                        <Settings className="h-4 w-4 mr-1" />
                        Gestisci SAL
                    </Button>
                )}
            </div>

            {/* ── 1. Materiali ──────────────────────────────────────────── */}
            <Section
                icon={<Package className="h-5 w-5" />}
                title="Materiali"
                total={materialTotal}
                expanded={expanded.materiali}
                onToggle={() => toggle('materiali')}
                actions={
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleOpenAddSal}
                            disabled={selectedIds.size === 0}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 h-8 text-xs"
                        >
                            <Tag className="h-3.5 w-3.5 mr-1" />
                            Aggiungi al SAL
                            {selectedIds.size > 0 && <span className="ml-1 opacity-80">({selectedIds.size})</span>}
                        </Button>
                    </div>
                }
            >
                {filteredMaterialRows.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">
                        {activeFilter === 'all' ? 'Nessun materiale trovato.' : `Nessun materiale per il SAL "${activeFilter}".`}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                    <th className="p-2 w-8">
                                        <Checkbox
                                            checked={filteredMaterialRows.length > 0 && selectedIds.size === filteredMaterialRows.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="text-left p-2 font-medium text-slate-500">Data</th>
                                    <th className="text-left p-2 font-medium text-slate-500">Tipo</th>
                                    <th className="text-left p-2 font-medium text-slate-500">Descrizione</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Pezzi</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Importo</th>
                                    <th className="text-left p-2 font-medium text-slate-500">SAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMaterialRows.map(row => (
                                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-2">
                                            <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
                                        </td>
                                        <td className="p-2 text-slate-500 whitespace-nowrap">
                                            {new Date(row.date).toLocaleDateString('it-IT')}
                                        </td>
                                        <td className="p-2">
                                            <Badge variant="outline" className={row.type === 'purchase' ? 'border-purple-300 text-purple-700' : 'border-blue-300 text-blue-700'}>
                                                {row.type === 'purchase' ? 'Acquisto' : 'Movimento'}
                                            </Badge>
                                        </td>
                                        <td className="p-2">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{row.description}</div>
                                            {row.detail && <div className="text-xs text-slate-400">{row.detail}</div>}
                                        </td>
                                        <td className={`p-2 text-right font-mono whitespace-nowrap ${row.pieces !== undefined && row.pieces < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                            {row.pieces !== undefined
                                                ? `${row.pieces > 0 ? '' : ''}${row.pieces.toLocaleString('it-IT', { maximumFractionDigits: 3 })}${row.unit ? ' ' + row.unit : ''}`
                                                : '—'}
                                        </td>
                                        <td className={`p-2 text-right font-mono ${row.amount < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {row.amount !== 0 ? `€ ${fmt(row.amount)}` : '—'}
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-wrap gap-1">
                                                {row.salNames.map(name => (
                                                    <span key={name} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1.5 py-0.5">
                                                        {name}
                                                        <button onClick={() => handleRemoveFromSal(row, name)} className="hover:text-red-500">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-800/50 font-semibold text-sm">
                                    <td colSpan={4} className="p-2 text-slate-600">Totale</td>
                                    <td className={`p-2 text-right font-mono ${filteredMaterialRows.filter(r => r.pieces !== undefined).reduce((s, r) => s + (r.pieces ?? 0), 0) < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                        {filteredMaterialRows.some(r => r.pieces !== undefined)
                                            ? `${filteredMaterialRows.filter(r => r.pieces !== undefined).reduce((s, r) => s + (r.pieces ?? 0), 0).toLocaleString('it-IT', { maximumFractionDigits: 3 })}`
                                            : '—'}
                                    </td>
                                    <td className={`p-2 text-right font-mono ${materialTotal < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                        € {fmt(materialTotal)}
                                    </td>
                                    <td className="p-2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </Section>

            {/* ── 2. Ore Operai ─────────────────────────────────────────── */}
            <Section
                icon={<Users className="h-5 w-5" />}
                title="Ore Operai"
                total={workerTotal}
                expanded={expanded.ore}
                onToggle={() => toggle('ore')}
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenWorkerHours}
                        className="h-8 text-xs"
                    >
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Aggiungi al SAL
                    </Button>
                }
            >
                {filteredWorkerRows.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">
                        {activeFilter === 'all' ? 'Nessuna presenza registrata.' : `Nessuna ore operai per il SAL "${activeFilter}".`}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                    <th className="text-left p-2 font-medium text-slate-500">Operaio</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Ore Norm.</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Ore Trasf.</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Costo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWorkerRows.map(row => (
                                    <tr
                                        key={row.workerId}
                                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
                                        onClick={() => handleViewWorkerDetail(row)}
                                    >
                                        <td className="p-2 font-medium text-slate-800 dark:text-slate-200 capitalize">{row.workerName}</td>
                                        <td className="p-2 text-right text-slate-600">{row.normalHours.toFixed(1)}h</td>
                                        <td className="p-2 text-right text-slate-600">{row.transferHours.toFixed(1)}h</td>
                                        <td className="p-2 text-right font-medium">€ {fmt(row.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Saved worker_hours SAL entries (always shown, not filtered by activeFilter) */}
                {salItems.filter(s => s.itemType === 'worker_hours').length > 0 && activeFilter === 'all' && (
                    <div className="mt-4 border-t pt-3">
                        <p className="text-xs text-slate-500 mb-2">Registrazioni SAL salvate:</p>
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
                                {salItems.filter(s => s.itemType === 'worker_hours').map(item => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                        onClick={() => item.workerHoursData && (setViewingWH(item.workerHoursData), setViewingWHTitle(`${item.salName} — Ore Operai`))}
                                    >
                                        <td className="p-2">
                                            <span className="text-xs bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">{item.salName}</span>
                                        </td>
                                        <td className="p-2 text-slate-500">
                                            {item.dateFrom && item.dateTo ? `${new Date(item.dateFrom).toLocaleDateString('it-IT')} – ${new Date(item.dateTo).toLocaleDateString('it-IT')}` : '—'}
                                        </td>
                                        <td className="p-2 text-right font-medium">
                                            {item.workerHoursData ? `€ ${fmt(item.workerHoursData.grandTotal)}` : '—'}
                                        </td>
                                        <td className="p-2">
                                            <button onClick={e => { e.stopPropagation(); salApi.deleteItem(item.id).then(loadData) }} className="text-slate-300 hover:text-red-500">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            {/* ── 3. Altri Costi ────────────────────────────────────────── */}
            <Section
                icon={<ReceiptText className="h-5 w-5" />}
                title="Altri Costi"
                total={otherCostsTotal}
                expanded={expanded.altri}
                onToggle={() => toggle('altri')}
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setNewCostDesc(''); setNewCostAmount('')
                            setNewCostSal(activeFilter !== 'all' ? activeFilter : '__none__')
                            setIsAddCostOpen(true)
                        }}
                        className="h-8 text-xs"
                    >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        Aggiungi Costo
                    </Button>
                }
            >
                {filteredCosts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">
                        {activeFilter === 'all' ? 'Nessun costo aggiuntivo.' : `Nessun costo per il SAL "${activeFilter}".`}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                    <th className="text-left p-2 font-medium text-slate-500">Descrizione</th>
                                    <th className="text-left p-2 font-medium text-slate-500">SAL</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Importo</th>
                                    <th className="w-8 p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCosts.map(cost => (
                                    <tr key={cost.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                        <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{cost.description}</td>
                                        <td className="p-2">
                                            {editingCostSal === cost.id ? (
                                                <div className="flex items-center gap-1">
                                                    <Select value={editCostSalValue} onValueChange={setEditCostSalValue}>
                                                        <SelectTrigger className="h-7 text-xs w-32">
                                                            <SelectValue placeholder="Nessun SAL" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">Nessun SAL</SelectItem>
                                                            {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleUpdateCostSal(cost.id, editCostSalValue === '__none__' ? null : editCostSalValue)}>OK</Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs px-1" onClick={() => setEditingCostSal(null)}>✕</Button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="text-xs rounded px-1.5 py-0.5 hover:bg-slate-100"
                                                    onClick={() => { setEditingCostSal(cost.id); setEditCostSalValue(cost.salName || '__none__') }}
                                                    title="Clicca per cambiare SAL"
                                                >
                                                    {cost.salName
                                                        ? <span className="bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">{cost.salName}</span>
                                                        : <span className="text-slate-400 italic">—</span>}
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-2 text-right font-mono font-medium">€ {fmt(cost.amount)}</td>
                                        <td className="p-2">
                                            <button onClick={() => handleDeleteCost(cost.id)} className="text-slate-300 hover:text-red-500">
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>

            {/* ── 4. Totali ──────────────────────────────────────────────── */}
            <Section
                icon={<Euro className="h-5 w-5" />}
                title={activeFilter === 'all' ? 'Totali' : `Totali — ${activeFilter}`}
                expanded={expanded.totali}
                onToggle={() => toggle('totali')}
            >
                <table className="w-full text-sm">
                    <tbody>
                        <tr className="border-b border-slate-100">
                            <td className="py-2 text-slate-600 flex items-center gap-2">
                                <Package className="h-4 w-4 text-slate-400" /> Materiali
                            </td>
                            <td className="py-2 text-right font-mono">€ {fmt(materialTotal)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-2 text-slate-600 flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-400" /> Ore Operai
                            </td>
                            <td className="py-2 text-right font-mono">€ {fmt(workerTotal)}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-2 text-slate-600 flex items-center gap-2">
                                <ReceiptText className="h-4 w-4 text-slate-400" /> Altri Costi
                            </td>
                            <td className="py-2 text-right font-mono">€ {fmt(otherCostsTotal)}</td>
                        </tr>
                        <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-800 dark:text-blue-200">
                            <td className="py-3 px-2 rounded-l flex items-center gap-2">
                                <Euro className="h-4 w-4" /> Totale Complessivo
                            </td>
                            <td className="py-3 px-2 text-right font-mono text-lg rounded-r">€ {fmt(grandTotal)}</td>
                        </tr>
                    </tbody>
                </table>
            </Section>

            {/* ── Dialogs ─────────────────────────────────────────────────── */}

            {/* Add to SAL */}
            <Dialog open={isAddSalOpen} onOpenChange={setIsAddSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aggiungi al SAL</DialogTitle>
                        <DialogDescription>Assegna le {selectedIds.size} voci selezionate a un SAL.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {salNames.length > 0 && (
                            <div className="flex gap-2">
                                <Button variant={addSalMode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setAddSalMode('existing')}>SAL esistente</Button>
                                <Button variant={addSalMode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setAddSalMode('new')}>Nuovo SAL</Button>
                            </div>
                        )}
                        {addSalMode === 'existing' && salNames.length > 0 ? (
                            <div className="space-y-2">
                                <Label>Seleziona SAL</Label>
                                <Select value={addSalName} onValueChange={setAddSalName}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona un SAL" /></SelectTrigger>
                                    <SelectContent>{salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Nome SAL</Label>
                                <Input placeholder="Es. SAL 1, SAL Luglio, ..." value={addSalName} onChange={e => setAddSalName(e.target.value)} />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddSalOpen(false)}>Annulla</Button>
                        <Button onClick={handleAddSal} disabled={!addSalName.trim() || isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Conferma
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Worker Hours */}
            <Dialog open={isWorkerHoursOpen} onOpenChange={setIsWorkerHoursOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Aggiungi Ore Operai al SAL</DialogTitle>
                        <DialogDescription>Seleziona il periodo e il SAL di riferimento, poi carica le presenze.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {whDateHint?.first && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded p-2">
                                <span>Prima presenza:</span>
                                <button className="font-semibold text-blue-600 hover:underline" onClick={() => { setWhDateFrom(whDateHint.first!); setWhPreview(null) }}>
                                    {new Date(whDateHint.first).toLocaleDateString('it-IT')}
                                </button>
                                <span className="mx-1">—</span>
                                <span>Ultima:</span>
                                <button className="font-semibold text-blue-600 hover:underline" onClick={() => { setWhDateTo(whDateHint.last!); setWhPreview(null) }}>
                                    {new Date(whDateHint.last!).toLocaleDateString('it-IT')}
                                </button>
                                <button className="ml-auto text-blue-600 hover:underline font-medium" onClick={() => { setWhDateFrom(whDateHint.first!); setWhDateTo(whDateHint.last!); setWhPreview(null) }}>
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
                            <div className="flex gap-2">
                                <Select value={whSalName} onValueChange={setWhSalName}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleziona o digita un SAL" /></SelectTrigger>
                                    <SelectContent>
                                        {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Nuovo nome SAL..."
                                    value={salNames.includes(whSalName) ? '' : whSalName}
                                    onChange={e => setWhSalName(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                        <Button onClick={handleLoadWHPreview} disabled={!whDateFrom || !whDateTo || whLoading} variant="outline">
                            {whLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Carica Presenze
                        </Button>
                        {whPreview && <WorkerHoursTable data={whPreview} />}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsWorkerHoursOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveWorkerHours} disabled={!whPreview || !whSalName.trim() || whSaving || whPreview.workers.length === 0}>
                            {whSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva nel SAL
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Worker Hours */}
            <Dialog open={!!viewingWH} onOpenChange={open => !open && setViewingWH(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{viewingWHTitle || 'Ore Operai'}</DialogTitle>
                        {viewingWH?.dateFrom && (
                            <DialogDescription>
                                {new Date(viewingWH.dateFrom).toLocaleDateString('it-IT')} – {new Date(viewingWH.dateTo).toLocaleDateString('it-IT')}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    {viewingWH && <WorkerHoursTable data={viewingWH} />}
                </DialogContent>
            </Dialog>

            {/* Add Cost */}
            <Dialog open={isAddCostOpen} onOpenChange={setIsAddCostOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aggiungi Costo</DialogTitle>
                        <DialogDescription>Aggiungi un costo aggiuntivo alla commessa.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Descrizione</Label>
                            <Input placeholder="Es. Noleggio ponteggio, Smaltimento, ..." value={newCostDesc} onChange={e => setNewCostDesc(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Importo (€)</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={newCostAmount} onChange={e => setNewCostAmount(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>SAL (opzionale)</Label>
                            <Select value={newCostSal} onValueChange={setNewCostSal}>
                                <SelectTrigger><SelectValue placeholder="Nessun SAL" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Nessun SAL</SelectItem>
                                    {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddCostOpen(false)}>Annulla</Button>
                        <Button onClick={handleAddCost} disabled={!newCostDesc.trim() || !newCostAmount || costSaving}>
                            {costSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Gestisci SAL */}
            <Dialog open={isManageSalOpen} onOpenChange={setIsManageSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gestisci SAL</DialogTitle>
                        <DialogDescription>Rinomina o elimina i SAL esistenti.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {salNames.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Nessun SAL creato.</p>
                        ) : salNames.map(name => (
                            <div key={name} className="flex items-center gap-2">
                                <Input
                                    value={editingNames[name] ?? name}
                                    onChange={e => setEditingNames(prev => ({ ...prev, [name]: e.target.value }))}
                                    className="flex-1"
                                />
                                <Button size="sm" variant="outline"
                                    disabled={manageSaving === name || (editingNames[name] || '').trim() === name || !(editingNames[name] || '').trim()}
                                    onClick={() => handleRenameSal(name)}
                                >
                                    {manageSaving === name ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rinomina'}
                                </Button>
                                <Button size="sm" variant="destructive" disabled={manageSaving === name} onClick={() => handleDeleteSal(name)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManageSalOpen(false)}>Chiudi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
