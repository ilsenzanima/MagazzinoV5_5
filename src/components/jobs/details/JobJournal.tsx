"use client"


import { useState, useEffect } from "react"
import { JobLog, jobLogsApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Calendar, User, Cloud, Sun, CloudRain, Pencil, Trash2 } from "lucide-react"
import { JobWeatherWidget } from "./JobWeatherWidget"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth-provider"

interface JobJournalProps {
  jobId: string
}

export function JobJournal({ jobId }: JobJournalProps) {
  const { userRole } = useAuth()
  const [logs, setLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<JobLog | null>(null)

  // Form state
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    content: "",
    weather: "sunny",
    temp: ""
  })

  useEffect(() => {
    loadLogs()
  }, [jobId])

  const loadLogs = async () => {
    try {
      const data = await jobLogsApi.getByJobId(jobId)
      setLogs(data)
    } catch (error) {
      console.error("Failed to load logs", error)
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
          weatherInfo: {
            condition: newLog.weather,
            tempMax: newLog.temp,
            tempMin: newLog.temp
          }
        })
      } else {
        await jobLogsApi.create({
          jobId,
          date: newLog.date,
          content: newLog.content,
          weatherInfo: {
            condition: newLog.weather,
            tempMax: newLog.temp,
            tempMin: newLog.temp // using same for now
          },
          tags: []
        })
      }
      setIsDialogOpen(false)
      setNewLog({ date: new Date().toISOString().split('T')[0], content: "", weather: "sunny", temp: "" })
      setEditingLog(null)
      loadLogs()
    } catch (error) {
      console.error("Failed to save log", error)
    }
  }

  const handleDelete = async (logId: string) => {
    if (!confirm("Sicuro di voler eliminare questa annotazione?")) return;
    try {
      await jobLogsApi.delete(logId);
      loadLogs();
    } catch (error) {
      console.error("Failed to delete log", error);
    }
  }

  const openEdit = (log: JobLog) => {
    setEditingLog(log);
    setNewLog({
      date: log.date.split('T')[0],
      content: log.content,
      weather: log.weatherInfo?.condition || 'sunny',
      temp: log.weatherInfo?.tempMax || ''
    });
    setIsDialogOpen(true);
  }

  const openNew = () => {
    setEditingLog(null);
    setNewLog({ date: new Date().toISOString().split('T')[0], content: "", weather: "sunny", temp: "" });
    setIsDialogOpen(true);
  }

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return <Sun className="h-4 w-4 text-yellow-500" />
      case 'cloudy': return <Cloud className="h-4 w-4 text-slate-500" />
      case 'rainy': return <CloudRain className="h-4 w-4 text-blue-500" />
      default: return <Sun className="h-4 w-4 text-yellow-500" />
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Diario dei Lavori</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nuova Annotazione
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLog ? "Modifica Annotazione" : "Aggiungi Voce al Giornale"}</DialogTitle>
                <DialogDescription>
                  Inserisci i dettagli delle attività svolte e le condizioni meteo.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={newLog.date}
                      onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meteo</Label>
                    <div className="flex gap-2">
                      <Select
                        value={newLog.weather}
                        onValueChange={(val) => setNewLog({ ...newLog, weather: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sunny">Soleggiato</SelectItem>
                          <SelectItem value="cloudy">Nuvoloso</SelectItem>
                          <SelectItem value="rainy">Piovoso</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="°C"
                        className="w-20"
                        value={newLog.temp}
                        onChange={(e) => setNewLog({ ...newLog, temp: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Note / Descrizione Lavori</Label>
                  <Textarea
                    placeholder="Descrivi le attività svolte oggi..."
                    className="min-h-[100px]"
                    value={newLog.content}
                    onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave}>Salva Annotazione</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {logs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-slate-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessuna annotazione presente nel giornale.</p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log) => (
              <Card key={log.id}>
                <CardHeader className="pb-2 bg-slate-50/50 dark:bg-muted/30">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {new Date(log.date).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.weatherInfo && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">
                        {getWeatherIcon(log.weatherInfo.condition)}
                        <span>{log.weatherInfo.tempMax}°C</span>
                      </div>
                    )}
                    {(userRole === 'admin' || userRole === 'operativo') && (
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-blue-500" onClick={() => openEdit(log)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => handleDelete(log.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{log.content}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t dark:border-slate-700 mt-2">
                    <User className="h-3 w-3" />
                    <span>Registrato da {log.userName || 'Utente'}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="space-y-6">
        <JobWeatherWidget />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Riepilogo Attività</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-slate-500">Annotazioni totali</p>
          </CardContent>
        </Card>
      </div>
    </div >
  )
}
