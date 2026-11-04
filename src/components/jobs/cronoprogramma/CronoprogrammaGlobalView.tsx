"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GanttChartSquare, ExternalLink, Loader2, Plus, Trash2, Users } from "lucide-react"
import { jobTasksApi, jobsApi, attendanceApi, jobTaskAssignmentsApi, workersApi, JobTask, Job, Attendance, JobTaskAssignment, Worker } from "@/lib/api"
import { notify } from "@/lib/notify"
import { TimelineChart } from "@/components/jobs/cronoprogramma/TimelineChart"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { buildJobLinks } from "@/lib/utils/job-links"
import type { JobChainItem } from "@/lib/types"

const STATUS_LABEL: Record<JobTask['status'], string> = {
    planned: "Pianificata",
    in_progress: "In corso",
    completed: "Completata",
    delayed: "In ritardo",
}

const STATUS_BADGE: Record<JobTask['status'], string> = {
    planned: "bg-slate-500",
    in_progress: "bg-blue-600",
    completed: "bg-green-600",
    delayed: "bg-amber-500",
}

const JOB_STATUS_LABEL: Record<string, string> = {
    active: "Attiva",
    suspended: "Sospesa",
    completed: "Completata",
}

const JOB_COLOR_COUNT = 8

function jobColorClass(jobId: string): string {
    let hash = 0
    for (let i = 0; i < jobId.length; i++) {
        hash = (hash * 31 + jobId.charCodeAt(i)) >>> 0
    }
    return `job-color-${hash % JOB_COLOR_COUNT}`
}

type StatusFilter = "onsite" | "active" | "all" | "suspended" | "completed"

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
    onsite: "In cantiere",
    active: "Attive",
    all: "Tutte",
    suspended: "Sospese",
    completed: "Completate",
}

// Stato della commessa -> colore della barra di riepilogo (blu in corso, verde conclusa, arancio sospesa)
const JOB_TO_TASK_STATUS: Record<string, JobTask['status']> = {
    active: "in_progress",
    completed: "completed",
    suspended: "delayed",
}

const SUMMARY_PREFIX = "job-" // niente ":" negli id: frappe-gantt li usa nei selettori CSS
const isSummaryId = (id: string) => id.startsWith(SUMMARY_PREFIX)

const matchesStatus = (job: Job, filter: StatusFilter) =>
    filter === "all" ? true : filter === "onsite" ? job.status === "active" && !!job.onSite : job.status === filter

const localToday = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyForm = {
    jobId: "",
    name: "",
    startDate: "",
    endDate: "",
    progress: 0,
    status: "planned" as JobTask['status'],
    notes: "",
    plannedWorkers: "" as number | "",
    assignedWorkerIds: [] as string[],
}

