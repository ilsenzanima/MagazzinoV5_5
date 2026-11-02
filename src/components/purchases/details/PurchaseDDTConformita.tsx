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
import { brandsApi } from "@/lib/services/inventory"
import { Supplier, Brand } from "@/lib/types"
import { ComplianceUploadDialog } from "@/components/compliance/ComplianceUploadDialog"
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

    // Upload: stesso modale della pagina Gestione conformità, con fornitore e bolla già compilati
    const [uploadOpen, setUploadOpen] = useState(false)
    const [initialFiles, setInitialFiles] = useState<File[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [cardDragOver, setCardDragOver] = useState(false)

    // Disassociate
    const [disassocOpen, setDisassocOpen] = useState(false)
    const [toDisassoc, setToDisassoc] = useState<PurchaseComplianceAssociation | null>(null)
    const [toDeleteOwn, setToDeleteOwn] = useState<ComplianceDocument | null>(null)
    const [deleteOwnOpen, setDeleteOwnOpen] = useState(false)

    useEffect(() => { load() }, [purchaseId])

    const load = async () => {
        try {
            setLoading(true)
            const [own, assocs, types, brandList] = await Promise.all([
                complianceApi.getByPurchaseId(purchaseId),
                purchaseComplianceApi.getByPurchaseId(purchaseId),
                complianceDocumentTypesApi.getAll(),
                brandsApi.getAll(),
            ])
            setBrands(brandList)
            setOwnDocs(own)
            setAssociations(assocs)
            setDocTypes(types)
        } catch {
            toast.error("Errore nel caricamento dei documenti di conformità")
        } finally {
            setLoading(false)
        }
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    const openUpload = (files?: File[]) => {
        setInitialFiles(files ?? [])
        setUploadOpen(true)
    }

    const handleCardDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setCardDragOver(false)
        const files = Array.from(e.dataTransfer.files ?? [])
        if (files.length > 0) openUpload(files)
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
            <Card
                className={`transition-colors duration-200 ${cardDragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : ""}`}
                onDragOver={e => { e.preventDefault(); setCardDragOver(true) }}
                onDragLeave={e => { e.preventDefault(); setCardDragOver(false) }}
                onDrop={handleCardDrop}
            >
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Conformità associate al DDT
                    </CardTitle>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openUpload()}>
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
                            <p className="text-sm">
                                {cardDragOver ? "Rilascia il file qui..." : "Nessun documento di conformità associato, trascina qui un file o usa il pulsante Carica"}
                            </p>
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

            <ComplianceUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                supplierId={supplierId}
                suppliers={[{ id: supplierId, name: supplierName || supplierId } as Supplier]}
                brands={brands}
                docTypes={docTypes}
                fixedPurchase={{ id: purchaseId }}
                initialFiles={initialFiles}
                onUploaded={() => { load(); onUpdate?.() }}
            />

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
