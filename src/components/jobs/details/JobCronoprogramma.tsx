"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, GanttChartSquare, Pencil, Trash2 } from "lucide-react"
import { jobTasksApi, JobTask } from "@/lib/api"
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
}

export function JobCronoprogramma({ jobId }: JobCronoprogrammaProps) {
    const [tasks, setTasks] = useState<JobTask[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<JobTask | null>(null)
    const [form, setForm] = useState(emptyForm)

    const load = async () => {
        try {
            setLoading(true)
            const data = await jobTasksApi.getByJobId(jobId)
            setTasks(data)
        } catch (err) {
            console.error("Errore caricamento cronoprogramma:", err)
            notify.error("Errore nel caricamento del cronoprogramma")
        } finally {
            setLoading(false)
        }
    }

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
        })
        setIsFormOpen(true)
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
        try {
            if (editingTask) {
                await jobTasksApi.update(editingTask.id, form)
            } else {
                await jobTasksApi.create({ ...form, jobId, sortOrder: tasks.length })
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
                        onTaskClick={(id) => { const t = tasks.find(t => t.id === id); if (t) openEdit(t) }}
                        onDateChange={handleDateChange}
                        onProgressChange={handleProgressChange}
                    />
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
                                <Select value={form.status} onValueChange={(v: JobTask['status']) => setForm({ ...form, status: v })}>
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
