"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, PlusCircle, X, Download, Package, FileText } from "lucide-react"
import { costAnalysisApi, CostAnalysisRow } from "@/lib/services/cost-analysis"
import { inventoryApi } from "@/lib/api"
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog"
import { notify } from "@/lib/notify"
import type { InventoryItem, Movement } from "@/lib/types"
import * as XLSX from "xlsx-js-style"

interface JobAnalisiCostiProps {
    jobId: string
    jobCode?: string
    jobName?: string
    movements: Movement[]
}

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtN = (n: number) => Math.round(n * 100) / 100
const parseNum = (v: string) => parseFloat(v.replace(',', '.')) || 0

// ── Cella editabile inline ───────────────────────────────────────────────────
function EditCell({ value, onSave, placeholder = '0', prefix }: {
    value: number | null
    onSave: (v: number | null) => void
    placeholder?: string
    prefix?: string
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')

    const start = () => { setDraft(value !== null ? String(value).replace('.', ',') : ''); setEditing(true) }
    const commit = () => {
        setEditing(false)
        const s = draft.trim()
        if (s === '') { onSave(null); return }
        const n = parseFloat(s.replace(',', '.'))
        onSave(isNaN(n) ? null : n)
    }

    if (editing) return (
        <Input
            autoFocus
            className="h-7 text-xs text-right w-24 px-1"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
    )
    return (
        <button
            className="text-xs font-mono text-right w-full hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-0.5 min-w-[5rem]"
            onClick={start}
            title="Clicca per modificare"
        >
            {value !== null ? `${prefix || ''}${fmt(value)}` : <span className="text-slate-300 italic">—</span>}
        </button>
    )
}

// ── Tabella materiali ─────────────────────────────────────────────────────────
function MaterialTable({
    rows,
    onUpdate,
}: {
    rows: CostAnalysisRow[]
    onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual'>>) => void
}) {
    const totalEst = rows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left p-2 font-medium text-slate-500">Articolo</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo max acq.</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo unit.</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Qtà presunta</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Tot. presunto</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const totEst = (row.unitPrice ?? 0) * row.qtyEstimated
                        const unitLabel = row.itemUnit ? `€/${row.itemUnit}` : '€/u.'
                        return (
                            <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/20">
                                <td className="p-2">
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{row.itemName}</div>
                                    {row.itemModel && <div className="text-xs text-slate-400">{row.itemModel}</div>}
                                    <div className="text-xs text-slate-400 italic">{unitLabel}</div>
                                </td>
                                <td className="p-2 text-right">
                                    {row.maxPurchasePrice !== null
                                        ? <span className="text-xs font-mono text-slate-600">€ {fmt(row.maxPurchasePrice)}</span>
                                        : <Badge variant="outline" className="text-xs text-slate-400 border-slate-300">N/D</Badge>
                                    }
                                </td>
                                <td className="p-2 text-right">
                                    <EditCell value={row.unitPrice} onSave={v => onUpdate(row.id, { unitPrice: v })} prefix="€ " />
                                </td>
                                <td className="p-2 text-right">
                                    <EditCell value={row.qtyEstimated || null} onSave={v => onUpdate(row.id, { qtyEstimated: v ?? 0 })} />
                                </td>
                                <td className="p-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                                    {row.unitPrice !== null ? `€ ${fmt(totEst)}` : '—'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                {rows.length > 0 && (
                    <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-800/50 font-semibold text-sm">
                            <td colSpan={4} className="p-2 text-slate-600">Totale presunto</td>
                            <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    )
}

// ── Tabella voci generiche ────────────────────────────────────────────────────
function GenericTable({
    rows,
    onUpdate,
    onDelete,
}: {
    rows: CostAnalysisRow[]
    onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => void
    onDelete: (id: string) => void
}) {
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const totalEst = rows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left p-2 font-medium text-slate-500">Voce</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo unit.</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Qtà presunta</th>
                        <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Tot. presunto</th>
                        <th className="w-6 p-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const totEst = (row.unitPrice ?? 0) * row.qtyEstimated
                        return (
                            <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/20">
                                <td className="p-2 min-w-[160px]">
                                    <InlineTextEdit
                                        value={row.itemName}
                                        onSave={v => onUpdate(row.id, { itemName: v })}
                                        placeholder="Descrizione voce…"
                                    />
                                </td>
                                <td className="p-2 text-right">
                                    <EditCell value={row.unitPrice} onSave={v => onUpdate(row.id, { unitPrice: v })} prefix="€ " />
                                </td>
                                <td className="p-2 text-right">
                                    <EditCell value={row.qtyEstimated || null} onSave={v => onUpdate(row.id, { qtyEstimated: v ?? 0 })} />
                                </td>
                                <td className="p-2 text-right font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {row.unitPrice !== null ? `€ ${fmt(totEst)}` : '—'}
                                </td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {pendingDelete === row.id ? (
                                        <span className="flex items-center gap-1 justify-end">
                                            <span className="text-xs text-slate-500">Eliminare?</span>
                                            <button
                                                onClick={() => { onDelete(row.id); setPendingDelete(null) }}
                                                className="text-xs font-medium text-red-600 hover:text-red-700 px-1"
                                            >Sì</button>
                                            <button
                                                onClick={() => setPendingDelete(null)}
                                                className="text-xs text-slate-400 hover:text-slate-600 px-1"
                                            >No</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setPendingDelete(row.id)} className="text-slate-300 hover:text-red-500">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                {rows.length > 0 && (
                    <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 dark:bg-slate-800/50 font-semibold text-sm">
                            <td colSpan={3} className="p-2 text-slate-600">Totale presunto</td>
                            <td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    )
}

function InlineTextEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const start = () => { setDraft(value); setEditing(true) }
    const commit = () => { setEditing(false); const v = draft.trim(); if (v !== value) onSave(v || value) }
    if (editing) return (
        <Input autoFocus className="h-7 text-xs w-full" value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
    )
    return (
        <button className="text-left w-full hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-0.5 text-sm" onClick={start}>
            {value || <span className="text-slate-400 italic text-xs">{placeholder}</span>}
        </button>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
export function JobAnalisiCosti({ jobId, jobCode, jobName, movements }: JobAnalisiCostiProps) {
    const [rows, setRows] = useState<CostAnalysisRow[]>([])
    const [loading, setLoading] = useState(true)
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [invLoading, setInvLoading] = useState(false)
    const [addingGeneric, setAddingGeneric] = useState(false)
    const [newGenericName, setNewGenericName] = useState('')

    const inventoryRows = useMemo(() => rows.filter(r => r.type === 'inventory'), [rows])
    const genericRows = useMemo(() => rows.filter(r => r.type === 'generic'), [rows])

    const autoImported = useRef(false)

    const loadRows = async () => {
        try {
            setLoading(true)
            const existing = await costAnalysisApi.getByJobId(jobId)
            setRows(existing)

            // Auto-import articoli dai movimenti (solo al primo caricamento)
            if (!autoImported.current) {
                autoImported.current = true
                const existingIds = new Set(existing.filter(r => r.type === 'inventory').map(r => r.itemId).filter(Boolean))
                const uniqueItems = new Map<string, Movement>()
                for (const m of movements) {
                    if (!m.itemId || existingIds.has(m.itemId) || uniqueItems.has(m.itemId)) continue
                    if (m.type === 'exit' || m.type === 'entry' || m.type === 'purchase') {
                        uniqueItems.set(m.itemId, m)
                    }
                }
                if (uniqueItems.size > 0) {
                    const priceMap = await costAnalysisApi.getMaxPurchasePrices([...uniqueItems.keys()])
                    let sortBase = existing.filter(r => r.type === 'inventory').length
                    const added: CostAnalysisRow[] = []
                    for (const m of [...uniqueItems.values()]) {
                        const row = await costAnalysisApi.add(jobId, {
                            type: 'inventory',
                            itemId: m.itemId,
                            itemName: m.itemName || m.itemCode || '',
                            itemModel: m.itemModel || '',
                            itemUnit: m.itemUnit || '',
                            maxPurchasePrice: priceMap.get(m.itemId) ?? null,
                            unitPrice: null,
                            qtyEstimated: 0,
                            qtyActual: 0,
                            sortOrder: sortBase++,
                        })
                        added.push(row)
                    }
                    if (added.length > 0) setRows(prev => [...prev, ...added])
                }
            }
        } catch { notify.error("Errore nel caricamento dell'analisi costi") }
        finally { setLoading(false) }
    }

    useEffect(() => { loadRows() }, [jobId])

    // ── Ricerca articoli per selector ─────────────────────────────────────────
    const handleItemSearch = useCallback(async (term: string) => {
        setInvLoading(true)
        try {
            const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term })
            setInventory(items)
        } catch { /* non bloccante */ }
        finally { setInvLoading(false) }
    }, [])

    // ── Aggiungi articolo da magazzino ────────────────────────────────────────
    const handleSelectItem = async (item: InventoryItem) => {
        setSelectorOpen(false)
        if (inventoryRows.some(r => r.itemId === item.id)) {
            notify.error(`"${item.name}" è già presente nella tabella`)
            return
        }
        try {
            const maxPrice = await costAnalysisApi.getMaxPurchasePrice(item.id)
            const newRow = await costAnalysisApi.add(jobId, {
                type: 'inventory',
                itemId: item.id,
                itemName: item.name,
                itemModel: item.model || '',
                itemUnit: item.unit || '',
                maxPurchasePrice: maxPrice,
                unitPrice: null,
                qtyEstimated: 0,
                qtyActual: 0,
                sortOrder: inventoryRows.length,
            })
            setRows(prev => [...prev, newRow])
        } catch { notify.error("Errore durante l'aggiunta dell'articolo") }
    }

    // ── Aggiungi voce generica ────────────────────────────────────────────────
    const handleAddGeneric = async () => {
        const name = newGenericName.trim()
        if (!name) return
        try {
            const newRow = await costAnalysisApi.add(jobId, {
                type: 'generic',
                itemId: null,
                itemName: name,
                itemModel: '',
                itemUnit: '',
                maxPurchasePrice: null,
                unitPrice: null,
                qtyEstimated: 0,
                qtyActual: 0,
                sortOrder: genericRows.length,
            })
            setRows(prev => [...prev, newRow])
            setNewGenericName('')
            setAddingGeneric(false)
        } catch { notify.error("Errore durante l'aggiunta della voce") }
    }

    // ── Aggiorna riga ─────────────────────────────────────────────────────────
    const handleUpdate = async (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r))
        try { await costAnalysisApi.update(id, fields) }
        catch { notify.error("Errore durante il salvataggio"); await loadRows() }
    }

    // ── Elimina riga ──────────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id))
        try { await costAnalysisApi.delete(id) }
        catch { notify.error("Errore durante l'eliminazione"); await loadRows() }
    }

    // ── Export Excel ──────────────────────────────────────────────────────────
    const handleExport = () => {
        const wb = XLSX.utils.book_new()
        const today = new Date().toISOString().slice(0, 10)
        const jobSlug = [jobCode, jobName].filter(Boolean).join('_')
            .replace(/[^a-zA-Z0-9_\-àáèéìíòóùú]/g, '_').replace(/_+/g, '_').slice(0, 40)
        type XS = Record<string, any>
        const xc = (v: any, s: XS = {}) => ({ v, t: typeof v === 'number' ? 'n' : 's', s })
        const hdr = (v: string) => xc(v, { fill: { patternType: 'solid', fgColor: { rgb: 'FF334155' } }, font: { bold: true, color: { rgb: 'FFFFFFFF' } } })
        const tot = (v: any) => xc(v, { fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } }, font: { bold: true, color: { rgb: 'FFFFFFFF' } } })

        // Sheet 1 — Materiali
        const matHdr = ['Articolo', 'Variante', '€/U.M.', 'Prezzo max acq.', 'Prezzo unitario', 'Qtà presunta', 'Tot. presunto']
        const matData: any[][] = [matHdr.map(hdr)]
        for (const r of inventoryRows) {
            matData.push([
                xc(r.itemName), xc(r.itemModel),
                xc(r.itemUnit ? `€/${r.itemUnit}` : '€/u.'),
                xc(r.maxPurchasePrice !== null ? fmtN(r.maxPurchasePrice) : ''),
                xc(r.unitPrice !== null ? fmtN(r.unitPrice) : ''),
                xc(fmtN(r.qtyEstimated)),
                xc(r.unitPrice !== null ? fmtN(r.unitPrice * r.qtyEstimated) : ''),
            ])
        }
        const invTotEst = inventoryRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
        matData.push([xc(''), xc(''), xc(''), xc(''), xc(''), tot('TOTALE'), tot(fmtN(invTotEst))])
        const ws1 = XLSX.utils.aoa_to_sheet(matData)
        ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]
        XLSX.utils.book_append_sheet(wb, ws1, 'Materiali')

        // Sheet 2 — Voci Generiche
        const genHdr = ['Voce', 'Prezzo unitario', 'Qtà presunta', 'Tot. presunto']
        const genData: any[][] = [genHdr.map(hdr)]
        for (const r of genericRows) {
            genData.push([
                xc(r.itemName),
                xc(r.unitPrice !== null ? fmtN(r.unitPrice) : ''),
                xc(fmtN(r.qtyEstimated)),
                xc(r.unitPrice !== null ? fmtN(r.unitPrice * r.qtyEstimated) : ''),
            ])
        }
        const genTotEst = genericRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
        genData.push([xc(''), tot('TOTALE'), xc(''), tot(fmtN(genTotEst))])
        const ws2 = XLSX.utils.aoa_to_sheet(genData)
        ws2['!cols'] = [{ wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]
        XLSX.utils.book_append_sheet(wb, ws2, 'Voci Generiche')

        XLSX.writeFile(wb, `${[jobSlug, 'Analisi_Costi', today].filter(Boolean).join('_')}.xlsx`)
    }

    if (loading) return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header actions */}
            <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-1" />
                    Excel
                </Button>
            </div>

            {/* ── Sezione 1: Materiali da Magazzino ─────────────────────────── */}
            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Materiali da Magazzino</span>
                    <Button
                        size="sm"
                        onClick={() => setSelectorOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                    >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        Aggiungi articolo
                    </Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {inventoryRows.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">
                            Nessun materiale. Usa "Aggiungi articolo" per aggiungerne uno manualmente.
                        </p>
                    ) : (
                        <MaterialTable
                            rows={inventoryRows}
                            onUpdate={handleUpdate}
                        />
                    )}
                </CardContent>
            </Card>

            {/* ── Sezione 2: Voci Generiche ──────────────────────────────────── */}
            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Voci Generiche</span>
                    <Button
                        size="sm"
                        onClick={() => setAddingGeneric(true)}
                        className="bg-slate-600 hover:bg-slate-700 h-8 text-xs"
                    >
                        <PlusCircle className="h-3.5 w-3.5 mr-1" />
                        Aggiungi voce
                    </Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {/* Riga di inserimento inline */}
                    {addingGeneric && (
                        <div className="flex items-center gap-2 py-3 border-b border-slate-100 dark:border-slate-800">
                            <Input
                                autoFocus
                                placeholder="Nome voce (es. Noleggio gru, Smaltimento…)"
                                value={newGenericName}
                                onChange={e => setNewGenericName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddGeneric(); if (e.key === 'Escape') { setAddingGeneric(false); setNewGenericName('') } }}
                                className="flex-1 text-sm"
                            />
                            <Button size="sm" onClick={handleAddGeneric} disabled={!newGenericName.trim()} className="bg-slate-600 hover:bg-slate-700">
                                Aggiungi
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingGeneric(false); setNewGenericName('') }}>
                                Annulla
                            </Button>
                        </div>
                    )}
                    {genericRows.length === 0 && !addingGeneric ? (
                        <p className="text-sm text-slate-400 text-center py-6">
                            Nessuna voce generica. Usa "Aggiungi voce".
                        </p>
                    ) : genericRows.length > 0 ? (
                        <GenericTable
                            rows={genericRows}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                        />
                    ) : null}
                </CardContent>
            </Card>

            {/* Item selector dialog */}
            <ItemSelectorDialog
                open={selectorOpen}
                onOpenChange={setSelectorOpen}
                onSelect={handleSelectItem}
                items={inventory}
                onSearch={handleItemSearch}
                loading={invLoading}
            />
        </div>
    )
}
