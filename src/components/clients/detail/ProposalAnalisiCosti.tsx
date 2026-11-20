"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, PlusCircle, X, Download, Package, FileText, Calculator, ArrowLeft, Truck, Save, Undo2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { proposalCostAnalysisApi } from "@/lib/services/proposal-cost-analysis"
import { costAnalysisApi, CostAnalysisRow, CostAnalysisParams, effectiveUnitPrice } from "@/lib/services/cost-analysis"
import { inventoryApi, clientsApi } from "@/lib/api"
import { clientProposalsApi } from "@/lib/services/client-proposals"
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog"
import { notify } from "@/lib/notify"
import type { InventoryItem, Client } from "@/lib/types"
import { generateCostAnalysisPDF } from "@/lib/pdf/cost-analysis-pdf"
import { generateCostAnalysisExcel } from "@/lib/excel/cost-analysis-excel"

interface Props {
    // null per le analisi che appartengono direttamente a una commessa senza offerta
    proposalId: string | null
    // Etichetta della commessa, usata come titolo negli export quando non c'è un'offerta
    jobLabel?: string
    versionId: string
    versionName: string
    versionCreatedAt: string
    onBack: () => void
}

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 , useGrouping: true})

function EditCell({ value, onSave, placeholder = '—' }: { value: number | null; onSave: (v: number | null) => void; placeholder?: string }) {
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
    if (editing) return <Input autoFocus className="h-7 text-xs text-right w-20 px-1" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
    return <button className="text-xs font-mono text-right hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-0.5 min-w-[4.5rem] block w-full" onClick={start}>{value !== null ? fmt(value) : <span className="text-slate-300 italic">{placeholder}</span>}</button>
}

function InlineTextEdit({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    const start = () => { setDraft(value); setEditing(true) }
    const commit = () => { setEditing(false); const v = draft.trim(); if (v !== value) onSave(v || value) }
    if (editing) return <Input autoFocus className="h-7 text-xs w-full" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }} />
    return <button className="text-left w-full hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-0.5 text-sm" onClick={start}>{value || <span className="text-slate-400 italic text-xs">{placeholder}</span>}</button>
}

