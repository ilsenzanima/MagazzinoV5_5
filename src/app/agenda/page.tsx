"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, CheckCircle2, ExternalLink, Loader2, MapPin, Pencil, Trash2 } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { NotchTabs, NotchActions, NotchHelp, NotchSearch } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/components/auth-provider"
import { confirmDialog } from "@/components/ui/confirm-host"
import { notify } from "@/lib/notify"
import { supabase } from "@/lib/supabase"
import { leaveRequestsApi } from "@/lib/api"
import { AGENDA_KINDS, AgendaInput, AgendaItem, AgendaKind, agendaApi, getAutoItems, kindInfo, todayIso } from "@/lib/services/agenda"

const headCls = "text-xs font-semibold uppercase tracking-wide text-slate-600"

const emptyForm = (): AgendaInput => ({
  title: "", kind: "appuntamento", date: todayIso(), time: null, endDate: null, location: null, notes: null,
  workerId: null, jobId: null, remindDaysBefore: 1,
})

const REMIND_OPTIONS = [
  { value: "0", label: "Il giorno stesso" },
  { value: "1", label: "1 giorno prima" },
  { value: "2", label: "2 giorni prima" },
  { value: "3", label: "3 giorni prima" },
  { value: "7", label: "1 settimana prima" },
  { value: "14", label: "2 settimane prima" },
  { value: "30", label: "1 mese prima" },
]

