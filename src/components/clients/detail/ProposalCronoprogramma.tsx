"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Plus, GanttChartSquare, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { proposalTasksApi, ProposalTask } from "@/lib/services/proposal-tasks"
import { notify } from "@/lib/notify"

interface ProposalCronoprogrammaProps {
    proposalId: string
}

const emptyForm = {
    name: "",
    durationDays: 1,
    notes: "",
}

export function ProposalCronoprogramma({ proposalId }: ProposalCronoprogrammaProps) {
    const [tasks, setTasks] = useState<ProposalTask[]>([])
    const [loading, setLoading] = useState(true)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<ProposalTask | null>(null)
    const [form, setForm] = useState(emptyForm)

    const load = async () => {
        try {
            setLoading(true)
            setTasks(await proposalTasksApi.getByProposalId(proposalId))
        } catch (err) {
            console.error("Errore caricamento cronoprogramma offerta:", err)
            notify.error("Errore nel caricamento del cronoprogramma")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [proposalId])

    const openCreate = () => {
        setEditingTask(null)
        setForm(emptyForm)
        setIsFormOpen(true)
    }

    const openEdit = (task: ProposalTask) => {
        setEditingTask(task)
        setForm({ name: task.name, durationDays: task.durationDays, notes: task.notes || "" })
        setIsFormOpen(true)
    }

    const handleSave = async () => {
        if (!form.name) {
            notify.error("Inserisci il nome della fase")
            return
        }
        if (form.durationDays < 1) {
            notify.error("I giorni lavorativi previsti devono essere almeno 1")
            return
        }
        try {
            if (editingTask) {
                await proposalTasksApi.update(editingTask.id, form)
            } else {
                await proposalTasksApi.create({ ...form, proposalId, sortOrder: tasks.length })
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
            await proposalTasksApi.delete(id)
            setIsFormOpen(false)
            await load()
        } catch (err) {
            console.error("Errore eliminazione fase:", err)
            notify.error("Errore nell'eliminazione della fase")
        }
    }

    const moveTask = async (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (target < 0 || target >= tasks.length) return
        const a = tasks[index]
        const b = tasks[target]
        try {
            await Promise.all([
                proposalTasksApi.update(a.id, { sortOrder: b.sortOrder }),
                proposalTasksApi.update(b.id, { sortOrder: a.sortOrder }),
            ])
            await load()
        } catch (err) {
            console.error("Errore riordino fasi:", err)
            notify.error("Errore nel riordino delle fasi")
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

    const totalDays = tasks.reduce((sum, t) => sum + t.durationDays, 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GanttChartSquare className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cronoprogramma preventivo</h3>
                </div>
                <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />Aggiungi fase
                </Button>
            </div>

            <p className="text-xs text-slate-500">
                Definisci le fasi in giorni lavorativi previsti, senza date fisse. Le date verranno calcolate automaticamente quando l&apos;offerta sarà convertita in commessa.
            </p>

            {tasks.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <GanttChartSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Nessuna fase pianificata.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tasks.map((task, index) => (
                        <Card key={task.id}>
                            <CardContent className="py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveTask(index, -1)}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" disabled={index === tasks.length - 1} onClick={() => moveTask(index, 1)}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{task.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{task.durationDays} giorni lavorativi</p>
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
                    ))}
                    <p className="text-xs text-slate-500 text-right">Totale: {totalDays} giorni lavorativi</p>
                </div>
            )}

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTask ? "Modifica fase" : "Nuova fase"}</DialogTitle>
                        <DialogDescription>
                            Definisci nome e durata in giorni lavorativi della fase di lavoro.
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
                        <div>
                            <Label>Giorni lavorativi previsti</Label>
                            <Input
                                type="number"
                                min={1}
                                value={form.durationDays}
                                onChange={e => setForm({ ...form, durationDays: Math.max(1, Number(e.target.value)) })}
                            />
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
