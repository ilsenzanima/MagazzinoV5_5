"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, FileText, Pencil, Trash2, X, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, Printer, Download } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { InlineNote } from "@/components/jobs/details/JobDocuments"
import { RowActionsButton } from "@/components/ui/row-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DocumentBulkBar, useDocSelection, printOne, downloadOne } from "@/components/documents/DocumentBulkBar"
import { costAnalysisDocumentsApi, CostAnalysisDocument } from "@/lib/services/cost-analysis-documents"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { getFileIcon } from "@/lib/file-icon"
import { compressImageIfNeeded } from "@/lib/image-compress"
import { uploadFileToDrive } from "@/lib/drive-upload"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NotchActions, NotchSearch } from "@/components/ui/notch-tabs"
import { useBatchUpload, MAX_BATCH_UPLOAD_FILES } from "@/hooks/useBatchUpload"
import { DocumentUploadDialog, usePendingFiles } from "@/components/documents/DocumentUploadDialog"

interface Props {
    jobId?: string
    proposalId?: string
    jobLabel?: string
}

export function CostAnalysisDocuments({ jobId, proposalId, jobLabel }: Props) {
    const [documents, setDocuments] = useState<CostAnalysisDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [activeDoc, setActiveDoc] = useState<CostAnalysisDocument | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [sortKey, setSortKey] = useState<'name' | 'date'>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (k: 'name' | 'date') => {
        if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
        else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc') }
    }
    const sortIcon = (k: 'name' | 'date') => sortKey === k
        ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
    const [search, setSearch] = useState("")
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Upload wizard
    const { files: pendingFiles, setFiles: setPendingFiles, add: addFiles, update: updatePending, remove: removePending, clear: clearPending } = usePendingFiles()

    // Edit form
    const [editName, setEditName] = useState("")
    const [editNotes, setEditNotes] = useState("")

    const ownerId = jobId || proposalId
    const folderPath = jobId ? ['Cantieri', jobLabel || jobId, 'Analisi Costi di Terzi'] : ['Proposte', proposalId || '', 'Analisi Costi di Terzi']

    useEffect(() => {
        if (ownerId) load()
    }, [ownerId])

    const load = async () => {
        try {
            setLoading(true)
            const all = jobId ? await costAnalysisDocumentsApi.getByJobId(jobId) : await costAnalysisDocumentsApi.getByProposalId(proposalId!)
            setDocuments(all)
        } catch (error) {
            console.error("Failed to load analisi costi di terzi", error)
            notify.error("Errore nel caricamento delle analisi costi di terzi")
        } finally {
            setLoading(false)
        }
    }

    const openUpload = () => {
        clearPending()
        batchUpload.reset()
        setUploadOpen(true)
    }

    const batchUpload = useBatchUpload()

    const handleUploadAll = async () => {
        if (pendingFiles.length === 0 || !ownerId) return
        setUploading(true)
        const { okCount, failedCount } = await batchUpload.run(pendingFiles, async pending => {
            const compressed = await compressImageIfNeeded(pending.file)
            const fileExt = compressed.name.split('.').pop() || ''
            const uploaded = await uploadFileToDrive(compressed, folderPath)

            await costAnalysisDocumentsApi.create({
                jobId,
                proposalId,
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

    const openEdit = (doc: CostAnalysisDocument) => {
        setActiveDoc(doc)
        setEditName(doc.name)
        setEditNotes(doc.notes || "")
        setEditOpen(true)
    }

    const handleSaveEdit = async () => {
        if (!activeDoc) return
        try {
            setSaving(true)
            await costAnalysisDocumentsApi.update(activeDoc.id, {
                name: editName.trim() || activeDoc.name,
                notes: editNotes.trim(),
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

    // Nota modificata direttamente dalla tabella
    const saveNote = async (d: CostAnalysisDocument, notes: string) => {
        if (notes === (d.notes || "")) return
        try {
            await costAnalysisDocumentsApi.update(d.id, { name: d.name, notes })
            setDocuments(prev => prev.map(x => x.id === d.id ? { ...x, notes } : x))
        } catch { notify.error("Errore durante il salvataggio della nota") }
    }

    const handleDelete = async () => {
        if (!activeDoc) return
        try {
            const path = activeDoc.fileUrl?.split('/public/documents/')[1]
            if (path) await supabase.storage.from('documents').remove([path])
            await costAnalysisDocumentsApi.delete(activeDoc.id)
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

    const shown = documents.filter(d => {
        const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
        const target = `${d.name} ${d.notes || ''}`.toLowerCase()
        return words.every(w => target.includes(w))
    }).sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1
        return sortKey === 'name'
            ? dir * a.name.localeCompare(b.name, 'it', { numeric: true })
            : dir * String(a.createdAt).localeCompare(String(b.createdAt))
    })

    // Selezione multipla: resta anche cambiando la ricerca
    const sel = useDocSelection()
    const selectedDocs = documents.filter(d => sel.ids.has(d.id))
    const allShownSelected = shown.length > 0 && shown.every(d => sel.ids.has(d.id))

    return (
        <div className="space-y-4">
            <NotchActions>
                <NotchSearch value={search} onChange={setSearch} placeholder="Cerca documento" />
            </NotchActions>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
            ) : documents.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-slate-500">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Nessuna analisi costi caricata</h3>
                        <p className="text-slate-500 dark:text-slate-400">Carica qui le analisi costi fornite da terzi (es. dal cliente o da un consulente).</p>
                    </CardContent>
                </Card>
            ) : shown.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Nessun documento corrisponde alla ricerca.</p>
            ) : (
                <>
                <DocumentBulkBar docs={selectedDocs} onClear={sel.clear} />
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className="w-10 border-r"><Checkbox checked={allShownSelected ? true : selectedDocs.length > 0 ? "indeterminate" : false} onCheckedChange={v => sel.setAll(shown.map(d => d.id), v === true)} aria-label="Seleziona tutti" /></TableHead>
                            <TableHead className="w-1/3 border-r text-xs font-semibold uppercase tracking-wide text-slate-600"><button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">Nome{sortIcon('name')}</button></TableHead>
                            <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Note</TableHead>
                            <TableHead className="w-36 border-r text-xs font-semibold uppercase tracking-wide text-slate-600"><button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">Caricato il{sortIcon('date')}</button></TableHead>
                            <TableHead className="w-[4.5rem]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shown.map(doc => (
                            <TableRow key={doc.id} className="cursor-pointer" onClick={() => handleOpenDocument(doc.fileUrl)}>
                                <TableCell className="border-r py-2" onClick={e => e.stopPropagation()}><Checkbox checked={sel.ids.has(doc.id)} onCheckedChange={() => sel.toggle(doc.id)} aria-label="Seleziona documento" /></TableCell>
                                <TableCell className="border-r py-2">
                                    <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                        <span className="shrink-0">{getFileIcon(doc.fileType)}</span>
                                        <span className="truncate" title={doc.name}>{doc.name}</span>
                                    </span>
                                </TableCell>
                                <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}><InlineNote value={doc.notes || ""} onSave={n => saveNote(doc, n)} /></TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: it })}</TableCell>
                                <TableCell className="py-2">
                                    <div className="flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><RowActionsButton aria-label="Azioni documento" /></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                                                <DropdownMenuItem onClick={() => handleOpenDocument(doc.fileUrl)}><ExternalLink className="mr-2 h-4 w-4" />Apri</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => printOne(doc)}><Printer className="mr-2 h-4 w-4" />Stampa</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => downloadOne(doc)}><Download className="mr-2 h-4 w-4" />Scarica</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => openEdit(doc)}><Pencil className="mr-2 h-4 w-4" />Modifica</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setActiveDoc(doc); setDeleteOpen(true) }} className="text-red-600 focus:text-red-600"><Trash2 className="mr-2 h-4 w-4" />Elimina</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </>
            )}

            <FloatingAddButton onClick={openUpload} label="Carica analisi costi" />

            <DocumentUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                title="Carica analisi costi di terzi"
                files={pendingFiles}
                onAddFiles={addFiles}
                onUpdateFile={updatePending}
                onRemoveFile={removePending}
                statuses={batchUpload.statuses}
                uploading={uploading}
                onSubmit={handleUploadAll}
                showOldRev={false}
            />

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
