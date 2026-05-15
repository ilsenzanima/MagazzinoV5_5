"use client"

import { notify } from "@/lib/notify";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Job, Client, jobsApi, clientsApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Trash2, Pencil, Building2, MapPin, User, FileText, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/components/auth-provider"
import { JobMap } from "./JobMap"
import { JobWeatherWidget } from "./JobWeatherWidget"

import { Checkbox } from "@/components/ui/checkbox"

interface JobOverviewProps {
  job: Job
  totalCost: number
  totalHours?: number
  onJobUpdated?: () => void
}

export function JobOverview({ job, totalCost, totalHours = 0, onJobUpdated }: JobOverviewProps) {
  const router = useRouter()
  const { userRole } = useAuth()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Job>>({})
  const [updateExistingMovements, setUpdateExistingMovements] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)

  const mockBudget = 0
  const percentage = mockBudget > 0 ? Math.min(100, Math.round((totalCost / mockBudget) * 100)) : 0

  const handleEditClick = async () => {
    setEditForm({
      name: job.name,
      description: job.description,
      status: job.status,
      siteAddress: job.siteAddress || '',
      siteManager: job.siteManager || '',
      startDate: job.startDate,
      endDate: job.endDate,
      cig: job.cig || '',
      cup: job.cup || '',
      clientId: job.clientId
    })
    setUpdateExistingMovements(false)
    setIsEditOpen(true)
    setIsLoadingClients(true)
    try {
      const data = await clientsApi.getAll()
      setClients(data)
    } catch {
      notify.error("Errore nel caricamento dei committenti")
    } finally {
      setIsLoadingClients(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await jobsApi.update(job.id, editForm, updateExistingMovements)
      setIsEditOpen(false)
      if (onJobUpdated) {
        onJobUpdated()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to update job", error)
      notify.error("Errore durante l'aggiornamento della commessa")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await jobsApi.delete(job.id)
      router.push('/jobs')
    } catch (error) {
      console.error("Failed to delete job", error)
      notify.error("Errore durante l'eliminazione della commessa")
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-2 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white truncate">{job.name}</h1>
            <Badge className={`shrink-0 text-xs ${job.status === 'active' ? 'bg-green-600' :
              job.status === 'completed' ? 'bg-slate-500' : 'bg-yellow-500'
              }`}>
              {job.status === 'active' ? 'Attiva' : job.status === 'completed' ? 'Completata' : 'Sospesa'}
            </Badge>
          </div>
          <div className="flex gap-2 shrink-0">
            {(userRole === 'admin' || userRole === 'operativo') && (
              <Button variant="outline" size="sm" onClick={handleEditClick} className="px-2 md:px-4">
                <Pencil className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Modifica</span>
              </Button>
            )}
            {userRole === 'admin' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="px-2 md:px-4"
              >
                <Trash2 className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Elimina</span>
              </Button>
            )}
          </div>
        </div>
        <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1 md:gap-2">
          <span className="font-mono">#{job.code}</span>
          <span>•</span>
          <span>Creata il {new Date(job.createdAt || new Date()).toLocaleDateString()}</span>
          {job.description && (
            <>
              <span className="hidden md:inline">•</span>
              <span className="italic hidden md:inline">{job.description}</span>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ore Lavoro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toLocaleString('it-IT')} ore</div>
            <div className="text-xs text-slate-500 mt-1">Totale tutte le presenze</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data Inizio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {job.startDate ? new Date(job.startDate).toLocaleDateString() : '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Fine: {job.endDate ? new Date(job.endDate).toLocaleDateString() : 'In corso'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Committente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate" title={job.clientName}>
              {job.clientName || '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate" title={job.clientAddress}>
              {job.clientAddress || 'Indirizzo non disponibile'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Cantiere
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium mb-1 truncate" title={job.siteAddress}>
              {job.siteAddress || 'Indirizzo cantiere mancante'}
            </div>
            {job.siteManager && (
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <User className="h-3 w-3" />
                Resp: {job.siteManager}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Additional Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informazioni Amministrative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500">Codice Commessa</Label>
                <div className="font-mono font-medium">{job.code}</div>
              </div>
              <div>
                <Label className="text-slate-500">Stato</Label>
                <div className="font-medium capitalize">{
                  job.status === 'active' ? 'In Lavorazione' :
                    job.status === 'completed' ? 'Completata' : 'Sospesa'
                }</div>
              </div>
              <div>
                <Label className="text-slate-500">CIG</Label>
                <div className="font-medium">{job.cig || '-'}</div>
              </div>
              <div>
                <Label className="text-slate-500">CUP</Label>
                <div className="font-medium">{job.cup || '-'}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Descrizione Lavori</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 whitespace-pre-wrap">{job.description}</p>
          </CardContent>
        </Card>
      </div>

      {job.siteAddress && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 min-h-[300px]">
            <JobMap address={job.siteAddress} />
          </div>
          <div>
            <JobWeatherWidget address={job.siteAddress} />
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Commessa</DialogTitle>
            <DialogDescription>
              Modifica i dettagli della commessa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="committente">Committente *</Label>
              <Select
                value={editForm.clientId || ""}
                onValueChange={(value) => setEditForm({ ...editForm, clientId: value })}
                disabled={isLoadingClients}
              >
                <SelectTrigger id="committente">
                  <SelectValue placeholder={isLoadingClients ? "Caricamento..." : "Seleziona committente"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.clientId !== job.clientId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Attenzione: cambiare il committente aggiornerà automaticamente tutte le movimentazioni e bolle associate.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Commessa *</Label>
              <Input
                id="name"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: any) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">In Lavorazione</SelectItem>
                    <SelectItem value="suspended">Sospesa</SelectItem>
                    <SelectItem value="completed">Completata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteManager">Responsabile Cantiere</Label>
                <Input
                  id="siteManager"
                  value={editForm.siteManager || ""}
                  onChange={(e) => setEditForm({ ...editForm, siteManager: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteAddress">Indirizzo Cantiere</Label>
              <Input
                id="siteAddress"
                value={editForm.siteAddress || ""}
                onChange={(e) => setEditForm({ ...editForm, siteAddress: e.target.value })}
                placeholder="Via, Città..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inizio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={editForm.startDate ? (typeof editForm.startDate === 'string' ? editForm.startDate.split('T')[0] : '') : ""}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fine</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate ? (typeof editForm.endDate === 'string' ? editForm.endDate.split('T')[0] : '') : ""}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cig">CIG</Label>
                <Input
                  id="cig"
                  value={editForm.cig || ""}
                  onChange={(e) => setEditForm({ ...editForm, cig: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cup">CUP</Label>
                <Input
                  id="cup"
                  value={editForm.cup || ""}
                  onChange={(e) => setEditForm({ ...editForm, cup: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t mt-2">
              <Checkbox
                id="updateMovements"
                checked={updateExistingMovements}
                onCheckedChange={(checked) => setUpdateExistingMovements(checked as boolean)}
              />
              <label
                htmlFor="updateMovements"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Aggiorna CIG/CUP nelle note delle bolle esistenti
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Commessa</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare la commessa <strong>{job.description}</strong>?
              <br />
              Questa azione è irreversibile e cancellerà tutti i dati associati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
