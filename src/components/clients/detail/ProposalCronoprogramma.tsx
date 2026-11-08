"use client"

import { useState, useEffect } from "react"
import { confirmDialog } from "@/components/ui/confirm-host";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { GanttChartSquare, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import { NotchTabs, NotchHelp, NotchActions, NotchStat } from "@/components/ui/notch-tabs"
import { FloatingAddButton } from "@/components/ui/floating-add-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
        if (!await confirmDialog("Eliminare questa fase del cronoprogramma?")) return
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
            <NotchTabs title="Cronoprogramma">
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <span className="ml-2 text-slate-500 text-sm">Caricamento cronoprogramma...</span>
                </div>
            </NotchTabs>
        )
    }

    const totalDays = tasks.reduce((sum, t) => sum + t.durationDays, 0)

    return (
        <NotchTabs title="Cronoprogramma">
            <NotchHelp
                title="Cronoprogramma preventivo"
                lines={[
                    "Definisci le fasi in giorni lavorativi previsti, senza date fisse.",
                    "Le date verranno calcolate automaticamente quando l'offerta sarà convertita in commessa.",
                    "Le frecce a sinistra cambiano l'ordine delle fasi.",
                ]}
            />
            <NotchActions>
                <NotchStat label="Fasi" value={String(tasks.length)} />
                <NotchStat label="Totale" value={`${totalDays} giorni lavorativi`} />
            </NotchActions>

            <div className="space-y-4">
                <Table className="border-collapse">
                    <TableHeader>
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className="w-24 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Ordine</TableHead>
                            <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Fase</TableHead>
                            <TableHead className="w-44 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Giorni lavorativi</TableHead>
                            <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Note</TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center text-slate-400 dark:text-slate-500">
                                    Nessuna fase pianificata. Usa il pulsante + in basso a destra per aggiungere.
                                </TableCell>
                            </TableRow>
                        ) : tasks.map((task, index) => (
                            <TableRow key={task.id} className="cursor-pointer" onClick={() => openEdit(task)}>
                                <TableCell className="border-r py-1" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center gap-0.5">
                                        <button type="button" title="Sposta su" disabled={index === 0} onClick={() => moveTask(index, -1)} className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                                        <button type="button" title="Sposta giù" disabled={index === tasks.length - 1} onClick={() => moveTask(index, 1)} className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                                    </div>
                                </TableCell>
                                <TableCell className="border-r py-2 font-medium text-slate-900 dark:text-white">
                                    <span className="flex items-center gap-2"><GanttChartSquare className="h-4 w-4 shrink-0 text-blue-600" />{task.name}</span>
                                </TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{task.durationDays}</TableCell>
                                <TableCell className="border-r py-2 text-sm text-slate-500">{task.notes || <span className="text-slate-300">—</span>}</TableCell>
                                <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-0.5">
                                        <button type="button" title="Modifica" onClick={() => openEdit(task)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="h-4 w-4" /></button>
                                        <button type="button" title="Elimina" onClick={() => handleDelete(task.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <FloatingAddButton onClick={openCreate} label="Aggiungi fase" />

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
                                value={form.durationDays || ""}
                                onChange={e => setForm({ ...form, durationDays: e.target.value === "" ? 0 : Number(e.target.value) })}
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
        </NotchTabs>
    )
}
