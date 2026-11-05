"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { NotchSearch } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { SortArrow, InlineNote, TABLE_HEAD_CLS, TABLE_SELECT_CLS } from "@/components/ui/table-bits"
import { Upload, Loader2, FileText, Pencil, Trash2, X, Search, MoreHorizontal, ExternalLink, Download } from "lucide-react"
import { supplierOffersApi, SupplierOffer } from "@/lib/services/supplier-offers"
import { suppliersApi } from "@/lib/services/suppliers"
import { supplierGroupsApi } from "@/lib/services/supplier-groups"
import type { Supplier } from "@/lib/types"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { getFileIcon } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

const NO_SUPPLIER = "_nessuno"
const PAGE_SIZE = 50
type SortKey = "name" | "supplier" | "date"

interface PendingFile {
    file: File
    name: string
    notes: string
}

interface Props {
    jobId?: string
    proposalId?: string
    jobLabel?: string
    // Dentro la striscia dei tab della commessa: titolo e pulsante stanno nella striscia
    inStrip?: boolean
}

export function SupplierOffers({ jobId, proposalId, jobLabel, inStrip }: Props) {
    const [documents, setDocuments] = useState<SupplierOffer[]>([])
    const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<SupplierOffer | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState("")
    const [supplierFilter, setSupplierFilter] = useState("all")
    const [sortKey, setSortKey] = useState<SortKey>("date")
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
    const [page, setPage] = useState(1)
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Upload wizard
    const [upStep, setUpStep] = useState<1 | 2>(1)
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
    const [dragOver, setDragOver] = useState(false)
    const [uploadSupplierId, setUploadSupplierId] = useState("")

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")
    const [editSupplierId, setEditSupplierId] = useState("")

    const ownerId = jobId || proposalId
    const folderPath = jobId ? ['Cantieri', jobLabel || jobId, 'Offerte Fornitori'] : ['Proposte', proposalId || '', 'Offerte Fornitori']

    const supplierName = useMemo(() => {
        const map = new Map(allSuppliers.map(s => [s.id, s.name]))
        return (id: string | null) => (id && map.get(id)) || null
    }, [allSuppliers])

    // Fornitori presenti nei documenti, in ordine alfabetico (per il filtro in intestazione)
    const supplierGroups = useMemo(() => {
        const present = new Map<string, string>()
        let hasUnassigned = false
        for (const doc of documents) {
            if (doc.supplierId) present.set(doc.supplierId, supplierName(doc.supplierId) || "Fornitore")
            else hasUnassigned = true
        }
        const groups = [...present.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "it"))
        return { groups, hasUnassigned }
    }, [documents, supplierName])

    const sorted = useMemo(() => {
        const q = search.trim().toLowerCase()
        const list = documents.filter(d => {
            if (supplierFilter === NO_SUPPLIER ? !!d.supplierId : supplierFilter !== "all" && d.supplierId !== supplierFilter) return false
            if (!q) return true
            return `${d.name} ${d.notes} ${supplierName(d.supplierId) ?? ""}`.toLowerCase().includes(q)
        })
        const dir = sortDir === "asc" ? 1 : -1
        return [...list].sort((x, y) => {
            let r = 0
            if (sortKey === "name") r = x.name.localeCompare(y.name, "it")
            else if (sortKey === "supplier") r = (supplierName(x.supplierId) || "~").localeCompare(supplierName(y.supplierId) || "~", "it")
            else r = x.createdAt.localeCompare(y.createdAt)
            return r * dir
        })
    }, [documents, search, supplierFilter, sortKey, sortDir, supplierName])

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages)
    const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
        else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc") }
        setPage(1)
    }
    const anyFilter = !!search.trim() || supplierFilter !== "all"

    useEffect(() => {
        if (ownerId) load()
        Promise.all([suppliersApi.getAll(), supplierGroupsApi.getHiddenFromPurchasesIds()])
            .then(([s, hiddenIds]) => {
                setAllSuppliers(s)
                setSuppliers(s.filter(sup => !hiddenIds.includes(sup.id)))
            })
            .catch(() => {})
    }, [ownerId])

    const load = async () => {
        try {
            setLoading(true)
            const all = jobId ? await supplierOffersApi.getByJobId(jobId) : await supplierOffersApi.getByProposalId(proposalId!)
            setDocuments(all)
        } catch (error) {
            console.error("Failed to load offerte fornitori", error)
            notify.error("Errore nel caricamento delle offerte fornitori")
        } finally {
            setLoading(false)
        }
    }

    const openUpload = () => {
        setUpStep(1)
        setPendingFiles([])
        setUploadSupplierId("")
        batchUpload.reset()
        setUploadOpen(true)
    }

    const addFiles = (files: FileList | File[]) => {
        setPendingFiles(prev => {
            const room = MAX_BATCH_UPLOAD_FILES - prev.length
            if (room <= 0) {
                notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta`)
                return prev
            }
            const selected = Array.from(files)
            if (selected.length > room) notify.error(`Puoi caricare al massimo ${MAX_BATCH_UPLOAD_FILES} file alla volta, aggiunti solo i primi ${room}`)
            const arr = selected.slice(0, room).map(file => ({
                file,
                name: file.name.replace(/\.[^.]+$/, ''),
                notes: "",
            }))
            return [...prev, ...arr]
        })
    }

    const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) addFiles(e.target.files)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
    }

    const goToStep2 = () => {
        if (pendingFiles.length === 0 || !uploadSupplierId) return
        setUpStep(2)
    }

    const updatePending = (index: number, patch: Partial<PendingFile>) => {
        setPendingFiles(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
    }

    const removePending = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index))
    }

    const batchUpload = useBatchUpload()

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0 || !ownerId) return
        setUploading(true)
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pending => {
            const compressed = await compressImageIfNeeded(pending.file)
            const fileExt = compressed.name.split('.').pop() || ''
            const uploaded = await uploadFileToDrive(compressed, folderPath)

            await supplierOffersApi.create({
                jobId,
                proposalId,
                supplierId: uploadSupplierId,
                name: pending.name.trim() || pending.file.name,
                notes: pending.notes.trim(),
                fileUrl: uploaded.fileId,
                fileType: fileExt,
            })
        })
        setUploading(false)
        if (failedCount === 0) {
            notify.success(okCount > 1 ? "Documenti caricati con successo" : "Documento caricato con successo")
            setUploadOpen(false)
        } else if (okCount === 0) {
            notify.error("Nessun documento caricato, riprova")
        } else {
            notify.error(`${okCount} caricati, ${failedCount} falliti. Riprova con i file rimasti.`)
            setPendingFiles(prev => prev.filter((_, i) => batchUpload.statuses[i]?.status === 'error'))
        }
        load()
    }

    const openEdit = (doc: SupplierOffer) => {
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditSupplierId(doc.supplierId || "")
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            await supplierOffersApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
                supplierId: editSupplierId || null,
            })
            notify.success("Documento aggiornato")
            setEditOpen(false)
            load()
        } catch {
            notify.error("Errore durante l'aggiornamento")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNote = async (doc: SupplierOffer, notes: string) => {
        if (notes === doc.notes) return
        try {
            await supplierOffersApi.update(doc.id, { notes })
            setDocuments(prev => prev.map(d => (d.id === doc.id ? { ...d, notes } : d)))
        } catch {
            notify.error("Errore nel salvataggio della nota")
        }
    }

    const handleOpenDocument = async (fileUrl: string) => {
        if (fileUrl && !fileUrl.includes('/')) {
            window.open(`/api/drive/download?fileId=${encodeURIComponent(fileUrl)}&fileName=documento`, '_blank')
            return
        }
        try {
            const path = fileUrl.split('/public/documents/')[1]
            if (!path) { window.open(fileUrl, '_blank'); return }
            const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
            if (error || !data?.signedUrl) { window.open(fileUrl, '_blank'); return }
            window.open(data.signedUrl, '_blank')
        } catch {
            window.open(fileUrl, '_blank')
        }
    }

    const handleDelete = async () => {
        if (!activeDoc) return
        try {
            const path = activeDoc.fileUrl?.split('/public/documents/')[1]
            if (path) await supabase.storage.from('documents').remove([path])
            await supplierOffersApi.delete(activeDoc.id)
            setDeleteOpen(false)
            setEditOpen(false)
            notify.success("Documento eliminato")
            setDocuments(documents.filter(d => d.id !== activeDoc.id))
            setActiveDoc(null)
        } catch (error) {
            console.error("Delete failed", error)
            notify.error("Errore durante l'eliminazione")
        }
    }

    const isDrive = (doc: SupplierOffer) => !!doc.fileUrl && !doc.fileUrl.includes('/')
    const dateOf = (doc: SupplierOffer) => format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: it })

    const rowMenu = (doc: SupplierOffer) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" aria-label="Azioni documento" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handleOpenDocument(doc.fileUrl)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
                {isDrive(doc) && (
                    <DropdownMenuItem onClick={() => window.open(`/api/drive/download?fileId=${encodeURIComponent(doc.fileUrl)}&download=1`, '_blank')}>
                        <Download className="mr-2 h-4 w-4" />Scarica
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => openEdit(doc)}><Pencil className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setActiveDoc(doc); setDeleteOpen(true) }} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />Elimina
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const supplierSelect = (cls?: string) => (
        <Select value={supplierFilter} onValueChange={v => { setSupplierFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Filtra per fornitore" className={cls}><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Tutti i fornitori</SelectItem>
                {supplierGroups.groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                {supplierGroups.hasUnassigned && <SelectItem value={NO_SUPPLIER}>Senza fornitore</SelectItem>}
            </SelectContent>
        </Select>
    )
    const sortBtn = (key: SortKey, label: string) => (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
            {label}<SortArrow active={sortKey === key} dir={sortDir} />
        </button>
    )

    return (
        <div className="space-y-4">
            {inStrip ? (
                <FloatingAddButton onClick={openUpload} label="Carica documenti" icon={<Upload className="h-6 w-6" />} showOnMobile />
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Offerte Fornitori</h2>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={openUpload}>
                        <Upload className="mr-2 h-4 w-4" />
                        Carica Documenti
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : documents.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessuna offerta fornitore</h3>
                        <p className="text-slate-500 dark:text-slate-400">Carica le offerte ricevute dai fornitori.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2 empty:hidden">
                        <NotchSearch value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Cerca per nome, fornitore o nota" />
                        {anyFilter && (
                            <Button variant="ghost" className="shrink-0 text-xs text-slate-600" onClick={() => { setSearch(""); setSupplierFilter("all"); setPage(1) }}>Azzera filtri</Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 md:hidden">{supplierSelect()}</div>

                    {/* Tabella (PC) */}
                    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-card">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={TABLE_HEAD_CLS}>{sortBtn("name", "Documento")}</TableHead>
                                    <TableHead className={`w-56 ${TABLE_HEAD_CLS}`}>
                                        <div className="flex items-center gap-1">
                                            <div className="min-w-0 flex-1">{supplierSelect(TABLE_SELECT_CLS)}</div>
                                            <button type="button" aria-label="Ordina per fornitore" onClick={() => toggleSort("supplier")} className="shrink-0 text-slate-500 hover:text-slate-900">
                                                <SortArrow active={sortKey === "supplier"} dir={sortDir} />
                                            </button>
                                        </div>
                                    </TableHead>
                                    <TableHead className={`w-28 ${TABLE_HEAD_CLS}`}>{sortBtn("date", "Data")}</TableHead>
                                    <TableHead className={`w-[28%] ${TABLE_HEAD_CLS}`}>Nota</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-10 text-center text-slate-400">Nessun documento con questi filtri</TableCell>
                                    </TableRow>
                                ) : rows.map(doc => (
                                    <TableRow key={doc.id} className="cursor-pointer" onClick={() => handleOpenDocument(doc.fileUrl)}>
                                        <TableCell className="border-r py-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</span>
                                                <span className="truncate text-sm font-medium" title={doc.name}>{doc.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="truncate border-r py-2 text-sm text-slate-600 dark:text-slate-300" title={supplierName(doc.supplierId) || ""}>
                                            {supplierName(doc.supplierId) || <span className="text-slate-300">—</span>}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap border-r py-2 text-sm text-slate-600 dark:text-slate-300">{dateOf(doc)}</TableCell>
                                        <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                            <InlineNote value={doc.notes} onSave={v => handleSaveNote(doc, v)} />
                                        </TableCell>
                                        <TableCell className="py-2 text-right">{rowMenu(doc)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Elenco compatto (telefono) */}
                    <div className="space-y-2 md:hidden">
                        {rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nessun documento con questi filtri</p>}
                        {rows.map(doc => (
                            <div key={doc.id} className="flex items-start gap-2 rounded-md border bg-white p-3 dark:bg-slate-900" onClick={() => handleOpenDocument(doc.fileUrl)}>
                                <span className="mt-0.5 shrink-0">{getFileIcon(doc.fileType, "h-5 w-5")}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{doc.name}</p>
                                    <p className="text-xs text-slate-500">{supplierName(doc.supplierId) || "Senza fornitore"} · {dateOf(doc)}</p>
                                    <div className="mt-1" onClick={e => e.stopPropagation()}>
                                        <InlineNote value={doc.notes} onSave={v => handleSaveNote(doc, v)} />
                                    </div>
                                </div>
                                {rowMenu(doc)}
                            </div>
                        ))}
                    </div>

                    <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} totalItems={sorted.length} itemLabel="documenti" />
                </>
            )}

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Carica Offerte Fornitori</DialogTitle></DialogHeader>
                    {upStep === 1 ? (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <Label>Fornitore *</Label>
                                <Select value={uploadSupplierId} onValueChange={setUploadSupplierId}>
                                    <SelectTrigger><SelectValue placeholder="Seleziona il fornitore" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>File (puoi selezionarne più di uno, anche con drag&drop)</Label>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? 'bg-blue-50 border-blue-400 dark:bg-blue-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                >
                                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFilesSelected} />
                                    <Upload className="h-8 w-8 text-slate-400 mb-2" />
                                    <p className="text-sm text-slate-600 font-medium">
                                        {pendingFiles.length > 0 ? `${pendingFiles.length} file selezionati` : "Clicca o trascina qui i file"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <p className="text-xs text-slate-500">Per ogni file inserisci nome e nota (opzionale).</p>
                            {pendingFiles.map((p, i) => (
                                <div key={i} className="border rounded-lg p-3 space-y-2 relative">
                                    {!uploading && (
                                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => removePending(i)}>
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <p className="text-xs text-slate-400 truncate pr-6">{p.file.name}</p>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nome documento</Label>
                                        <Input value={p.name} disabled={batchUpload.statuses[i]?.status === 'uploading'} onChange={e => updatePending(i, { name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Nota (opzionale)</Label>
                                        <Input value={p.notes} disabled={batchUpload.statuses[i]?.status === 'uploading'} onChange={e => updatePending(i, { notes: e.target.value })} placeholder="Breve descrizione" />
                                    </div>
                                    <UploadStatusBar state={batchUpload.statuses[i]} />
                                </div>
                            ))}
                            {pendingFiles.length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">Nessun file selezionato.</p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        {upStep === 1 ? (
                            <>
                                <Button variant="outline" onClick={() => setUploadOpen(false)}>Annulla</Button>
                                <Button onClick={goToStep2} disabled={pendingFiles.length === 0 || !uploadSupplierId}>Continua</Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setUpStep(1)}>Indietro</Button>
                                <Button onClick={handleUploadAll} disabled={uploading || pendingFiles.length === 0}>
                                    {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Carica {pendingFiles.length > 1 ? `(${pendingFiles.length})` : ""}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Modifica Documento</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Nome documento</Label>
                            <Input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Nota</Label>
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label>Fornitore</Label>
                            <Select value={editSupplierId} onValueChange={setEditSupplierId}>
                                <SelectTrigger><SelectValue placeholder="Seleziona il fornitore" /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.some(s => s.id === editSupplierId)
                                        ? suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))
                                        : allSuppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 sm:mr-auto"
                            onClick={() => { setEditOpen(false); setDeleteOpen(true) }}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />Elimina
                        </Button>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Elimina documento"
                description={`Il documento "${activeDoc?.name || 'selezionato'}" verrà eliminato definitivamente e non potrà essere recuperato.`}
                onConfirm={handleDelete}
            />
        </div>
    )
}
