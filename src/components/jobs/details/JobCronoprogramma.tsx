"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, GanttChartSquare, Pencil, Trash2, Users } from "lucide-react"
import { jobTasksApi, attendanceApi, jobTaskAssignmentsApi, workersApi, JobTask, Attendance, JobTaskAssignment, Worker } from "@/lib/api"
import { notify } from "@/lib/notify"
import { TimelineChart } from "@/components/jobs/cronoprogramma/TimelineChart"

interface JobCronoprogrammaProps {
    jobId: string
}

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

const emptyForm = {
    name: "",
    startDate: "",
    endDate: "",
    progress: 0,
    status: "planned" as JobTask['status'],
    notes: "",
    plannedWorkers: "" as number | "",
    assignedWorkerIds: [] as string[],
}

export function JobCronoprogramma({ jobId }: JobCronoprogrammaProps) {
    const [tasks, setTasks] = useState<JobTask[]>([])
    const [attendance, setAttendance] = useState<Attendance[]>([])
    const [assignments, setAssignments] = useState<JobTaskAssignment[]>([])
    const [workers, setWorkers] = useState<Worker[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<JobTask | null>(null)
    const [form, setForm] = useState(emptyForm)

    const load = async () => {
        try {
            setLoading(true)
            const [tasksData, attendanceData, workersData] = await Promise.all([
                jobTasksApi.getByJobId(jobId),
                attendanceApi.getByJobId(jobId),
                workersApi.getAll(),
            ])
            const assignmentsData = await jobTaskAssignmentsApi.getByTaskIds(tasksData.map(t => t.id))
            setTasks(tasksData)
            setAttendance(attendanceData)
            setWorkers(workersData)
            setAssignments(assignmentsData)
        } catch (err) {
            console.error("Errore caricamento cronoprogramma:", err)
            notify.error("Errore nel caricamento del cronoprogramma")
        } finally {
            setLoading(false)
        }
    }

    const assignmentsByTask = (taskId: string) => assignments.filter(a => a.taskId === taskId)

    const presencePopupContent = (task: JobTask) => {
        const inRange = attendance.filter(a => a.date >= task.startDate && a.date <= task.endDate && (a.status === 'presence' || a.status === 'transfer'))
        const totalHours = inRange.reduce((sum, a) => sum + a.hours, 0)
        const presentWorkerIds = new Set(inRange.map(a => a.workerId))
        const planned = assignmentsByTask(task.id)

        const parts: string[] = []
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

    const workersByDate = new Map<string, Set<string>>()
    attendance.filter(a => a.status === 'presence' || a.status === 'transfer').forEach(a => {
        if (!workersByDate.has(a.date)) workersByDate.set(a.date, new Set())
        workersByDate.get(a.date)!.add(a.workerId)
    })
    const presenceCounts = new Map(Array.from(workersByDate, ([date, workers]) => [date, workers.size]))
    const rowPresence = () => presenceCounts

    useEffect(() => { load() }, [jobId])

    const openCreate = () => {
        setEditingTask(null)
        setForm(emptyForm)
        setIsFormOpen(true)
    }

    const openEdit = (task: JobTask) => {
        setEditingTask(task)
        setForm({
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
                : await jobTasksApi.create({ ...payload, jobId, sortOrder: tasks.length })
            await jobTaskAssignmentsApi.setForTask(savedTask.id, assignedWorkerIds)
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
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                <span className="ml-2 text-slate-500 text-sm">Caricamento cronoprogramma...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GanttChartSquare className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cronoprogramma</h3>
                </div>
                <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />Aggiungi fase
                </Button>
            </div>

            {/* Diagramma di Gantt - sempre visibile e ben leggibile */}
            <Card>
                <CardContent className="py-4">
                    <TimelineChart
                        tasks={tasks}
                        popupContent={presencePopupContent}
                        rowPresence={rowPresence}
                        onTaskClick={(id) => { const t = tasks.find(t => t.id === id); if (t) openEdit(t) }}
                        onDateChange={handleDateChange}
                        onProgressChange={handleProgressChange}
                    />
                    {tasks.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-2">
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white text-[8px] align-middle">n</span> sotto la barra = numero di lavoratori presenti quel giorno
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Lista fasi (fallback compatto per mobile) */}
            <div className="space-y-2">
                {tasks.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700 md:hidden">
                        <GanttChartSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>Nessuna fase pianificata.</p>
                    </div>
                ) : (
                    tasks.map(task => (
                        <Card key={task.id} className="md:hidden">
                            <CardContent className="py-3 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm truncate">{task.name}</p>
                                        <Badge className={`${STATUS_BADGE[task.status]} text-white text-[10px]`}>
                                            {STATUS_LABEL[task.status]}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {task.startDate} → {task.endDate} · {task.progress}%
                                    </p>
                                    {(task.plannedWorkers || assignmentsByTask(task.id).length > 0) && (
                                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {assignmentsByTask(task.id).length > 0
                                                ? assignmentsByTask(task.id).map(a => a.workerName).join(', ')
                                                : `${task.plannedWorkers} operai previsti`}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Dialog creazione/modifica fase */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTask ? "Modifica fase" : "Nuova fase"}</DialogTitle>
                        <DialogDescription>
                            Definisci nome, periodo e stato di avanzamento della fase di lavoro.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
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
                            <Button variant="ghost" className="text-red-600" onClick={() => { handleDelete(editingTask.id); setIsFormOpen(false) }}>
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