function MaterialTable({ rows, onUpdate, onDelete }: { rows: CostAnalysisRow[]; onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual'>>) => void; onDelete: (id: string) => void }) {
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const totalEst = rows.reduce((s, r) => s + (effectiveUnitPrice(r) ?? 0) * r.qtyEstimated, 0)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-100/80 dark:bg-slate-800/70">
                    <th className="text-left p-2 font-medium text-slate-500">Articolo</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo max acq.</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo unit.</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Qtà presunta</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Tot. presunto</th>
                    <th className="w-6 p-2"></th>
                </tr></thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const price = effectiveUnitPrice(row)
                        const usingMax = row.unitPrice === null && row.maxPurchasePrice !== null
                        const totEst = (price ?? 0) * row.qtyEstimated
                        const unitPfx = row.itemUnit ? `€/${row.itemUnit}` : '€'
                        const label = row.itemModel ? `${row.itemName} (${row.itemModel})` : row.itemName
                        const stripe = idx % 2 === 1 ? 'bg-slate-50/80 dark:bg-slate-800/30' : ''
                        return (
                            <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 ${stripe}`}>
                                <td className="p-2 text-slate-800 dark:text-slate-200 text-sm leading-snug">{label}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {row.maxPurchasePrice !== null ? <span className="text-xs font-mono text-slate-600"><span className="text-slate-400 text-[10px] mr-0.5">{unitPfx}</span>{fmt(row.maxPurchasePrice)}</span> : <Badge variant="outline" className="text-xs text-slate-400 border-slate-300">N/D</Badge>}
                                </td>
                                <td className="p-2 text-right"><div className="flex items-center justify-end gap-0.5"><span className="text-[10px] text-slate-400">{unitPfx}</span><EditCell value={row.unitPrice} onSave={v => onUpdate(row.id, { unitPrice: v })} placeholder={row.maxPurchasePrice !== null ? fmt(row.maxPurchasePrice) : '—'} /></div></td>
                                <td className="p-2 text-right"><EditCell value={row.qtyEstimated || null} onSave={v => onUpdate(row.id, { qtyEstimated: v ?? 0 })} /></td>
                                <td className={`p-2 text-right font-mono text-xs ${usingMax ? 'italic text-slate-500' : 'text-slate-700 dark:text-slate-300 font-medium'}`} title={usingMax ? 'Prezzo non impostato: usato in automatico il prezzo massimo di acquisto' : undefined}>{price !== null ? `€ ${fmt(totEst)}` : '—'}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {pendingDelete === row.id ? (
                                        <span className="flex items-center gap-1 justify-end">
                                            <span className="text-xs text-slate-500">Eliminare?</span>
                                            <button onClick={() => { onDelete(row.id); setPendingDelete(null) }} className="text-xs font-medium text-red-600 hover:text-red-700 px-1">Sì</button>
                                            <button onClick={() => setPendingDelete(null)} className="text-xs text-slate-400 hover:text-slate-600 px-1">No</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setPendingDelete(row.id)} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                {rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 font-semibold text-sm"><td colSpan={4} className="p-2 text-slate-600 dark:text-slate-400">Totale materiali</td><td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td><td></td></tr></tfoot>}
            </table>
        </div>
    )
}

function GenericTable({ rows, onUpdate, onDelete, voceLabel = 'Voce', totalLabel = 'Totale voci generiche' }: { rows: CostAnalysisRow[]; voceLabel?: string; totalLabel?: string; onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => void; onDelete: (id: string) => void }) {
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const totalEst = rows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-100/80 dark:bg-slate-800/70">
                    <th className="text-left p-2 font-medium text-slate-500">{voceLabel}</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo unit. (€)</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Qtà presunta</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Tot. presunto</th>
                    <th className="w-6 p-2"></th>
                </tr></thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const totEst = (row.unitPrice ?? 0) * row.qtyEstimated
                        const stripe = idx % 2 === 1 ? 'bg-slate-50/80 dark:bg-slate-800/30' : ''
                        return (
                            <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 ${stripe}`}>
                                <td className="p-2 min-w-[160px]"><InlineTextEdit value={row.itemName} onSave={v => onUpdate(row.id, { itemName: v })} placeholder="Descrizione voce…" /></td>
                                <td className="p-2 text-right"><EditCell value={row.unitPrice} onSave={v => onUpdate(row.id, { unitPrice: v })} /></td>
                                <td className="p-2 text-right"><EditCell value={row.qtyEstimated || null} onSave={v => onUpdate(row.id, { qtyEstimated: v ?? 0 })} /></td>
                                <td className="p-2 text-right font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{row.unitPrice !== null ? `€ ${fmt(totEst)}` : '—'}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {pendingDelete === row.id ? (
                                        <span className="flex items-center gap-1 justify-end">
                                            <span className="text-xs text-slate-500">Eliminare?</span>
                                            <button onClick={() => { onDelete(row.id); setPendingDelete(null) }} className="text-xs font-medium text-red-600 hover:text-red-700 px-1">Sì</button>
                                            <button onClick={() => setPendingDelete(null)} className="text-xs text-slate-400 hover:text-slate-600 px-1">No</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setPendingDelete(row.id)} className="text-slate-300 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                {rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 font-semibold text-sm"><td colSpan={3} className="p-2 text-slate-600 dark:text-slate-400">{totalLabel}</td><td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td><td></td></tr></tfoot>}
            </table>
        </div>
    )
}

function SummaryRow({ label, value, delta, subtotal }: { label: string; value: number; delta?: number; subtotal?: string }) {
    return (
        <>
            <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400 text-xs">{label}</td>
                <td className="py-1.5 px-2 text-right font-mono text-xs text-slate-500">{delta !== undefined && delta !== 0 && <span className={delta > 0 ? 'text-emerald-600' : 'text-red-500'}>{delta > 0 ? '+' : ''}€ {fmt(Math.abs(delta))}</span>}</td>
                <td className="py-1.5 px-2 text-right font-mono text-xs text-slate-600 dark:text-slate-400">€ {fmt(value)}</td>
            </tr>
            {subtotal && <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30"><td className="py-1.5 px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{subtotal}</td><td></td><td className="py-1.5 px-2 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">€ {fmt(value)}</td></tr>}
        </>
    )
}

const DEFAULT_PARAMS = { sfrido: 5, sconto: 0, trasporto: 0, posa: 0, ricarico: 30, margineTrattativa: 10 }

