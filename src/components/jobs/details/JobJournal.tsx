"use client"

import { useState, useEffect } from "react"
import { JobLog, jobLogsApi } from "@/lib/api"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Calendar, User, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { notify } from "@/lib/notify"

interface JobJournalProps {
  jobId: string
}

export function JobJournal({ jobId }: JobJournalProps) {
  const { userRole } = useAuth()
  const [logs, setLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<JobLog | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [logToDelete, setLogToDelete] = useState<string | null>(null)

  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    content: "",
    isCompleted: false,
  })

  const canEdit = userRole === 'admin' || userRole === 'operativo'

  useEffect(() => {
    loadLogs()
  }, [jobId])

  const loadLogs = async () => {
    try {
      const data = await jobLogsApi.getByJobId(jobId)
      setLogs(data)
    } catch (error) {
      console.error("Failed to load logs", error)
      notify.error("Errore nel caricamento del giornale")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      if (editingLog) {
        await jobLogsApi.update(editingLog.id, {
          date: newLog.date,
          content: newLog.content,
          isCompleted: newLog.isCompleted,
        })
      } else {
        await jobLogsApi.create({
          jobId,
          date: newLog.date,
          content: newLog.content,
          isCompleted: newLog.isCompleted,
          tags: []
        })
      }
      setIsDialogOpen(false)
      setNewLog({ date: new Date().toISOString().split('T')[0], content: "", isCompleted: false })
      setEditingLog(null)
      loadLogs()
    } catch (error) {
      console.error("Failed to save log", error)
      notify.error("Errore nel salvataggio della nota")
    }
  }

  const handleDelete = async () => {
    if (!logToDelete) return
    try {
      await jobLogsApi.delete(logToDelete)
      setDeleteDialogOpen(false)
      setLogToDelete(null)
      loadLogs()
    } catch (error) {
      console.error("Failed to delete log", error)
      notify.error("Errore nell'eliminazione della nota")
    }
  }

  const handleToggleCompleted = async (log: JobLog) => {
    try {
      await jobLogsApi.update(log.id, { isCompleted: !log.isCompleted })
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, isCompleted: !l.isCompleted } : l))
    } catch (error) {
      console.error("Failed to toggle completed", error)
      notify.error("Errore nell'aggiornamento dello stato")
    }
  }

  const openEdit = (log: JobLog) => {
    setEditingLog(log)
    setNewLog({
      date: log.date.split('T')[0],
      content: log.content,
      isCompleted: log.isCompleted,
    })
    setIsDialogOpen(true)
  }

  const openNew = () => {
    setEditingLog(null)
    setNewLog({ date: new Date().toISOString().split('T')[0], content: "", isCompleted: false })
    setIsDialogOpen(true)
  }

  // Sort: incomplete first, completed last; within each group by date desc
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const incompleteLogs = sortedLogs.filter(l => !l.isCompleted)
  const completedLogs = sortedLogs.filter(l => l.isCompleted)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Diario dei Lavori</h2>
          {canEdit && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nuova Annotazione
            </Button>
          )}
        </div>

        {logs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nessuna annotazione presente nel giornale.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {incompleteLogs.map((log) => (
              <LogCard key={log.id} log={log} canEdit={canEdit} onEdit={openEdit} onDelete={(id) => { setLogToDelete(id); setDeleteDialogOpen(true); }} onToggle={handleToggleCompleted} />
            ))}

            {completedLogs.length > 0 && (
              <>
                {incompleteLogs.length > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Completate ({completedLogs.length})</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                )}
                {completedLogs.map((log) => (
                  <LogCard key={log.id} log={log} canEdit={canEdit} onEdit={openEdit} onDelete={(id) => { setLogToDelete(id); setDeleteDialogOpen(true); }} onToggle={handleToggleCompleted} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-slate-500">Annotazioni totali</p>
            {completedLogs.length > 0 && (
              <p className="text-xs text-green-600 mt-1">{completedLogs.length} completate</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLog ? "Modifica Annotazione" : "Aggiungi Voce al Giornale"}</DialogTitle>
            <DialogDescription>Inserisci i dettagli delle attività svolte.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={newLog.date}
                onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Note / Descrizione Lavori</Label>
              <Textarea
                placeholder="Descrivi le attività svolte..."
                className="min-h-[120px]"
                value={newLog.content}
                onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isCompleted"
                checked={newLog.isCompleted}
                onCheckedChange={(v) => setNewLog({ ...newLog, isCompleted: !!v })}
              />
              <label htmlFor="isCompleted" className="text-sm font-medium cursor-pointer">
                Segna come completata
              </label>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave}>Salva Annotazione</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Elimina annotazione"
        description="L'annotazione verrà eliminata definitivamente e non potrà essere recuperata."
        onConfirm={handleDelete}
      />
    </div>
  )
}

function LogCard({ log, canEdit, onEdit, onDelete, onToggle }: {
  log: JobLog
  canEdit: boolean
  onEdit: (log: JobLog) => void
  onDelete: (id: string) => void
  onToggle: (log: JobLog) => void
}) {
  return (
    <Card className={cn(log.isCompleted && "opacity-60")}>
      <CardHeader className="pb-2 bg-slate-50/50 dark:bg-muted/30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {canEdit ? (
              <button
                onClick={() => onToggle(log)}
                className="text-slate-400 hover:text-green-600 transition-colors"
                title={log.isCompleted ? "Segna come non completata" : "Segna come completata"}
              >
                {log.isCompleted
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : <Circle className="h-5 w-5" />
                }
              </button>
            ) : (
              log.isCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className={cn("font-semibold text-slate-900 dark:text-white", log.isCompleted && "line-through text-slate-400")}>
              {new Date(log.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          {canEdit && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" onClick={() => onEdit(log)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => onDelete(log.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className={cn("whitespace-pre-wrap text-slate-700 dark:text-slate-300", log.isCompleted && "line-through text-slate-400")}>
          {log.content}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t dark:border-slate-700 mt-2">
          <User className="h-3 w-3" />
          <span>Registrato da {log.userName || 'Utente'}</span>
        </div>
      </CardContent>
    </Card>
  )
}
