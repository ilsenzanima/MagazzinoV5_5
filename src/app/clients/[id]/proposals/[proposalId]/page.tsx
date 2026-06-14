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
import { ArrowLeft, BarChart2, Calculator, CheckCircle2, FileText, Loader2, MapPin, Pencil, Trash2 } from "lucide-react"
import { clientProposalsApi, ClientProposal, ProposalStatus } from "@/lib/services/client-proposals"
import { clientsApi } from "@/lib/api"
import { jobsApi } from "@/lib/api"
import { Client } from "@/lib/types"
import { notify } from "@/lib/notify"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { ProposalAnalisiCosti } from "@/components/clients/detail/ProposalAnalisiCosti"
import { ProposalDocuments } from "@/components/clients/detail/ProposalDocuments"
import { ProposalDistanza } from "@/components/clients/detail/ProposalDistanza"
import { useAuth } from "@/components/auth-provider"

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
    const [loading, setLoading] = useState(true)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [convertOpen, setConvertOpen] = useState(false)
    const [converting, setConverting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [useClientAddr, setUseClientAddr] = useState(false)

    const [form, setForm] = useState({
        title: "", description: "", estimatedValue: "", status: "draft" as ProposalStatus,
        date: "", notes: "",
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
        ]).then(([p, c]) => {
            if (!p) { router.push(`/clients/${clientId}`); return }
            setProposal(p)
            setClient(c)
        }).catch(() => router.push(`/clients/${clientId}`))
          .finally(() => setLoading(false))
    }, [proposalId, clientId])

    const openEdit = () => {
        if (!proposal) return
        setForm({
            title: proposal.title,
            description: proposal.description,
            estimatedValue: proposal.estimatedValue !== null ? String(proposal.estimatedValue) : "",
            status: proposal.status,
            date: proposal.date,
            notes: proposal.notes,
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
        try {
            setSaving(true)
            await clientProposalsApi.update(proposalId, {
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

    const handleConvert = async () => {
        if (!proposal || !client) return
        try {
            setConverting(true)
            const siteAddressParts = [
                proposal.siteStreet && `${proposal.siteStreet}${proposal.siteStreetNumber ? " " + proposal.siteStreetNumber : ""}`,
                (proposal.sitePostalCode || proposal.siteCity) && `${proposal.sitePostalCode} ${proposal.siteCity}`.trim(),
                proposal.siteProvince && `(${proposal.siteProvince.toUpperCase()})`,
            ].filter(Boolean)
            const job = await jobsApi.create({
                clientId,
                code: "",
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
            await clientProposalsApi.update(proposalId, { status: "accepted", convertedJobId: job.id })
            notify.success("Commessa creata con successo!")
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
                <div className="flex items-center justify-between gap-4">
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
                        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                            {proposal.status !== "accepted" && !proposal.convertedJobId && (
                                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => setConvertOpen(true)}>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />Converti in Commessa
                                </Button>
                            )}
                            {proposal.convertedJobId && (
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
                    <TabsTrigger value="documenti"><BarChart2 className="h-4 w-4 mr-2" />Documenti</TabsTrigger>
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
                                                        {(Object.entries(STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                        </div>

                        {/* Colonna destra: Distanza */}
                        <div>
                            <ProposalDistanza siteAddress={siteAddress} />
                        </div>
                    </div>
                </TabsContent>

                {/* ── ANALISI COSTI ─────────────────────────────────── */}
                <TabsContent value="costi">
                    <ProposalAnalisiCosti proposalId={proposalId} proposalTitle={proposal.title} />
                </TabsContent>

                {/* ── DOCUMENTI ─────────────────────────────────────── */}
                <TabsContent value="documenti">
                    <ProposalDocuments proposalId={proposalId} />
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
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Stato</Label>
                                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as ProposalStatus })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(STATUS_LABELS) as [ProposalStatus, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                        Verrà creata una nuova commessa a partire da questa proposta con titolo, descrizione, indirizzo cantiere e valore stimato già compilati. La proposta verrà marcata come <strong>Accettata</strong>.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConvertOpen(false)}>Annulla</Button>
                        <Button className="bg-green-600 hover:bg-green-700" onClick={handleConvert} disabled={converting}>
                            {converting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Crea Commessa
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Elimina proposta" description={`Eliminare la proposta "${proposal.title}"? L'azione è irreversibile.`} onConfirm={handleDelete} />
        </DashboardLayout>
    )
}