export function CronoprogrammaGlobalView() {
    const router = useRouter()
    const [tasks, setTasks] = useState<JobTask[]>([])
    const [jobs, setJobs] = useState<Job[]>([])
    const [attendance, setAttendance] = useState<Attendance[]>([])
    const [assignments, setAssignments] = useState<JobTaskAssignment[]>([])
    const [workers, setWorkers] = useState<Worker[]>([])
    const [links, setLinks] = useState<Map<string, JobChainItem[]>>(new Map())
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("onsite")
    const [jobFilter, setJobFilter] = useState<string>("all")
    const [showPhases, setShowPhases] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<JobTask | null>(null)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const [form, setForm] = useState(emptyForm)

    const load = async () => {
        try {
            setLoading(true)
            const [tasksData, jobsData, workersData, linkRows] = await Promise.all([
                jobTasksApi.getAll(),
                jobsApi.getAll(),
                workersApi.getAll(),
                jobsApi.getLinkRows().catch(() => [] as JobChainItem[]),
            ])
            setTasks(tasksData)
            setJobs(jobsData)
            setWorkers(workersData)
            setLinks(buildJobLinks(linkRows))

            const assignmentsData = await jobTaskAssignmentsApi.getByTaskIds(tasksData.map(t => t.id))
            setAssignments(assignmentsData)
        } catch (err) {
            console.error("Errore caricamento cronoprogramma globale:", err)
            notify.error("Errore nel caricamento del cronoprogramma")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const assignmentsByTask = (taskId: string) => assignments.filter(a => a.taskId === taskId)

    const tasksByJob = useMemo(() => {
        const map = new Map<string, JobTask[]>()
        tasks.forEach(t => map.set(t.jobId, [...(map.get(t.jobId) ?? []), t]))
        map.forEach(list => list.sort((x, y) => x.startDate.localeCompare(y.startDate)))
        return map
    }, [tasks])

    // Commesse da mostrare: filtro per stato e per commessa; quelle dello stesso cantiere restano vicine
    const visibleJobs = useMemo(() => {
        const startOf = (j: Job) => (j.startDate || tasksByJob.get(j.id)?.[0]?.startDate || "").slice(0, 10)
        const groupKey = (j: Job) => {
            const members = [j, ...(links.get(j.id) ?? []).map(l => jobs.find(x => x.id === l.id)).filter((x): x is Job => !!x)]
            const first = members.map(startOf).filter(Boolean).sort()[0] ?? ""
            const root = members.map(m => m.id).sort()[0]
            return `${first}|${members.length > 1 ? root : j.id}`
        }
        return jobs
            .filter(j => matchesStatus(j, statusFilter) && (jobFilter === "all" || j.id === jobFilter))
            .filter(j => startOf(j))
            .sort((x, y) => groupKey(x).localeCompare(groupKey(y)) || startOf(x).localeCompare(startOf(y)))
    }, [jobs, links, tasksByJob, statusFilter, jobFilter])

    const lastPresenceByJob = useMemo(() => {
        const map = new Map<string, string>()
        attendance.forEach(a => {
            if (!a.jobId || (a.status !== 'presence' && a.status !== 'transfer')) return
            const known = map.get(a.jobId)
            if (!known || a.date > known) map.set(a.jobId, a.date)
        })
        return map
    }, [attendance])

    // Riga di riepilogo con il periodo reale della commessa. Senza data di fine: se è in cantiere arriva a oggi,
    // altrimenti si ferma all'ultima presenza registrata (una commessa attiva ma ferma non si allunga all'infinito)
    const summaryRow = (job: Job): JobTask => {
        const jobTasks = tasksByJob.get(job.id) ?? []
        const start = (job.startDate || jobTasks[0]?.startDate || "").slice(0, 10)
        const lastTaskEnd = jobTasks.map(t => t.endDate).sort().slice(-1)[0]
        const lastPresence = lastPresenceByJob.get(job.id)
        const idleEnd = lastPresence && lastPresence >= start ? lastPresence : (lastTaskEnd || start)
        let end = (job.endDate || "").slice(0, 10) || (job.status === "active" && job.onSite ? localToday() : idleEnd)
        if (end < start) end = start
        return {
            id: SUMMARY_PREFIX + job.id,
            jobId: job.id,
            jobCode: job.code,
            jobName: job.name,
            jobStatus: job.status,
            name: `${job.code} · ${job.name}`,
            startDate: start,
            endDate: end,
            progress: 0,
            status: JOB_TO_TASK_STATUS[job.status] ?? "planned",
            sortOrder: 0,
            createdAt: "",
        }
    }

    // Righe del diagramma: per ogni commessa il riepilogo e, sotto, le sue fasi
    const rows = useMemo(
        () => visibleJobs.flatMap(job => [summaryRow(job), ...(showPhases ? (tasksByJob.get(job.id) ?? []) : [])]),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [visibleJobs, tasksByJob, showPhases, lastPresenceByJob]
    )

    // Presenze: si leggono solo per il periodo che si sta guardando
    const rangeFrom = visibleJobs.map(j => (j.startDate || tasksByJob.get(j.id)?.[0]?.startDate || "").slice(0, 10)).filter(Boolean).sort()[0]
    const rangeTo = rangeFrom ? [localToday(), ...visibleJobs.map(j => (j.endDate || "").slice(0, 10))].sort().slice(-1)[0] : undefined
    useEffect(() => {
        if (!rangeFrom || !rangeTo) { setAttendance([]); return }
        let cancelled = false
        attendanceApi.getByRange(rangeFrom, rangeTo)
            .then(data => { if (!cancelled) setAttendance(data) })
            .catch(err => console.error("Errore caricamento presenze:", err))
        return () => { cancelled = true }
    }, [rangeFrom, rangeTo])

    // Presenze del cantiere giorno per giorno. Sotto la riga di riepilogo solo se la commessa non ha fasi:
    // è il modo di vedere dove si è lavorato anche senza un cronoprogramma inserito
    const rowPresence = (task: JobTask) => {
        if (isSummaryId(task.id) && showPhases && (tasksByJob.get(task.jobId)?.length ?? 0) > 0) return new Map<string, number>()
        const workersByDate = new Map<string, Set<string>>()
        attendance.filter(a => a.jobId === task.jobId && (a.status === 'presence' || a.status === 'transfer')).forEach(a => {
            if (!workersByDate.has(a.date)) workersByDate.set(a.date, new Set())
            workersByDate.get(a.date)!.add(a.workerId)
        })
        return new Map(Array.from(workersByDate, ([date, workers]) => [date, workers.size]))
    }

    const presencePopupContent = (task: JobTask) => {
        const inRange = attendance.filter(a => a.jobId === task.jobId && a.date >= task.startDate && a.date <= task.endDate && (a.status === 'presence' || a.status === 'transfer'))
        const totalHours = inRange.reduce((sum, a) => sum + a.hours, 0)
        const presentWorkerIds = new Set(inRange.map(a => a.workerId))
        const planned = assignmentsByTask(task.id)

        const parts: string[] = []
        if (isSummaryId(task.id)) {
            parts.push(`<div class="text-xs mb-1"><strong>${task.startDate}</strong> → <strong>${task.endDate}</strong></div>`)
        }
        if (planned.length > 0) {
            const rows = planned.map(p => {
                const showedUp = presentWorkerIds.has(p.workerId)
                return `<div class="flex items-center gap-1">${showedUp ? '✅' : '⬜'} ${p.workerName || 'Operaio'}</div>`
            }).join('')
            parts.push(`<div class="text-xs mb-1"><strong>Pianificati (${planned.length}):</strong>${rows}</div>`)
        } else if (task.plannedWorkers) {
            parts.push(`<div class="text-xs mb-1"><strong>${task.plannedWorkers}</strong> operai previsti (nomi non ancora assegnati)</div>`)
        }

        if (inRange.length === 0) {
            parts.push(`<div class="text-xs text-slate-500">Nessuna presenza registrata nel periodo</div>`)
        } else {
            parts.push(`<div class="text-xs"><strong>${presentWorkerIds.size}</strong> lavoratori · <strong>${totalHours}</strong> ore presenza effettiva nel periodo</div>`)
        }
        return parts.join('')
    }

    const jobOptions = useMemo(
        () => [
            { value: "all", label: "Tutte le commesse" },
            ...jobs
                .filter(j => matchesStatus(j, statusFilter))
                .map(j => ({ value: j.id, label: `${j.code} · ${j.name}`, description: j.clientName || undefined })),
        ],
        [jobs, statusFilter]
    )

    const openCreate = () => {
        setEditingTask(null)
        setForm({ ...emptyForm, jobId: jobFilter !== "all" ? jobFilter : "" })
        setIsFormOpen(true)
    }

    const openEdit = (task: JobTask) => {
        setEditingTask(task)
        setForm({
            jobId: task.jobId,
            name: task.name,
            startDate: task.startDate,
            endDate: task.endDate,
            progress: task.progress,
            status: task.status,
            notes: task.notes || "",
            plannedWorkers: task.plannedWorkers ?? "",
            assignedWorkerIds: assignmentsByTask(task.id).map(a => a.workerId),
        })
        setIsFormOpen(true)
    }

    // Clic su una barra: la fase si modifica qui, la riga della commessa apre la sua scheda
    const handleTaskClick = (id: string) => {
        if (isSummaryId(id)) { router.push(`/jobs/${id.slice(SUMMARY_PREFIX.length)}`); return }
        const t = tasks.find(t => t.id === id)
        if (t) openEdit(t)
    }

    const toggleAssignedWorker = (workerId: string) => {
        setForm(f => {
            const isSelected = f.assignedWorkerIds.includes(workerId)
            const assignedWorkerIds = isSelected
                ? f.assignedWorkerIds.filter(id => id !== workerId)
                : [...f.assignedWorkerIds, workerId]
            return { ...f, assignedWorkerIds }
        })
    }

    const handleSave = async () => {
        if (!form.jobId) {
            notify.error("Seleziona la commessa")
            return
        }
        if (!form.name || !form.startDate || !form.endDate) {
            notify.error("Compila nome, data inizio e data fine")
            return
        }
        if (form.endDate < form.startDate) {
            notify.error("La data fine non può precedere la data inizio")
            return
        }
        const plannedWorkers = form.assignedWorkerIds.length > 0
            ? form.assignedWorkerIds.length
            : (form.plannedWorkers === "" ? null : Number(form.plannedWorkers))
        const { assignedWorkerIds, ...taskFields } = form
        const payload = { ...taskFields, plannedWorkers }
        try {
            const savedTask = editingTask
                ? await jobTasksApi.update(editingTask.id, payload)
                : await jobTasksApi.create({ ...payload, sortOrder: tasks.filter(t => t.jobId === form.jobId).length })
            await jobTaskAssignmentsApi.setForTask(savedTask.id, assignedWorkerIds)
            setIsFormOpen(false)
            await load()
        } catch (err) {
            console.error("Errore salvataggio fase:", err)
            notify.error("Errore nel salvataggio della fase")
        }
    }

    const handleDelete = async () => {
        if (!taskToDelete) return
        try {
            await jobTasksApi.delete(taskToDelete)
            setTaskToDelete(null)
            setIsFormOpen(false)
            await load()
        } catch (err) {
            console.error("Errore eliminazione fase:", err)
            notify.error("Errore nell'eliminazione della fase")
        }
    }

    // La riga di riepilogo è il periodo della commessa: non si sposta da qui, la barra torna dov'era
    const redraw = () => setTasks(prev => [...prev])

    const handleDateChange = async (taskId: string, start: Date, end: Date) => {
        if (isSummaryId(taskId)) { redraw(); return }
        try {
            await jobTasksApi.update(taskId, {
                startDate: start.toISOString().slice(0, 10),
                endDate: end.toISOString().slice(0, 10),
            })
            await load()
        } catch (err) {
            console.error("Errore aggiornamento date:", err)
            notify.error("Errore nell'aggiornamento delle date")
        }
    }

    const handleProgressChange = async (taskId: string, progress: number) => {
        if (isSummaryId(taskId)) { redraw(); return }
        try {
            await jobTasksApi.update(taskId, { progress })
            await load()
        } catch (err) {
            console.error("Errore aggiornamento avanzamento:", err)
            notify.error("Errore nell'aggiornamento dell'avanzamento")
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Caricamento cronoprogramma...</span>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <GanttChartSquare className="h-6 w-6 text-blue-600" />
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cronoprogramma Commesse</h1>
                </div>
                <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />Aggiungi fase
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setJobFilter("all") }}>
                    <SelectTrigger className="w-40" aria-label="Stato commesse"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map(k => (
                            <SelectItem key={k} value={k}>{STATUS_FILTER_LABEL[k]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="w-72 max-w-full">
                    <SearchableSelect
                        options={jobOptions}
                        value={jobFilter}
                        onValueChange={(v) => setJobFilter(v || "all")}
                        placeholder="Tutte le commesse"
                        searchPlaceholder="Cerca per codice, nome o committente..."
                        emptyMessage="Nessuna commessa trovata."
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <Checkbox checked={showPhases} onCheckedChange={(v) => setShowPhases(v === true)} />
                    Mostra le fasi
                </label>
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <GanttChartSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nessuna commessa da mostrare con questi filtri.</p>
                    <p className="text-sm">Cambia lo stato o scegli &quot;Tutte le commesse&quot;.</p>
                </div>
            ) : (
                <>
                    {/* Un unico diagramma: per ogni commessa il suo periodo reale e, sotto, le fasi */}
                    <Card>
                        <CardContent className="py-4 space-y-4">
                            <TimelineChart
                                tasks={rows}
                                taskLabel={(t) => isSummaryId(t.id) ? t.name : `↳ ${t.name}`}
                                isSummary={(t) => isSummaryId(t.id)}
                                barClass={(t) => jobColorClass(t.jobId)}
                                popupContent={presencePopupContent}
                                rowPresence={rowPresence}
                                readonly={false}
                                onTaskClick={handleTaskClick}
                                onDateChange={handleDateChange}
                                onProgressChange={handleProgressChange}
                            />
                            <div className="space-y-1 text-[11px] text-slate-400">
                                <p>
                                    Barra scura = periodo della commessa (dall&apos;inizio alla fine; senza data di fine arriva a oggi se è in cantiere, altrimenti all&apos;ultima presenza). Clic sulla barra per aprire la commessa. Per spostarti trascina lo sfondo del diagramma o usa le frecce.
                                </p>
                                <p>
                                    <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white text-[8px] align-middle">n</span> sotto la barra = numero di lavoratori presenti quel giorno sul cantiere. Per le commesse senza fasi i puntini sono sotto la barra del periodo.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Lista compatta per mobile, raggruppata per commessa */}
                    <div className="md:hidden space-y-4">
                        {visibleJobs.map(job => {
                            const jobTasks = tasksByJob.get(job.id) ?? []
                            const summary = summaryRow(job)
                            return (
                                <Card key={job.id}>
                                    <CardContent className="py-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{job.code} · {job.name}</h2>
                                                <p className="text-xs text-slate-500">{summary.startDate} → {summary.endDate}</p>
                                            </div>
                                            <Link href={`/jobs/${job.id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0">
                                                Apri <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </div>
                                        {showPhases && jobTasks.map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => openEdit(task)}
                                                className="w-full flex items-center justify-between gap-2 border-b pb-2 last:border-none text-left"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{task.name}</p>
                                                    <p className="text-xs text-slate-500">{task.startDate} → {task.endDate} · {task.progress}%</p>
                                                    {(task.plannedWorkers || assignmentsByTask(task.id).length > 0) && (
                                                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                            <Users className="h-3 w-3" />
                                                            {assignmentsByTask(task.id).length > 0
                                                                ? assignmentsByTask(task.id).map(a => a.workerName).join(', ')
                                                                : `${task.plannedWorkers} operai previsti`}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge className={`${STATUS_BADGE[task.status]} text-white text-[10px] shrink-0`}>
                                                    {STATUS_LABEL[task.status]}
                                                </Badge>
                                            </button>
                                        ))}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Dialog creazione/modifica fase, senza dover passare dalla commessa */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTask ? "Modifica fase" : "Nuova fase"}</DialogTitle>
                        <DialogDescription>
                            {editingTask
                                ? "Modifica periodo, stato e avanzamento della fase."
                                : "Seleziona la commessa e definisci la fase di lavoro."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Commessa</Label>
                            <Select
                                value={form.jobId}
                                onValueChange={v => setForm({ ...form, jobId: v })}
                                disabled={!!editingTask}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona una commessa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {jobs.filter(job => job.status !== 'completed').map(job => (
                                        <SelectItem key={job.id} value={job.id}>
                                            {job.code} · {job.name} ({JOB_STATUS_LABEL[job.status] || job.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Nome fase</Label>
                            <Input
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Es. Scavo, Fondazioni, Strutture..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Data inizio</Label>
                                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                            </div>
                            <div>
                                <Label>Data fine</Label>
                                <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Stato</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(v: JobTask['status']) => setForm({ ...form, status: v, progress: v === 'in_progress' ? form.progress : 0 })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.status === 'in_progress' && (
                                <div>
                                    <Label>Avanzamento (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form.progress}
                                        onChange={e => setForm({ ...form, progress: Math.min(100, Math.max(0, Number(e.target.value))) })}
                                    />
                                </div>
                            )}
                        </div>
                        <div>
                            <Label>Note</Label>
                            <Textarea
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                placeholder="Note opzionali sulla fase"
                            />
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1"><Users className="h-4 w-4" />Operai da mandare</Label>
                                {form.assignedWorkerIds.length === 0 && (
                                    <Input
                                        type="number"
                                        min={0}
                                        className="w-24 h-8"
                                        placeholder="Numero"
                                        value={form.plannedWorkers}
                                        onChange={e => setForm({ ...form, plannedWorkers: e.target.value === "" ? "" : Number(e.target.value) })}
                                    />
                                )}
                            </div>
                            {form.assignedWorkerIds.length === 0 ? (
                                <p className="text-xs text-slate-400">
                                    Indica solo il numero previsto, oppure seleziona i nominativi qui sotto.
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500">
                                    {form.assignedWorkerIds.length} operai selezionati
                                </p>
                            )}
                            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                                {workers.filter(w => w.isActive).map(worker => (
                                    <label key={worker.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                        <Checkbox
                                            checked={form.assignedWorkerIds.includes(worker.id)}
                                            onCheckedChange={() => toggleAssignedWorker(worker.id)}
                                        />
                                        {worker.firstName} {worker.lastName}
                                    </label>
                                ))}
                                {workers.filter(w => w.isActive).length === 0 && (
                                    <p className="text-xs text-slate-400 py-1">Nessun operaio attivo disponibile</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        {editingTask && (
                            <Button variant="ghost" className="text-red-600" onClick={() => setTaskToDelete(editingTask.id)}>
                                <Trash2 className="h-4 w-4 mr-1" />Elimina
                            </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Annulla</Button>
                            <Button onClick={handleSave}>Salva</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={!!taskToDelete}
                onOpenChange={(o) => { if (!o) setTaskToDelete(null) }}
                title="Elimina fase"
                description="Eliminare questa fase del cronoprogramma?"
                onConfirm={handleDelete}
            />
        </div>
    )
}
