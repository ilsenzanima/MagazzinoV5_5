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
import { ArrowLeft, ArrowUpRight, Menu, BarChart2, Calculator, CheckCircle2, ChevronDown, FileText, GanttChartSquare, Info, Loader2, MapPin, Pencil, ShieldCheck, Trash2, Truck, Upload } from "lucide-react"
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals"
import { clientsApi } from "@/lib/api"
import { jobsApi, jobTasksApi } from "@/lib/api"
import { proposalTasksApi } from "@/lib/services/proposal-tasks"
import { costAnalysisApi } from "@/lib/services/cost-analysis"
import { proposalDocumentsApi } from "@/lib/services/proposal-documents"
import { supplierOffersApi } from "@/lib/services/supplier-offers"
import { SupplierOffers } from "@/components/shared/SupplierOffers"
import { costAnalysisDocumentsApi } from "@/lib/services/cost-analysis-documents"
import { CostAnalysisDocuments } from "@/components/shared/CostAnalysisDocuments"
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
import { JobSectionMenu, type SectionMenuGroup } from "@/components/jobs/JobSectionMenu"
import { NotchTabs, NotchActions, NotchStat } from "@/components/ui/notch-tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

    // Pagina aperta e sotto-scheda dell'analisi costi
    const [activeTab, setActiveTab] = useState("info")
    const [costTab, setCostTab] = useState("create")

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

    const changeStatus = async (st: ProposalStatus) => {
        try {
            await clientProposalsApi.update(proposalId, { status: st })
            setProposal(await clientProposalsApi.getById(proposalId))
        } catch { notify.error("Errore durante il salvataggio") }
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
            await costAnalysisDocumentsApi.linkToJob(proposalId, job.id)

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

    // La commessa collegata esiste ancora (non è nel cestino): si può aprire; altrimenti l'offerta si può riconvertire
    const hasLinkedJob = !!proposal.convertedJobId && linkedJobAlive !== false
    const canConvert = !proposal.convertedJobId || proposal.status === "pending" || linkedJobAlive === false

    const startConvert = async () => {
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
    }

    const icon = "h-4 w-4"
    const menuGroups: SectionMenuGroup[] = [
        {
            key: "generale", label: "Generale", items: [
                { key: "info", label: "Dettagli", icon: <Info className={icon} /> },
                { key: "cronoprogramma", label: "Cronoprogramma", icon: <GanttChartSquare className={icon} /> },
                { key: "offerte-fornitori", label: "Offerte Fornitori", icon: <Truck className={icon} /> },
            ],
        },
        {
            key: "documenti", label: "Documenti", items: [
                { key: "conformita", label: "Conformità", icon: <ShieldCheck className={`${icon} text-green-600`} /> },
                {
                    key: "documenti-cantiere", label: "Documenti Cantiere", icon: <FileText className={icon} />,
                    help: {
                        title: "Documenti Cantiere",
                        description: "Tipi disponibili per i documenti caricati in questa sezione (condivisi con le commesse).",
                        fetchItems: async () => (await jobSiteDocumentTypesApi.getAll()).map(t => t.name),
                        emptyText: "Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Cantiere per crearne uno.",
                    },
                },
                {
                    key: "documenti", label: "Documenti Commessa", icon: <BarChart2 className={icon} />,
                    help: {
                        title: "Documenti Commessa",
                        description: "Tipi disponibili per i documenti caricati in questa sezione (condivisi con le commesse).",
                        fetchItems: async () => (await proposalDocumentTypesApi.getAll()).map(t => t.name),
                        emptyText: "Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Offerte per crearne uno.",
                    },
                },
            ],
        },
        {
            key: "economico", label: "Economico", items: [
                { key: "costi", label: "Analisi Costi", icon: <Calculator className={`${icon} text-emerald-600`} /> },
            ],
        },
    ]

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-[1700px] space-y-6 pb-20 overflow-x-hidden">
                {/* Intestazione con il nome dell'offerta */}
                <div className="mb-3 flex items-center justify-between gap-2">
                    <Link href={`/clients/${clientId}?tab=proposte`}>
                        <Button variant="ghost" size="sm" className="px-2 text-slate-500 hover:text-slate-900 md:px-4">
                            <ArrowLeft className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Torna al committente</span>
                        </Button>
                    </Link>
                    <div className="min-w-0 flex-1 px-2 text-center">
                        <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 md:text-lg">{proposal.title}</h1>
                        {client && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{client.name}</p>}
                    </div>
                    <span className="w-9 md:w-40" aria-hidden />
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    {/* Menu delle pagine | data di creazione | azioni */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <JobSectionMenu groups={menuGroups} activeKey={activeTab} onSelect={(_g, tab) => setActiveTab(tab)} />
                        <div className="min-w-0 flex-1 truncate text-center text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                            Creata il {format(new Date(proposal.createdAt), "d MMM yyyy", { locale: it })}
                        </div>
                        {canEdit && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 px-2 md:px-3" aria-label="Azioni dell'offerta">
                                        <Menu className="h-4 w-4" />
                                        <span className="hidden md:inline">Azioni</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-56">
                                    <DropdownMenuItem onClick={openEdit}>
                                        <Pencil className="mr-2 h-4 w-4" />Modifica
                                    </DropdownMenuItem>
                                    {canConvert && (
                                        <DropdownMenuItem onClick={startConvert} className="text-green-700 focus:text-green-700">
                                            <CheckCircle2 className="mr-2 h-4 w-4" />Converti in commessa
                                        </DropdownMenuItem>
                                    )}
                                    {hasLinkedJob && (
                                        <DropdownMenuItem asChild>
                                            <Link href={`/jobs/${proposal.convertedJobId}`}>
                                                <ArrowUpRight className="mr-2 h-4 w-4" />Vai alla commessa
                                            </Link>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />Elimina
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* ── DETTAGLI ─────────────────────────────────────────── */}
                    <TabsContent value="info" className="space-y-6 focus-visible:outline-none">
                        <NotchTabs title="Dettagli">
                            <NotchActions>
                                {hasLinkedJob && (
                                    <Link
                                        href={`/jobs/${proposal.convertedJobId}`}
                                        title="Questa offerta è stata trasformata in commessa: apri la commessa"
                                        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 text-xs font-medium normal-case tracking-normal text-emerald-200 transition-colors hover:bg-emerald-500/30"
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                        <span>Convertita in commessa</span>
                                        <ArrowUpRight className="h-3 w-3 shrink-0" />
                                    </Link>
                                )}
                                {canEdit ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button type="button" title="Cambia stato" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                                                <Badge className={`cursor-pointer gap-1 text-xs ${STATUS_COLORS[proposal.status]}`} variant="secondary">
                                                    {STATUS_LABELS[proposal.status]}<ChevronDown className="h-3 w-3" />
                                                </Badge>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(Object.entries(STATUS_LABELS) as [ProposalStatus, string][]).filter(([k]) => k !== "accepted").map(([k, v]) => (
                                                <DropdownMenuItem key={k} onClick={() => changeStatus(k)} className={proposal.status === k ? "font-semibold" : ""}>{v}</DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Badge className={`text-xs ${STATUS_COLORS[proposal.status]}`} variant="secondary">{STATUS_LABELS[proposal.status]}</Badge>
                                )}
                                {inlineEdit === "value" ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-3 pr-1 text-xs normal-case tracking-normal text-slate-300">
                                        Valore stimato
                                        <input
                                            autoFocus type="number" placeholder="0.00"
                                            className="h-7 w-28 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
                                            value={inlineValue}
                                            onChange={e => setInlineValue(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") saveInline("value"); if (e.key === "Escape") setInlineEdit(null) }}
                                        />
                                        <button type="button" onClick={() => saveInline("value")} disabled={inlineSaving} className="h-7 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">
                                            {inlineSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "OK"}
                                        </button>
                                        <button type="button" onClick={() => setInlineEdit(null)} aria-label="Annulla" className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/20">✕</button>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium normal-case tracking-normal text-slate-300">
                                        Valore stimato
                                        <b className="text-sm font-semibold text-white">
                                            {proposal.estimatedValue !== null
                                                ? `€ ${proposal.estimatedValue.toLocaleString('it-IT', { minimumFractionDigits: 2, useGrouping: true })}`
                                                : <i className="font-normal text-slate-400">non impostato</i>}
                                        </b>
                                        {canEdit && (
                                            <button type="button" title="Modifica valore" aria-label="Modifica valore" className="self-center text-slate-300 hover:text-white" onClick={() => openInline("value")}>
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                        )}
                                    </span>
                                )}
                                {proposal.date && <NotchStat label="Data" value={format(new Date(proposal.date), "d MMM yyyy", { locale: it })} />}
                            </NotchActions>

                            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                                <div className="space-y-4">
                                    {/* Descrizione */}
                                    <Card>
                                        <CardContent className="space-y-2 px-4 py-3">
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
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInlineEdit(null)}>Annulla</Button>
                                                        <Button size="sm" className="h-7 text-xs" onClick={() => saveInline("description")} disabled={inlineSaving}>
                                                            {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salva"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="min-h-[1.25rem] whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                                                    {proposal.description || <span className="text-xs italic text-slate-400">Nessuna descrizione</span>}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {proposal.notes && (
                                        <Card>
                                            <CardContent className="space-y-1 px-4 py-3">
                                                <span className="text-xs uppercase tracking-wide text-slate-500">Note</span>
                                                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{proposal.notes}</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {siteAddress && (
                                        <Card>
                                            <CardContent className="space-y-1 px-4 py-3">
                                                <span className="text-xs uppercase tracking-wide text-slate-500">Cantiere</span>
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    <p className="text-sm text-slate-700 dark:text-slate-300">{siteAddress}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {proposal.convertedJobId && linkedJobAlive === false && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                                            <p className="mb-0.5 text-xs uppercase tracking-wide text-amber-600">Commessa eliminata</p>
                                            <p className="text-xs text-slate-500">La commessa creata da questa proposta è stata eliminata. Puoi usare &quot;Converti in Commessa&quot; per riconvertirla: se la commessa è ancora nel cestino verrà ripristinata e aggiornata, altrimenti ne verrà creata una nuova.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </NotchTabs>
                    </TabsContent>

                    {/* ── CRONOPROGRAMMA ───────────────────────────────── */}
                    <TabsContent value="cronoprogramma" className="space-y-6 focus-visible:outline-none">
                        <ProposalCronoprogramma proposalId={proposalId} />
                    </TabsContent>

                    {/* ── OFFERTE FORNITORI ────────────────────────────── */}
                    <TabsContent value="offerte-fornitori" className="space-y-6 focus-visible:outline-none">
                        <NotchTabs title="Offerte fornitori">
                            <SupplierOffers proposalId={proposalId} inStrip />
                        </NotchTabs>
                    </TabsContent>

                    {/* ── DOCUMENTI ─────────────────────────────────────── */}
                    <TabsContent value="conformita" className="space-y-6 focus-visible:outline-none">
                        <ProposalConformita proposalId={proposalId} />
                    </TabsContent>
                    <TabsContent value="documenti-cantiere" className="space-y-6 focus-visible:outline-none">
                        <ProposalSiteDocuments proposalId={proposalId} />
                    </TabsContent>
                    <TabsContent value="documenti" className="space-y-6 focus-visible:outline-none">
                        <ProposalDocuments proposalId={proposalId} />
                    </TabsContent>

                    {/* ── ANALISI COSTI ─────────────────────────────────── */}
                    <TabsContent value="costi" className="space-y-6 focus-visible:outline-none">
                        <Tabs value={costTab} onValueChange={setCostTab}>
                            <NotchTabs
                                title="Analisi costi"
                                value={costTab}
                                onValueChange={setCostTab}
                                items={[
                                    { value: "create", label: "Create", icon: <Calculator /> },
                                    { value: "terzi", label: "Caricate da terzi", icon: <Upload /> },
                                ]}
                            >
                                <TabsContent value="create" className="focus-visible:outline-none">
                                    <ProposalCostAnalysisVersions proposalId={proposalId} />
                                </TabsContent>
                                <TabsContent value="terzi" className="focus-visible:outline-none">
                                    <CostAnalysisDocuments proposalId={proposalId} />
                                </TabsContent>
                            </NotchTabs>
                        </Tabs>
                    </TabsContent>
                </Tabs>
            </div>

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
