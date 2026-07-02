"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { Loader2, PlusCircle, Search, Calculator, Pencil, Trash2 } from "lucide-react"
import { proposalCostAnalysisVersionsApi, ProposalCostAnalysisVersion } from "@/lib/services/proposal-cost-analysis"
import { notify } from "@/lib/notify"
import { ViewToggle } from "@/components/ui/view-toggle"
import { useViewMode } from "@/hooks/useViewMode"
import { ProposalAnalisiCosti } from "@/components/clients/detail/ProposalAnalisiCosti"

interface Props {
    proposalId: string
}

export function ProposalCostAnalysisVersions({ proposalId }: Props) {
    const [versions, setVersions] = useState<ProposalCostAnalysisVersion[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [viewMode, setViewMode] = useViewMode("proposal-cost-analysis-versions", "grid")
    const [openVersionId, setOpenVersionId] = useState<string | null>(null)

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
            setVersions(await proposalCostAnalysisVersionsApi.getByProposalId(proposalId))
        } catch { notify.error("Errore nel caricamento delle analisi costi") }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [proposalId])

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return versions
        return versions.filter(v => v.name.toLowerCase().includes(term) || (v.note ?? '').toLowerCase().includes(term))
    }, [versions, search])

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) return
        try {
            setCreating(true)
            const v = await proposalCostAnalysisVersionsApi.create(proposalId, name, newNote.trim() || undefined)
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
                proposalId={proposalId}
                versionId={openVersionId}
                versionName={v?.name ?? ""}
                versionCreatedAt={v?.createdAt ?? ""}
                onBack={() => setOpenVersionId(null)}
            />
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input className="pl-8" placeholder="Cerca analisi costi…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <ViewToggle mode={viewMode} onChange={setViewMode} />
                <div className="flex-1" />
                <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <PlusCircle className="h-4 w-4 mr-1" />Nuova analisi costi
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-12">
                    {versions.length === 0 ? 'Nessuna analisi costi creata. Usa "Nuova analisi costi" per iniziare.' : 'Nessuna analisi costi corrisponde alla ricerca.'}
                </p>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(v => (
                        <Card key={v.id} className="cursor-pointer hover:border-blue-400 transition-colors group" onClick={() => setOpenVersionId(v.id)}>
                            <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Calculator className="h-4 w-4 text-emerald-600 shrink-0" />
                                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{v.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={e => { e.stopPropagation(); openEdit(v) }} className="text-slate-400 hover:text-blue-600 p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={e => { e.stopPropagation(); setDeleteTarget(v) }} className="text-slate-400 hover:text-red-600 p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                                {v.note && <p className="text-xs text-slate-500 line-clamp-2">{v.note}</p>}
                                <p className="text-[11px] text-slate-400">Creata il {new Date(v.createdAt).toLocaleDateString('it-IT')}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="border rounded-md divide-y dark:border-slate-700">
                    {filtered.map(v => (
                        <div key={v.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group" onClick={() => setOpenVersionId(v.id)}>
                            <Calculator className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{v.name}</p>
                                {v.note && <p className="text-xs text-slate-500 truncate">{v.note}</p>}
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">{new Date(v.createdAt).toLocaleDateString('it-IT')}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={e => { e.stopPropagation(); openEdit(v) }} className="text-slate-400 hover:text-blue-600 p-1"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={e => { e.stopPropagation(); setDeleteTarget(v) }} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
