"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GanttChartSquare, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react"
import { jobTasksApi, jobsApi, attendanceApi, JobTask, Job, Attendance } from "@/lib/api"
import { notify } from "@/lib/notify"
import { TimelineChart } from "@/components/jobs/cronoprogramma/TimelineChart"

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

const emptyForm = {
    jobId: "",
    name: "",
    startDate: "",
    endDate: "",
    progress: 0,
    status: "planned" as JobTask['status'],
    notes: "",
}

export function CronoprogrammaGlobalView() {
    const [tasks, setTasks] = useState<JobTask[]>([])
    const [jobs, setJobs] = useState<Job[]>([])
    const [attendance, setAttendance] = useState<Attendance[]>([])
    const [loading, setLoading] = useState(true)
    const [jobFilter, setJobFilter] = useState<string>("all")
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<JobTask | null>(null)
    const [form, setForm] = useState(emptyForm)

    const load = async () => {
        try {
            setLoading(true)
            const [tasksData, jobsData] = await Promise.all([
                jobTasksApi.getAll(),
                jobsApi.getAll(),
            ])
            setTasks(tasksData)
            setJobs(jobsData)

            const allDates = [
                ...jobsData.flatMap(j => [j.startDate, j.endDate]),
                ...tasksData.flatMap(t => [t.startDate, t.endDate]),
            ].filter(Boolean).sort()
            if (allDates.length > 0) {
                const attendanceData = await attendanceApi.getByRange(allDates[0], allDates[allDates.length - 1])
                setAttendance(attendanceData)
            }
        } catch (err) {
            console.error("Errore caricamento cronoprogramma globale:", err)
            notify.error("Errore nel caricamento del cronoprogramma")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const rowPresence = (task: JobTask) =>
        new Set(attendance.filter(a => a.jobId === task.jobId && a.status === 'presence').map(a => a.date))

    const presencePopupContent = (task: JobTask) => {
        const inRange = attendance.filter(a => a.jobId === task.jobId && a.date >= task.startDate && a.date <= task.endDate && a.status === 'presence')
        const totalHours = inRange.reduce((sum, a) => sum + a.hours, 0)
        const workers = new Set(inRange.map(a => a.workerId)).size
        if (inRange.length === 0) {
            return `<div class="text-xs text-slate-500">Nessuna presenza registrata nel periodo</div>`
        }
        return `<div class="text-xs"><strong>${workers}</strong> lavoratori · <strong>${totalHours}</strong> ore presenza nel periodo</div>`
    }

    const jobOptions = useMemo(() => {
        const map = new Map<string, string>()
        tasks.forEach(t => map.set(t.jobId, t.jobName || ''))
        return Array.from(map.entries())
    }, [tasks])

    const filteredTasks = useMemo(
        () => jobFilter === "all" ? tasks : tasks.filter(t => t.jobId === jobFilter),
        [tasks, jobFilter]
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
        })
        setIsFormOpen(true)
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
        try {
            if (editingTask) {
                await jobTasksApi.update(editingTask.id, form)
            } else {
                await jobTasksApi.create({ ...form, sortOrder: tasks.filter(t => t.jobId === form.jobId).length })
            }
            setIsFormOpen(false)
            await load()
        } catch (err) {
            console.error("Errore salvataggio fase:", err)
            notify.error("Errore nel salvataggio della fase")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Eliminare questa fase del cronoprogramma?")) return
        try {
            await jobTasksApi.delete(id)
            setIsFormOpen(false)
            await load()
        } catch (err) {
            console.error("Errore eliminazione fase:", err)
            notify.error("Errore nell'eliminazione della fase")
        }
    }

    const handleDateChange = async (taskId: string, start: Date, end: Date) => {
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
                <div className="flex items-center gap-2">
                    <Select value={jobFilter} onValueChange={setJobFilter}>
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="Tutte le commesse" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutte le commesse</SelectItem>
                            {jobOptions.map(([id, label]) => (
                                <SelectItem key={id} value={id}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-1" />Aggiungi fase
                    </Button>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <GanttChartSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nessuna fase pianificata.</p>
                    <p className="text-sm">Usa il pulsante &quot;Aggiungi fase&quot; per crearne una direttamente da qui.</p>
                </div>
            ) : (
                <>
                    {/* Unico diagramma di Gantt con tutte le commesse */}
                    <Card>
                        <CardContent className="py-4 space-y-4">
                            <TimelineChart
                                tasks={filteredTasks}
                                taskLabel={(t) => `${t.jobName ? t.jobName + ' · ' : ''}${t.name}`}
                                barClass={(t) => jobColorClass(t.jobId)}
                                popupContent={presencePopupContent}
                                rowPresence={rowPresence}
                                readonly={false}
                                onTaskClick={(id) => { const t = tasks.find(t => t.id === id); if (t) openEdit(t) }}
                                onDateChange={handleDateChange}
                                onProgressChange={handleProgressChange}
                            />
                            <p className="text-[11px] text-slate-400">
                                ● puntino verde sotto la barra = presenza registrata quel giorno sul cantiere
                            </p>
                        </CardContent>
                    </Card>

                    {/* Lista compatta per mobile, raggruppata per commessa */}
                    <div className="md:hidden space-y-4">
                        {Array.from(new Set(filteredTasks.map(t => t.jobId))).map(jobId => {
                            const jobTasks = filteredTasks.filter(t => t.jobId === jobId)
                            const label = jobTasks[0].jobName || ''
                            return (
                                <Card key={jobId}>
                                    <CardContent className="py-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{label}</h2>
                                            <Link href={`/jobs/${jobId}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                Apri <ExternalLink className="h-3 w-3" />
                                            </Link>
                                        </div>
                                        {jobTasks.map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => openEdit(task)}
                                                className="w-full flex items-center justify-between gap-2 border-b pb-2 last:border-none text-left"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{task.name}</p>
                                                    <p className="text-xs text-slate-500">{task.startDate} → {task.endDate} · {task.progress}%</p>
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
                                            {job.name} ({JOB_STATUS_LABEL[job.status] || job.status})
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
                    </div>
                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        {editingTask && (
                            <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(editingTask.id)}>
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
        </div>
    )
}
