"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Trash2, Paperclip, Euro, TrendingUp, X } from "lucide-react"
import { jobSalApprovatiApi, jobFattureCommittenteApi } from "@/lib/services/job-billing"
import { jobsApi } from "@/lib/api"
import { JobSalApprovato, JobFatturaCommittente } from "@/lib/types"
import { notify } from "@/lib/notify"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"

interface JobFatturazioneProps {
    jobId: string
    job: { estimatedCost?: number | null; id: string }
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
    date: new Date().toISOString().split("T")[0],
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
                            {existingDocUrl && (
                                <button onClick={() => openDocument(existingDocUrl)}
                                    className="text-xs text-blue-600 hover:underline truncate">
                                    Documento allegato
                                </button>
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

// ── Apri documento con signed URL ────────────────────────────────────────────

async function openDocument(url: string) {
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
                            € {entry.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
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

    // Fattura dialog
    const [fatturaDialogOpen, setFatturaDialogOpen] = useState(false)
    const [editingFattura, setEditingFattura] = useState<JobFatturaCommittente | null>(null)
    const [fatturaForm, setFatturaForm] = useState<EntryFormData>(emptyForm())
    const [fatturaDocUrl, setFatturaDocUrl] = useState<string | undefined>()
    const [uploadingFattura, setUploadingFattura] = useState(false)
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
    const handleSalFile = async (file: File) => {
        setUploadingSal(true)
        try { setSalDocUrl(await jobSalApprovatiApi.uploadDocument(file)) }
        catch { notify.error("Errore upload") }
        finally { setUploadingSal(false) }
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
    const deleteSal = async (id: string) => {
        if (!confirm("Eliminare questo SAL?")) return
        await jobSalApprovatiApi.delete(id); notify.success("SAL eliminato"); load()
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
        try { setFatturaDocUrl(await jobFattureCommittenteApi.uploadDocument(file)) }
        catch { notify.error("Errore upload") }
        finally { setUploadingFattura(false) }
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
    const deleteFattura = async (id: string) => {
        if (!confirm("Eliminare questa fattura?")) return
        await jobFattureCommittenteApi.delete(id); notify.success("Fattura eliminata"); load()
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
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Importo Commessa</p>
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
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                                        {estimatedCost != null
                                            ? `€ ${estimatedCost.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
                                            : <span className="text-slate-400 text-base font-normal italic">Non impostato</span>
                                        }
                                    </span>
                                    <button onClick={() => { setCostoValue(estimatedCost != null ? String(estimatedCost) : ""); setEditingCosto(true) }}
                                        className="text-slate-400 hover:text-slate-600">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Totale SAL */}
                <Card className="border-slate-200 dark:border-slate-700">
                    <CardContent className="p-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SAL Approvati</p>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                            € {totalSal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
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
                                    € {totalFatture.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{fatture.length} fatture</p>
                            </div>
                            {totalSal > 0 && (
                                <div className="text-right">
                                    <p className="text-xs text-slate-500">Da fatturare</p>
                                    <p className={`text-base font-bold ${totalSal - totalFatture > 0.005 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                        € {(totalSal - totalFatture).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Intestazioni colonne + pulsanti ── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        SAL Approvati
                    </h3>
                    <Button size="sm" onClick={openNewSal}
                        className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2 text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi
                    </Button>
                </div>
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                        <Euro className="h-4 w-4 text-blue-600" />
                        Fatture Committente
                    </h3>
                    <Button size="sm" onClick={openNewFattura}
                        className="bg-blue-600 hover:bg-blue-700 h-7 px-2 text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" />Aggiungi
                    </Button>
                </div>
            </div>

            {/* ── Due colonne indipendenti ── */}
            {sals.length === 0 && fatture.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 border border-dashed rounded-lg">
                    <p className="text-sm">Nessun SAL o fattura inserita</p>
                    <p className="text-xs mt-1">Usa i pulsanti sopra per aggiungere</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 items-start">
                    {/* Colonna SAL */}
                    <div className="space-y-2">
                        {sals.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-500 border border-dashed rounded-lg text-xs">
                                Nessun SAL inserito
                            </div>
                        ) : (
                            sals.map(sal => (
                                <EntryCard
                                    key={sal.id}
                                    entry={sal}
                                    color="emerald"
                                    onEdit={() => openEditSal(sal)}
                                    onDelete={() => deleteSal(sal.id)}
                                />
                            ))
                        )}
                    </div>
                    {/* Colonna Fatture */}
                    <div className="space-y-2">
                        {fatture.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-500 border border-dashed rounded-lg text-xs">
                                Nessuna fattura inserita
                            </div>
                        ) : (
                            fatture.map(f => (
                                <EntryCard
                                    key={f.id}
                                    entry={f}
                                    color="blue"
                                    onEdit={() => openEditFattura(f)}
                                    onDelete={() => deleteFattura(f.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

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
        </div>
    )
}
