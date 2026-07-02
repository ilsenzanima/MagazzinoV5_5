"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, PlusCircle, X, Download, Package, FileText, Calculator, ArrowLeft } from "lucide-react"
import { proposalCostAnalysisApi } from "@/lib/services/proposal-cost-analysis"
import { costAnalysisApi, CostAnalysisRow, CostAnalysisParams } from "@/lib/services/cost-analysis"
import { inventoryApi, clientsApi } from "@/lib/api"
import { clientProposalsApi } from "@/lib/services/client-proposals"
import { ItemSelectorDialog } from "@/components/inventory/ItemSelectorDialog"
import { notify } from "@/lib/notify"
import type { InventoryItem, Client } from "@/lib/types"
import { generateCostAnalysisPDF } from "@/lib/pdf/cost-analysis-pdf"

interface Props {
    proposalId: string
    versionId: string
    versionName: string
    versionCreatedAt: string
    onBack: () => void
}

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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

function MaterialTable({ rows, onUpdate }: { rows: CostAnalysisRow[]; onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual'>>) => void }) {
    const totalEst = rows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-100/80 dark:bg-slate-800/70">
                    <th className="text-left p-2 font-medium text-slate-500">Articolo</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo max acq.</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Prezzo unit.</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Qtà presunta</th>
                    <th className="text-right p-2 font-medium text-slate-500 whitespace-nowrap">Tot. presunto</th>
                </tr></thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const totEst = (row.unitPrice ?? 0) * row.qtyEstimated
                        const unitPfx = row.itemUnit ? `€/${row.itemUnit}` : '€'
                        const label = row.itemModel ? `${row.itemName} (${row.itemModel})` : row.itemName
                        const stripe = idx % 2 === 1 ? 'bg-slate-50/80 dark:bg-slate-800/30' : ''
                        return (
                            <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 ${stripe}`}>
                                <td className="p-2 text-slate-800 dark:text-slate-200 text-sm leading-snug">{label}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                    {row.maxPurchasePrice !== null ? <span className="text-xs font-mono text-slate-600"><span className="text-slate-400 text-[10px] mr-0.5">{unitPfx}</span>{fmt(row.maxPurchasePrice)}</span> : <Badge variant="outline" className="text-xs text-slate-400 border-slate-300">N/D</Badge>}
                                </td>
                                <td className="p-2 text-right"><div className="flex items-center justify-end gap-0.5"><span className="text-[10px] text-slate-400">{unitPfx}</span><EditCell value={row.unitPrice} onSave={v => onUpdate(row.id, { unitPrice: v })} /></div></td>
                                <td className="p-2 text-right"><EditCell value={row.qtyEstimated || null} onSave={v => onUpdate(row.id, { qtyEstimated: v ?? 0 })} /></td>
                                <td className="p-2 text-right font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">{row.unitPrice !== null ? `€ ${fmt(totEst)}` : '—'}</td>
                            </tr>
                        )
                    })}
                </tbody>
                {rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 font-semibold text-sm"><td colSpan={4} className="p-2 text-slate-600 dark:text-slate-400">Totale materiali</td><td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td></tr></tfoot>}
            </table>
        </div>
    )
}

function GenericTable({ rows, onUpdate, onDelete }: { rows: CostAnalysisRow[]; onUpdate: (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => void; onDelete: (id: string) => void }) {
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const totalEst = rows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0)
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-100/80 dark:bg-slate-800/70">
                    <th className="text-left p-2 font-medium text-slate-500">Voce</th>
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
                {rows.length > 0 && <tfoot><tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 font-semibold text-sm"><td colSpan={3} className="p-2 text-slate-600 dark:text-slate-400">Totale voci generiche</td><td className="p-2 text-right font-mono text-blue-700 dark:text-blue-300">€ {fmt(totalEst)}</td><td></td></tr></tfoot>}
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

export function ProposalAnalisiCosti({ proposalId, versionId, versionName, versionCreatedAt, onBack }: Props) {
    const [rows, setRows] = useState<CostAnalysisRow[]>([])
    const [params, setParams] = useState<CostAnalysisParams>({ jobId: versionId, ...DEFAULT_PARAMS })
    const [loading, setLoading] = useState(true)
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [invLoading, setInvLoading] = useState(false)
    const [addingGeneric, setAddingGeneric] = useState(false)
    const [newGenericName, setNewGenericName] = useState('')
    const [proposalTitle, setProposalTitle] = useState('')
    const [client, setClient] = useState<Client | null>(null)
    const [exportingPdf, setExportingPdf] = useState(false)

    const inventoryRows = useMemo(() => rows.filter(r => r.type === 'inventory'), [rows])
    const genericRows = useMemo(() => rows.filter(r => r.type === 'generic'), [rows])

    const loadRows = async () => {
        try {
            setLoading(true)
            const [existing, paramsData] = await Promise.all([
                proposalCostAnalysisApi.getByVersionId(versionId),
                proposalCostAnalysisApi.getParams(versionId),
            ])
            setRows(existing)
            setParams(paramsData)
        } catch { notify.error("Errore nel caricamento dell'analisi costi") }
        finally { setLoading(false) }
    }

    useEffect(() => { loadRows() }, [versionId])

    useEffect(() => {
        clientProposalsApi.getById(proposalId)
            .then(async proposal => {
                setProposalTitle(proposal?.title ?? '')
                if (proposal?.clientId) setClient(await clientsApi.getById(proposal.clientId))
            })
            .catch(() => { setProposalTitle(''); setClient(null) })
    }, [proposalId])

    const handleItemSearch = useCallback(async (term: string) => {
        setInvLoading(true)
        try { const { items } = await inventoryApi.getPaginated({ page: 1, limit: 50, search: term }); setInventory(items) }
        catch { /* non bloccante */ }
        finally { setInvLoading(false) }
    }, [])

    const handleSelectItem = async (item: InventoryItem) => {
        setSelectorOpen(false)
        if (inventoryRows.some(r => r.itemId === item.id)) { notify.error(`"${item.name}" è già presente`); return }
        try {
            const maxPrice = await costAnalysisApi.getMaxPurchasePrice(item.id)
            const newRow = await proposalCostAnalysisApi.add(proposalId, versionId, {
                type: 'inventory', itemId: item.id, itemName: item.name,
                itemModel: item.model || '', itemUnit: (item as any).unit || '',
                maxPurchasePrice: maxPrice, unitPrice: null,
                qtyEstimated: 0, qtyActual: 0, sortOrder: inventoryRows.length,
            })
            setRows(prev => [...prev, newRow])
        } catch { notify.error("Errore durante l'aggiunta dell'articolo") }
    }

    const handleAddGeneric = async () => {
        const name = newGenericName.trim()
        if (!name) return
        try {
            const newRow = await proposalCostAnalysisApi.add(proposalId, versionId, {
                type: 'generic', itemId: null, itemName: name,
                itemModel: '', itemUnit: '', maxPurchasePrice: null,
                unitPrice: null, qtyEstimated: 0, qtyActual: 0, sortOrder: genericRows.length,
            })
            setRows(prev => [...prev, newRow])
            setNewGenericName(''); setAddingGeneric(false)
        } catch { notify.error("Errore durante l'aggiunta della voce") }
    }

    const handleUpdate = async (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName'>>) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r))
        try { await proposalCostAnalysisApi.update(id, fields) }
        catch { notify.error("Errore durante il salvataggio"); await loadRows() }
    }

    const handleDelete = async (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id))
        try { await proposalCostAnalysisApi.delete(id) }
        catch { notify.error("Errore durante l'eliminazione"); await loadRows() }
    }

    const handleParamChange = async (field: keyof Omit<CostAnalysisParams, 'jobId'>, value: number) => {
        const updated = { ...params, [field]: value }
        setParams(updated)
        try { await proposalCostAnalysisApi.upsertParams(proposalId, versionId, { sfrido: updated.sfrido, sconto: updated.sconto, trasporto: updated.trasporto, posa: updated.posa, ricarico: updated.ricarico, margineTrattativa: updated.margineTrattativa }) }
        catch { notify.error("Errore durante il salvataggio dei parametri") }
    }

    const totBase = useMemo(() => [...inventoryRows, ...genericRows].reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0), [inventoryRows, genericRows])
    const sfrido_delta = totBase * params.sfrido / 100
    const totListino = totBase + sfrido_delta
    const sconto_delta = totListino * params.sconto / 100
    const totSconto = totListino - sconto_delta
    const costoFranco = totSconto + params.trasporto
    const costoTot = costoFranco + params.posa
    const ric_delta = costoTot * params.ricarico / 100
    const conRicarico = costoTot + ric_delta
    const marg_delta = conRicarico * params.margineTrattativa / 100
    const totaleFinalE = conRicarico + marg_delta

    const handleExportPdf = async () => {
        try {
            setExportingPdf(true)
            await generateCostAnalysisPDF({
                client, proposalTitle, versionName, createdAt: versionCreatedAt,
                inventoryRows, genericRows, params,
            })
        } catch { notify.error("Errore durante la generazione del PDF") }
        finally { setExportingPdf(false) }
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Torna alle versioni</Button>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{versionName}</span>
                    <Button size="sm" variant="outline" onClick={handleExportPdf} disabled={exportingPdf}>
                        {exportingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}PDF
                    </Button>
                </div>
            </div>

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Materiali da Magazzino</span>
                    <Button size="sm" onClick={() => setSelectorOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi articolo</Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {inventoryRows.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Nessun materiale. Usa "Aggiungi articolo" per aggiungerne uno manualmente.</p> : <MaterialTable rows={inventoryRows} onUpdate={handleUpdate} />}
                </CardContent>
            </Card>

            <Card>
                <div className="flex items-center gap-3 p-4 border-b">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <span className="flex-1 font-semibold text-slate-800 dark:text-slate-100">Voci Generiche</span>
                    <Button size="sm" onClick={() => setAddingGeneric(true)} className="bg-slate-600 hover:bg-slate-700 h-8 text-xs"><PlusCircle className="h-3.5 w-3.5 mr-1" />Aggiungi voce</Button>
                </div>
                <CardContent className="pt-0 pb-4 px-4">
                    {addingGeneric && (
                        <div className="flex items-center gap-2 py-3 border-b border-slate-100 dark:border-slate-800">
                            <Input autoFocus placeholder="Nome voce (es. Noleggio gru, Smaltimento…)" value={newGenericName} onChange={e => setNewGenericName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddGeneric(); if (e.key === 'Escape') { setAddingGeneric(false); setNewGenericName('') } }} className="flex-1 text-sm" />
                            <Button size="sm" onClick={handleAddGeneric} disabled={!newGenericName.trim()} className="bg-slate-600 hover:bg-slate-700">Aggiungi</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingGeneric(false); setNewGenericName('') }}>Annulla</Button>
                        </div>
                    )}
                    {genericRows.length === 0 && !addingGeneric ? <p className="text-sm text-slate-400 text-center py-6">Nessuna voce generica. Usa "Aggiungi voce".</p> : genericRows.length > 0 ? <GenericTable rows={genericRows} onUpdate={handleUpdate} onDelete={handleDelete} /> : null}
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
                                {([{ label: 'Sfrido', field: 'sfrido', suffix: '%' }, { label: 'Sconto', field: 'sconto', suffix: '%' }, { label: 'Trasporto (A)', field: 'trasporto', suffix: '€' }, { label: 'Posa (B)', field: 'posa', suffix: '€' }, { label: 'Ricarico', field: 'ricarico', suffix: '%' }, { label: 'Margine Trattativa', field: 'margineTrattativa', suffix: '%' }] as const).map(({ label, field, suffix }) => (
                                    <div key={field} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-20 text-right"><EditCell value={params[field]} onSave={v => handleParamChange(field, v ?? 0)} /></div>
                                            <span className="text-xs text-slate-400 w-4 text-left">{suffix}</span>
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
                                    <SummaryRow label={`+ Sfrido (${params.sfrido}%)`} delta={sfrido_delta} value={totListino} subtotal="TOT materiali listino" />
                                    <SummaryRow label={`− Sconto (${params.sconto}%)`} delta={-sconto_delta} value={totSconto} subtotal="TOT materiali sconto" />
                                    <SummaryRow label={`+ Trasporto (A)`} delta={params.trasporto} value={costoFranco} subtotal="Costo franco" />
                                    <SummaryRow label={`+ Posa (B)`} delta={params.posa} value={costoTot} subtotal="Costo TOT (TC)" />
                                    <SummaryRow label={`+ Ricarico (${params.ricarico}%)`} delta={ric_delta} value={conRicarico} />
                                    <SummaryRow label={`+ Margine trattativa (${params.margineTrattativa}%)`} delta={marg_delta} value={totaleFinalE} />
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
        </div>
    )
}
