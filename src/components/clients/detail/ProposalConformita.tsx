"use client"

import { useState, useEffect, useMemo } from "react"
import { NotchTabs, NotchSearch, NotchStat, NotchActions } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Loader2,
    Link2,
    Unlink,
    Search,
    ArrowUp,
    ArrowDown,
    Pencil,
    ExternalLink,
    ShieldCheck,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
    complianceApi,
    proposalComplianceApi,
    ProposalComplianceAssociation,
    ComplianceDocument,
} from "@/lib/services/compliance"
import { suppliersApi } from "@/lib/services/suppliers"
import { supplierGroupsApi } from "@/lib/services/supplier-groups"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { notify } from "@/lib/notify"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface Props {
    proposalId: string
}

export function ProposalConformita({ proposalId }: Props) {
    const supabase = createClient()
    const [associations, setAssociations] = useState<ProposalComplianceAssociation[]>([])
    const [loading, setLoading] = useState(true)
    const [searchOpen, setSearchOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [disassociateOpen, setDisassociateOpen] = useState(false)
    const [editing, setEditing] = useState<ProposalComplianceAssociation | null>(null)
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [toDisassociate, setToDisassociate] = useState<ProposalComplianceAssociation | null>(null)

    useEffect(() => { load() }, [proposalId])

    const load = async () => {
        try {
            setLoading(true)
            setAssociations(await proposalComplianceApi.getByProposalId(proposalId))
        } catch {
            notify.error("Errore nel caricamento delle associazioni")
        } finally {
            setLoading(false)
        }
    }

    const openDoc = async (url: string) => {
        try {
            const path = url.split("/public/documents/")[1]
            if (!path) { window.open(url, "_blank"); return }
            const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(url, "_blank"); return }
            window.open(data.signedUrl, "_blank")
        } catch { window.open(url, "_blank") }
    }

    const handleSaveEdit = async () => {
        if (!editing) return
        try {
            setSaving(true)
            await proposalComplianceApi.update(editing.id, {
                customName: editName.trim() || null,
                customNotes: editNotes.trim() || null,
            })
            notify.success("Aggiornato")
            setEditOpen(false)
            load()
        } catch {
            notify.error("Errore aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleDisassociate = async () => {
        if (!toDisassociate) return
        try {
            await proposalComplianceApi.disassociate(toDisassociate.id)
            setAssociations(associations.filter(a => a.id !== toDisassociate.id))
            notify.success("Documento disassociato")
        } catch {
            notify.error("Errore disassociazione")
        } finally {
            setDisassociateOpen(false)
            setToDisassociate(null)
        }
    }

    const handleAssociated = () => {
        load()
    }

    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const nameOf = (a: ProposalComplianceAssociation) => a.customName || a.document?.name || ""
    const typeNames = useMemo(
        () => Array.from(new Set(associations.map(a => a.document?.documentTypeName).filter((x): x is string => !!x))).sort((x, y) => x.localeCompare(y, 'it')),
        [associations]
    )
    const shown = useMemo(() => {
        const words = search.toLowerCase().split(/\s+/).filter(Boolean)
        const dir = sortDir === 'asc' ? 1 : -1
        return associations
            .filter(a => {
                if (typeFilter !== 'all' && a.document?.documentTypeName !== typeFilter) return false
                const target = `${nameOf(a)} ${a.document?.name || ''} ${a.customNotes || ''} ${a.document?.brandName || ''} ${a.document?.documentTypeName || ''}`.toLowerCase()
                return words.every(w => target.includes(w))
            })
            .sort((x, y) => dir * nameOf(x).localeCompare(nameOf(y), 'it', { numeric: true }))
    }, [associations, search, typeFilter, sortDir])
    const head = "border-r text-xs font-semibold uppercase tracking-wide text-slate-600"

    return (
        <NotchTabs title="Conformità">
            <NotchActions>
                <NotchSearch value={search} onChange={setSearch} placeholder="Cerca per nome, marca o tipo" />
                <NotchStat label="Documenti" value={String(associations.length)} />
            </NotchActions>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : (
                <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className={head}>
                                <button type="button" onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                                    Documento{sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                </button>
                            </TableHead>
                            <TableHead className={`w-48 ${head}`}>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger aria-label="Filtra per tipo" className="h-7 min-w-0 border-slate-300 bg-white px-2 text-xs font-semibold uppercase">
                                        <SelectValue>{typeFilter === 'all' ? 'Tipo' : typeFilter}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Tutti i tipi</SelectItem>
                                        {typeNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </TableHead>
                            <TableHead className={`w-36 ${head}`}>Marca</TableHead>
                            <TableHead className={`w-[28%] ${head}`}>Nota</TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shown.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    {associations.length === 0
                                        ? "Nessun documento di conformità associato. Quando l'offerta diventa commessa, i documenti associati qui verranno collegati anche alla commessa."
                                        : "Nessun documento corrisponde ai filtri."}
                                </TableCell>
                            </TableRow>
                        ) : shown.map(assoc => {
                            const doc = assoc.document
                            return (
                                <TableRow key={assoc.id} className={doc?.fileUrl ? "cursor-pointer" : ""} onClick={() => doc?.fileUrl && openDoc(doc.fileUrl)}>
                                    <TableCell className="border-r py-2">
                                        <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                            <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
                                            <span className="min-w-0">
                                                <span className="block truncate" title={nameOf(assoc)}>{nameOf(assoc) || "—"}</span>
                                                {assoc.customName && doc?.name && <span className="block truncate text-xs font-normal text-slate-400">Originale: {doc.name}</span>}
                                            </span>
                                        </span>
                                    </TableCell>
                                    <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300">{doc?.documentTypeName || <span className="text-slate-300">—</span>}</TableCell>
                                    <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300">{doc?.brandName || <span className="text-slate-300">—</span>}</TableCell>
                                    <TableCell className="truncate border-r py-2 text-sm text-slate-500" title={assoc.customNotes || undefined}>{assoc.customNotes || <span className="text-slate-300">—</span>}</TableCell>
                                    <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-0.5">
                                            <button type="button" title="Personalizza" onClick={() => {
                                                setEditing(assoc)
                                                setEditName(assoc.customName || "")
                                                setEditNotes(assoc.customNotes || "")
                                                setEditOpen(true)
                                            }} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                            <button type="button" title="Disassocia" onClick={() => { setToDisassociate(assoc); setDisassociateOpen(true) }} className="p-1 text-slate-400 hover:text-red-600"><Unlink className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            )}

            <FloatingAddButton onClick={() => setSearchOpen(true)} label="Associa documento" icon={<Link2 className="h-6 w-6" />} showOnMobile />

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Personalizza documento associato</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Nome personalizzato</Label>
                            <Input
                                placeholder={editing?.document?.name || "Nome originale"}
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                            />
                            {editing?.document?.name && (
                                <p className="text-xs text-slate-400">Originale: {editing.document.name}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Note personalizzate</Label>
                            <Textarea
                                placeholder="Note per questa proposta (non modificano le note originali)"
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disassociate confirm */}
            <ConfirmDeleteDialog
                open={disassociateOpen}
                onOpenChange={setDisassociateOpen}
                title="Disassocia documento"
                description={`Il documento "${toDisassociate?.customName || toDisassociate?.document?.name}" verrà rimosso da questa proposta. Il documento originale non sarà modificato.`}
                onConfirm={handleDisassociate}
            />

            {/* Search & associate dialog */}
            {searchOpen && (
                <AssociateDialog
                    proposalId={proposalId}
                    existingIds={associations.map(a => a.complianceDocumentId)}
                    onClose={() => setSearchOpen(false)}
                    onAssociated={handleAssociated}
                />
            )}
        </NotchTabs>
    )
}

function AssociateDialog({
    proposalId,
    existingIds: initialExistingIds,
    onClose,
    onAssociated,
}: {
    proposalId: string
    existingIds: string[]
    onClose: () => void
    onAssociated: () => void
}) {
    const [existingIds, setExistingIds] = useState(initialExistingIds)
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState("all")
    const [search, setSearch] = useState("")
    const [documentTypeId, setDocumentTypeId] = useState("all")
    const [allResults, setAllResults] = useState<ComplianceDocument[]>([])
    const [loadingResults, setLoadingResults] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    useEffect(() => {
        Promise.all([suppliersApi.getAll(), supplierGroupsApi.getHiddenFromPurchasesIds()])
            .then(([s, hiddenIds]) => setSuppliers(s.filter(sup => !hiddenIds.includes(sup.id))))
            .catch(() => {})
    }, [])

    useEffect(() => {
        const t = setTimeout(() => fetchResults(), 300)
        return () => clearTimeout(t)
    }, [supplierId, search])

    const fetchResults = async () => {
        try {
            setLoadingResults(true)
            let docs: ComplianceDocument[]
            if (supplierId && supplierId !== "all") {
                docs = await complianceApi.getBySupplier(supplierId, true)
                if (search) docs = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
            } else {
                docs = await complianceApi.getAll(search || undefined, true)
            }
            setAllResults(docs)
        } catch {
            notify.error("Errore ricerca documenti")
        } finally {
            setLoadingResults(false)
        }
    }

    const availableTypes = Array.from(
        new Map(allResults.map(d => [d.documentTypeId || d.documentTypeName, d.documentTypeName])).entries()
    ).map(([id, name]) => ({ id, name }))

    useEffect(() => {
        if (documentTypeId !== "all" && !availableTypes.some(t => t.id === documentTypeId)) {
            setDocumentTypeId("all")
        }
    }, [allResults])

    const results = documentTypeId === "all"
        ? allResults
        : allResults.filter(d => (d.documentTypeId || d.documentTypeName) === documentTypeId)

    const handleAssociate = async (doc: ComplianceDocument) => {
        try {
            setAssociating(doc.id)
            await proposalComplianceApi.associate(proposalId, doc.id)
            notify.success("Documento associato")
            setExistingIds(prev => [...prev, doc.id])
            onAssociated()
        } catch (e: any) {
            if (e?.code === "23505") notify.error("Documento già associato")
            else notify.error("Errore associazione")
        } finally {
            setAssociating(null)
        }
    }

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Associa documento conformità</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={supplierId} onValueChange={setSupplierId}>
                            <SelectTrigger><SelectValue placeholder="Tutti i fornitori" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i fornitori</SelectItem>
                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
                            <SelectTrigger><SelectValue placeholder="Tutti i tipi" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i tipi</SelectItem>
                                {availableTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            className="pl-8"
                            placeholder="Cerca per nome..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                        {loadingResults ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
                        ) : results.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Nessun documento trovato</p>
                        ) : results.map(doc => {
                            const already = existingIds.includes(doc.id)
                            return (
                                <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{doc.name}</p>
                                        <p className="text-xs text-slate-400">{doc.brandName} · {doc.documentTypeName}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={already ? "ghost" : "outline"}
                                        disabled={already || associating === doc.id}
                                        onClick={() => handleAssociate(doc)}
                                        className="shrink-0"
                                    >
                                        {associating === doc.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : already ? "Già associato" : "Associa"}
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Chiudi</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
