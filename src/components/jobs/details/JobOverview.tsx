"use client"

import { Job } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, Calendar, MapPin, User, Pencil, Archive, Euro, TrendingUp } from "lucide-react"
import Link from "next/link"

interface JobOverviewProps {
  job: Job
  totalCost: number
}

export function JobOverview({ job, totalCost }: JobOverviewProps) {
  // Mock budget (since we don't track it yet)
  const mockBudget = 0 
  const percentage = mockBudget > 0 ? Math.min(100, Math.round((totalCost / mockBudget) * 100)) : 0

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
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Archive className="mr-2 h-4 w-4" />
            Archivia
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
               {job.endDate ? 'Scadenza fissata' : 'Nessuna scadenza'}
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Stato Avanzamento</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">In Corso</div>
                <div className="text-xs text-slate-500 mt-1">
                    Cantiere attivo
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

                 <div className="flex items-center gap-3">
                   <User className="h-4 w-4 text-slate-400" />
                   <div>
                     <div className="text-xs text-slate-500">Capocantiere</div>
                     <div className="text-sm font-medium">{job.siteManager || 'N/D'}</div>
                   </div>
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Map Placeholder */}
          <Card className="overflow-hidden">
             <div className="h-48 bg-slate-100 relative">
               <div className="absolute inset-0 flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-slate-300" />
               </div>
               {/* Embed Google Maps if address exists - simplified for now */}
               {job.siteAddress && (
                 <iframe 
                   width="100%" 
                   height="100%" 
                   frameBorder="0" 
                   style={{border:0}} 
                   src={`https://maps.google.com/maps?q=${encodeURIComponent(job.siteAddress)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                   allowFullScreen
                 ></iframe>
               )}
             </div>
             <div className="p-3 bg-white border-t">
               <p className="text-xs text-slate-500 truncate">{job.siteAddress}</p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
