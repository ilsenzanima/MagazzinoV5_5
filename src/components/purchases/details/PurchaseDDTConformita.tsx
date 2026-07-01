"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ShieldCheck,
    Upload,
    Link2,
    Unlink,
    Loader2,
    ExternalLink,
    Plus,
    Search,
    X,
} from "lucide-react"
import { toast } from "sonner"
import {
    complianceApi,
    purchaseComplianceApi,
    ComplianceDocument,
    PurchaseComplianceAssociation,
} from "@/lib/services/compliance"
import { complianceDocumentTypesApi, ComplianceDocumentTypeConfig } from "@/lib/services/compliance-document-types"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"

interface PurchaseDDTConformitaProps {
    purchaseId: string
    supplierId: string
    supplierName?: string
    onUpdate?: () => void
}

export function PurchaseDDTConformita({
    purchaseId,
    supplierId,
    supplierName,
    onUpdate,
}: PurchaseDDTConformitaProps) {
    const [ownDocs, setOwnDocs] = useState<ComplianceDocument[]>([])
    const [associations, setAssociations] = useState<PurchaseComplianceAssociation[]>([])
    const [docTypes, setDocTypes] = useState<ComplianceDocumentTypeConfig[]>([])
    const [loading, setLoading] = useState(true)

    // Upload wizard
    const [uploadOpen, setUploadOpen] = useState(false)
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [upDocTypeId, setUpDocTypeId] = useState("")
    const [upFile, setUpFile] = useState<File | null>(null)
    const [upName, setUpName] = useState("")
    const [uploading, setUploading] = useState(false)
    const upRef = useRef<HTMLInputElement>(null)

    // Associate existing
    const [assocOpen, setAssocOpen] = useState(false)
    const [assocSearch, setAssocSearch] = useState("")
    const [assocResults, setAssocResults] = useState<ComplianceDocument[]>([])
    const [assocLoading, setAssocLoading] = useState(false)
    const [associating, setAssociating] = useState<string | null>(null)

    // Disassociate
    const [disassocOpen, setDisassocOpen] = useState(false)
    const [toDisassoc, setToDisassoc] = useState<PurchaseComplianceAssociation | null>(null)
    const [toDeleteOwn, setToDeleteOwn] = useState<ComplianceDocument | null>(null)
    const [deleteOwnOpen, setDeleteOwnOpen] = useState(false)

    useEffect(() => { load() }, [purchaseId])

    const load = async () => {
        try {
            setLoading(true)
            const [own, assocs, types] = await Promise.all([
                complianceApi.getByPurchaseId(purchaseId),
                purchaseComplianceApi.getByPurchaseId(purchaseId),
                complianceDocumentTypesApi.getAll(),
            ])
            setOwnDocs(own)
            setAssociations(assocs)
            setDocTypes(types)
        } catch {
            toast.error("Errore nel caricamento dei documenti di conformità")
        } finally {
            setLoading(false)
        }
    }

    // ── Upload wizard ─────────────────────────────────────────────────────────

    const openUpload = () => {
        setUpStep(1)
        setUpDocTypeId("")
        setUpFile(null)
        setUpName("")
        setUploadOpen(true)
    }

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        setUpFile(f)
        setUpName(f.name.replace(/\.[^.]+$/, ""))
        e.target.value = ""
    }

    const handleUpload = async () => {
        if (!upFile || !upDocTypeId) return
        try {
            setUploading(true)
            const compressed = await compressImageIfNeeded(upFile)
            const formData = new FormData()
            formData.append("file", compressed)
            formData.append(
                "folderPath",
                JSON.stringify(["Fornitori", supplierName || supplierId, "Compliance", "DDT"])
            )
            const res = await fetch("/api/drive/upload", { method: "POST", body: formData })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error || "Errore upload")

            await complianceApi.create({
                supplierId,
                brandId: null as any,
                documentTypeId: upDocTypeId,
                name: upName.trim() || upFile.name,
                fileUrl: result.fileId,
                fileSize: compressed.size,
                purchaseId,
            })
            toast.success("Documento caricato")
            setUploadOpen(false)
            load()
            onUpdate?.()
        } catch {
            toast.error("Errore durante il caricamento")
        } finally {
            setUploading(false)
        }
    }

    // ── Associate existing ────────────────────────────────────────────────────

    const openAssociate = () => {
        setAssocSearch("")
        setAssocResults([])
        setAssocOpen(true)
    }

    useEffect(() => {
        if (!assocOpen) return
        const t = setTimeout(() => fetchAssocResults(), 300)
        return () => clearTimeout(t)
    }, [assocSearch, assocOpen])

    const fetchAssocResults = async () => {
        try {
            setAssocLoading(true)
            let docs = await complianceApi.getBySupplier(supplierId)
            if (assocSearch) docs = docs.filter(d => d.name.toLowerCase().includes(assocSearch.toLowerCase()))
            const existingOwnIds = new Set(ownDocs.map(d => d.id))
            const existingAssocIds = new Set(associations.map(a => a.complianceDocumentId))
            setAssocResults(docs.filter(d => !existingOwnIds.has(d.id) && !existingAssocIds.has(d.id)))
        } catch {
            toast.error("Errore ricerca documenti")
        } finally {
            setAssocLoading(false)
        }
    }

    const handleAssociate = async (doc: ComplianceDocument) => {
        try {
            setAssociating(doc.id)
            await purchaseComplianceApi.associate(purchaseId, doc.id)
            toast.success("Documento associato")
            load()
        } catch {
            toast.error("Errore durante l'associazione")
        } finally {
            setAssociating(null)
        }
    }

    const confirmDisassoc = (assoc: PurchaseComplianceAssociation) => {
        setToDisassoc(assoc)
        setDisassocOpen(true)
    }

    const handleDisassoc = async () => {
        if (!toDisassoc) return
        try {
            await purchaseComplianceApi.disassociate(toDisassoc.id)
            setAssociations(associations.filter(a => a.id !== toDisassoc.id))
            toast.success("Documento disassociato")
        } catch {
            toast.error("Errore disassociazione")
        } finally {
            setDisassocOpen(false)
            setToDisassoc(null)
        }
    }

    const confirmDeleteOwn = (doc: ComplianceDocument) => {
        setToDeleteOwn(doc)
        setDeleteOwnOpen(true)
    }

    const handleDeleteOwn = async () => {
        if (!toDeleteOwn) return
        try {
            await complianceApi.delete(toDeleteOwn.id)
            setOwnDocs(ownDocs.filter(d => d.id !== toDeleteOwn.id))
            toast.success("Documento eliminato")
            onUpdate?.()
        } catch {
            toast.error("Errore eliminazione")
        } finally {
            setDeleteOwnOpen(false)
            setToDeleteOwn(null)
        }
    }

    const openDoc = (url: string) => {
        if (url && !url.includes("/")) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento`, "_blank")
            return
        }
        window.open(url, "_blank")
    }

    const allDocs: { doc: ComplianceDocument; assocId?: string }[] = [
        ...ownDocs.map(doc => ({ doc })),
        ...associations.map(a => ({ doc: a.document!, assocId: a.id })).filter(x => x.doc),
    ]

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Conformità associate al DDT
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openAssociate}>
                            <Link2 className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Associa esistente</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={openUpload}>
                            <Upload className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Carica</span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                    ) : allDocs.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 border-2 border-dashed dark:border-slate-600 rounded-md bg-slate-50/50 dark:bg-slate-800/50">
                            <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Nessun documento di conformità associato</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {allDocs.map(({ doc, assocId }) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-3 border dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 group"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                        <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded flex-shrink-0">
                                            <ShieldCheck className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="overflow-hidden min-w-0">
                                            <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                                                {doc.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {doc.documentTypeName && (
                                                    <span className="text-[10px] uppercase tracking-wide bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-green-700 font-semibold">
                                                        {doc.documentTypeName}
                                                    </span>
                                                )}
                                                {assocId && (
                                                    <span className="text-[10px] text-slate-400">associato</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => openDoc(doc.fileUrl)}
                                                className="text-xs text-blue-600 hover:underline flex items-center mt-0.5"
                                            >
                                                Apri documento <ExternalLink className="h-3 w-3 ml-1" />
                                            </button>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0 opacity-0 group-hover:opacity-100"
                                        onClick={() =>
                                            assocId
                                                ? confirmDisassoc(associations.find(a => a.id === assocId)!)
                                                : confirmDeleteOwn(doc)
                                        }
                                        title={assocId ? "Disassocia" : "Elimina"}
                                    >
                                        {assocId ? <Unlink className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upload wizard */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Carica documento di conformità</DialogTitle>
                    </DialogHeader>

                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>Tipo di documento *</Label>
                                <Select value={upDocTypeId} onValueChange={setUpDocTypeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona tipo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {docTypes.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>File *</Label>
                                <div
                                    className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => upRef.current?.click()}
                                >
                                    {upFile ? (
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{upFile.name}</p>
                                    ) : (
                                        <>
                                            <Upload className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                                            <p className="text-sm text-slate-400">Clicca per selezionare un file</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={upRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileSelected}
                                />
                            </div>
                            {upFile && (
                                <div className="space-y-1.5">
                                    <Label>Nome documento</Label>
                                    <Input
                                        value={upName}
                                        onChange={e => setUpName(e.target.value)}
                                        placeholder="Nome del documento"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {upStep === 1 ? (
                            <>
                                <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
                                <Button onClick={() => setUpStep(2)} disabled={!upDocTypeId}>Avanti</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setUpStep(1)}>Indietro</Button>
                                <Button onClick={handleUpload} disabled={!upFile || uploading}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Carica
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                <p className="text-sm text-slate-400 text-center py-4">
                                    {assocSearch ? "Nessun documento trovato" : "Nessun documento disponibile per questo fornitore"}
                                </p>
                            ) : (
                                assocResults.map(doc => (
                                    <div
                                        key={doc.id}
                                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{doc.name}</p>
                                            <p className="text-xs text-slate-400">{doc.documentTypeName}</p>
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

            {/* Disassociate confirm */}
            <ConfirmDeleteDialog
                open={disassocOpen}
                onOpenChange={setDisassocOpen}
                title="Disassocia documento"
                description={`Il documento "${toDisassoc?.document?.name}" verrà rimosso da questo DDT. Il documento originale non verrà eliminato.`}
                onConfirm={handleDisassoc}
            />

            {/* Delete own confirm */}
            <ConfirmDeleteDialog
                open={deleteOwnOpen}
                onOpenChange={setDeleteOwnOpen}
                title="Elimina documento"
                description={`Il documento "${toDeleteOwn?.name}" verrà eliminato definitivamente.`}
                onConfirm={handleDeleteOwn}
            />
        </>
    )
}
