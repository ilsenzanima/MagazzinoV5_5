"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { todayIso } from "@/lib/utils/local-date"
import { Loader2, Pencil, Trash2, Paperclip, Euro, TrendingUp, X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { jobSalApprovatiApi, jobFattureCommittenteApi } from "@/lib/services/job-billing"
import { jobsApi } from "@/lib/api"
import { JobSalApprovato, JobFatturaCommittente } from "@/lib/types"
import { notify } from "@/lib/notify"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { useBatchUpload, UploadItemState } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"
import { NotchTabs, NotchActions, NotchStat } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface JobFatturazioneProps {
    jobId: string
    job: { estimatedCost?: number | null; id: string; code?: string; name?: string }
    onJobUpdated: () => void
}

interface EntryFormData {
    name: string
    amount: string
    date: string
    notes: string
}

const emptyForm = (): EntryFormData => ({
    name: "",
    amount: "",
    date: todayIso(),
    notes: "",
})

// ── Form dialog ───────────────────────────────────────────────────────────────

function EntryDialog({
    open,
    title,
    initial,
    onClose,
    onSave,
    uploading,
    uploadState,
    onFileChange,
    fileRef,
    existingDocUrl,
}: {
    open: boolean
    title: string
    initial: EntryFormData
    onClose: () => void
    onSave: (data: EntryFormData) => Promise<void>
    uploading: boolean
    uploadState?: UploadItemState
    onFileChange: (file: File) => void
    fileRef: React.RefObject<HTMLInputElement | null>
    existingDocUrl?: string
}) {
    const [form, setForm] = useState<EntryFormData>(initial)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setForm(initial) }, [open])

    const handleSave = async () => {
        if (!form.name.trim()) { notify.error("Inserisci un nome"); return }
        const amt = parseFloat(form.amount.replace(",", "."))
        if (isNaN(amt) || amt < 0) { notify.error("Inserisci un importo valido"); return }
        setSaving(true)
        try { await onSave(form) } finally { setSaving(false) }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label className="text-xs">Nome / Riferimento *</Label>
                        <Input
                            className="mt-1"
                            placeholder="es. SAL 1, Fattura n°001..."
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Importo (€) *</Label>
                            <Input
                                className="mt-1"
                                placeholder="0,00"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Data emissione *</Label>
                            <Input
                                type="date"
                                className="mt-1"
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Note</Label>
                        <Input
                            className="mt-1"
                            placeholder="Note opzionali..."
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Documento (PDF/immagine)</Label>
                        <div className="flex items-center gap-2 mt-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="shrink-0"
                            >
                                {uploading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                    : <Paperclip className="h-3.5 w-3.5 mr-1" />
                                }
                                {uploading ? "Caricamento..." : "Allega file"}
                            </Button>
                            {existingDocUrl && !uploading && (
                                <button onClick={() => openDocument(existingDocUrl)}
                                    className="text-xs text-blue-600 hover:underline truncate">
                                    Documento allegato
                                </button>
                            )}
                        </div>
                        {uploading && <UploadStatusBar state={uploadState} />}
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f) }}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annulla</Button>
                    <Button onClick={handleSave} disabled={saving || uploading}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salva
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Apri documento con signed URL ────────────────────────────────────────────

