"use client"

import { useState, useEffect } from "react"
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
        setSearchOpen(false)
        load()
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Conformità</h2>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSearchOpen(true)}>
                    <Link2 className="h-4 w-4 mr-2" />Associa Documento
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : associations.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nessun documento di conformità associato. Quando la proposta diventa commessa, i documenti associati qui verranno collegati anche alla commessa.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {associations.map(assoc => {
                        const doc = assoc.document
                        const displayName = assoc.customName || doc?.name || "—"
                        return (
                            <Card key={assoc.id} className="group hover:shadow-sm transition-shadow">
                                <CardContent className="p-3 flex items-start gap-3">
                                    <div className="bg-green-50 dark:bg-green-950/30 p-1.5 rounded shrink-0">
                                        <ShieldCheck className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{displayName}</p>
                                        {assoc.customName && doc?.name && (
                                            <p className="text-xs text-slate-400">Originale: {doc.name}</p>
                                        )}
                                        {assoc.customNotes && (
                                            <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{assoc.customNotes}</p>
                                        )}
                                        {doc && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {doc.brandName && (
                                                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                                                        {doc.brandName}
                                                    </span>
                                                )}
                                                <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                                                    {doc.documentTypeName}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                                        {doc?.fileUrl && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDoc(doc.fileUrl)}>
                                                <ExternalLink className="h-3 w-3 text-slate-500" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                            setEditing(assoc)
                                            setEditName(assoc.customName || "")
                                            setEditNotes(assoc.customNotes || "")
                                            setEditOpen(true)
                                        }}>
                                            <Pencil className="h-3 w-3 text-slate-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setToDisassociate(assoc); setDisassociateOpen(true) }}>
                                            <Unlink className="h-3 w-3 text-red-500" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

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
        </div>
    )
}

function AssociateDialog({
    proposalId,
    existingIds,
    onClose,
    onAssociated,
}: {
    proposalId: string
    existingIds: string[]
    onClose: () => void
    onAssociated: () => void
}) {
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState("all")
    const [search, setSearch] = useState("")
    const [documentTypeId, setDocumentTypeId] = useState("all")
    const [allResults, setAllResults] = useState<ComplianceDocument[]>([])
    const [loadingResults, setLoadingResults] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    useEffect(() => {
        suppliersApi.getAll().then(s => setSuppliers(s)).catch(() => {})
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
