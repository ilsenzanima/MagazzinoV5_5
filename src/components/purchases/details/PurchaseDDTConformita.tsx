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
    Unlink,
    Loader2,
    ExternalLink,
    Plus,
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
import { useBatchUpload } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

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
    const batchUpload = useBatchUpload()

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
        batchUpload.reset()
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
        setUploading(true)
        const { failedCount } = await batchUpload.run([upFile], async (file) => {
            const compressed = await compressImageIfNeeded(file)
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
                name: upName.trim() || file.name,
                fileUrl: result.fileId,
                fileSize: compressed.size,
                purchaseId,
                documentScope: "ddt_specific",
            })
        })
        setUploading(false)
        if (failedCount > 0) {
            toast.error("Errore durante il caricamento")
            return
        }
        toast.success("Documento caricato")
        setUploadOpen(false)
        load()
        onUpdate?.()
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
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Conformità associate al DDT
                    </CardTitle>
                    <div className="flex gap-2 shrink-0">
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
                                                {assocId ? (
                                                    <span className="text-[10px] text-slate-400">certificato associato</span>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">specifico di questo DDT</span>
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
                                    className={`border-2 border-dashed rounded-md p-4 text-center transition-colors ${uploading ? "opacity-60" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                    onClick={() => !uploading && upRef.current?.click()}
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
                                {uploading && <UploadStatusBar state={batchUpload.statuses[0]} />}
                                <input
                                    ref={upRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    disabled={uploading}
                                    onChange={handleFileSelected}
                                />
                            </div>
                            {upFile && (
                                <div className="space-y-1.5">
                                    <Label>Nome documento</Label>
                                    <Input
                                        value={upName}
                                        disabled={uploading}
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