async function openDocument(url: string) {
    if (!url.includes('/')) {
        window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento.pdf`, '_blank')
        return
    }
    try {
        const supabase = createClient()
        const path = url.split('/public/documents/')[1]
        if (!path) { window.open(url, '_blank'); return }
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
        if (error || !data?.signedUrl) { window.open(url, '_blank'); return }
        window.open(data.signedUrl, '_blank')
    } catch {
        window.open(url, '_blank')
    }
}

// ── Entry card (compact, for use in a column) ─────────────────────────────────

function EntryCard({
    entry,
    color,
    onEdit,
    onDelete,
}: {
    entry: JobSalApprovato | JobFatturaCommittente
    color: "emerald" | "blue"
    onEdit: () => void
    onDelete: () => void
}) {
    const borderClass = color === "emerald"
        ? "border-l-4 border-l-emerald-500"
        : "border-l-4 border-l-blue-500"
    const amountClass = color === "emerald"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-blue-700 dark:text-blue-400"

    const dateLabel = entry.date
        ? format(new Date(entry.date + "T00:00:00"), "dd MMM yyyy", { locale: it })
        : null

    return (
        <Card className={`${borderClass} border-slate-200 dark:border-slate-700 shadow-none`}>
            <CardContent className="p-3">
                <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{entry.name}</p>
                        {dateLabel && (
                            <p className="text-xs text-slate-400 mt-0.5">{dateLabel}</p>
                        )}
                        <p className={`text-base font-bold mt-1 ${amountClass}`}>
                            € {entry.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 , useGrouping: true})}
                        </p>
                        {entry.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{entry.notes}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                        {entry.documentUrl && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Apri documento"
                                onClick={e => { e.stopPropagation(); openDocument(entry.documentUrl!) }}>
                                <Paperclip className="h-3 w-3 text-violet-500" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                            <Pencil className="h-3 w-3 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={onDelete}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function JobFatturazione({ jobId, job, onJobUpdated }: JobFatturazioneProps) {
    const [loading, setLoading] = useState(true)
    const [sals, setSals] = useState<JobSalApprovato[]>([])
    const [fatture, setFatture] = useState<JobFatturaCommittente[]>([])

    // Costo presunto
    const [editingCosto, setEditingCosto] = useState(false)
    const [costoValue, setCostoValue] = useState("")
    const [savingCosto, setSavingCosto] = useState(false)

    // SAL dialog
    const [salDialogOpen, setSalDialogOpen] = useState(false)
    const [editingSal, setEditingSal] = useState<JobSalApprovato | null>(null)
    const [salForm, setSalForm] = useState<EntryFormData>(emptyForm())
    const [salDocUrl, setSalDocUrl] = useState<string | undefined>()
    const [uploadingSal, setUploadingSal] = useState(false)
    const salFileRef = useRef<HTMLInputElement>(null)
    const salBatchUpload = useBatchUpload()

    // Fattura dialog
    const [fatturaDialogOpen, setFatturaDialogOpen] = useState(false)
    const [editingFattura, setEditingFattura] = useState<JobFatturaCommittente | null>(null)
    const [fatturaForm, setFatturaForm] = useState<EntryFormData>(emptyForm())
    const [fatturaDocUrl, setFatturaDocUrl] = useState<string | undefined>()
    const [uploadingFattura, setUploadingFattura] = useState(false)
    const fatturaBatchUpload = useBatchUpload()
    const fatturaFileRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [s, f] = await Promise.all([
                jobSalApprovatiApi.getByJobId(jobId),
                jobFattureCommittenteApi.getByJobId(jobId),
            ])
            setSals(s)
            setFatture(f)
        } catch {
            notify.error("Errore caricamento dati fatturazione")
        } finally {
            setLoading(false)
        }
    }

    // ── Costo presunto ──────────────────────────────────────────────────────
    const saveCosto = async () => {
        const val = costoValue.trim() === "" ? null : parseFloat(costoValue.replace(",", "."))
        if (val !== null && isNaN(val)) { notify.error("Importo non valido"); return }
        setSavingCosto(true)
        try {
            await jobsApi.update(jobId, { estimatedCost: val } as any)
            onJobUpdated()
            setEditingCosto(false)
            notify.success("Costo presunto aggiornato")
        } catch { notify.error("Errore salvataggio") }
        finally { setSavingCosto(false) }
    }

    // ── SAL handlers ────────────────────────────────────────────────────────
    const openNewSal = () => {
        setEditingSal(null); setSalForm(emptyForm()); setSalDocUrl(undefined); setSalDialogOpen(true)
    }
    const openEditSal = (s: JobSalApprovato) => {
        setEditingSal(s)
        setSalForm({ name: s.name, amount: String(s.amount), date: s.date ?? emptyForm().date, notes: s.notes ?? "" })
        setSalDocUrl(s.documentUrl)
        setSalDialogOpen(true)
    }
    const jobLabel = `${job.code ?? ''} ${job.name ?? ''}`.trim() || job.id
    const handleSalFile = async (file: File) => {
        setUploadingSal(true)
        const { failedCount } = await salBatchUpload.run([file], async (f) => {
            setSalDocUrl(await jobSalApprovatiApi.uploadDocument(f, jobLabel))
        })
        if (failedCount > 0) notify.error("Errore upload")
        setUploadingSal(false)
    }
    const saveSal = async (form: EntryFormData) => {
        const amount = parseFloat(form.amount.replace(",", ".")) || 0
        if (editingSal) {
            await jobSalApprovatiApi.update(editingSal.id, { name: form.name, amount, date: form.date || null, documentUrl: salDocUrl, notes: form.notes || null })
            notify.success("SAL aggiornato")
        } else {
            await jobSalApprovatiApi.create(jobId, { name: form.name, amount, date: form.date || undefined, documentUrl: salDocUrl, notes: form.notes || undefined })
            notify.success("SAL aggiunto")
        }
        setSalDialogOpen(false); load()
    }
    const [toDelete, setToDelete] = useState<{ kind: 'sal' | 'fattura'; id: string } | null>(null)
    const deleteSal = (id: string) => setToDelete({ kind: 'sal', id })
    const doDelete = async () => {
        const target = toDelete
        setToDelete(null)
        if (!target) return
        if (target.kind === 'sal') {
            await jobSalApprovatiApi.delete(target.id); notify.success("SAL eliminato")
        } else {
            await jobFattureCommittenteApi.delete(target.id); notify.success("Fattura eliminata")
        }
        load()
    }

    // ── Fattura handlers ────────────────────────────────────────────────────
    const openNewFattura = () => {
        setEditingFattura(null); setFatturaForm(emptyForm()); setFatturaDocUrl(undefined); setFatturaDialogOpen(true)
    }
    const openEditFattura = (f: JobFatturaCommittente) => {
        setEditingFattura(f)
        setFatturaForm({ name: f.name, amount: String(f.amount), date: f.date ?? emptyForm().date, notes: f.notes ?? "" })
        setFatturaDocUrl(f.documentUrl)
        setFatturaDialogOpen(true)
    }
    const handleFatturaFile = async (file: File) => {
        setUploadingFattura(true)
        const { failedCount } = await fatturaBatchUpload.run([file], async (f) => {
            setFatturaDocUrl(await jobFattureCommittenteApi.uploadDocument(f, jobLabel))
        })
        if (failedCount > 0) notify.error("Errore upload")
        setUploadingFattura(false)
    }
    const saveFattura = async (form: EntryFormData) => {
        const amount = parseFloat(form.amount.replace(",", ".")) || 0
        if (editingFattura) {
            await jobFattureCommittenteApi.update(editingFattura.id, { name: form.name, amount, date: form.date || null, documentUrl: fatturaDocUrl, notes: form.notes || null })
            notify.success("Fattura aggiornata")
        } else {
            await jobFattureCommittenteApi.create(jobId, { name: form.name, amount, date: form.date || undefined, documentUrl: fatturaDocUrl, notes: form.notes || undefined })
            notify.success("Fattura aggiunta")
        }
        setFatturaDialogOpen(false); load()
    }
    const deleteFattura = (id: string) => setToDelete({ kind: 'fattura', id })

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalSal = sals.reduce((s, x) => s + x.amount, 0)
    const totalFatture = fatture.reduce((s, x) => s + x.amount, 0)
    const estimatedCost = job.estimatedCost ?? null

    // ── Tabella unica: SAL approvati e fatture del committente ──────────────
    const [kindFilter, setKindFilter] = useState<'all' | 'sal' | 'fattura'>('all')
    const [sortKey, setSortKey] = useState<'date' | 'name' | 'amount'>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (k: 'date' | 'name' | 'amount') => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc') }
    }
    const sortIcon = (k: 'date' | 'name' | 'amount') => sortKey === k
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
    const rows = useMemo(() => {
        const all = [
            ...sals.map(e => ({ kind: 'sal' as const, e })),
            ...fatture.map(e => ({ kind: 'fattura' as const, e })),
        ].filter(r => kindFilter === 'all' || r.kind === kindFilter)
        const dir = sortDir === 'asc' ? 1 : -1
        return all.sort((x, y) => {
            if (sortKey === 'name') return dir * x.e.name.localeCompare(y.e.name, 'it', { numeric: true })
            if (sortKey === 'amount') return dir * (x.e.amount - y.e.amount)
            return dir * String(x.e.date || '').localeCompare(String(y.e.date || ''))
        })
    }, [sals, fatture, kindFilter, sortKey, sortDir])
    const sortHead = (k: 'date' | 'name' | 'amount', label: string, cls = '') => (
        <TableHead className={`border-r text-xs font-semibold uppercase tracking-wide text-slate-600 ${cls}`}>
            <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 ${cls.includes('text-right') ? 'flex-row-reverse' : ''}`}>
                {label}{sortIcon(k)}
            </button>
        </TableHead>
    )
    const money = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, useGrouping: true })}`

    const strip = (
        <NotchActions>
            {editingCosto ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-3 pr-1 text-xs normal-case tracking-normal text-slate-300">
                    Importo commessa
                    <input
                        autoFocus
                        className="h-7 w-28 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="0,00"
                        value={costoValue}
                        onChange={e => setCostoValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveCosto(); if (e.key === "Escape") setEditingCosto(false) }}
                    />
                    <button type="button" onClick={saveCosto} disabled={savingCosto} className="h-7 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">
                        {savingCosto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
                    </button>
                    <button type="button" onClick={() => setEditingCosto(false)} aria-label="Annulla" className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/20"><X className="h-3.5 w-3.5" /></button>
                </span>
            ) : (
                <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium normal-case tracking-normal text-slate-300">
                    Importo commessa
                    <b className="text-sm font-semibold text-white">{estimatedCost != null ? money(estimatedCost) : <i className="font-normal text-slate-400">non impostato</i>}</b>
                    <button type="button" title="Modifica importo" aria-label="Modifica importo" className="self-center text-slate-300 hover:text-white"
                        onClick={() => { setCostoValue(estimatedCost != null ? String(estimatedCost) : ""); setEditingCosto(true) }}>
                        <Pencil className="h-3 w-3" />
                    </button>
                </span>
            )}
            <NotchStat label="SAL approvati" value={`${money(totalSal)} · ${sals.length}`} />
            <NotchStat label="Fatturato" value={`${money(totalFatture)} · ${fatture.length}`} />
            {totalSal > 0 && <NotchStat label="Da fatturare" value={money(totalSal - totalFatture)} />}
        </NotchActions>
    )

    if (loading) {
        return (
            <NotchTabs title="Fatturazione">
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-slate-500">Caricamento fatturazione...</span>
                </div>
            </NotchTabs>
        )
    }

    return (
        <NotchTabs title="Fatturazione">
            {strip}
            <div className="space-y-4">
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className="w-52 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                                <Select value={kindFilter} onValueChange={v => setKindFilter(v as 'all' | 'sal' | 'fattura')}>
                                    <SelectTrigger className="h-7 min-w-0 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                                        <SelectValue>{kindFilter === 'all' ? 'Tipo' : kindFilter === 'sal' ? 'SAL approvati' : 'Fatture committente'}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti</SelectItem>
                                        <SelectItem value="sal">SAL approvati</SelectItem>
                                        <SelectItem value="fattura">Fatture committente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableHead>
                            {sortHead('name', 'Nome')}
                            {sortHead('date', 'Data', 'w-32')}
                            {sortHead('amount', 'Importo', 'w-36 text-right')}
                            <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Note</TableHead>
                            <TableHead className="w-28" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    {sals.length === 0 && fatture.length === 0 ? 'Nessun SAL o fattura inserita. Usa il pulsante + in basso a destra per aggiungere.' : 'Nessuna voce per questo filtro.'}
                                </TableCell>
                            </TableRow>
                        ) : rows.map(({ kind, e }) => (
                            <TableRow key={`${kind}-${e.id}`}>
                                <TableCell className="border-r py-2">
                                    {kind === 'sal'
                                        ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"><TrendingUp className="h-3 w-3" />SAL approvato</span>
                                        : <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"><Euro className="h-3 w-3" />Fattura committente</span>}
                                </TableCell>
                                <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">{e.name}</TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{e.date ? format(new Date(e.date + "T00:00:00"), "dd/MM/yyyy", { locale: it }) : <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className={`border-r py-2 text-right font-bold ${kind === 'sal' ? 'text-emerald-700 dark:text-emerald-400' : 'text-blue-700 dark:text-blue-400'}`}>{money(e.amount)}</TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-500">{e.notes || <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className="py-2">
                                    <div className="flex items-center justify-end gap-0.5">
                                        {e.documentUrl && (
                                            <button type="button" title="Apri documento" onClick={() => openDocument(e.documentUrl!)} className="p-1 text-violet-500 hover:text-violet-700"><Paperclip className="h-4 w-4" /></button>
                                        )}
                                        <button type="button" title="Modifica" onClick={() => kind === 'sal' ? openEditSal(e as JobSalApprovato) : openEditFattura(e as JobFatturaCommittente)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                        <button type="button" title="Elimina" onClick={() => kind === 'sal' ? deleteSal(e.id) : deleteFattura(e.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <FloatingAddButton
                label="Aggiungi"
                actions={[
                    { label: "Nuovo SAL approvato", onClick: openNewSal },
                    { label: "Nuova fattura committente", onClick: openNewFattura },
                ]}
            />

            {/* ── Dialogs ── */}
            <EntryDialog
                open={salDialogOpen}
                title={editingSal ? "Modifica SAL" : "Nuovo SAL Approvato"}
                initial={salForm}
                onClose={() => setSalDialogOpen(false)}
                onSave={saveSal}
                uploading={uploadingSal}
                uploadState={salBatchUpload.statuses[0]}
                onFileChange={handleSalFile}
                fileRef={salFileRef}
                existingDocUrl={salDocUrl}
            />
            <EntryDialog
                open={fatturaDialogOpen}
                title={editingFattura ? "Modifica Fattura" : "Nuova Fattura Committente"}
                initial={fatturaForm}
                onClose={() => setFatturaDialogOpen(false)}
                onSave={saveFattura}
                uploading={uploadingFattura}
                uploadState={fatturaBatchUpload.statuses[0]}
                onFileChange={handleFatturaFile}
                fileRef={fatturaFileRef}
                existingDocUrl={fatturaDocUrl}
            />

            <ConfirmDeleteDialog
                open={!!toDelete}
                onOpenChange={(o) => { if (!o) setToDelete(null) }}
                title={toDelete?.kind === 'sal' ? "Elimina SAL" : "Elimina fattura"}
                description={toDelete?.kind === 'sal' ? "Eliminare questo SAL?" : "Eliminare questa fattura?"}
                onConfirm={doDelete}
            />
        </NotchTabs>
    )
}