export function ProposalAnalisiCosti({ proposalId, jobLabel, versionId, versionName, versionCreatedAt, onBack }: Props) {
    // «rows»/«params» sono la bozza modificabile; «savedRows»/«savedParams» l'ultimo stato salvato nel database.
    // Nulla viene scritto finché non si preme «Salva».
    const [rows, setRows] = useState<CostAnalysisRow[]>([])
    const [savedRows, setSavedRows] = useState<CostAnalysisRow[]>([])
    const [params, setParams] = useState<CostAnalysisParams>({ jobId: versionId, ...DEFAULT_PARAMS })
    const [savedParams, setSavedParams] = useState<CostAnalysisParams>({ jobId: versionId, ...DEFAULT_PARAMS })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [leaveOpen, setLeaveOpen] = useState(false)
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [invLoading, setInvLoading] = useState(false)
    const [addingKind, setAddingKind] = useState<'generic' | 'transport' | 'posa' | null>(null)
    const [newVoceName, setNewVoceName] = useState('')
    const [proposalTitle, setProposalTitle] = useState('')
    const [client, setClient] = useState<Client | null>(null)
    const [exportingPdf, setExportingPdf] = useState(false)
    const [exportingExcel, setExportingExcel] = useState(false)
    const tempId = useRef(0)

    const inventoryRows = useMemo(() => rows.filter(r => r.type === 'inventory'), [rows])
    const genericRows = useMemo(() => rows.filter(r => r.type === 'generic'), [rows])
    const transportRows = useMemo(() => rows.filter(r => r.type === 'transport'), [rows])
    const posaRows = useMemo(() => rows.filter(r => r.type === 'posa'), [rows])

    const loadRows = async () => {
        try {
            setLoading(true)
            const [existing, paramsData] = await Promise.all([
                proposalCostAnalysisApi.getByVersionId(versionId),
                proposalCostAnalysisApi.getParams(versionId),
            ])
            setRows(existing); setSavedRows(existing)
            setParams(paramsData); setSavedParams(paramsData)
        } catch { notify.error("Errore nel caricamento dell'analisi costi") }
        finally { setLoading(false) }
    }

    useEffect(() => { loadRows() }, [versionId])

    useEffect(() => {
        if (!proposalId) { setProposalTitle(jobLabel ?? ''); setClient(null); return }
        clientProposalsApi.getById(proposalId)
            .then(async proposal => {
                setProposalTitle(proposal?.title ?? '')
                if (proposal?.clientId) setClient(await clientsApi.getById(proposal.clientId))
            })
            .catch(() => { setProposalTitle(''); setClient(null) })
    }, [proposalId, jobLabel])

    // Trasporto (A) e Posa (B): se ci sono delle voci, il valore è la loro somma; altrimenti resta quello digitato a mano
    const sumRows = (list: CostAnalysisRow[]) => list.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
    const trasportoTot = transportRows.length > 0 ? sumRows(transportRows) : params.trasporto
    const posaTot = posaRows.length > 0 ? sumRows(posaRows) : params.posa
    const effParams: CostAnalysisParams = useMemo(
        () => ({ ...params, trasporto: trasportoTot, posa: posaTot }),
        [params, trasportoTot, posaTot]
    )

    // Modifiche non ancora salvate
    const rowSig = (list: CostAnalysisRow[]) => JSON.stringify(list.map(r => [r.id, r.type, r.itemId, r.itemName, r.unitPrice, r.qtyEstimated]))
    const paramSig = (p: CostAnalysisParams) => JSON.stringify([p.sfrido, p.sconto, p.trasporto, p.posa, p.ricarico, p.margineTrattativa])
    const dirty = useMemo(
        () => rowSig(rows) !== rowSig(savedRows) || paramSig(effParams) !== paramSig(savedParams),
        [rows, savedRows, effParams, savedParams]
    )

    // Avvisa se si chiude/ricarica la pagina con modifiche non salvate
    useEffect(() => {
        if (!dirty) return
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [dirty])

    const handleItemSearch = useCallback(async (term: string) => {
        setInvLoading(true)
        try { const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term }); setInventory(items) }
        catch { /* non bloccante */ }
        finally { setInvLoading(false) }
    }, [])

    const newLocalRow = (fields: Omit<CostAnalysisRow, 'id' | 'jobId' | 'createdAt'>): CostAnalysisRow => ({
        ...fields, id: `new-${++tempId.current}`, jobId: versionId, createdAt: new Date().toISOString(),
    })

    const handleSelectItem = async (item: InventoryItem) => {
        setSelectorOpen(false)
        if (inventoryRows.some(r => r.itemId === item.id)) { notify.error(`"${item.name}" è già presente`); return }
        try {
            const maxPrice = await costAnalysisApi.getMaxPurchasePrice(item.id)
            const newRow = newLocalRow({
                type: 'inventory', itemId: item.id, itemName: item.name,
                itemModel: item.model || '', itemUnit: (item as any).unit || '',
                maxPurchasePrice: maxPrice, unitPrice: null,
                qtyEstimated: 0, qtyActual: 0, sortOrder: inventoryRows.length,
            })
            setRows(prev => [...prev, newRow])
        } catch { notify.error("Errore durante l'aggiunta dell'articolo") }
    }

    const handleAddVoce = () => {
        const name = newVoceName.trim()
        if (!name || !addingKind) return
        const sameKind = rows.filter(r => r.type === addingKind)
        setRows(prev => [...prev, newLocalRow({
            type: addingKind, itemId: null, itemName: name,
            itemModel: '', itemUnit: '', maxPurchasePrice: null,
            unitPrice: null, qtyEstimated: 0, qtyActual: 0, sortOrder: sameKind.length,
        })])
        setNewVoceName(''); setAddingKind(null)
    }

    const handleUpdate = (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r))
    }

    const handleDelete = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id))
    }

    const handleParamChange = (field: keyof Omit<CostAnalysisParams, 'jobId'>, value: number) => {
        setParams(prev => ({ ...prev, [field]: value }))
    }

    // Scrive nel database solo ciò che è cambiato rispetto all'ultimo salvataggio
    const handleSave = async (): Promise<boolean> => {
        try {
            setSaving(true)
            const draftIds = new Set(rows.map(r => r.id))
            const saved = new Map(savedRows.map(r => [r.id, r]))
            const ops: Promise<unknown>[] = []
            for (const r of savedRows) if (!draftIds.has(r.id)) ops.push(proposalCostAnalysisApi.delete(r.id))
            rows.forEach((r, idx) => {
                const old = saved.get(r.id)
                if (!old) {
                    ops.push(proposalCostAnalysisApi.add(proposalId, versionId, {
                        type: r.type, itemId: r.itemId, itemName: r.itemName, itemModel: r.itemModel, itemUnit: r.itemUnit,
                        maxPurchasePrice: r.maxPurchasePrice, unitPrice: r.unitPrice,
                        qtyEstimated: r.qtyEstimated, qtyActual: r.qtyActual, sortOrder: idx,
                    }))
                } else if (old.unitPrice !== r.unitPrice || old.qtyEstimated !== r.qtyEstimated || old.itemName !== r.itemName) {
                    ops.push(proposalCostAnalysisApi.update(r.id, { unitPrice: r.unitPrice, qtyEstimated: r.qtyEstimated, itemName: r.itemName }))
                }
            })
            // Il valore di Trasporto (A) e Posa (B) salvato è sempre quello effettivo (somma delle voci, se presenti)
            ops.push(proposalCostAnalysisApi.upsertParams(proposalId, versionId, {
                sfrido: effParams.sfrido, sconto: effParams.sconto, trasporto: effParams.trasporto,
                posa: effParams.posa, ricarico: effParams.ricarico, margineTrattativa: effParams.margineTrattativa,
            }))
            await Promise.all(ops)
            await loadRows()
            notify.success("Analisi costi salvata")
            return true
        } catch {
            notify.error("Errore durante il salvataggio dell'analisi costi")
            return false
        } finally { setSaving(false) }
    }

    const handleDiscard = () => { setRows(savedRows); setParams(savedParams); setAddingKind(null); setNewVoceName('') }

    const handleBack = () => { if (dirty) setLeaveOpen(true); else onBack() }

    const totBase = useMemo(() => [...inventoryRows, ...genericRows].reduce((s, r) => s + (effectiveUnitPrice(r) ?? 0) * r.qtyEstimated, 0), [inventoryRows, genericRows])
    const sfrido_delta = totBase * effParams.sfrido / 100
    const totListino = totBase + sfrido_delta
    const sconto_delta = totListino * effParams.sconto / 100
    const totSconto = totListino - sconto_delta
    const costoFranco = totSconto + effParams.trasporto
    const costoTot = costoFranco + effParams.posa
    const ric_delta = costoTot * effParams.ricarico / 100
    const conRicarico = costoTot + ric_delta
    const marg_delta = conRicarico * effParams.margineTrattativa / 100
    const totaleFinalE = conRicarico + marg_delta

    const exportInput = () => ({
        client, proposalTitle, versionName, createdAt: versionCreatedAt,
        inventoryRows, genericRows, transportRows, posaRows, params: effParams,
    })

    const handleExportPdf = async () => {
        try { setExportingPdf(true); await generateCostAnalysisPDF(exportInput()) }
        catch { notify.error("Errore durante la generazione del PDF") }
        finally { setExportingPdf(false) }
    }

    const handleExportExcel = async () => {
        try { setExportingExcel(true); await generateCostAnalysisExcel(exportInput()) }
        catch { notify.error("Errore durante la generazione dell'Excel") }
        finally { setExportingExcel(false) }
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

    // Form «nuova voce» condiviso dalle tre sezioni
    const addVoceForm = (kind: 'generic' | 'transport' | 'posa', placeholder: string) => addingKind === kind && (
        <div className="flex items-center gap-2 py-3 border-b border-slate-100 dark:border-slate-800">
            <Input autoFocus placeholder={placeholder} value={newVoceName} onChange={e => setNewVoceName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddVoce(); if (e.key === 'Escape') { setAddingKind(null); setNewVoceName('') } }} className="flex-1 text-sm" />
            <Button size="sm" onClick={handleAddVoce} disabled={!newVoceName.trim()} className="bg-slate-600 hover:bg-slate-700">Aggiungi</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingKind(null); setNewVoceName('') }}>Annulla</Button>
        </div>
    )

    const paramRows = [
        { label: 'Sfrido', field: 'sfrido', suffix: '%', fromVoci: false, value: 0 },
        { label: 'Sconto', field: 'sconto', suffix: '%', fromVoci: false, value: 0 },
        { label: 'Trasporto (A)', field: 'trasporto', suffix: '€', fromVoci: transportRows.length > 0, value: trasportoTot },
        { label: 'Posa (B)', field: 'posa', suffix: '€', fromVoci: posaRows.length > 0, value: posaTot },
        { label: 'Ricarico', field: 'ricarico', suffix: '%', fromVoci: false, value: 0 },
        { label: 'Margine Trattativa', field: 'margineTrattativa', suffix: '%', fromVoci: false, value: 0 },
    ] as const

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button size="sm" variant="ghost" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-1" />Torna alle versioni</Button>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{versionName}</span>
                    {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Modifiche non salvate</span>}
                    {dirty && (
                        <Button size="sm" variant="outline" onClick={handleDiscard} disabled={saving}>
                            <Undo2 className="h-4 w-4 mr-1" />Annulla modifiche
                        </Button>
                    )}
                    <Button size="sm" onClick={() => { void handleSave() }} disabled={!dirty || saving} className="bg-emerald-600 hover:bg-emerald-700">
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Salva
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exportingPdf}>
                        {exportingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={exportingExcel}>
                        {exportingExcel ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}Excel
                    </Button>
                </div>
            </div>
            {dirty && <p className="text-xs text-slate-500">PDF ed Excel includono anche le modifiche non ancora salvate.</p>}

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Materiali da Magazzino</span>
                    <Button size="sm" onClick={() => setSelectorOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi articolo</Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {inventoryRows.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Nessun materiale. Usa "Aggiungi articolo" per aggiungerne uno manualmente.</p> : <MaterialTable rows={inventoryRows} onUpdate={handleUpdate} onDelete={handleDelete} />}
                </CardContent>
            </Card>

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Voci Generiche</span>
                    <Button size="sm" onClick={() => { setNewVoceName(''); setAddingKind('generic') }} className="bg-slate-600 hover:bg-slate-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi voce</Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {addVoceForm('generic', 'Nome voce (es. Noleggio gru, Smaltimento…)')}
                    {genericRows.length === 0 && addingKind !== 'generic' ? <p className="text-sm text-slate-400 text-center py-6">Nessuna voce generica. Usa "Aggiungi voce".</p> : genericRows.length > 0 ? <GenericTable rows={genericRows} onUpdate={handleUpdate} onDelete={handleDelete} /> : null}
                </CardContent>
            </Card>

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <Truck className="h-5 w-5 text-amber-600" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Trasporto e posa</span>
                </div>
                <CardContent className="pt-3 pb-4 px-4 space-y-5">
                    <p className="text-xs text-slate-500">Le voci inserite qui, sommate, definiscono i valori Trasporto (A) e Posa (B) del riepilogo prezzi. Senza voci, A e B restano quelli digitati a mano nei parametri.</p>
                    <div>
                        <div className="flex items-center gap-3 pb-1">
                            <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Trasporto (A)</span>
                            <Button size="sm" onClick={() => { setNewVoceName(''); setAddingKind('transport') }} className="bg-slate-600 hover:bg-slate-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi voce</Button>
                        </div>
                        {addVoceForm('transport', 'Voce di trasporto (es. Camion 5 q.li, Corriere…)')}
                        {transportRows.length === 0 && addingKind !== 'transport' ? <p className="text-sm text-slate-400 text-center py-4">Nessuna voce di trasporto.</p> : transportRows.length > 0 ? <GenericTable rows={transportRows} voceLabel="Voce di trasporto" totalLabel="Totale trasporto (A)" onUpdate={handleUpdate} onDelete={handleDelete} /> : null}
                    </div>
                    <div>
                        <div className="flex items-center gap-3 pb-1">
                            <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Posa (B)</span>
                            <Button size="sm" onClick={() => { setNewVoceName(''); setAddingKind('posa') }} className="bg-slate-600 hover:bg-slate-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi voce</Button>
                        </div>
                        {addVoceForm('posa', 'Voce di posa (es. Squadra posatori, Ponteggio…)')}
                        {posaRows.length === 0 && addingKind !== 'posa' ? <p className="text-sm text-slate-400 text-center py-4">Nessuna voce di posa.</p> : posaRows.length > 0 ? <GenericTable rows={posaRows} voceLabel="Voce di posa" totalLabel="Totale posa (B)" onUpdate={handleUpdate} onDelete={handleDelete} /> : null}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <Calculator className="h-5 w-5 text-emerald-600" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Riepilogo Prezzi</span>
                </div>
                <CardContent className="pt-4 pb-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Parametri</p>
                            <div className="space-y-0">
                                {paramRows.map(p => (
                                    <div key={p.field} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{p.label}</span>
                                        <div className="flex items-center gap-1.5">
                                            {p.fromVoci ? (
                                                <div className="text-right text-xs font-mono px-1" title="Somma delle voci della sezione Trasporto e posa">
                                                    {fmt(p.value)} <span className="text-[10px] text-slate-400 font-sans">da voci</span>
                                                </div>
                                            ) : (
                                                <div className="w-20 text-right"><EditCell value={params[p.field]} onSave={v => handleParamChange(p.field, v ?? 0)} /></div>
                                            )}
                                            <span className="text-xs text-slate-400 w-4 text-left">{p.suffix}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Calcolo</p>
                            <table className="w-full text-sm">
                                <tbody>
                                    <SummaryRow label="Tot. materiali + voci" value={totBase} />
                                    <SummaryRow label={`+ Sfrido (${effParams.sfrido}%)`} delta={sfrido_delta} value={totListino} subtotal="TOT materiali listino" />
                                    <SummaryRow label={`− Sconto (${effParams.sconto}%)`} delta={-sconto_delta} value={totSconto} subtotal="TOT materiali sconto" />
                                    <SummaryRow label={`+ Trasporto (A)`} delta={effParams.trasporto} value={costoFranco} subtotal="Costo franco" />
                                    <SummaryRow label={`+ Posa (B)`} delta={effParams.posa} value={costoTot} subtotal="Costo TOT (TC)" />
                                    <SummaryRow label={`+ Ricarico (${effParams.ricarico}%)`} delta={ric_delta} value={conRicarico} />
                                    <SummaryRow label={`+ Margine trattativa (${effParams.margineTrattativa}%)`} delta={marg_delta} value={totaleFinalE} />
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                                        <td className="py-2.5 px-2 font-bold text-blue-800 dark:text-blue-200 text-sm">TOTALE FINALE</td>
                                        <td></td>
                                        <td className="py-2.5 px-2 text-right font-bold font-mono text-blue-700 dark:text-blue-300">€ {fmt(totaleFinalE)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <ItemSelectorDialog open={selectorOpen} onOpenChange={setSelectorOpen} onSelect={handleSelectItem} items={inventory} onSearch={handleItemSearch} loading={invLoading} />

            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Modifiche non salvate</DialogTitle>
                        <DialogDescription>Questa analisi costi ha modifiche non salvate. Vuoi salvarle prima di uscire?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setLeaveOpen(false)}>Continua a modificare</Button>
                        <Button variant="outline" className="text-red-600" onClick={() => { setLeaveOpen(false); onBack() }}>Esci senza salvare</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={async () => { if (await handleSave()) { setLeaveOpen(false); onBack() } }}>
                            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salva ed esci
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
