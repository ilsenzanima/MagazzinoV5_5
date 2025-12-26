"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Job, jobsApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Euro, Trash2, Pencil, Building2, MapPin, User, FileText } from "lucide-react"
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

interface JobOverviewProps {
  job: Job
  totalCost: number
  onJobUpdated?: () => void
}

export function JobOverview({ job, totalCost, onJobUpdated }: JobOverviewProps) {
  const router = useRouter()
  const { userRole } = useAuth()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Job>>({})

  const mockBudget = 0 
  const percentage = mockBudget > 0 ? Math.min(100, Math.round((totalCost / mockBudget) * 100)) : 0

  const handleEditClick = () => {
    setEditForm({
      description: job.description,
      status: job.status,
      siteAddress: job.siteAddress || '',
      siteManager: job.siteManager || '',
      startDate: job.startDate,
      endDate: job.endDate,
      cig: job.cig || '',
      cup: job.cup || ''
    })
    setIsEditOpen(true)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await jobsApi.update(job.id, editForm)
      setIsEditOpen(false)
      if (onJobUpdated) {
        onJobUpdated()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to update job", error)
      alert("Errore durante l'aggiornamento della commessa")
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
      alert("Errore durante l'eliminazione della commessa")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-slate-900">{job.description}</h1>
            <Badge className={
              job.status === 'active' ? 'bg-green-600' : 
              job.status === 'completed' ? 'bg-slate-500' : 'bg-yellow-500'
            }>
              {job.status === 'active' ? 'In Lavorazione' : job.status === 'completed' ? 'Completata' : 'Sospesa'}
            </Badge>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <span className="font-mono">#{job.code}</span>
            <span>•</span>
            <span>Creata il {new Date(job.createdAt || new Date()).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Button variant="outline" size="sm" onClick={handleEditClick}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifica
            </Button>
          )}
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Elimina
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Costo Materiali
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userRole === 'user' ? (
                <div className="text-xl font-bold text-slate-400 italic">Riservato</div>
            ) : (
                <div className="text-2xl font-bold">€ {totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
            )}
            <div className="text-xs text-slate-500 mt-1">Calcolato su listino interno</div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
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
              <Label htmlFor="description">Descrizione *</Label>
              <Textarea
                id="description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select 
                  value={editForm.status} 
                  onValueChange={(value: any) => setEditForm({...editForm, status: value})}
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
                  onChange={(e) => setEditForm({...editForm, siteManager: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteAddress">Indirizzo Cantiere</Label>
              <Input
                id="siteAddress"
                value={editForm.siteAddress || ""}
                onChange={(e) => setEditForm({...editForm, siteAddress: e.target.value})}
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
                  onChange={(e) => setEditForm({...editForm, startDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fine</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate ? (typeof editForm.endDate === 'string' ? editForm.endDate.split('T')[0] : '') : ""}
                  onChange={(e) => setEditForm({...editForm, endDate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cig">CIG</Label>
                <Input
                  id="cig"
                  value={editForm.cig || ""}
                  onChange={(e) => setEditForm({...editForm, cig: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cup">CUP</Label>
                <Input
                  id="cup"
                  value={editForm.cup || ""}
                  onChange={(e) => setEditForm({...editForm, cup: e.target.value})}
                />
              </div>
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
