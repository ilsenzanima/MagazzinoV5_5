"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { ShieldCheck, Link2, Unlink, Loader2, ExternalLink, Search } from "lucide-react"
import { toast } from "sonner"
import { complianceApi, ComplianceDocument } from "@/lib/services/compliance"
import { itemComplianceApi, ItemComplianceAssociation } from "@/lib/services/item-compliance"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"

interface Props {
    itemId: string
}

export function ItemConformita({ itemId }: Props) {
    const [associations, setAssociations] = useState<ItemComplianceAssociation[]>([])
    const [loading, setLoading] = useState(true)

    const [assocOpen, setAssocOpen] = useState(false)
    const [assocSearch, setAssocSearch] = useState("")
    const [assocResults, setAssocResults] = useState<ComplianceDocument[]>([])
    const [assocLoading, setAssocLoading] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    const [disassociateOpen, setDisassociateOpen] = useState(false)
    const [toDisassociate, setToDisassociate] = useState<ItemComplianceAssociation | null>(null)

    useEffect(() => { load() }, [itemId])

    const load = async () => {
        try {
            setLoading(true)
            setAssociations(await itemComplianceApi.getByItemId(itemId))
        } catch {
            toast.error("Errore nel caricamento delle certificazioni")
        } finally {
            setLoading(false)
        }
    }

    const openDoc = (url: string) => {
        if (url && !url.includes('/')) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento`, '_blank')
            return
        }
        window.open(url, '_blank')
    }

    const openAssociate = () => {
        setAssocSearch("")
        setAssocResults([])
        setAssocOpen(true)
    }

    useEffect(() => {
        if (!assocOpen) return
        const t = setTimeout(() => fetchResults(), 300)
        return () => clearTimeout(t)
    }, [assocSearch, assocOpen])

    const fetchResults = async () => {
        try {
            setAssocLoading(true)
            const docs = await complianceApi.getAll(assocSearch || undefined, true)
            const existingIds = new Set(associations.map(a => a.complianceDocumentId))
            setAssocResults(docs.filter(d => !existingIds.has(d.id)))
        } catch {
            toast.error("Errore ricerca documenti")
        } finally {
            setAssocLoading(false)
        }
    }

    const handleAssociate = async (doc: ComplianceDocument) => {
        try {
            setAssociating(doc.id)
            await itemComplianceApi.associate(itemId, doc.id)
            toast.success("Certificato associato")
            setAssocResults(prev => prev.filter(d => d.id !== doc.id))
            load()
        } catch {
            toast.error("Errore durante l'associazione")
        } finally {
            setAssociating(null)
        }
    }

    const confirmDisassociate = (assoc: ItemComplianceAssociation) => {
        setToDisassociate(assoc)
        setDisassociateOpen(true)
    }

    const handleDisassociate = async () => {
        if (!toDisassociate) return
        try {
            await itemComplianceApi.disassociate(toDisassociate.id)
            setAssociations(associations.filter(a => a.id !== toDisassociate.id))
            toast.success("Certificato disassociato")
        } catch {
            toast.error("Errore disassociazione")
        } finally {
            setDisassociateOpen(false)
            setToDisassociate(null)
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Certificazioni Articolo
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={openAssociate}>
                        <Link2 className="h-3.5 w-3.5 mr-1.5" />Associa esistente
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                    ) : associations.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 border-2 border-dashed dark:border-slate-600 rounded-md bg-slate-50/50 dark:bg-slate-800/50">
                            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Nessuna certificazione associata a questo articolo</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {associations.map(assoc => {
                                const doc = assoc.document
                                if (!doc) return null
                                return (
                                    <div
                                        key={assoc.id}
                                        className="group flex items-center gap-3 px-3 py-2 rounded border bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
                                    >
                                        <div className="bg-green-50 dark:bg-green-950/30 p-1 rounded shrink-0">
                                            <ShieldCheck className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            {doc.brandName && (
                                                <span className="text-[10px] uppercase tracking-wide bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                                                    {doc.brandName}
                                                </span>
                                            )}
                                            {doc.documentTypeName && (
                                                <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                                                    {doc.documentTypeName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDoc(doc.fileUrl)}>
                                                <ExternalLink className="h-3 w-3 text-slate-500" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => confirmDisassociate(assoc)}>
                                                <Unlink className="h-3 w-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Associate existing dialog */}
            <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Associa certificato esistente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                className="pl-9"
                                placeholder="Cerca per nome..."
                                value={assocSearch}
                                onChange={e => setAssocSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                            {assocLoading ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            ) : assocResults.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">Nessun documento trovato</p>
                            ) : (
                                assocResults.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{doc.name}</p>
                                            <p className="text-xs text-slate-400">{doc.brandName} · {doc.documentTypeName}</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={associating === doc.id}
                                            onClick={() => handleAssociate(doc)}
                                            className="shrink-0"
                                        >
                                            {associating === doc.id
                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                : "Associa"}
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssocOpen(false)}>Chiudi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={disassociateOpen}
                onOpenChange={setDisassociateOpen}
                title="Disassocia certificato"
                description={`Il certificato "${toDisassociate?.document?.name}" verrà rimosso da questo articolo. Il documento originale non verrà eliminato.`}
                onConfirm={handleDisassociate}
            />
        </>
    )
}
