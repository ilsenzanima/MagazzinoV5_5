"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Loader2, Tag, X, Clock, ChevronDown, ChevronRight, PlusCircle, Settings, Users, Package, Euro, ReceiptText, Download, Paperclip, ExternalLink } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { purchasesApi, attendanceApi, correctionsApi, Movement, Purchase } from "@/lib/api"
import { salApi, salCostsApi, salNamesApi, SalItem, SalCost, WorkerHoursSalData } from "@/lib/services/sal"
import { costAnalysisApi, CostAnalysisRow } from "@/lib/services/cost-analysis"
import { createClient } from "@/lib/supabase/client"
import { notify } from "@/lib/notify"
import * as XLSX from "xlsx-js-style"

interface JobCostiSALProps {
    jobId: string
    jobCode?: string
    jobName?: string
    materialCost: number
    movements: Movement[]
}

type SalRowKind = 'exit' | 'entry' | 'ddt'

interface SalRow {
    id: string
    type: 'movement' | 'purchase'   // used for SAL tagging API
    kind: SalRowKind                 // used for badge display
    date: string
    description: string
    detail?: string
    pieces?: number   // signed: positive = uscita, negative = reso/rientro
    unit?: string
    amount: number
    salNames: string[]
    isFictitious?: boolean
    // For exit child rows: DDT/fornitore di provenienza del materiale
    purchaseId?: string
    purchaseRef?: string    // DDT number (e.g. "DDT-123")
    supplierName?: string
}