function dayLabel(item: AgendaItem): { text: string; cls: string } {
  const today = todayIso()
  const last = item.endDate ?? item.date
  const diff = Math.round((new Date(`${item.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000)
  if (item.done) return { text: "", cls: "" }
  if (last < today) return { text: `scaduto da ${Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86400000)} gg`, cls: "text-red-600" }
  if (item.date <= today && last >= today) return { text: "oggi", cls: "font-semibold text-emerald-600" }
  if (diff === 1) return { text: "domani", cls: "text-amber-600" }
  if (diff <= 7) return { text: `tra ${diff} gg`, cls: "text-amber-600" }
  return { text: `tra ${diff} gg`, cls: "text-slate-400" }
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })

function AgendaContent() {
  const { userRole } = useAuth()
  const canEdit = userRole === "admin" || userRole === "operativo"

  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("open")
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState("all")

  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([])
  const [jobs, setJobs] = useState<{ id: string; label: string }[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AgendaInput>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [own, auto] = await Promise.all([agendaApi.getAll(), getAutoItems(supabase).catch(() => [] as AgendaItem[])])
      setItems([...own, ...auto].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")))
    } catch (e) {
      console.error(e)
      notify.error("Errore nel caricamento dell'agenda")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (canEdit) load() }, [canEdit, load])

  useEffect(() => {
    if (!canEdit) return
    supabase.from("workers").select("id, first_name, last_name").eq("is_active", true).is("deleted_at", null).order("last_name")
      .then(({ data }) => setWorkers((data ?? []).map((w: any) => ({ id: w.id, name: `${w.last_name ?? ""} ${w.first_name ?? ""}`.trim() }))))
    supabase.from("jobs").select("id, code, name").is("deleted_at", null).eq("status", "active").order("code")
      .then(({ data }) => setJobs((data ?? []).map((j: any) => ({ id: j.id, label: `${j.code} ${j.name}` }))))
  }, [canEdit])

  const q = search.trim().toLowerCase()
  const open = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  const rows = useMemo(() => {
    const base = tab === "open" ? open : [...done].sort((a, b) => b.date.localeCompare(a.date))
    return base.filter(i =>
      (kindFilter === "all" || i.kind === kindFilter) &&
      (!q || [i.title, i.location, i.notes, i.workerName, i.jobLabel, kindInfo(i.kind).label].some(v => (v ?? "").toLowerCase().includes(q)))
    )
  }, [tab, items, q, kindFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const overdueCount = open.filter(i => (i.endDate ?? i.date) < todayIso()).length

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setDialogOpen(true) }
  const openEdit = (i: AgendaItem) => {
    setEditingId(i.id)
    setForm({ title: i.title, kind: i.kind, date: i.date, time: i.time, endDate: i.endDate, location: i.location, notes: i.notes, workerId: i.workerId, jobId: i.jobId, remindDaysBefore: i.remindDaysBefore })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) { notify.error("Scrivi un titolo"); return }
    if (!form.date) { notify.error("Scegli la data"); return }
    if (form.endDate && form.endDate < form.date) { notify.error("La data di fine è prima dell'inizio"); return }
    setSaving(true)
    try {
      if (editingId) await agendaApi.update(editingId, form)
      else await agendaApi.create(form)
      setDialogOpen(false)
      await load()
    } catch (e) {
      console.error(e)
      notify.error("Salvataggio non riuscito")
    } finally {
      setSaving(false)
    }
  }

  const toggleDone = async (i: AgendaItem) => {
    setItems(prev => prev.map(x => (x.id === i.id ? { ...x, done: !x.done } : x)))
    try { await agendaApi.setDone(i.id, !i.done) } catch { notify.error("Errore"); load() }
  }

  const remove = async (i: AgendaItem) => {
    if (!await confirmDialog(`Eliminare «${i.title}» dall'agenda?`)) return
    try { await agendaApi.remove(i.id); setItems(prev => prev.filter(x => x.id !== i.id)) } catch { notify.error("Eliminazione non riuscita") }
  }

  // Permesso/ferie importato: si elimina qui, insieme alle ore messe in automatico nelle presenze
  const removeLeave = async (i: AgendaItem) => {
    if (!await confirmDialog(`Eliminare «${i.title}»? Verranno tolte anche le ore inserite in automatico nelle presenze.`)) return
    try { await leaveRequestsApi.delete(i.id.replace(/^leave-/, "")); setItems(prev => prev.filter(x => x.id !== i.id)) } catch { notify.error("Eliminazione non riuscita") }
  }

  const set = <K extends keyof AgendaInput>(key: K, value: AgendaInput[K]) => setForm(f => ({ ...f, [key]: value }))
  const needsWorker = form.kind === "visita" || form.kind === "corso" || form.kind === "permesso"

  if (!canEdit) {
    return <div className="py-24 text-center text-slate-500"><CalendarDays className="mx-auto mb-4 h-12 w-12 opacity-20" />L'agenda è riservata ad admin e operativi.</div>
  }

  return (
    <div className="space-y-4">
      <NotchTabs
        title="Agenda"
        tabWidth={170}
        items={[
          { value: "open", label: open.length > 0 ? `Da fare (${open.length})` : "Da fare", icon: <CalendarDays />, dot: overdueCount > 0 },
          { value: "done", label: done.length > 0 ? `Fatti (${done.length})` : "Fatti", icon: <CheckCircle2 /> },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        <NotchHelp wide title="Agenda" lines={["Appuntamenti, scadenze, consegne di materiale, visite mediche, corsi, ferie e permessi segnati in anticipo. Ogni voce ti ricorda con un avviso nella campanella e nel «Da fare» della dashboard, a partire dai giorni che scegli. Spunta la voce quando è fatta."]} />
        <NotchActions>
          <NotchSearch value={search} onChange={setSearch} placeholder="Cerca titolo, luogo, operaio, commessa..." />
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-9 w-[180px] rounded-full border-slate-300 bg-white text-slate-800"><SelectValue placeholder="Tutti i tipi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {AGENDA_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </NotchActions>
      </NotchTabs>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
              <TableHead className="w-10" />
              <TableHead className={`w-52 ${headCls}`}>Quando</TableHead>
              <TableHead className={`hidden w-40 md:table-cell ${headCls}`}>Tipo</TableHead>
              <TableHead className={headCls}>Titolo</TableHead>
              <TableHead className={`hidden w-56 lg:table-cell ${headCls}`}>Luogo</TableHead>
              <TableHead className={`hidden w-56 lg:table-cell ${headCls}`}>Collegato a</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-14 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-slate-400">
                  <CalendarDays className="mx-auto mb-2 h-10 w-10 opacity-20" />
                  {tab === "open" ? "Niente in programma: aggiungi un appuntamento con il pulsante in basso" : "Ancora nessuna voce completata"}
                </TableCell>
              </TableRow>
            ) : rows.map(i => {
              const label = dayLabel(i)
              const info = kindInfo(i.kind)
              return (
                <TableRow key={i.id} className={i.done ? "opacity-60" : undefined}>
                  <TableCell className="py-2">{!i.auto && <Checkbox checked={i.done} onCheckedChange={() => toggleDone(i)} className="h-5 w-5" aria-label="Fatto" />}</TableCell>
                  <TableCell className="py-2">
                    <div className="text-sm font-medium capitalize">{fmtDate(i.date)}{i.endDate ? ` → ${fmtDate(i.endDate)}` : ""}</div>
                    <div className="text-xs text-slate-500">{i.time ? `ore ${i.time}` : "tutto il giorno"} {label.text && <span className={label.cls}>· {label.text}</span>}</div>
                  </TableCell>
                  <TableCell className="hidden py-2 md:table-cell">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${info.badge}`}>{info.label}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="truncate text-sm font-medium">{i.title}</div>
                    {i.notes && <div className="truncate text-xs text-slate-500">{i.notes}</div>}
                    {i.auto && <div className="text-xs text-slate-400">Importato in automatico</div>}
                  </TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 lg:table-cell">
                    {i.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{i.location}</span>}
                  </TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 lg:table-cell">{[i.workerName, i.jobLabel].filter(Boolean).join(" · ")}</TableCell>
                  <TableCell className="py-2">
                    <div className="flex justify-end gap-1">
                      {i.auto ? (
                        <>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Apri"><Link href={i.href ?? "/agenda"}><ExternalLink className="h-4 w-4" /></Link></Button>
                          {i.auto === "leave" && userRole === "admin" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => removeLeave(i)} title="Elimina il permesso"><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)} title="Modifica"><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => remove(i)} title="Elimina"><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <FloatingAddButton onClick={openCreate} label="Nuova voce" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Modifica voce" : "Nuova voce in agenda"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={v => set("kind", v as AgendaKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AGENDA_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Titolo</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="es. Consegna ponteggio, Visita medica Rossi..." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Data</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>Ora (facoltativa)</Label><Input type="time" value={form.time ?? ""} onChange={e => set("time", e.target.value || null)} /></div>
            </div>
            <div className="grid gap-1.5">
              <Label>Fino al (per ferie, corsi di più giorni...)</Label>
              <Input type="date" value={form.endDate ?? ""} min={form.date} onChange={e => set("endDate", e.target.value || null)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Luogo</Label>
              <Input value={form.location ?? ""} onChange={e => set("location", e.target.value || null)} placeholder={form.kind === "consegna" ? "Dove arriva il materiale" : "Dove"} />
            </div>
            {(needsWorker || form.workerId) && (
              <div className="grid gap-1.5">
                <Label>Operaio</Label>
                <Select value={form.workerId ?? "none"} onValueChange={v => set("workerId", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Commessa (facoltativa)</Label>
              <Select value={form.jobId ?? "none"} onValueChange={v => set("jobId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Avvisami</Label>
              <Select value={String(form.remindDaysBefore)} onValueChange={v => set("remindDaysBefore", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REMIND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Note</Label>
              <Textarea rows={3} value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AgendaPage() {
  return (
    <DashboardLayout>
      <AgendaContent />
    </DashboardLayout>
  )
}
