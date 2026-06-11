"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
    Loader2, Plus, Pencil, Trash2, Paperclip, Euro, FileText,
    ChevronDown, ChevronRight, Link2, X, CheckCircle2, TrendingUp
} from "lucide-react"
import { jobSalApprovatiApi, jobFattureCommittenteApi, jobSalFatturaLinksApi } from "@/lib/services/job-billing"
import { jobsApi } from "@/lib/api"
import { JobSalApprovato, JobFatturaCommittente, JobSalFatturaLink } from "@/lib/types"
import { notify } from "@/lib/notify"

interface JobFatturazioneProps {
    jobId: string
    job: { estimatedCost?: number | null; id: string }
    onJobUpdated: () => void
}

// ── Mini form per SAL e Fatture ───────────────────────────────────────────────

interface EntryFormData {
    name: string
    amount: string
    notes: string
}

const emptyForm = (): EntryFormData => ({ name: "", amount: "", notes: "" })

// ── Dialogo collegamento SAL ↔ Fattura ────────────────────────────────────────

function LinkDialog({
    open,
    onClose,
    sal,
    fatture,
    links,
    onSave,
}: {
    open: boolean
    onClose: () => void
    sal: JobSalApprovato
    fatture: JobFatturaCommittente[]
    links: JobSalFatturaLink[]
    onSave: (fatturaId: string, amount: number) => Promise<void>
}) {
    const [selectedFatturaId, setSelectedFatturaId] = useState("")
    const [amount, setAmount] = useState("")
    const [saving, setSaving] = useState(false)

    const existingLinks = links.filter(l => l.salId === sal.id)
    const alreadyLinkedIds = new Set(existingLinks.map(l => l.fatturaId))

    const handleSave = async () => {
        if (!selectedFatturaId) return
        const amt = parseFloat(amount.replace(",", "."))
        if (isNaN(amt) || amt <= 0) { notify.error("Inserisci un importo valido"); return }
        setSaving(true)
        try {
            await onSave(selectedFatturaId, amt)
            setSelectedFatturaId("")
            setAmount("")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-blue-600" />
                        Collega fattura a {sal.name}
                    </DialogTitle>
                </DialogHeader>

                {existingLinks.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Già collegati</p>
                        {existingLinks.map(link => {
                            const f = fatture.find(f => f.id === link.fatturaId)
                            return (
                                <div key={link.id} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded px-3 py-1.5">
                                    <span>{f?.name ?? link.fatturaId}</span>
                                    <span className="font-medium text-blue-700 dark:text-blue-400">
                                        € {link.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div className="space-y-3">
                    <div>
                        <Label className="text-xs">Fattura</Label>
                        <select
                            className="w-full mt-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedFatturaId}
                            onChange={e => setSelectedFatturaId(e.target.value)}
                        >
                            <option value="">Seleziona fattura...</option>
                            {fatture.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} — € {f.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    {alreadyLinkedIds.has(f.id) ? " (già collegata)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Importo coperto da questa fattura (€)</Label>
                        <Input
                            className="mt-1"
                            placeholder="0,00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annulla</Button>
                    <Button onClick={handleSave} disabled={saving || !selectedFatturaId}>
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Collega
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Entry Row ─────────────────────────────────────────────────────────────────

function EntryCard({
    type,
    entry,
    links,
    fatture,
    onEdit,
    onDelete,
    onLink,
    onDeleteLink,
    canEdit,
}: {
    type: 'sal' | 'fattura'
    entry: JobSalApprovato | JobFatturaCommittente
    links: JobSalFatturaLink[]
    fatture: JobFatturaCommittente[]
    onEdit: () => void
    onDelete: () => void
    onLink: () => void
    onDeleteLink: (salId: string, fatturaId: string) => void
    canEdit: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const isSal = type === 'sal'
    const myLinks = isSal
        ? links.filter(l => l.salId === entry.id)
        : links.filter(l => l.fatturaId === entry.id)

    const linkedAmount = myLinks.reduce((s, l) => s + l.amount, 0)
    const remaining = entry.amount - linkedAmount
    const fullyLinked = remaining <= 0.005

    return (
        <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">{entry.name}</span>
                            {fullyLinked && (
                                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Completo
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-lg font-bold text-blue-700 dark:text-blue-400">
                                € {entry.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </span>
                            {myLinks.length > 0 && (
                                <span className="text-xs text-slate-500">
                                    Coperto: € {linkedAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    {!fullyLinked && (
                                        <span className="text-amber-600 dark:text-amber-400 ml-1">
                                            (residuo € {remaining.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                        {entry.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.notes}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {entry.documentUrl && (
                            <a href={entry.documentUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Apri documento">
                                    <Paperclip className="h-3.5 w-3.5 text-violet-500" />
                                </Button>
                            </a>
                        )}
                        {canEdit && isSal && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLink} title="Collega fattura">
                                <Link2 className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                        )}
                        {myLinks.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(v => !v)}>
                                {expanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                }
                            </Button>
                        )}
                        {canEdit && (
                            <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                                    <Pencil className="h-3.5 w-3.5 text-slate-400" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onDelete}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {expanded && myLinks.length > 0 && (
                    <div className="mt-3 border-t dark:border-slate-700 pt-2 space-y-1">
                        {myLinks.map(link => {
                            const other = isSal
                                ? fatture.find(f => f.id === link.fatturaId)
                                : null
                            return (
                                <div key={link.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                                    <span className="flex items-center gap-1">
                                        <Link2 className="h-3 w-3 text-blue-400" />
                                        {isSal ? (other?.name ?? link.fatturaId) : ""}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                            € {link.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                        </span>
                                        {canEdit && isSal && (
                                            <button
                                                className="text-red-400 hover:text-red-600"
                                                onClick={() => onDeleteLink(link.salId, link.fatturaId)}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ── Form dialog ───────────────────────────────────────────────────────────────

function EntryDialog({
    open,
    title,
    initial,
    onClose,
    onSave,
    uploading,
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
        try {
            await onSave(form)
        } finally {
            setSaving(false)
        }
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
                            {existingDocUrl && (
                                <a href={existingDocUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline truncate">
                                    Documento allegato
                                </a>
                            )}
                        </div>
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

// ── Main component ────────────────────────────────────────────────────────────

export function JobFatturazione({ jobId, job, onJobUpdated }: JobFatturazioneProps) {
    const [loading, setLoading] = useState(true)
    const [sals, setSals] = useState<JobSalApprovato[]>([])
    const [fatture, setFatture] = useState<JobFatturaCommittente[]>([])
    const [links, setLinks] = useState<JobSalFatturaLink[]>([])

    // Estimated cost
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

    // Fattura dialog
    const [fatturaDialogOpen, setFatturaDialogOpen] = useState(false)
    const [editingFattura, setEditingFattura] = useState<JobFatturaCommittente | null>(null)
    const [fatturaForm, setFatturaForm] = useState<EntryFormData>(emptyForm())
    const [fatturaDocUrl, setFatturaDocUrl] = useState<string | undefined>()
    const [uploadingFattura, setUploadingFattura] = useState(false)
    const fatturaFileRef = useRef<HTMLInputElement>(null)

    // Link dialog
    const [linkDialogSal, setLinkDialogSal] = useState<JobSalApprovato | null>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const [s, f, l] = await Promise.all([
                jobSalApprovatiApi.getByJobId(jobId),
                jobFattureCommittenteApi.getByJobId(jobId),
                jobSalFatturaLinksApi.getByJobId(jobId),
            ])
            setSals(s)
            setFatture(f)
            setLinks(l)
        } catch (err) {
            console.error(err)
            notify.error("Errore caricamento dati fatturazione")
        } finally {
            setLoading(false)
        }
    }

    // ── Estimated cost ──────────────────────────────────────────────────────
    const startEditCosto = () => {
        setCostoValue(job.estimatedCost != null ? String(job.estimatedCost) : "")
        setEditingCosto(true)
    }

    const saveCosto = async () => {
        const val = costoValue.trim() === "" ? null : parseFloat(costoValue.replace(",", "."))
        if (val !== null && isNaN(val)) { notify.error("Importo non valido"); return }
        setSavingCosto(true)
        try {
            await jobsApi.update(jobId, { estimatedCost: val } as any)
            onJobUpdated()
            setEditingCosto(false)
            notify.success("Costo presunto aggiornato")
        } catch {
            notify.error("Errore salvataggio")
        } finally {
            setSavingCosto(false)
        }
    }

    // ── SAL handlers ────────────────────────────────────────────────────────
    const openNewSal = () => {
        setEditingSal(null)
        setSalForm(emptyForm())
        setSalDocUrl(undefined)
        setSalDialogOpen(true)
    }

    const openEditSal = (s: JobSalApprovato) => {
        setEditingSal(s)
        setSalForm({ name: s.name, amount: String(s.amount), notes: s.notes ?? "" })
        setSalDocUrl(s.documentUrl)
        setSalDialogOpen(true)
    }

    const handleSalFile = async (file: File) => {
        setUploadingSal(true)
        try {
            const url = await jobSalApprovatiApi.uploadDocument(file)
            setSalDocUrl(url)
        } catch { notify.error("Errore upload documento") }
        finally { setUploadingSal(false) }
    }

    const saveSal = async (form: EntryFormData) => {
        const amount = parseFloat(form.amount.replace(",", ".")) || 0
        if (editingSal) {
            await jobSalApprovatiApi.update(editingSal.id, { name: form.name, amount, documentUrl: salDocUrl, notes: form.notes || null })
            notify.success("SAL aggiornato")
        } else {
            await jobSalApprovatiApi.create(jobId, { name: form.name, amount, documentUrl: salDocUrl, notes: form.notes || undefined })
            notify.success("SAL aggiunto")
        }
        setSalDialogOpen(false)
        load()
    }

    const deleteSal = async (id: string) => {
        if (!confirm("Eliminare questo SAL? Verranno rimossi anche i collegamenti alle fatture.")) return
        await jobSalApprovatiApi.delete(id)
        notify.success("SAL eliminato")
        load()
    }

    // ── Fattura handlers ────────────────────────────────────────────────────
    const openNewFattura = () => {
        setEditingFattura(null)
        setFatturaForm(emptyForm())
        setFatturaDocUrl(undefined)
        setFatturaDialogOpen(true)
    }

    const openEditFattura = (f: JobFatturaCommittente) => {
        setEditingFattura(f)
        setFatturaForm({ name: f.name, amount: String(f.amount), notes: f.notes ?? "" })
        setFatturaDocUrl(f.documentUrl)
        setFatturaDialogOpen(true)
    }

    const handleFatturaFile = async (file: File) => {
        setUploadingFattura(true)
        try {
            const url = await jobFattureCommittenteApi.uploadDocument(file)
            setFatturaDocUrl(url)
        } catch { notify.error("Errore upload documento") }
        finally { setUploadingFattura(false) }
    }

    const saveFattura = async (form: EntryFormData) => {
        const amount = parseFloat(form.amount.replace(",", ".")) || 0
        if (editingFattura) {
            await jobFattureCommittenteApi.update(editingFattura.id, { name: form.name, amount, documentUrl: fatturaDocUrl, notes: form.notes || null })
            notify.success("Fattura aggiornata")
        } else {
            await jobFattureCommittenteApi.create(jobId, { name: form.name, amount, documentUrl: fatturaDocUrl, notes: form.notes || undefined })
            notify.success("Fattura aggiunta")
        }
        setFatturaDialogOpen(false)
        load()
    }

    const deleteFattura = async (id: string) => {
        if (!confirm("Eliminare questa fattura? Verranno rimossi anche i collegamenti ai SAL.")) return
        await jobFattureCommittenteApi.delete(id)
        notify.success("Fattura eliminata")
        load()
    }

    // ── Link handlers ───────────────────────────────────────────────────────
    const handleLink = async (fatturaId: string, amount: number) => {
        if (!linkDialogSal) return
        await jobSalFatturaLinksApi.upsert(linkDialogSal.id, fatturaId, amount)
        notify.success("Collegamento salvato")
        setLinkDialogSal(null)
        load()
    }

    const handleDeleteLink = async (salId: string, fatturaId: string) => {
        if (!confirm("Rimuovere il collegamento?")) return
        await jobSalFatturaLinksApi.delete(salId, fatturaId)
        notify.success("Collegamento rimosso")
        load()
    }

    // ── Totals ──────────────────────────────────────────────────────────────
    const totalSal = sals.reduce((s, x) => s + x.amount, 0)
    const totalFatture = fatture.reduce((s, x) => s + x.amount, 0)
    const estimatedCost = job.estimatedCost ?? null

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Caricamento fatturazione...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Riepilogo ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Costo presunto */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Costo Presunto</p>
                        {editingCosto ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    autoFocus
                                    className="h-8 text-base"
                                    placeholder="0,00"
                                    value={costoValue}
                                    onChange={e => setCostoValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") saveCosto(); if (e.key === "Escape") setEditingCosto(false) }}
                                />
                                <Button size="sm" onClick={saveCosto} disabled={savingCosto}>
                                    {savingCosto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingCosto(false)}>
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    {estimatedCost != null
                                        ? `€ ${estimatedCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                                        : <span className="text-slate-400 text-base font-normal italic">Non impostato</span>
                                    }
                                </span>
                                <button onClick={startEditCosto} className="text-slate-400 hover:text-slate-600">
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Totale SAL approvati */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SAL Approvati</p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                            € {totalSal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{sals.length} SAL</p>
                    </CardContent>
                </Card>

                {/* Totale fatture */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fatturato</p>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                    € {totalFatture.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{fatture.length} fatture</p>
                            </div>
                            {totalSal > 0 && (
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Da fatturare</p>
                                    <p className={`text-base font-bold ${totalSal - totalFatture > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        € {(totalSal - totalFatture).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── SAL Approvati ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        SAL Approvati
                    </h3>
                    <Button size="sm" onClick={openNewSal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi SAL
                    </Button>
                </div>

                {sals.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 border border-dashed rounded-lg">
                        <p className="text-sm">Nessun SAL approvato inserito</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sals.map(sal => (
                            <EntryCard
                                key={sal.id}
                                type="sal"
                                entry={sal}
                                links={links}
                                fatture={fatture}
                                canEdit={true}
                                onEdit={() => openEditSal(sal)}
                                onDelete={() => deleteSal(sal.id)}
                                onLink={() => setLinkDialogSal(sal)}
                                onDeleteLink={handleDeleteLink}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Fatture Committente ── */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Euro className="h-4 w-4 text-blue-600" />
                        Fatture Committente
                    </h3>
                    <Button size="sm" onClick={openNewFattura} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi Fattura
                    </Button>
                </div>

                {fatture.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 border border-dashed rounded-lg">
                        <p className="text-sm">Nessuna fattura committente inserita</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {fatture.map(f => (
                            <EntryCard
                                key={f.id}
                                type="fattura"
                                entry={f}
                                links={links}
                                fatture={fatture}
                                canEdit={true}
                                onEdit={() => openEditFattura(f)}
                                onDelete={() => deleteFattura(f.id)}
                                onLink={() => {}}
                                onDeleteLink={handleDeleteLink}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Dialogs ── */}
            <EntryDialog
                open={salDialogOpen}
                title={editingSal ? "Modifica SAL" : "Nuovo SAL Approvato"}
                initial={salForm}
                onClose={() => setSalDialogOpen(false)}
                onSave={saveSal}
                uploading={uploadingSal}
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
                onFileChange={handleFatturaFile}
                fileRef={fatturaFileRef}
                existingDocUrl={fatturaDocUrl}
            />

            {linkDialogSal && (
                <LinkDialog
                    open={!!linkDialogSal}
                    onClose={() => setLinkDialogSal(null)}
                    sal={linkDialogSal}
                    fatture={fatture}
                    links={links}
                    onSave={handleLink}
                />
            )}
        </div>
    )
}
