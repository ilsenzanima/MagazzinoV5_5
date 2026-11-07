"use client"

import { useState, useEffect } from "react"
import { Job, jobsApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Calendar, Building2, MapPin, User, Clock, Link2 } from "lucide-react"
import Link from "next/link"
import { JobChainItem } from "@/lib/types"
import { JobMap } from "./JobMap"
import { JobWeatherWidget } from "./JobWeatherWidget"

interface JobOverviewProps {
  job: Job
  totalCost?: number
  totalHours?: number
  onJobUpdated?: () => void // non più usato qui (le azioni sono nel menu in alto), tenuto per compatibilità
}

export function JobOverview({ job, totalHours = 0 }: JobOverviewProps) {

  return (
    <div className="space-y-6 overflow-x-hidden">
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
            <div className="text-lg font-bold break-words" title={job.clientName}>
              {job.clientName || '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1 break-words" title={job.clientAddress}>
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
            <div className="text-sm font-medium mb-1 break-words" title={job.siteAddress}>
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

      {(job.cig || job.cup || job.description) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dati commessa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(job.cig || job.cup) && (
              <div className="grid grid-cols-2 gap-4 md:max-w-md">
                <div>
                  <Label className="text-slate-500">CIG</Label>
                  <div className="font-medium">{job.cig || '-'}</div>
                </div>
                <div>
                  <Label className="text-slate-500">CUP</Label>
                  <div className="font-medium">{job.cup || '-'}</div>
                </div>
              </div>
            )}
            {job.description && (
              <div>
                <Label className="text-slate-500">Descrizione lavori</Label>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}
