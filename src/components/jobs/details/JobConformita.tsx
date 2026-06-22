"use client"

import { useState, useEffect, useRef } from "react"
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
    FileText,
    Upload,
    Loader2,
    Trash2,
    Link2,
    Unlink,
    Search,
    Pencil,
    ExternalLink,
    File,
    FileImage,
    FileSpreadsheet,
    ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { jobDocumentsApi, JobDocument } from "@/lib/api"
import {
    complianceApi,
    jobComplianceApi,
    JobComplianceAssociation,
    ComplianceDocument,
} from "@/lib/services/compliance"
import { suppliersApi } from "@/lib/services/suppliers"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface JobConformitaProps {
    jobId: string
}

function getFileIcon(type?: string) {
    if (!type) return <FileText className="h-7 w-7 text-slate-400" />
    const t = type.toLowerCase()
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(t)) return <FileImage className="h-7 w-7 text-blue-500" />
    if (t === "pdf") return <FileText className="h-7 w-7 text-red-500" />
    if (["xls", "xlsx", "csv"].includes(t)) return <FileSpreadsheet className="h-7 w-7 text-green-500" />
    return <File className="h-7 w-7 text-slate-500" />
}

// ─── Upload sezione ──────────────────────────────────────────────────────────

function OwnDocuments({ jobId }: { jobId: string }) {
    const supabase = createClient()
    const [docs, setDocs] = useState<JobDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [docName, setDocName] = useState("")
    const [uploading, setUploading] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [toDelete, setToDelete] = useState<JobDocument | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const all = await jobDocumentsApi.getByJobId(jobId)
            setDocs(all.filter(d => d.category === "conformita"))
        } catch {
            toast.error("Errore nel caricamento dei documenti")
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async () => {
        if (!file) return
        try {
            setUploading(true)
            const fileExt = file.name.split(".").pop()
            const fileName = `${jobId}/conformita_${Math.random().toString(36).substring(7)}_${file.name}`
            const { error: upErr } = await supabase.storage.from("documents").upload(fileName, file)
            if (upErr) throw upErr
            const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(fileName)
            await jobDocumentsApi.create({
                jobId,
                name: docName || file.name,
                fileUrl: publicUrl,
                fileType: fileExt,
                category: "conformita",
            })
            toast.success("Documento caricato")
            setUploadOpen(false)
            setFile(null)
            setDocName("")
            load()
        } catch (e: any) {
            toast.error("Errore caricamento: " + e.message)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async () => {
        if (!toDelete) return
        try {
            const path = toDelete.fileUrl?.split("/public/documents/")[1]
            if (path) await supabase.storage.from("documents").remove([path])
            await jobDocumentsApi.delete(toDelete.id)
            setDocs(docs.filter(d => d.id !== toDelete.id))
            toast.success("Documento eliminato")
        } catch {
            toast.error("Errore eliminazione")
        } finally {
            setDeleteOpen(false)
            setToDelete(null)
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

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti caricati
                </h3>
                <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />Carica
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : docs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento caricato</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {docs.map(doc => (
                        <Card key={doc.id} className="group hover:shadow-md transition-shadow">
                            <CardContent className="p-3 flex items-start gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded shrink-0">
                                    {getFileIcon(doc.fileType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {format(new Date(doc.createdAt), "dd MMM yyyy", { locale: it })}
                                    </p>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openDoc(doc.fileUrl)}>
                                        <ExternalLink className="h-3 w-3 text-slate-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setToDelete(doc); setDeleteOpen(true) }}>
                                        <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Carica documento conformità</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Nome documento</Label>
                            <Input
                                placeholder="Lascia vuoto per usare il nome del file"
                                value={docName}
                                onChange={e => setDocName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>File</Label>
                            <div
                                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                onClick={() => fileRef.current?.click()}
                            >
                                <input type="file" className="hidden" ref={fileRef} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                                <Upload className="h-7 w-7 text-slate-400 mb-2" />
                                <p className="text-sm text-slate-600 font-medium">
                                    {file ? file.name : "Clicca per selezionare"}
                                </p>
                                {file && <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
                        <Button onClick={handleUpload} disabled={!file || uploading}>
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Carica
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Elimina documento"
                description={`Il documento "${toDelete?.name}" verrà eliminato definitivamente.`}
                onConfirm={handleDelete}
            />
        </div>
    )
}

// ─── Documenti associati ─────────────────────────────────────────────────────

function AssociatedDocuments({ jobId }: { jobId: string }) {
    const supabase = createClient()
    const [associations, setAssociations] = useState<JobComplianceAssociation[]>([])
    const [loading, setLoading] = useState(true)
    const [searchOpen, setSearchOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [disassociateOpen, setDisassociateOpen] = useState(false)
    const [editing, setEditing] = useState<JobComplianceAssociation | null>(null)
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [saving, setSaving] = useState(false)
    const [toDisassociate, setToDisassociate] = useState<JobComplianceAssociation | null>(null)

    useEffect(() => { load() }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            setAssociations(await jobComplianceApi.getByJobId(jobId))
        } catch {
            toast.error("Errore nel caricamento delle associazioni")
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
            await jobComplianceApi.update(editing.id, {
                customName: editName.trim() || null,
                customNotes: editNotes.trim() || null,
            })
            toast.success("Aggiornato")
            setEditOpen(false)
            load()
        } catch {
            toast.error("Errore aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleDisassociate = async () => {
        if (!toDisassociate) return
        try {
            await jobComplianceApi.disassociate(toDisassociate.id)
            setAssociations(associations.filter(a => a.id !== toDisassociate.id))
            toast.success("Documento disassociato")
        } catch {
            toast.error("Errore disassociazione")
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Documenti associati dalla gestione conformità
                </h3>
                <Button size="sm" variant="outline" onClick={() => setSearchOpen(true)}>
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />Associa
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : associations.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nessun documento associato</p>
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
                                placeholder="Note per questa commessa (non modificano le note originali)"
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
                description={`Il documento "${toDisassociate?.customName || toDisassociate?.document?.name}" verrà rimosso da questa commessa. Il documento originale non sarà modificato.`}
                onConfirm={handleDisassociate}
            />

            {/* Search & associate dialog */}
            {searchOpen && (
                <AssociateDialog
                    jobId={jobId}
                    existingIds={associations.map(a => a.complianceDocumentId)}
                    onClose={() => setSearchOpen(false)}
                    onAssociated={handleAssociated}
                />
            )}
        </div>
    )
}

// ─── Dialogo di ricerca e associazione ───────────────────────────────────────

function AssociateDialog({
    jobId,
    existingIds,
    onClose,
    onAssociated,
}: {
    jobId: string
    existingIds: string[]
    onClose: () => void
    onAssociated: () => void
}) {
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState("all")
    const [search, setSearch] = useState("")
    const [results, setResults] = useState<ComplianceDocument[]>([])
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
                docs = await complianceApi.getBySupplier(supplierId)
                if (search) docs = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
            } else {
                docs = await complianceApi.getAll(search || undefined)
            }
            setResults(docs)
        } catch {
            toast.error("Errore ricerca documenti")
        } finally {
            setLoadingResults(false)
        }
    }

    const handleAssociate = async (doc: ComplianceDocument) => {
        try {
            setAssociating(doc.id)
            await jobComplianceApi.associate(jobId, doc.id)
            toast.success("Documento associato")
            onAssociated()
        } catch (e: any) {
            if (e?.code === "23505") toast.error("Documento già associato")
            else toast.error("Errore associazione")
        } finally {
            setAssociating(null)
        }
    }

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Associa documento conformità</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Tutti i fornitori" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti i fornitori</SelectItem>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
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

// ─── Componente principale ───────────────────────────────────────────────────

export function JobConformita({ jobId }: JobConformitaProps) {
    return (
        <div className="space-y-8">
            <OwnDocuments jobId={jobId} />
            <div className="border-t pt-6">
                <AssociatedDocuments jobId={jobId} />
            </div>
        </div>
    )
}
