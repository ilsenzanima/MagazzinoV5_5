"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Job, jobsApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Euro, Trash2, Pencil, Building2, MapPin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface JobOverviewProps {
  job: Job
  totalCost: number
}

export function JobOverview({ job, totalCost }: JobOverviewProps) {
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Mock budget (since we don't track it yet)
  const mockBudget = 0 
  const percentage = mockBudget > 0 ? Math.min(100, Math.round((totalCost / mockBudget) * 100)) : 0

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
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Modifica
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Elimina
          </Button>
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
            <div className="text-2xl font-bold">€ {totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500 mt-1">Calcolato su listino interno</div>
            {/* Progress bar mock */}
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
               <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }} />
            </div>
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
              {job.startDate ? new Date(job.startDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Avviata da {job.startDate ? Math.floor((new Date().getTime() - new Date(job.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0} mesi
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
               <Calendar className="h-4 w-4" />
               Consegna Prevista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {job.endDate ? new Date(job.endDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Indefinita'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {job.endDate ? 'Data confermata' : 'Data da definire'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
           <Card>
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2">
                 <Building2 className="h-5 w-5 text-blue-600" />
                 Descrizione & Note
               </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <p className="text-slate-600 leading-relaxed">
                 {job.description}
               </p>
               
               <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                 <div className="flex">
                   <div className="ml-3">
                     <p className="text-sm text-yellow-700">
                       <span className="font-bold">Nota Importante:</span>
                       {' '}Verificare sempre la disponibilità dei materiali prima di pianificare il ritiro.
                     </p>
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                 <div>
                   <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CIG</span>
                   <p className="font-mono text-slate-900">{job.cig || '-'}</p>
                 </div>
                 <div>
                   <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CUP</span>
                   <p className="font-mono text-slate-900">{job.cup || '-'}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
               <div className="flex items-center gap-4 mb-6">
                 <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                    {job.clientName?.charAt(0).toUpperCase()}
                 </div>
                 <div>
                   <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cliente</div>
                   <div className="font-bold text-slate-900">{job.clientName}</div>
                 </div>
               </div>
               
               <div className="space-y-3 pt-4 border-t">
                 <div className="flex items-start gap-3">
                   <MapPin className="h-4 w-4 text-slate-400 mt-1" />
                   <div>
                     <div className="text-xs text-slate-500">Indirizzo Cantiere</div>
                     <div className="text-sm font-medium">{job.siteAddress || 'N/D'}</div>
                     <a 
                       href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.siteAddress || '')}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="text-xs text-blue-600 hover:underline block mt-1"
                     >
                       Visualizza Mappa
                     </a>
                   </div>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
