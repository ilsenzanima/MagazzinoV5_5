"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { Loader2, Calculator, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { proposalCostAnalysisVersionsApi, ProposalCostAnalysisVersion } from "@/lib/services/proposal-cost-analysis"
import { notify } from "@/lib/notify"
import { useHistoryStep } from "@/hooks/useHistoryStep"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NotchActions, NotchSearch } from "@/components/ui/notch-tabs"
import { ProposalAnalisiCosti } from "@/components/clients/detail/ProposalAnalisiCosti"

// Le versioni appartengono a un'offerta (proposalId) oppure, per le commesse
// create senza offerta, direttamente alla commessa (jobId).
interface Props {
    proposalId?: string
    jobId?: string
    jobLabel?: string
}

export function ProposalCostAnalysisVersions({ proposalId, jobId, jobLabel }: Props) {
    const [versions, setVersions] = useState<ProposalCostAnalysisVersion[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [sortKey, setSortKey] = useState<'name' | 'date'>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (k: 'name' | 'date') => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc') }
    }
    const sortIcon = (k: 'name' | 'date') => sortKey === k
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
    const [openVersionId, setOpenVersionId, closeVersion] = useHistoryStep<string>("magCostVersion")

    const [createOpen, setCreateOpen] = useState(false)
    const [newName, setNewName] = useState("")
    const [newNote, setNewNote] = useState("")
    const [creating, setCreating] = useState(false)

    const [editTarget, setEditTarget] = useState<ProposalCostAnalysisVersion | null>(null)
    const [editName, setEditName] = useState("")
    const [editNote, setEditNote] = useState("")
    const [saving, setSaving] = useState(false)

    const [deleteTarget, setDeleteTarget] = useState<ProposalCostAnalysisVersion | null>(null)

    const load = async () => {
        try {
            setLoading(true)
            if (proposalId) setVersions(await proposalCostAnalysisVersionsApi.getByProposalId(proposalId))
            else if (jobId) setVersions(await proposalCostAnalysisVersionsApi.getByJobId(jobId))
            else setVersions([])
        } catch { notify.error("Errore nel caricamento delle analisi costi") }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [proposalId, jobId])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return versions
        return versions.filter(v => v.name.toLowerCase().includes(term) || (v.note ?? '').toLowerCase().includes(term))
    }, [versions, search])

    const sorted = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1
        return [...filtered].sort((a, b) => sortKey === 'name'
            ? dir * a.name.localeCompare(b.name, 'it', { numeric: true })
            : dir * String(a.createdAt).localeCompare(String(b.createdAt)))
    }, [filtered, sortKey, sortDir])

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) return
        try {
            setCreating(true)
            const note = newNote.trim() || undefined
            const v = proposalId
                ? await proposalCostAnalysisVersionsApi.create(proposalId, name, note)
                : await proposalCostAnalysisVersionsApi.createForJob(jobId!, name, note)
            setVersions(prev => [v, ...prev])
            setCreateOpen(false)
            setNewName(""); setNewNote("")
            setOpenVersionId(v.id)
        } catch { notify.error("Errore durante la creazione dell'analisi costi") }
        finally { setCreating(false) }
    }

    const openEdit = (v: ProposalCostAnalysisVersion) => { setEditTarget(v); setEditName(v.name); setEditNote(v.note ?? "") }

    const handleSaveEdit = async () => {
        if (!editTarget) return
        const name = editName.trim()
        if (!name) return
        try {
            setSaving(true)
            const updated = await proposalCostAnalysisVersionsApi.update(editTarget.id, { name, note: editNote.trim() || null })
            setVersions(prev => prev.map(v => v.id === updated.id ? updated : v))
            setEditTarget(null)
        } catch { notify.error("Errore durante il salvataggio") }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await proposalCostAnalysisVersionsApi.delete(deleteTarget.id)
            setVersions(prev => prev.filter(v => v.id !== deleteTarget.id))
            notify.success("Analisi costi eliminata")
        } catch { notify.error("Errore durante l'eliminazione") }
        finally { setDeleteTarget(null) }
    }

    if (openVersionId) {
        const v = versions.find(v => v.id === openVersionId)
        return (
            <ProposalAnalisiCosti
                proposalId={proposalId ?? null}
                jobLabel={jobLabel}
                versionId={openVersionId}
                versionName={v?.name ?? ""}
                versionCreatedAt={v?.createdAt ?? ""}
                onBack={closeVersion}
            />
        )
    }

    return (
        <div className="space-y-4">
            <NotchActions>
                <NotchSearch value={search} onChange={setSearch} placeholder="Cerca analisi costi" />
            </NotchActions>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : sorted.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">
                    {versions.length === 0 ? 'Nessuna analisi costi creata. Usa il pulsante + in basso a destra per iniziare.' : 'Nessuna analisi costi corrisponde alla ricerca.'}
                </p>
            ) : (
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className="w-1/3 border-r text-xs font-semibold uppercase tracking-wide text-slate-600"><button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">Nome{sortIcon('name')}</button></TableHead>
                            <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Nota</TableHead>
                            <TableHead className="w-36 border-r text-xs font-semibold uppercase tracking-wide text-slate-600"><button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">Creata il{sortIcon('date')}</button></TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map(v => (
                            <TableRow key={v.id} className="group cursor-pointer" onClick={() => setOpenVersionId(v.id)}>
                                <TableCell className="border-r py-2">
                                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white"><Calculator className="h-4 w-4 shrink-0 text-emerald-600" />{v.name}</span>
                                </TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-500">{v.note || <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{new Date(v.createdAt).toLocaleDateString('it-IT')}</TableCell>
                                <TableCell className="py-2">
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={e => { e.stopPropagation(); openEdit(v) }} title="Modifica" className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(v) }} title="Elimina" className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <FloatingAddButton onClick={() => setCreateOpen(true)} label="Nuova analisi costi" />

            {/* Crea nuova analisi costi */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuova analisi costi</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nome *</label>
                            <Input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Es. Versione standard, Ipotesi ribasso…" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nota</label>
                            <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nota opzionale" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Annulla</Button>
                        <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modifica nome/nota */}
            <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Modifica analisi costi</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nome *</label>
                            <Input autoFocus value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Nota</label>
                            <Textarea value={editNote} onChange={e => setEditNote(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>Annulla</Button>
                        <Button onClick={handleSaveEdit} disabled={!editName.trim() || saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={open => !open && setDeleteTarget(null)}
                title="Elimina analisi costi"
                description={`Eliminare l'analisi costi "${deleteTarget?.name}"? L'azione è irreversibile.`}
                onConfirm={handleDelete}
            />
        </div>
    )
}
