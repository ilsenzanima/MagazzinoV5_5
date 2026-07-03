"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { ArrowLeft, BarChart2, Calculator, CheckCircle2, FileText, GanttChartSquare, Loader2, MapPin, Pencil, ShieldCheck, Trash2, Truck } from "lucide-react"
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals"
import { clientsApi } from "@/lib/api"
import { jobsApi, jobTasksApi } from "@/lib/api"
import { proposalTasksApi } from "@/lib/services/proposal-tasks"
import { costAnalysisApi } from "@/lib/services/cost-analysis"
import { proposalDocumentsApi } from "@/lib/services/proposal-documents"
import { supplierOffersApi } from "@/lib/services/supplier-offers"
import { SupplierOffers } from "@/components/shared/SupplierOffers"
import { proposalDocumentTypesApi } from "@/lib/services/proposal-document-types"
import { HelpTip } from "@/components/ui/help-tip"
import { proposalComplianceApi, jobComplianceApi } from "@/lib/services/compliance"
import { Client } from "@/lib/types"
import { notify } from "@/lib/notify"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { ProposalCostAnalysisVersions } from "@/components/clients/detail/ProposalCostAnalysisVersions"
import { ProposalDocuments } from "@/components/clients/detail/ProposalDocuments"
import { ProposalSiteDocuments } from "@/components/clients/detail/ProposalSiteDocuments"
import { proposalSiteDocumentsApi } from "@/lib/services/proposal-site-documents"
import { jobSiteDocumentTypesApi } from "@/lib/services/job-site-document-types"
import { ProposalConformita } from "@/components/clients/detail/ProposalConformita"
import { ProposalDistanza } from "@/components/clients/detail/ProposalDistanza"
import { ProposalCronoprogramma } from "@/components/clients/detail/ProposalCronoprogramma"
import { useAuth } from "@/components/auth-provider"

/** Avanza `start` di `days` giorni lavorativi (lun-ven), restituendo la data dell'ultimo giorno lavorativo occupato. */
function addWorkingDays(start: Date, days: number): Date {
    const d = new Date(start)
    let remaining = days
    while (remaining > 0) {
        if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
        if (remaining > 0) d.setDate(d.getDate() + 1)
    }
    return d
}

/** Trova il primo giorno lavorativo a partire da (e incluso) `date`. */
function firstWorkingDay(date: Date): Date {
    const d = new Date(date)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    return d
}

/** Giorno lavorativo successivo a `date`. */
function nextWorkingDay(date: Date): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    return firstWorkingDay(d)
}

