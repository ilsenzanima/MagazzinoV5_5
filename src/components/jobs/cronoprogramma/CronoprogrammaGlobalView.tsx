"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GanttChartSquare, ExternalLink, Loader2 } from "lucide-react"
import { jobTasksApi, JobTask } from "@/lib/api"
import { notify } from "@/lib/notify"
import { TimelineChart } from "@/components/jobs/cronoprogramma/TimelineChart"

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

export function CronoprogrammaGlobalView() {
    const [tasks, setTasks] = useState<JobTask[]>([])
    const [loading, setLoading] = useState(true)
    const [jobFilter, setJobFilter] = useState<string>("all")

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const data = await jobTasksApi.getAllActive()
                setTasks(data)
            } catch (err) {
                console.error("Errore caricamento cronoprogramma globale:", err)
                notify.error("Errore nel caricamento del cronoprogramma")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const jobOptions = useMemo(() => {
        const map = new Map<string, string>()
        tasks.forEach(t => map.set(t.jobId, `${t.jobCode ? t.jobCode + ' — ' : ''}${t.jobName || ''}`))
        return Array.from(map.entries())
    }, [tasks])

    const filteredTasks = useMemo(
        () => jobFilter === "all" ? tasks : tasks.filter(t => t.jobId === jobFilter),
        [tasks, jobFilter]
    )

    const groupedByJob = useMemo(() => {
        const groups = new Map<string, { label: string; tasks: JobTask[] }>()
        filteredTasks.forEach(t => {
            const label = `${t.jobCode ? t.jobCode + ' — ' : ''}${t.jobName || ''}`
            if (!groups.has(t.jobId)) groups.set(t.jobId, { label, tasks: [] })
            groups.get(t.jobId)!.tasks.push(t)
        })
        return Array.from(groups.entries())
    }, [filteredTasks])

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Caricamento cronoprogramma...</span>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <GanttChartSquare className="h-6 w-6 text-blue-600" />
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Cronoprogramma Commesse</h1>
                </div>
                <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="Tutte le commesse" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tutte le commesse attive</SelectItem>
                        {jobOptions.map(([id, label]) => (
                            <SelectItem key={id} value={id}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {filteredTasks.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-muted rounded-lg border border-dashed dark:border-slate-700">
                    <GanttChartSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nessuna fase pianificata per le commesse attive.</p>
                    <p className="text-sm">Aggiungi fasi dal tab Cronoprogramma di ogni commessa.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {groupedByJob.map(([jobId, group]) => (
                        <Card key={jobId}>
                            <CardContent className="py-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-semibold text-slate-800 dark:text-slate-100">{group.label}</h2>
                                    <Link href={`/jobs/${jobId}?tab=cronoprogramma`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                        Apri commessa <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                                <div className="hidden md:block">
                                    <TimelineChart tasks={group.tasks} readonly />
                                </div>
                                <div className="md:hidden space-y-2">
                                    {group.tasks.map(task => (
                                        <div key={task.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-none">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{task.name}</p>
                                                <p className="text-xs text-slate-500">{task.startDate} → {task.endDate} · {task.progress}%</p>
                                            </div>
                                            <Badge className={`${STATUS_BADGE[task.status]} text-white text-[10px] shrink-0`}>
                                                {STATUS_LABEL[task.status]}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