interface MaterialGroup {
    groupId: string
    kind: SalRowKind
    date: string
    description: string
    detail?: string
    totalAmount: number
    totalPieces?: number
    children: SalRow[]
    linkHref?: string    // internal route to navigate to (load-note or purchase); opens in same tab on mobile, new tab on desktop
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
export function JobCostiSAL({ jobId, jobCode, jobName, movements }: JobCostiSALProps) {
    const { isMobile } = useIsMobile()
    const supabase = createClient()
    // ── Data ──────────────────────────────────────────────────────────────────
    const [purchases, setPurchases] = useState<Purchase[]>([])
    const [salItems, setSalItems] = useState<SalItem[]>([])
    const [salCosts, setSalCosts] = useState<SalCost[]>([])
    const [workerCosts, setWorkerCosts] = useState<WorkerCostRow[]>([])
    const [salNamesData, setSalNamesData] = useState<string[]>([])
    const [analysisRows, setAnalysisRows] = useState<CostAnalysisRow[]>([])
    const [loading, setLoading] = useState(true)

    // ── Layout ────────────────────────────────────────────────────────────────
    const [expanded, setExpanded] = useState({ materiali: true, ore: true, altri: true, totali: true })
    const toggle = (k: keyof typeof expanded) => setExpanded(p => ({ ...p, [k]: !p[k] }))

    // ── SAL filter ────────────────────────────────────────────────────────────
    const [activeFilter, setActiveFilter] = useState<'all' | string>('all')

    // ── Materials section ─────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const toggleGroupExpanded = (groupId: string) => setExpandedGroups(prev => {
        const next = new Set(prev); next.has(groupId) ? next.delete(groupId) : next.add(groupId); return next
    })

    // ── Ore Operai section ────────────────────────────────────────────────────
    const [expandedWHItems, setExpandedWHItems] = useState<Set<string>>(new Set())
    const toggleWHExpanded = (id: string) => setExpandedWHItems(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
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
    const [newCostFiles, setNewCostFiles] = useState<File[]>([])
    const [costSaving, setCostSaving] = useState(false)
    const [editingCostSal, setEditingCostSal] = useState<string | null>(null)
    const [editCostSalValue, setEditCostSalValue] = useState('')
    const [uploadingCostId, setUploadingCostId] = useState<string | null>(null)

    // ── Manage SAL dialog ─────────────────────────────────────────────────────
    const [isManageSalOpen, setIsManageSalOpen] = useState(false)
    const [editingNames, setEditingNames] = useState<Record<string, string>>({})
    const [manageSaving, setManageSaving] = useState<string | null>(null)
    const [newSalInput, setNewSalInput] = useState('')
    const [newSalSaving, setNewSalSaving] = useState(false)

    // ── Load data ──────────────────────────────────────────────────────────────
    const loadData = async () => {
        try {
            setLoading(true)
            const [purData, salData, costData, wcData, namesData, analysisData] = await Promise.all([
                purchasesApi.getByJobId(jobId),
                salApi.getByJobId(jobId),
                salCostsApi.getByJobId(jobId),
                attendanceApi.getWorkerCostsByJobId(jobId),
                salNamesApi.getByJobId(jobId),
                costAnalysisApi.getByJobId(jobId),
            ])
            setPurchases(purData)
            setSalItems(salData)
            setSalCosts(costData)
            setWorkerCosts(wcData.rows)
            setSalNamesData(namesData)
            setAnalysisRows(analysisData)
        } catch (e) {
            console.error('Failed to load SAL data', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [jobId])

    // ── Derived: SAL names (union of items + standalone names) ────────────────
    const salNames = useMemo(() => {
        const fromItems = salItems.map(s => s.salName).filter((n): n is string => n !== null)
        const all = [...new Set([...salNamesData, ...fromItems])]
        return all.sort()
    }, [salItems, salNamesData])

    // ── Derived: unit price override from Analisi Costi (itemId → unitPrice) ────
    const analysisUnitPriceMap = useMemo(() => {
        const map = new Map<string, number>()
        for (const r of analysisRows) {
            if (r.itemId && r.unitPrice !== null) map.set(r.itemId, r.unitPrice)
        }
        return map
    }, [analysisRows])

    // ── Derived: tag map (itemType:itemId → salNames[]) ───────────────────────
    const salTagMap = useMemo(() => {
        const map = new Map<string, string[]>()
        salItems.filter(s => s.itemType !== 'worker_hours' && s.itemId && s.salName).forEach(s => {
            const key = `${s.itemType}:${s.itemId}`
            const existing = map.get(key) || []
            if (!existing.includes(s.salName!)) map.set(key, [...existing, s.salName!])
        })
        return map
    }, [salItems])

    // ── Derived: grouped material rows ───────────────────────────────────────
    const allMaterialGroups: MaterialGroup[] = useMemo(() => {
        const groups: MaterialGroup[] = []

        // ── 1. Exit / Entry movements grouped by delivery note ────────────────
        const movMap = new Map<string, { kind: SalRowKind; date: string; ref: string; deliveryNoteId?: string; children: SalRow[] }>()
        movements
            .filter(m => m.type === 'exit' || m.type === 'entry')
            .forEach(m => {
                const gk = m.deliveryNoteId || `ref:${m.reference}`
                const kind: SalRowKind = m.type === 'entry' ? 'entry' : 'exit'
                if (!movMap.has(gk)) movMap.set(gk, { kind, date: m.date, ref: m.reference, deliveryNoteId: m.deliveryNoteId, children: [] })
                const g = movMap.get(gk)!
                const sign = kind === 'entry' ? -1 : 1
                const rawPieces = m.pieces ?? (Math.abs(m.quantity || 0) * (m.coefficient || 1))
                g.children.push({
                    id: m.id, type: 'movement', kind,
                    date: m.date,
                    description: [m.itemName, m.itemModel].filter(Boolean).join(' — ') || m.itemCode || '—',
                    pieces: sign * Math.abs(rawPieces),
                    unit: m.itemUnit,
                    amount: sign * Math.abs(m.quantity || 0) * (analysisUnitPriceMap.get(m.itemId) ?? m.itemPrice ?? 0),
                    salNames: salTagMap.get(`movement:${m.id}`) || [],
                    isFictitious: m.isFictitious === true,
                    // For exit rows: provenance info from the original purchase
                    ...(kind === 'exit' && {
                        purchaseId: m.purchaseId,
                        purchaseRef: m.purchaseNumber,
                        supplierName: m.supplierName,
                    }),
                })
            })
        movMap.forEach((g, gk) => {
            const isRealNote = !gk.startsWith('ref:')
            groups.push({
                groupId: gk,
                kind: g.kind,
                date: g.date,
                description: `Bolla ${g.ref}`,
                totalAmount: g.children.reduce((s, c) => s + c.amount, 0),
                totalPieces: g.children.reduce((s, c) => s + (c.pieces ?? 0), 0),
                children: g.children,
                linkHref: isRealNote ? `/movements/${gk}` : undefined,
            })
        })

        // ── 2. DDT (purchases) with individual items from stock_movements_view ─
        purchases.forEach(p => {
            const items = movements.filter(m => m.type === 'purchase' && m.purchaseId === p.id)
            const children: SalRow[] = items.map(m => ({
                id: m.id, type: 'movement' as const, kind: 'ddt' as SalRowKind,
                date: m.date,
                description: [m.itemName, m.itemModel].filter(Boolean).join(' — ') || m.itemCode || '—',
                pieces: m.pieces ?? (Math.abs(m.quantity || 0) * (m.coefficient || 1)),
                unit: m.itemUnit,
                amount: Math.abs(m.quantity || 0) * (analysisUnitPriceMap.get(m.itemId) ?? m.itemPrice ?? 0),
                salNames: salTagMap.get(`movement:${m.id}`) || [],
                isFictitious: false,
            }))
            const childTotal = children.reduce((s, c) => s + c.amount, 0)
            groups.push({
                groupId: p.id,
                kind: 'ddt',
                date: p.deliveryNoteDate || p.createdAt,
                description: `DDT ${p.deliveryNoteNumber || p.id.slice(0, 8)}`,
                detail: p.supplierName,
                totalAmount: childTotal || p.totalAmount || 0,
                totalPieces: children.reduce((s, c) => s + (c.pieces ?? 0), 0),
                children,
                linkHref: `/purchases/${p.id}`,
            })
        })

        return groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [movements, purchases, salTagMap, analysisUnitPriceMap])

    // ── Derived: filtered groups (children filtered when TAG is active) ───────
    const filteredMaterialGroups: MaterialGroup[] = useMemo(() => {
        if (activeFilter === 'all') return allMaterialGroups
        return allMaterialGroups
            .map(g => {
                const children = activeFilter === '__no_tag__'
                    ? g.children.filter(c => c.salNames.length === 0)
                    : g.children.filter(c => c.salNames.includes(activeFilter))
                return {
                    ...g,
                    children,
                    totalAmount: children.reduce((s, c) => s + c.amount, 0),
                    totalPieces: children.reduce((s, c) => s + (c.pieces ?? 0), 0),
                }
            })
            .filter(g => g.children.length > 0)
    }, [allMaterialGroups, activeFilter])

    // flat list of all visible child rows (for selection helpers)
    const allVisibleChildRows = useMemo(
        () => filteredMaterialGroups.flatMap(g => g.children),
        [filteredMaterialGroups]
    )

    // ── Derived: filtered worker rows ─────────────────────────────────────────
    const filteredWorkerRows = useMemo(() => {
        if (activeFilter === 'all' || activeFilter === '__no_tag__') return workerCosts
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
                const wTransferDays = (w.days || []).filter(d => d.transferHours > 0).length
                e.normalHours += w.totalNormal
                e.transferHours += w.totalTransfer
                e.normalCost += w.totalNormal * w.hourlyRate
                e.trasfertaCost += w.totalTransfer * w.hourlyRate + wTransferDays * w.trasfertaRate
                e.total += w.totalCost
            }
        }
        return Array.from(wMap.values()).sort((a, b) => b.total - a.total)
    }, [workerCosts, salItems, activeFilter])

    // ── Derived: filtered other costs ─────────────────────────────────────────
    const filteredCosts = useMemo(() => {
        if (activeFilter === 'all') return salCosts
        if (activeFilter === '__no_tag__') return salCosts.filter(c => !c.salName)
        return salCosts.filter(c => c.salName === activeFilter)
    }, [salCosts, activeFilter])

    // ── Derived: totals ───────────────────────────────────────────────────────
    const materialTotal = useMemo(
        () => filteredMaterialGroups.reduce((s, g) => s + g.totalAmount, 0),
        [filteredMaterialGroups]
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

    // ── Excel export ──────────────────────────────────────────────────────────
    const handleExport = (scope: 'all' | string) => {
        const wb = XLSX.utils.book_new()
        const fmtN = (n: number) => Math.round(n * 100) / 100
        const isAll = scope === 'all'
        const today = new Date().toISOString().slice(0, 10)
        const fileLabel = isAll ? 'Completo' : scope.replace(/\s+/g, '_')

        // Nome cantiere dalle prop
        const jobSlug = [jobCode, jobName]
            .filter(Boolean)
            .join('_')
            .replace(/[^a-zA-Z0-9_\-àáèéìíòóùú]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 40)

        // ── Palette colori SAL (ARGB, 8 char) ────────────────────────────────
        const SAL_LIGHT  = ['FFD6E4FF','FFD4EDDA','FFFFF3CD','FFFFD6CC','FFE8D5FC','FFFCE4D6','FFD9F2F7','FFE2EFDA']
        const SAL_MID    = ['FF9DC3F0','FF9CD4B4','FFFFD966','FFFFB3A0','FFC5A8E8','FFFAB588','FF8EC8D5','FFA8C88E']
        const salColorMap = new Map<string, { light: string; mid: string }>()
        salNames.forEach((n, i) => salColorMap.set(n, { light: SAL_LIGHT[i % 8], mid: SAL_MID[i % 8] }))
        const getSalColor = (names: string[]) => names.length > 0 ? salColorMap.get(names[0]) : undefined

        // ── Cell builder helpers ──────────────────────────────────────────────
        type XS = Record<string, any>
        const xc = (v: any, s: XS = {}) => ({ v, t: typeof v === 'number' ? 'n' : 's', s })
        const hdrCell = (v: string, bgRgb = 'FF334155') => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: bgRgb } },
            font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        })
        const titleCell = (v: string) => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
            font: { bold: true, sz: 13, color: { rgb: 'FFFFFFFF' } },
        })
        const totalCell = (v: any) => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
            font: { bold: true, color: { rgb: 'FFFFFFFF' } },
        })
        const grayCell = (v: any) => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: 'FFF1F5F9' } },
        })
        const salHdrCell = (v: string, mid: string) => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: mid } },
            font: { bold: true },
        })
        const salDataCell = (v: any, light: string) => xc(v, {
            fill: { patternType: 'solid', fgColor: { rgb: light } },
        })

        // ── Helper: scoped groups/workers/costs ───────────────────────────────
        const groupsForScope = (sal: string | 'all') => {
            if (sal === 'all') return allMaterialGroups
            return allMaterialGroups.map(g => {
                const children = g.children.filter(c => c.salNames.includes(sal))
                return { ...g, children, totalAmount: children.reduce((s, c) => s + c.amount, 0), totalPieces: children.reduce((s, c) => s + (c.pieces ?? 0), 0) }
            }).filter(g => g.children.length > 0)
        }
        const workerRowsForScope = (sal: string | 'all') => {
            if (sal === 'all') return workerCosts
            const wMap = new Map<string, WorkerCostRow>()
            for (const item of salItems.filter(s => s.itemType === 'worker_hours' && s.salName === sal)) {
                if (!item.workerHoursData) continue
                for (const w of item.workerHoursData.workers) {
                    const p = wMap.get(w.workerId) ?? { workerId: w.workerId, workerName: w.workerName, normalHours: 0, transferHours: 0, normalCost: 0, trasfertaCost: 0, total: 0 }
                    const wTrDays = (w.days || []).filter(d => d.transferHours > 0).length
                    wMap.set(w.workerId, { ...p, normalHours: p.normalHours + w.totalNormal, transferHours: p.transferHours + w.totalTransfer, normalCost: p.normalCost + w.totalNormal * w.hourlyRate, trasfertaCost: p.trasfertaCost + w.totalTransfer * w.hourlyRate + wTrDays * w.trasfertaRate, total: p.total + w.totalCost })
                }
            }
            return [...wMap.values()]
        }

        const expGroups      = groupsForScope(scope)
        const expWorkerRows  = workerRowsForScope(scope)
        const expCosts       = isAll ? salCosts : salCosts.filter(c => c.salName === scope)
        const expMatTotal    = expGroups.reduce((s, g) => s + g.totalAmount, 0)
        const expWorkerTotal = expWorkerRows.reduce((s, r) => s + r.total, 0)
        const expCostsTotal  = expCosts.reduce((s, c) => s + c.amount, 0)
        const expGrandTotal  = expMatTotal + expWorkerTotal + expCostsTotal

        // ── Sheet 1 — Riepilogo ───────────────────────────────────────────────
        const ws1: any[][] = []
        ws1.push([titleCell(isAll ? 'Riepilogo Completo' : `Riepilogo SAL: ${scope}`), xc(today)])
        ws1.push([])
        ws1.push([hdrCell('Categoria'), hdrCell('Importo (€)')])
        ws1.push([xc('Materiali'), xc(fmtN(expMatTotal))])
        ws1.push([xc('Ore Operai'), xc(fmtN(expWorkerTotal))])
        ws1.push([xc('Altri Costi'), xc(fmtN(expCostsTotal))])
        ws1.push([])
        ws1.push([totalCell('TOTALE'), totalCell(fmtN(expGrandTotal))])

        if (isAll && salNames.length > 0) {
            ws1.push([])
            ws1.push([])
            ws1.push([hdrCell('Riepilogo per SAL')])
            ws1.push([hdrCell('SAL'), hdrCell('Materiali (€)'), hdrCell('Ore Operai (€)'), hdrCell('Altri Costi (€)'), hdrCell('Totale (€)')])

            for (const salName of salNames) {
                const col = salColorMap.get(salName)
                const salMat    = groupsForScope(salName).reduce((s, g) => s + g.totalAmount, 0)
                const salWorker = workerRowsForScope(salName).reduce((s, r) => s + r.total, 0)
                const salOther  = salCosts.filter(c => c.salName === salName).reduce((s, c) => s + c.amount, 0)
                const cells = [salName, fmtN(salMat), fmtN(salWorker), fmtN(salOther), fmtN(salMat + salWorker + salOther)]
                ws1.push(col ? cells.map(v => salDataCell(v, col.light)) : cells.map(v => xc(v)))
            }

            // Senza SAL (sempre incluso: materiali + ore + altri costi non assegnati)
            const noSalMat    = allMaterialGroups.flatMap(g => g.children.filter(c => c.salNames.length === 0)).reduce((s, c) => s + c.amount, 0)
            const noSalWorker = Math.max(0, workerCosts.reduce((s, r) => s + r.total, 0) - salNames.reduce((sum, n) => sum + workerRowsForScope(n).reduce((s, r) => s + r.total, 0), 0))
            const noSalOther  = salCosts.filter(c => !c.salName).reduce((s, c) => s + c.amount, 0)
            const noSalTotal  = noSalMat + noSalWorker + noSalOther
            ws1.push([grayCell('(senza SAL)'), grayCell(fmtN(noSalMat)), grayCell(fmtN(noSalWorker)), grayCell(fmtN(noSalOther)), grayCell(fmtN(noSalTotal))])
        }

        const sheet1 = XLSX.utils.aoa_to_sheet(ws1)
        sheet1['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }]
        XLSX.utils.book_append_sheet(wb, sheet1, 'Riepilogo')

        // ── Sheet 2 — Materiali ───────────────────────────────────────────────
        const hdrMat = ['Documento','Tipo','Data','Articolo','Acquisto origine','Pezzi','Unità','Importo (€)','SAL']
        const mat: any[][] = [hdrMat.map(h => hdrCell(h))]

        expGroups.forEach(g => {
            const tipo = g.kind === 'ddt' ? 'Acquisto' : g.kind === 'exit' ? 'Uscita' : 'Rientro'
            g.children.forEach(c => {
                const col = getSalColor(c.salNames)
                // Acquisto origine: DDT provenienza per le uscite, il DDT stesso per gli acquisti
                let origine = ''
                if (c.kind === 'exit') {
                    const parts = [c.purchaseRef && `DDT ${c.purchaseRef}`, c.supplierName].filter(Boolean)
                    origine = parts.join(' · ') || '—'
                } else if (c.kind === 'ddt') {
                    origine = [g.description, g.detail].filter(Boolean).join(' · ')
                } else {
                    origine = '—'
                }
                const row = [g.description, tipo, c.date, c.description, origine, fmtN(c.pieces ?? 0), c.unit || '', fmtN(c.amount), c.salNames.join(', ')]
                mat.push(col ? row.map(v => salDataCell(v, col.light)) : row.map(v => xc(v)))
            })
        })
        mat.push(['','','','','', xc(''), totalCell('TOTALE'), totalCell(fmtN(expMatTotal)), xc('')])

        const sheet2 = XLSX.utils.aoa_to_sheet(mat)
        sheet2['!cols'] = [{ wch: 22 },{ wch: 10 },{ wch: 12 },{ wch: 32 },{ wch: 28 },{ wch: 9 },{ wch: 6 },{ wch: 14 },{ wch: 18 }]
        XLSX.utils.book_append_sheet(wb, sheet2, 'Materiali')

        // ── Sheet 3 — Ore Operai ──────────────────────────────────────────────
        const hdrOre = ['Operaio','Ore Normali','Ore Trasferta','Costo Norm. (€)','Costo Trasf. (€)','Totale (€)']
        const ore: any[][] = [hdrOre.map(h => hdrCell(h))]
        expWorkerRows.forEach(r => {
            ore.push([r.workerName, fmtN(r.normalHours), fmtN(r.transferHours), fmtN(r.normalCost), fmtN(r.trasfertaCost), fmtN(r.total)].map(v => xc(v)))
        })
        ore.push([xc(''), xc(''), xc(''), xc(''), totalCell('TOTALE'), totalCell(fmtN(expWorkerTotal))])

        // Cross-table per SAL entry
        const whSalItems = salItems.filter(s => s.itemType === 'worker_hours' && (isAll || s.salName === scope))
        if (whSalItems.length > 0) {
            ore.push([])
            ore.push([hdrCell('── Dettaglio presenze per operaio e giorno ──')])

            for (const whi of whSalItems) {
                if (!whi.workerHoursData) continue
                const d = whi.workerHoursData
                const col = whi.salName ? salColorMap.get(whi.salName) : undefined

                ore.push([])
                ore.push([
                    col ? salHdrCell(`SAL: ${whi.salName || '(nessun SAL)'}`, col.mid) : hdrCell(`SAL: ${whi.salName || '(nessun SAL)'}`),
                    xc(`Periodo: ${d.dateFrom} → ${d.dateTo}`),
                ])

                const allDates = [...new Set(d.workers.flatMap(w => w.days.map(day => day.date)))].sort()
                ore.push([
                    col ? salHdrCell('Giorno', col.mid) : hdrCell('Giorno'),
                    ...d.workers.map(w => col ? salHdrCell(w.workerName, col.mid) : hdrCell(w.workerName)),
                ])

                for (const dateStr of allDates) {
                    const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })
                    const row: any[] = [col ? salDataCell(label, col.light) : xc(label)]
                    for (const worker of d.workers) {
                        const day = worker.days.find(day => day.date === dateStr)
                        let cell = ''
                        if (day && (day.normalHours > 0 || day.transferHours > 0)) {
                            const parts = []
                            if (day.normalHours > 0) parts.push(`${day.normalHours}N`)
                            if (day.transferHours > 0) parts.push(`${day.transferHours}T`)
                            cell = parts.join('+')
                        }
                        row.push(col ? salDataCell(cell, col.light) : xc(cell))
                    }
                    ore.push(row)
                }

                const totRow: any[] = [totalCell('TOTALE')]
                for (const worker of d.workers) {
                    totRow.push(totalCell(`${fmtN(worker.totalNormal)}N+${fmtN(worker.totalTransfer)}T = €${fmtN(worker.totalCost)}`))
                }
                ore.push(totRow)
            }
        }

        const sheet3 = XLSX.utils.aoa_to_sheet(ore)
        sheet3['!cols'] = [{ wch: 16 },{ wch: 14 },{ wch: 14 },{ wch: 16 },{ wch: 16 },{ wch: 14 }]
        XLSX.utils.book_append_sheet(wb, sheet3, 'Ore Operai')

        // ── Sheet 4 — Altri Costi ─────────────────────────────────────────────
        const hdrCosti = ['Descrizione','SAL','Importo (€)']
        const costi: any[][] = [hdrCosti.map(h => hdrCell(h))]
        expCosts.forEach(c => {
            const col = c.salName ? salColorMap.get(c.salName) : undefined
            const row = [c.description, c.salName || '', fmtN(c.amount)]
            costi.push(col ? row.map(v => salDataCell(v, col.light)) : row.map(v => xc(v)))
        })
        costi.push([xc(''), totalCell('TOTALE'), totalCell(fmtN(expCostsTotal))])

        const sheet4 = XLSX.utils.aoa_to_sheet(costi)
        sheet4['!cols'] = [{ wch: 35 },{ wch: 18 },{ wch: 14 }]
        XLSX.utils.book_append_sheet(wb, sheet4, 'Altri Costi')

        const nameParts = [jobSlug, fileLabel, today].filter(Boolean)
        XLSX.writeFile(wb, `${nameParts.join('_')}.xlsx`)
    }

    // ── Materials: toggle selection ───────────────────────────────────────────
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
        })
    }
    const toggleGroupSelection = (group: MaterialGroup) => {
        const ids = group.children.map(c => c.id)
        const allSel = ids.every(id => selectedIds.has(id))
        setSelectedIds(prev => {
            const next = new Set(prev)
            allSel ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id))
            return next
        })
    }
    const toggleSelectAll = () => {
        const allIds = allVisibleChildRows.map(r => r.id)
        const allSel = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
        setSelectedIds(allSel ? new Set() : new Set(allIds))
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
            const items = allVisibleChildRows.filter(r => selectedIds.has(r.id)).map(r => ({ itemType: r.type, itemId: r.id }))
            await salApi.tagItems(jobId, name, items)
            setIsAddSalOpen(false)
            setSelectedIds(new Set())
            await loadData()
            notify.success(`${items.length} voci aggiunte al TAG "${name}"`)
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'aggiunta al TAG")
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
            notify.error("Errore durante la rimozione dal TAG")
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
                const transferDays = days.filter(d => d.transferHours > 0).length
                const totalCost = (totalNormal + totalTransfer) * e.hourlyRate + transferDays * e.trasfertaRate
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
        if (!whPreview) return
        try {
            setWhSaving(true)
            await salApi.addWorkerHours(jobId, whSalName.trim(), whPreview)
            setIsWorkerHoursOpen(false)
            setWhPreview(null); setWhDateFrom(''); setWhDateTo(''); setWhSalName('')
            await loadData()
            notify.success("Ore operai aggiunte al TAG")
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

    // ── Worker hours: edit TAG inline ─────────────────────────────────────────
    const [editingWhTag, setEditingWhTag] = useState<string | null>(null)
    const [editWhTagValue, setEditWhTagValue] = useState('')
    const handleUpdateWhTag = async (itemId: string) => {
        try {
            await salApi.updateItemSalName(itemId, editWhTagValue === '__none__' ? null : editWhTagValue)
            setEditingWhTag(null)
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'aggiornamento del TAG")
        }
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
            const cost = await salCostsApi.add(jobId, desc, amount, salNameVal)
            if (newCostFiles.length > 0) {
                const urls = await Promise.all(newCostFiles.map(f => salCostsApi.uploadDocument(f)))
                await salCostsApi.updateDocumentUrls(cost.id, urls)
            }
            setIsAddCostOpen(false)
            setNewCostDesc(''); setNewCostAmount(''); setNewCostSal('__none__'); setNewCostFiles([])
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
            notify.error("Errore durante l'aggiornamento del TAG")
        }
    }
    const handleUploadCostDoc = async (costId: string, existingUrls: string[], file: File) => {
        try {
            setUploadingCostId(costId)
            const url = await salCostsApi.uploadDocument(file)
            await salCostsApi.updateDocumentUrls(costId, [...existingUrls, url])
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante il caricamento del documento")
        } finally {
            setUploadingCostId(null)
        }
    }
    const handleDeleteCostDoc = async (costId: string, existingUrls: string[], url: string) => {
        try {
            const path = url.split('/public/documents/')[1] || url.split('/documents/')[1]
            if (path) await supabase.storage.from('documents').remove([path])
            await salCostsApi.updateDocumentUrls(costId, existingUrls.filter(u => u !== url))
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante la rimozione del documento")
        }
    }
    const openDocument = async (url: string) => {
        try {
            const path = url.split('/public/documents/')[1] || url.split('/documents/')[1]
            if (!path) { window.open(url, '_blank'); return }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(url, '_blank'); return }
            window.open(data.signedUrl, '_blank')
        } catch {
            window.open(url, '_blank')
        }
    }
    const handleDeleteCost = async (costId: string) => {
        try {
            const cost = salCosts.find(c => c.id === costId)
            if (cost?.documentUrls?.length) {
                const paths = cost.documentUrls
                    .map(u => u.split('/public/documents/')[1] || u.split('/documents/')[1])
                    .filter(Boolean) as string[]
                if (paths.length) await supabase.storage.from('documents').remove(paths)
            }
            await salCostsApi.delete(costId)
            await loadData()
        } catch (e) {
            console.error(e)
            notify.error("Errore durante l'eliminazione del costo")
        }
    }

    // ── Manage SAL ────────────────────────────────────────────────────────────
    const handleCreateSal = async () => {
        const name = newSalInput.trim()
        if (!name || salNames.includes(name)) return
        try {
            setNewSalSaving(true)
            await salNamesApi.create(jobId, name)
            setNewSalInput('')
            await loadData()
            notify.success(`TAG "${name}" creato`)
        } catch (e) {
            console.error(e)
            notify.error("Errore durante la creazione del SAL")
        } finally {
            setNewSalSaving(false)
        }
    }
    const handleRenameSal = async (oldName: string) => {
        const newName = (editingNames[oldName] || '').trim()
        if (!newName || newName === oldName) return
        try {
            setManageSaving(oldName)
            await Promise.all([
                salApi.renameSal(jobId, oldName, newName),
                salCostsApi.renameSalInCosts(jobId, oldName, newName),
                salNamesApi.rename(jobId, oldName, newName),
            ])
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
        if (!confirm(`Eliminare il TAG "${name}" e tutte le sue voci?`)) return
        try {
            setManageSaving(name)
            await Promise.all([
                salApi.deleteSal(jobId, name),
                salNamesApi.delete(jobId, name),
            ])
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

            {/* ── TAG filter bar ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 mr-1">TAG:</span>
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
                <Button
                    key="__no_tag__"
                    variant={activeFilter === '__no_tag__' ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setActiveFilter('__no_tag__'); setSelectedIds(new Set()) }}
                    className={activeFilter === '__no_tag__' ? "bg-slate-600" : ""}
                >
                    senza TAG
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setEditingNames(Object.fromEntries(salNames.map(n => [n, n])))
                            setNewSalInput('')
                            setIsManageSalOpen(true)
                        }}
                    >
                        <Settings className="h-4 w-4 mr-1" />
                        Gestisci TAG
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" title="Esporta in Excel">
                                <Download className="h-4 w-4 mr-1" />
                                Excel
                                <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('all')}>
                                Tutti i dati
                            </DropdownMenuItem>
                            {salNames.length > 0 && <DropdownMenuSeparator />}
                            {salNames.map(name => (
                                <DropdownMenuItem key={name} onClick={() => handleExport(name)}>
                                    Solo TAG: {name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
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
                            Aggiungi al TAG
                            {selectedIds.size > 0 && <span className="ml-1 opacity-80">({selectedIds.size})</span>}
                        </Button>
                    </div>
                }
            >
                {filteredMaterialGroups.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">
                        {activeFilter === 'all' ? 'Nessun materiale trovato.' : activeFilter === '__no_tag__' ? 'Nessun materiale senza TAG.' : `Nessun materiale per il TAG "${activeFilter}".`}
                    </p>
                ) : (() => {
                    const allIds = allVisibleChildRows.map(r => r.id)
                    const allSel = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
                    const someSel = !allSel && allIds.some(id => selectedIds.has(id))
                    const totalPieces = filteredMaterialGroups.reduce((s, g) => s + (g.totalPieces ?? 0), 0)
                    return (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                        <th className="p-2 w-6"></th>
                                        <th className="p-2 w-8">
                                            <Checkbox
                                                checked={allSel ? true : someSel ? 'indeterminate' : false}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="text-left p-2 font-medium text-slate-500">Data</th>
                                        <th className="text-left p-2 font-medium text-slate-500">Tipo</th>
                                        <th className="text-left p-2 font-medium text-slate-500">Descrizione</th>
                                        <th className="text-right p-2 font-medium text-slate-500">Pezzi</th>
                                        <th className="text-right p-2 font-medium text-slate-500">Importo</th>
                                        <th className="text-left p-2 font-medium text-slate-500">TAG</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterialGroups.map(group => {
                                        const isOpen = expandedGroups.has(group.groupId)
                                        const gIds = group.children.map(c => c.id)
                                        const gAllSel = gIds.every(id => selectedIds.has(id))
                                        const gSomeSel = !gAllSel && gIds.some(id => selectedIds.has(id))
                                        // aggregate SAL names from children
                                        const groupSalNames = [...new Set(group.children.flatMap(c => c.salNames))]
                                        return (
                                            <>
                                                {/* ── Parent row ── */}
                                                <tr key={group.groupId} className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/40">
                                                    <td className="p-2">
                                                        {group.children.length > 0 ? (
                                                            <button onClick={() => toggleGroupExpanded(group.groupId)} className="text-slate-400 hover:text-slate-700">
                                                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            </button>
                                                        ) : <span className="w-4 inline-block" />}
                                                    </td>
                                                    <td className="p-2">
                                                        <Checkbox
                                                            checked={gAllSel ? true : gSomeSel ? 'indeterminate' : false}
                                                            onCheckedChange={() => toggleGroupSelection(group)}
                                                        />
                                                    </td>
                                                    <td className="p-2 text-slate-500 whitespace-nowrap text-xs">
                                                        {new Date(group.date).toLocaleDateString('it-IT')}
                                                    </td>
                                                    <td className="p-2">
                                                        {group.kind === 'exit' && <Badge variant="outline" className="border-blue-300 text-blue-700 text-xs">Uscita</Badge>}
                                                        {group.kind === 'entry' && <Badge variant="outline" className="border-orange-300 text-orange-700 text-xs">Rientro</Badge>}
                                                        {group.kind === 'ddt' && <Badge variant="outline" className="border-purple-300 text-purple-700 text-xs">Acquisto</Badge>}
                                                    </td>
                                                    <td className="p-2">
                                                        {group.linkHref ? (
                                                            <Link
                                                                href={group.linkHref}
                                                                target={isMobile ? undefined : "_blank"}
                                                                rel={isMobile ? undefined : "noopener noreferrer"}
                                                                className="font-semibold text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                {group.description}
                                                                {!isMobile && <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />}
                                                            </Link>
                                                        ) : (
                                                            <div className="font-semibold text-slate-800 dark:text-slate-200">{group.description}</div>
                                                        )}
                                                        {group.detail && <div className="text-xs text-slate-400">{group.detail}</div>}
                                                        {group.children.length > 0 && (
                                                            <div className="text-xs text-slate-400">{group.children.length} {group.children.length === 1 ? 'articolo' : 'articoli'}</div>
                                                        )}
                                                    </td>
                                                    <td className={`p-2 text-right font-mono whitespace-nowrap text-xs ${(group.totalPieces ?? 0) < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                                                        {group.totalPieces !== undefined
                                                            ? group.totalPieces.toLocaleString('it-IT', { maximumFractionDigits: 3 })
                                                            : '—'}
                                                    </td>
                                                    <td className={`p-2 text-right font-mono font-medium ${group.totalAmount < 0 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {group.totalAmount !== 0 ? `€ ${fmt(group.totalAmount)}` : '—'}
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {groupSalNames.map(name => (
                                                                <span key={name} className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1.5 py-0.5">{name}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* ── Child rows ── */}
                                                {isOpen && group.children.map(child => (
                                                    <tr key={child.id} className="border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900/20 hover:bg-slate-50/80">
                                                        <td className="p-2"></td>
                                                        <td className="p-2 pl-4">
                                                            <Checkbox checked={selectedIds.has(child.id)} onCheckedChange={() => toggleSelect(child.id)} />
                                                        </td>
                                                        <td className="p-2 text-slate-400 whitespace-nowrap text-xs">
                                                            {new Date(child.date).toLocaleDateString('it-IT')}
                                                        </td>
                                                        <td className="p-2"></td>
                                                        <td className="p-2 pl-4">
                                                            <div className="text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-1.5">
                                                                <span>{child.description}</span>
                                                                {child.isFictitious && (
                                                                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px] h-5 px-1.5 font-normal">
                                                                        Fittizio
                                                                    </Badge>
                                                                )}
                                                                {child.kind === 'exit' && (child.supplierName || child.purchaseRef) && (
                                                                    <span className="text-xs text-slate-400">
                                                                        ({[
                                                                            child.purchaseRef && `DDT ${child.purchaseRef}`,
                                                                            child.supplierName,
                                                                        ].filter(Boolean).join(' · ')})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className={`p-2 text-right font-mono text-xs whitespace-nowrap ${(child.pieces ?? 0) < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                                            {child.pieces !== undefined
                                                                ? `${child.pieces.toLocaleString('it-IT', { maximumFractionDigits: 3 })}${child.unit ? ' ' + child.unit : ''}`
                                                                : '—'}
                                                        </td>
                                                        <td className={`p-2 text-right font-mono text-xs ${child.amount < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                                            {child.amount !== 0 ? `€ ${fmt(child.amount)}` : '—'}
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="flex flex-wrap gap-1">
                                                                {child.salNames.map(name => (
                                                                    <span key={name} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1.5 py-0.5">
                                                                        {name}
                                                                        <button onClick={() => handleRemoveFromSal(child, name)} className="hover:text-red-500">
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-800/50 font-semibold text-sm">
                                        <td colSpan={5} className="p-2 text-slate-600">Totale</td>
                                        <td className={`p-2 text-right font-mono ${totalPieces < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {totalPieces.toLocaleString('it-IT', { maximumFractionDigits: 3 })}
                                        </td>
                                        <td className={`p-2 text-right font-mono ${materialTotal < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                            € {fmt(materialTotal)}
                                        </td>
                                        <td className="p-2"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                })()}
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
                        Calcola ore operai
                    </Button>
                }
            >
                {(() => {
                    const whItems = salItems.filter(s =>
                        s.itemType === 'worker_hours' &&
                        (activeFilter === 'all' || (activeFilter === '__no_tag__' ? !s.salName : s.salName === activeFilter))
                    )

                    if (filteredWorkerRows.length === 0 && whItems.length === 0) {
                        return (
                            <p className="text-sm text-slate-400 text-center py-6">
                                {activeFilter === 'all' || activeFilter === '__no_tag__' ? 'Nessuna presenza registrata.' : `Nessuna ore operai per il TAG "${activeFilter}".`}
                            </p>
                        )
                    }

                    return (
                        <div className="space-y-3">
                            {/* Riepilogo per operaio */}
                            {filteredWorkerRows.length > 0 && (
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
                                                <tr key={row.workerId} className="border-b border-slate-100 dark:border-slate-800">
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

                            {/* Dettaglio giornaliero per registrazione SAL — espandibile inline */}
                            {whItems.length > 0 && (
                                <div className="border-t pt-3 space-y-2">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dettaglio presenze per SAL</p>
                                    {whItems.map(item => {
                                        const isOpen = expandedWHItems.has(item.id)
                                        return (
                                            <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                                                {/* Header row */}
                                                <div
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 select-none"
                                                    onClick={() => toggleWHExpanded(item.id)}
                                                >
                                                    {isOpen
                                                        ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                                        : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                                    }
                                                    {editingWhTag === item.id ? (
                                                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                            <Select value={editWhTagValue} onValueChange={setEditWhTagValue}>
                                                                <SelectTrigger className="h-7 text-xs w-36">
                                                                    <SelectValue placeholder="Nessun TAG" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__none__">Nessun TAG</SelectItem>
                                                                    {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleUpdateWhTag(item.id)}>OK</Button>
                                                            <Button size="sm" variant="ghost" className="h-7 text-xs px-1" onClick={() => setEditingWhTag(null)}>✕</Button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded px-1.5 py-0.5 font-medium shrink-0 hover:bg-blue-200"
                                                            title="Clicca per cambiare TAG"
                                                            onClick={e => { e.stopPropagation(); setEditingWhTag(item.id); setEditWhTagValue(item.salName || '__none__') }}
                                                        >
                                                            {item.salName || <span className="italic opacity-60">senza TAG</span>}
                                                        </button>
                                                    )}
                                                    <span className="text-xs text-slate-500">
                                                        {item.dateFrom && item.dateTo
                                                            ? `${new Date(item.dateFrom).toLocaleDateString('it-IT')} – ${new Date(item.dateTo).toLocaleDateString('it-IT')}`
                                                            : '—'}
                                                    </span>
                                                    <span className="ml-auto text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                                                        {item.workerHoursData ? `€ ${fmt(item.workerHoursData.grandTotal)}` : '—'}
                                                    </span>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); salApi.deleteItem(item.id).then(loadData) }}
                                                        className="text-slate-300 hover:text-red-500 shrink-0 ml-1"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                {/* Cross-table: visible when expanded */}
                                                {isOpen && item.workerHoursData && (
                                                    <div className="p-3 bg-white dark:bg-slate-900/20">
                                                        <WorkerHoursTable data={item.workerHoursData} />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })()}
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
                        {activeFilter === 'all' ? 'Nessun costo aggiuntivo.' : activeFilter === '__no_tag__' ? 'Nessun costo senza TAG.' : `Nessun costo per il TAG "${activeFilter}".`}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                    <th className="text-left p-2 font-medium text-slate-500">Descrizione</th>
                                    <th className="text-left p-2 font-medium text-slate-500">TAG</th>
                                    <th className="text-right p-2 font-medium text-slate-500">Importo</th>
                                    <th className="text-left p-2 font-medium text-slate-500">Allegati</th>
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
                                                            <SelectValue placeholder="Nessun TAG" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">Nessun TAG</SelectItem>
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
                                                    title="Clicca per cambiare TAG"
                                                >
                                                    {cost.salName
                                                        ? <span className="bg-blue-100 text-blue-800 rounded px-1.5 py-0.5">{cost.salName}</span>
                                                        : <span className="text-slate-400 italic">—</span>}
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-2 text-right font-mono font-medium">€ {fmt(cost.amount)}</td>
                                        <td className="p-2">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {cost.documentUrls.map((url, i) => (
                                                    <div key={i} className="flex items-center gap-0.5">
                                                        <button
                                                            onClick={() => openDocument(url)}
                                                            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                                                            title={`Documento ${i + 1}`}
                                                        >
                                                            <Paperclip className="h-3 w-3" />
                                                            <span>{i + 1}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCostDoc(cost.id, cost.documentUrls, url)}
                                                            className="text-slate-300 hover:text-red-500"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <label className="cursor-pointer text-slate-400 hover:text-blue-600" title="Allega documento">
                                                    {uploadingCostId === cost.id
                                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        : <Paperclip className="h-3.5 w-3.5" />
                                                    }
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                        onChange={e => {
                                                            const f = e.target.files?.[0]
                                                            if (f) handleUploadCostDoc(cost.id, cost.documentUrls, f)
                                                            e.target.value = ''
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </td>
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
                title={activeFilter === 'all' ? 'Totali' : activeFilter === '__no_tag__' ? 'Totali — senza TAG' : `Totali — ${activeFilter}`}
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

            {/* Add to TAG */}
            <Dialog open={isAddSalOpen} onOpenChange={setIsAddSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aggiungi al TAG</DialogTitle>
                        <DialogDescription>Assegna le {selectedIds.size} voci selezionate a un TAG.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {salNames.length > 0 && (
                            <div className="flex gap-2">
                                <Button variant={addSalMode === 'existing' ? 'default' : 'outline'} size="sm" onClick={() => setAddSalMode('existing')}>TAG esistente</Button>
                                <Button variant={addSalMode === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setAddSalMode('new')}>Nuovo TAG</Button>
                            </div>
                        )}
                        {addSalMode === 'existing' && salNames.length > 0 ? (
                            <div className="space-y-2">
                                <Label>Seleziona TAG</Label>
                                <Select value={addSalName} onValueChange={setAddSalName}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona un TAG" /></SelectTrigger>
                                    <SelectContent>{salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Nome TAG</Label>
                                <Input placeholder="Es. TAG 1, Fase Luglio, ..." value={addSalName} onChange={e => setAddSalName(e.target.value)} />
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
                        <DialogTitle>Calcola ore operai</DialogTitle>
                        <DialogDescription>Seleziona il periodo, carica le presenze e assegna un TAG (opzionale).</DialogDescription>
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
                            <Label>TAG (opzionale)</Label>
                            <div className="flex gap-2">
                                <Select value={whSalName} onValueChange={setWhSalName}>
                                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleziona o digita un TAG" /></SelectTrigger>
                                    <SelectContent>
                                        {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="Nuovo nome TAG..."
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
                        <Button onClick={handleSaveWorkerHours} disabled={!whPreview || whSaving || whPreview.workers.length === 0}>
                            {whSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva nel TAG
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
                            <Label>TAG (opzionale)</Label>
                            <Select value={newCostSal} onValueChange={setNewCostSal}>
                                <SelectTrigger><SelectValue placeholder="Nessun TAG" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Nessun TAG</SelectItem>
                                    {salNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Allegati (opzionale)</Label>
                            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-md p-3 hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                                <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="text-sm text-slate-500">
                                    {newCostFiles.length === 0 ? 'Clicca per allegare documenti…' : `${newCostFiles.length} file selezionati`}
                                </span>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                                    onChange={e => setNewCostFiles(Array.from(e.target.files || []))}
                                />
                            </label>
                            {newCostFiles.length > 0 && (
                                <ul className="text-xs text-slate-500 space-y-0.5 pl-1">
                                    {newCostFiles.map((f, i) => (
                                        <li key={i} className="flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />{f.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
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

            {/* Gestisci TAG */}
            <Dialog open={isManageSalOpen} onOpenChange={setIsManageSalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gestisci TAG</DialogTitle>
                        <DialogDescription>Crea, rinomina o elimina i TAG.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Crea nuovo TAG */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Crea nuovo TAG</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Es. TAG 1, Fase Luglio…"
                                    value={newSalInput}
                                    onChange={e => setNewSalInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateSal()}
                                    className="flex-1"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleCreateSal}
                                    disabled={!newSalInput.trim() || salNames.includes(newSalInput.trim()) || newSalSaving}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {newSalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                                </Button>
                            </div>
                            {newSalInput.trim() && salNames.includes(newSalInput.trim()) && (
                                <p className="text-xs text-red-500">Nome già esistente</p>
                            )}
                        </div>

                        {/* Elenco TAG esistenti */}
                        {salNames.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">TAG esistenti</Label>
                                {salNames.map(name => (
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
                        )}
                        {salNames.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-2">Nessun TAG creato.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManageSalOpen(false)}>Chiudi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