const STATUS_LABELS: Record<ProposalStatus, string> = {
    draft: "Bozza", sent: "Inviata", pending: "In attesa", accepted: "Accettata", rejected: "Rifiutata",
}
const STATUS_COLORS: Record<ProposalStatus, string> = {
    draft: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

export default function ProposalDetailPage() {
    const { id: clientId, proposalId } = useParams<{ id: string; proposalId: string }>()
    const router = useRouter()
    const { userRole } = useAuth()
    const canEdit = userRole === "admin" || userRole === "operativo"

    const [proposal, setProposal] = useState<ClientProposal | null>(null)
    const [client, setClient] = useState<Client | null>(null)
    const [allClients, setAllClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [convertOpen, setConvertOpen] = useState(false)
    const [converting, setConverting] = useState(false)
    const [convertHasTasks, setConvertHasTasks] = useState(false)
    const [convertStartDate, setConvertStartDate] = useState("")
    const [convertReuseJobId, setConvertReuseJobId] = useState<string | null>(null)
    // false = la commessa collegata è nel cestino o non esiste più: la proposta è riconvertibile
    // (null = sconosciuto/in caricamento, trattato come "viva" per non far lampeggiare i pulsanti)
    const [linkedJobAlive, setLinkedJobAlive] = useState<boolean | null>(null)
    const [saving, setSaving] = useState(false)
    const [useClientAddr, setUseClientAddr] = useState(false)

    const [form, setForm] = useState({
        title: "", description: "", estimatedValue: "", status: "draft" as ProposalStatus,
        date: "", notes: "", clientId: "",
        siteStreet: "", siteStreetNumber: "", sitePostalCode: "", siteCity: "", siteProvince: "",
    })

    // Inline edit state
    const [inlineEdit, setInlineEdit] = useState<"status" | "value" | "description" | null>(null)
    const [inlineStatus, setInlineStatus] = useState<ProposalStatus>("draft")
    const [inlineValue, setInlineValue] = useState("")
    const [inlineDesc, setInlineDesc] = useState("")
    const [inlineSaving, setInlineSaving] = useState(false)

    const openInline = (field: "status" | "value" | "description") => {
        if (!proposal) return
        if (field === "status") setInlineStatus(proposal.status)
        if (field === "value") setInlineValue(proposal.estimatedValue !== null ? String(proposal.estimatedValue) : "")
        if (field === "description") setInlineDesc(proposal.description)
        setInlineEdit(field)
    }

    const saveInline = async (field: "status" | "value" | "description") => {
        if (!proposal) return
        try {
            setInlineSaving(true)
            const patch: Partial<ClientProposal> = {}
            if (field === "status") patch.status = inlineStatus
            if (field === "value") patch.estimatedValue = inlineValue ? Number(inlineValue) : null
            if (field === "description") patch.description = inlineDesc
            await clientProposalsApi.update(proposalId, patch)
            const updated = await clientProposalsApi.getById(proposalId)
            setProposal(updated)
            setInlineEdit(null)
        } catch { notify.error("Errore durante il salvataggio") }
        finally { setInlineSaving(false) }
    }

    useEffect(() => {
        Promise.all([
            clientProposalsApi.getById(proposalId),
            clientsApi.getById(clientId),
            clientsApi.getAll(),
        ]).then(([p, c, all]) => {
            if (!p) { router.push(`/clients/${clientId}`); return }
            setProposal(p)
            setClient(c)
            setAllClients(all)
        }).catch(() => router.push(`/clients/${clientId}`))
          .finally(() => setLoading(false))
    }, [proposalId, clientId])

    // Verifica se la commessa collegata esiste ancora ed è fuori dal cestino:
    // se non lo è, la proposta deve poter essere riconvertita qualunque sia il suo stato
    useEffect(() => {
        const jobId = proposal?.convertedJobId
        if (!jobId) { setLinkedJobAlive(null); return }
        let cancelled = false
        jobsApi.getStatusById(jobId)
            .then(s => { if (!cancelled) setLinkedJobAlive(s.exists && !s.deletedAt) })
            .catch(() => { if (!cancelled) setLinkedJobAlive(null) })
        return () => { cancelled = true }
    }, [proposal?.convertedJobId])

    const openEdit = () => {
        if (!proposal) return
        setForm({
            title: proposal.title,
            description: proposal.description,
            estimatedValue: proposal.estimatedValue !== null ? String(proposal.estimatedValue) : "",
            status: proposal.status,
            date: proposal.date,
            notes: proposal.notes,
            clientId: proposal.clientId,
            siteStreet: proposal.siteStreet,
            siteStreetNumber: proposal.siteStreetNumber,
            sitePostalCode: proposal.sitePostalCode,
            siteCity: proposal.siteCity,
            siteProvince: proposal.siteProvince,
        })
        setUseClientAddr(false)
        setEditOpen(true)
    }

    useEffect(() => {
        if (useClientAddr && client) {
            setForm(f => ({
                ...f,
                siteStreet: client.street || "",
                siteStreetNumber: client.streetNumber || "",
                sitePostalCode: client.postalCode || "",
                siteCity: client.city || "",
                siteProvince: client.province || "",
            }))
        }
    }, [useClientAddr, client])

    const handleSave = async () => {
        if (!form.title.trim()) { notify.warning("Il titolo è obbligatorio"); return }
        if (!form.clientId) { notify.warning("Il committente è obbligatorio"); return }
        try {
            setSaving(true)
            const clientChanged = form.clientId !== clientId
            await clientProposalsApi.update(proposalId, {
                clientId: form.clientId,
                title: form.title.trim(),
                description: form.description,
                estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
                status: form.status,
                date: form.date,
                notes: form.notes,
                siteStreet: form.siteStreet,
                siteStreetNumber: form.siteStreetNumber,
                sitePostalCode: form.sitePostalCode,
                siteCity: form.siteCity,
                siteProvince: form.siteProvince,
            })
            if (clientChanged) {
                notify.success("Committente aggiornato")
                router.push(`/clients/${form.clientId}/proposals/${proposalId}`)
                return
            }
            const updated = await clientProposalsApi.getById(proposalId)
            setProposal(updated)
            setEditOpen(false)
        } catch { notify.error("Errore durante il salvataggio") }
        finally { setSaving(false) }
    }

    const handleDelete = async () => {
        try {
            await clientProposalsApi.delete(proposalId)
            router.push(`/clients/${clientId}?tab=proposte`)
        } catch { notify.error("Errore durante l'eliminazione") }
    }

    const generateJobCode = (clientName: string) => {
        const date = new Date()
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const clientSlug = clientName.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X') || "JOB"
        const suffix = Date.now().toString(36).toUpperCase().slice(-4)
        return `${year}-${month}-${clientSlug}-${suffix}`
    }

    const handleConvert = async () => {
        if (!proposal || !client) return
        try {
            setConverting(true)
            const siteAddressParts = [
                proposal.siteStreet && `${proposal.siteStreet}${proposal.siteStreetNumber ? " " + proposal.siteStreetNumber : ""}`,
                (proposal.sitePostalCode || proposal.siteCity) && `${proposal.sitePostalCode} ${proposal.siteCity}`.trim(),
                proposal.siteProvince && `(${proposal.siteProvince.toUpperCase()})`,
            ].filter(Boolean)

            let job
            if (convertReuseJobId) {
                // Caso 1: la commessa collegata esiste ancora (soft-delete attivo) -> la ripristina e aggiorna,
                // pulendo prima cronoprogramma e conformità (l'analisi costi viene già sostituita più sotto)
                await jobsApi.restore(convertReuseJobId)
                job = await jobsApi.update(convertReuseJobId, {
                    name: proposal.title,
                    description: proposal.description,
                    siteAddress: siteAddressParts.join(", "),
                    estimatedCost: proposal.estimatedValue,
                })
                await jobTasksApi.deleteAllByJobId(convertReuseJobId)
                await jobComplianceApi.disassociateAll(convertReuseJobId)
            } else {
                // Caso 2: nessuna commessa collegata, oppure è stata eliminata definitivamente -> crea una nuova commessa
                job = await jobsApi.create({
                    clientId,
                    code: generateJobCode(client.name),
                    name: proposal.title,
                    description: proposal.description,
                    status: "active",
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: "",
                    siteAddress: siteAddressParts.join(", "),
                    siteManager: "",
                    cig: "",
                    cup: "",
                    estimatedCost: proposal.estimatedValue,
                })
            }
            await clientProposalsApi.update(proposalId, { status: "accepted", convertedJobId: job.id })

            // Se la proposta ha un cronoprogramma, calcola le date reali delle fasi a partire dalla data scelta
            if (convertHasTasks && convertStartDate) {
                const proposalTasks = await proposalTasksApi.getByProposalId(proposalId)
                let cursor = firstWorkingDay(new Date(convertStartDate + "T00:00:00"))
                for (const task of proposalTasks) {
                    const taskStart = cursor
                    const taskEnd = addWorkingDays(taskStart, task.durationDays)
                    await jobTasksApi.create({
                        jobId: job.id,
                        name: task.name,
                        startDate: taskStart.toISOString().slice(0, 10),
                        endDate: taskEnd.toISOString().slice(0, 10),
                        progress: 0,
                        status: "planned",
                        sortOrder: task.sortOrder,
                        notes: task.notes,
                    })
                    cursor = nextWorkingDay(taskEnd)
                }
            }

            // Copia in automatico nella tabella "Prezzi Materiali" della commessa l'unione dei
            // materiali di TUTTE le analisi costi della proposta (sostituendo eventuali righe
            // esistenti), senza chiedere nulla all'utente
            let costAnalysisCopied = false
            try {
                costAnalysisCopied = await costAnalysisApi.replaceFromAllProposalVersions(job.id, proposalId)
            } catch { /* non bloccante: la commessa resta creata anche se la copia fallisce */ }

            // Collega alla commessa i documenti già caricati sulla proposta (stessi record, nessuna copia)
            await proposalDocumentsApi.linkToJob(proposalId, job.id)
            await proposalSiteDocumentsApi.linkToJob(proposalId, job.id)
            await supplierOffersApi.linkToJob(proposalId, job.id)

            // Collega alla commessa le associazioni di conformità già presenti sulla
            // proposta (stesse righe, nessuna copia: restano sincronizzate tra le due pagine)
            await proposalComplianceApi.linkToJob(proposalId, job.id)

            notify.success(convertReuseJobId
                ? "Commessa esistente aggiornata!"
                : costAnalysisCopied ? "Commessa creata con analisi costi copiata!" : "Commessa creata!")
            router.push(`/jobs/${job.id}`)
        } catch { notify.error("Errore durante la conversione") }
        finally { setConverting(false) }
    }

    if (loading) return (
        <DashboardLayout>
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        </DashboardLayout>
    )

    if (!proposal) return null

    const siteAddress = [
        proposal.siteStreet && `${proposal.siteStreet} ${proposal.siteStreetNumber || ""}`.trim(),
        (proposal.sitePostalCode || proposal.siteCity) && `${proposal.sitePostalCode} ${proposal.siteCity}`.trim(),
        proposal.siteProvince && `(${proposal.siteProvince.toUpperCase()})`,
    ].filter(Boolean).join(", ")

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 rounded-lg mb-6 border dark:border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href={`/clients/${clientId}?tab=proposte`}>
                            <Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
                        </Link>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{proposal.title}</h1>
                                <Badge className={`text-xs ${STATUS_COLORS[proposal.status]}`} variant="secondary">
                                    {STATUS_LABELS[proposal.status]}
                                </Badge>
                            </div>
                            {client && <p className="text-xs text-slate-500 dark:text-slate-400">{client.name}</p>}
                        </div>
                    </div>
                    {canEdit && (
                        <div className="flex gap-2 shrink-0 flex-wrap sm:justify-end">
                            {(!proposal.convertedJobId || proposal.status === "pending" || linkedJobAlive === false) && (
                                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={async () => {
                                    setConvertStartDate("")
                                    try {
                                        const proposalTasks = await proposalTasksApi.getByProposalId(proposalId)
                                        setConvertHasTasks(proposalTasks.length > 0)
                                    } catch { setConvertHasTasks(false) }
                                    if (proposal.convertedJobId) {
                                        try {
                                            const status = await jobsApi.getStatusById(proposal.convertedJobId)
                                            setConvertReuseJobId(status.exists ? proposal.convertedJobId : null)
                                        } catch { setConvertReuseJobId(null) }
                                    } else {
                                        setConvertReuseJobId(null)
                                    }
                                    setConvertOpen(true)
                                }}>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />Converti in Commessa
                                </Button>
                            )}
                            {proposal.convertedJobId && proposal.status !== "pending" && linkedJobAlive !== false && (
                                <Link href={`/jobs/${proposal.convertedJobId}`}>
                                    <Button size="sm" variant="outline" className="text-blue-600">Vai alla Commessa</Button>
                                </Link>
                            )}
                            <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" />Modifica</Button>
                            <Button size="sm" variant="outline" className="text-red-600 hover:border-red-300" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-1" />Elimina</Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="info">
                <TabsList className="mb-6">
                    <TabsTrigger value="info"><FileText className="h-4 w-4 mr-2" />Info</TabsTrigger>
                    <TabsTrigger value="costi"><Calculator className="h-4 w-4 mr-2" />Analisi Costi</TabsTrigger>
                    <TabsTrigger value="documenti">
                        <BarChart2 className="h-4 w-4 mr-2" />Documenti Commessa
                        <HelpTip
                            title="Documenti Commessa"
                            description="Tipi disponibili per i documenti caricati in questa sezione (condivisi con le commesse)."
                            fetchItems={async () => (await proposalDocumentTypesApi.getAll()).map(t => t.name)}
                            emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Offerte per crearne uno."
                        />
                    </TabsTrigger>
                    <TabsTrigger value="documenti-cantiere">
                        <FileText className="h-4 w-4 mr-2" />Documenti Cantiere
                        <HelpTip
                            title="Documenti Cantiere"
                            description="Tipi disponibili per i documenti caricati in questa sezione (condivisi con le commesse)."
                            fetchItems={async () => (await jobSiteDocumentTypesApi.getAll()).map(t => t.name)}
                            emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Cantiere per crearne uno."
                        />
                    </TabsTrigger>
                    <TabsTrigger value="conformita"><ShieldCheck className="h-4 w-4 mr-2 text-green-600" />Conformità</TabsTrigger>
                    <TabsTrigger value="offerte-fornitori"><Truck className="h-4 w-4 mr-2" />Offerte Fornitori</TabsTrigger>
                    <TabsTrigger value="cronoprogramma"><GanttChartSquare className="h-4 w-4 mr-2" />Cronoprogramma</TabsTrigger>
                </TabsList>

                {/* ── INFO ─────────────────────────────────────────────── */}
                <TabsContent value="info">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                        {/* Colonna sinistra */}
                        <div className="space-y-4">

                            {/* Riga compatta: Stato + Valore + Data */}
                            <Card>
                                <CardContent className="py-3 px-4 space-y-3">

                                    {/* Stato */}
                                    <div className="flex items-center justify-between gap-2 min-h-[2rem]">
                                        <span className="text-xs uppercase tracking-wide text-slate-500 w-24 shrink-0">Stato</span>
                                        {inlineEdit === "status" ? (
                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                <Select value={inlineStatus} onValueChange={v => setInlineStatus(v as ProposalStatus)}>
                                                    <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.entries(STATUS_LABELS) as [ProposalStatus, string][]).filter(([k]) => k !== "accepted").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Button size="sm" className="h-7 text-xs" onClick={() => saveInline("status")} disabled={inlineSaving}>
                                                    {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salva"}
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineEdit(null)}>✕</Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Badge className={`text-xs ${STATUS_COLORS[proposal.status]}`} variant="secondary">{STATUS_LABELS[proposal.status]}</Badge>
                                                {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700" onClick={() => openInline("status")}><Pencil className="h-3 w-3" /></Button>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t dark:border-slate-700" />

                                    {/* Valore Stimato */}
                                    <div className="flex items-center justify-between gap-2 min-h-[2rem]">
                                        <span className="text-xs uppercase tracking-wide text-slate-500 w-36 shrink-0">Valore stimato proposta</span>
                                        {inlineEdit === "value" ? (
                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                <div className="relative w-36">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                                                    <Input type="number" className="pl-5 h-7 text-xs" value={inlineValue}
                                                        onChange={e => setInlineValue(e.target.value)}
                                                        onKeyDown={e => { if (e.key === "Enter") saveInline("value"); if (e.key === "Escape") setInlineEdit(null) }}
                                                        autoFocus placeholder="0.00" />
                                                </div>
                                                <Button size="sm" className="h-7 text-xs" onClick={() => saveInline("value")} disabled={inlineSaving}>
                                                    {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salva"}
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineEdit(null)}>✕</Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {proposal.estimatedValue !== null
                                                        ? `€ ${proposal.estimatedValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                                                        : <span className="text-slate-400 font-normal italic text-xs">Non impostato</span>}
                                                </span>
                                                {canEdit && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700" onClick={() => openInline("value")}><Pencil className="h-3 w-3" /></Button>}
                                            </div>
                                        )}
                                    </div>

                                    {proposal.date && <>
                                        <div className="border-t dark:border-slate-700" />
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs uppercase tracking-wide text-slate-500 w-24 shrink-0">Data</span>
                                            <span className="text-sm font-medium">{format(new Date(proposal.date), "d MMM yyyy", { locale: it })}</span>
                                        </div>
                                    </>}

                                    {siteAddress && <>
                                        <div className="border-t dark:border-slate-700" />
                                        <div>
                                            <span className="text-xs uppercase tracking-wide text-slate-500">Cantiere</span>
                                            <div className="flex items-start gap-1.5 mt-1">
                                                <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                <p className="text-xs text-slate-700 dark:text-slate-300">{siteAddress}</p>
                                            </div>
                                        </div>
                                    </>}

                                    {proposal.notes && <>
                                        <div className="border-t dark:border-slate-700" />
                                        <div>
                                            <span className="text-xs uppercase tracking-wide text-slate-500">Note</span>
                                            <p className="text-xs mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{proposal.notes}</p>
                                        </div>
                                    </>}

                                    <div className="border-t dark:border-slate-700 pt-1">
                                        <span className="text-xs text-slate-400">Creata il {format(new Date(proposal.createdAt), "d MMM yyyy", { locale: it })}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Descrizione */}
                            <Card>
                                <CardContent className="py-3 px-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs uppercase tracking-wide text-slate-500">Descrizione</span>
                                        {canEdit && inlineEdit !== "description" && (
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700" onClick={() => openInline("description")}><Pencil className="h-3 w-3" /></Button>
                                        )}
                                    </div>
                                    {inlineEdit === "description" ? (
                                        <div className="space-y-2">
                                            <textarea
                                                className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                value={inlineDesc}
                                                onChange={e => setInlineDesc(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineEdit(null)}>Annulla</Button>
                                                <Button size="sm" className="h-7 text-xs" onClick={() => saveInline("description")} disabled={inlineSaving}>
                                                    {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salva"}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap min-h-[1.25rem]">
                                            {proposal.description || <span className="text-slate-400 italic text-xs">Nessuna descrizione</span>}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Card collegamento commessa (solo se convertita e la commessa esiste ancora) */}
                            {proposal.convertedJobId && linkedJobAlive !== false && (
                                <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-green-600 mb-0.5">Convertita in commessa</p>
                                        <p className="text-xs text-slate-500">Questa proposta è stata accettata e trasformata in commessa.</p>
                                    </div>
                                    <Link href={`/jobs/${proposal.convertedJobId}`}>
                                        <Button size="sm" variant="outline" className="shrink-0 text-green-700 border-green-300">
                                            Vai alla Commessa
                                        </Button>
                                    </Link>
                                </div>
                            )}

                            {/* Card commessa eliminata: la proposta può essere riconvertita */}
                            {proposal.convertedJobId && linkedJobAlive === false && (
                                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-amber-600 mb-0.5">Commessa eliminata</p>
                                    <p className="text-xs text-slate-500">La commessa creata da questa proposta è stata eliminata. Puoi usare &quot;Converti in Commessa&quot; per riconvertirla: se la commessa è ancora nel cestino verrà ripristinata e aggiornata, altrimenti ne verrà creata una nuova.</p>
                                </div>
                            )}
                        </div>

                        {/* Colonna destra: Distanza */}
                        <div>
                            <ProposalDistanza siteAddress={siteAddress} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── ANALISI COSTI ─────────────────────────────────── */}
                <TabsContent value="costi">
                    <ProposalCostAnalysisVersions proposalId={proposalId} />
                </TabsContent>

                {/* ── DOCUMENTI ─────────────────────────────────────── */}
                <TabsContent value="documenti">
                    <ProposalDocuments proposalId={proposalId} />
                </TabsContent>

                <TabsContent value="documenti-cantiere">
                    <ProposalSiteDocuments proposalId={proposalId} />
                </TabsContent>

                {/* ── CONFORMITÀ ────────────────────────────────────── */}
                <TabsContent value="conformita">
                    <ProposalConformita proposalId={proposalId} />
                </TabsContent>

                {/* ── OFFERTE FORNITORI ────────────────────────────────── */}
                <TabsContent value="offerte-fornitori">
                    <SupplierOffers proposalId={proposalId} />
                </TabsContent>

                {/* ── CRONOPROGRAMMA ───────────────────────────────── */}
                <TabsContent value="cronoprogramma">
                    <ProposalCronoprogramma proposalId={proposalId} />
                </TabsContent>
            </Tabs>

            {/* Edit dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Modifica Proposta</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Titolo *</Label>
                            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <Label>Committente *</Label>
                            <Select value={form.clientId} onValueChange={v => setForm({ ...form, clientId: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleziona committente" /></SelectTrigger>
                                <SelectContent>
                                    {allClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {form.clientId !== clientId && (
                                <p className="text-xs text-amber-600">Cambiando il committente la proposta verrà spostata sotto il nuovo cliente.</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Stato</Label>
                                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as ProposalStatus })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(STATUS_LABELS) as [ProposalStatus, string][]).filter(([k]) => k !== "accepted").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Data</Label>
                                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Valore Stimato (€)</Label>
                            <Input type="number" value={form.estimatedValue} onChange={e => setForm({ ...form, estimatedValue: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                            <Label>Descrizione</Label>
                            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        {/* Indirizzo cantiere */}
                        <div className="space-y-3 border-t pt-3">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold">Indirizzo Cantiere</Label>
                                {client && (
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="useClientAddrEdit" checked={useClientAddr} onCheckedChange={v => setUseClientAddr(v as boolean)} />
                                        <label htmlFor="useClientAddrEdit" className="text-xs cursor-pointer text-slate-600">Usa indirizzo committente</label>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-3 space-y-1"><Label className="text-xs">Via / Piazza</Label><Input value={form.siteStreet} onChange={e => setForm({ ...form, siteStreet: e.target.value })} placeholder="Via Roma" /></div>
                                <div className="col-span-1 space-y-1"><Label className="text-xs">N. Civico</Label><Input value={form.siteStreetNumber} onChange={e => setForm({ ...form, siteStreetNumber: e.target.value })} placeholder="1" /></div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-1 space-y-1"><Label className="text-xs">CAP</Label><Input value={form.sitePostalCode} onChange={e => setForm({ ...form, sitePostalCode: e.target.value })} placeholder="00100" /></div>
                                <div className="col-span-2 space-y-1"><Label className="text-xs">Città</Label><Input value={form.siteCity} onChange={e => setForm({ ...form, siteCity: e.target.value })} placeholder="Milano" /></div>
                                <div className="col-span-1 space-y-1"><Label className="text-xs">Prov.</Label><Input value={form.siteProvince} onChange={e => setForm({ ...form, siteProvince: e.target.value.toUpperCase() })} placeholder="MI" maxLength={2} className="uppercase" /></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Note</Label>
                            <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Annulla</Button>
                        <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Convert confirm */}
            <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Converti in Commessa</DialogTitle></DialogHeader>
                    <p className="text-sm text-slate-600 dark:text-slate-400 py-2">
                        {convertReuseJobId ? (
                            <>La commessa precedentemente collegata a questa proposta esiste ancora (nel cestino): verrà <strong>ripristinata e aggiornata</strong> con i dati attuali della proposta (titolo, descrizione, indirizzo cantiere, valore stimato, cronoprogramma, analisi costi e conformità). I documenti restano collegati automaticamente.</>
                        ) : (
                            <>Verrà creata una nuova commessa a partire da questa proposta con titolo, descrizione, indirizzo cantiere e valore stimato già compilati.</>
                        )} La proposta verrà marcata come <strong>Accettata</strong>. I materiali e i parametri dell&apos;analisi costi più recente verranno copiati automaticamente nei &quot;Prezzi Materiali&quot; della commessa.
                    </p>
                    {convertHasTasks && (
                        <div className="space-y-1 py-2">
                            <label className="text-sm font-medium">Data inizio cantiere</label>
                            <p className="text-xs text-slate-500">
                                La proposta ha un cronoprogramma: le date delle fasi verranno calcolate in giorni lavorativi a partire da questa data.
                            </p>
                            <Input type="date" value={convertStartDate} onChange={e => setConvertStartDate(e.target.value)} />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConvertOpen(false)}>Annulla</Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleConvert}
                            disabled={converting || (convertHasTasks && !convertStartDate)}
                        >
                            {converting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea Commessa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Elimina proposta" description={`Eliminare la proposta "${proposal.title}"? L'azione è irreversibile.`} onConfirm={handleDelete} />
        </DashboardLayout>
    )
}
