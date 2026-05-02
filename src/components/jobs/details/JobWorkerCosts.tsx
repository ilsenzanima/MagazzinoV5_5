"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { attendanceApi } from "@/lib/api"
import { Users, Loader2, Euro } from "lucide-react"

interface WorkerCostRow {
    workerId: string
    workerName: string
    normalHours: number
    transferHours: number
    normalCost: number
    trasfertaCost: number
    total: number
}

interface JobWorkerCostsProps {
    jobId: string
    materialCost: number
    onTotalCostChange?: (total: number) => void
}

export function JobWorkerCosts({ jobId, materialCost, onTotalCostChange }: JobWorkerCostsProps) {
    const [rows, setRows] = useState<WorkerCostRow[]>([])
    const [workerTotal, setWorkerTotal] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        attendanceApi.getWorkerCostsByJobId(jobId)
            .then(({ rows, totalCost }) => {
                setRows(rows)
                setWorkerTotal(totalCost)
                onTotalCostChange?.(materialCost + totalCost)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [jobId, materialCost])

    const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2 })

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Costo Operai */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        Costo Operai
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-2">Nessuna presenza registrata.</p>
                    ) : (
                        <div className="space-y-0">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b dark:border-slate-700">
                                        <th className="text-left py-1.5 font-medium text-slate-500">Operaio</th>
                                        <th className="text-right py-1.5 font-medium text-slate-500">Ore</th>
                                        <th className="text-right py-1.5 font-medium text-slate-500">Trasferta</th>
                                        <th className="text-right py-1.5 font-medium text-slate-500">Costo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.workerId} className="border-b dark:border-slate-700/50 last:border-0">
                                            <td className="py-1.5 capitalize">{r.workerName}</td>
                                            <td className="py-1.5 text-right text-slate-600">{r.normalHours.toFixed(1)}</td>
                                            <td className="py-1.5 text-right text-slate-600">{r.transferHours > 0 ? r.transferHours.toFixed(1) : '—'}</td>
                                            <td className="py-1.5 text-right font-medium">€ {fmt(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t dark:border-slate-600">
                                        <td colSpan={3} className="py-2 font-semibold text-slate-700 dark:text-slate-200">Totale Operai</td>
                                        <td className="py-2 text-right font-bold text-lg">€ {fmt(workerTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Costo Complessivo */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Euro className="h-4 w-4 text-green-600" />
                        Costo Complessivo
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Materiali</span>
                                <span className="font-medium">€ {fmt(materialCost)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Manodopera</span>
                                <span className="font-medium">€ {fmt(workerTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-blue-600 text-white rounded-lg">
                                <span className="font-semibold">Totale</span>
                                <span className="text-xl font-bold">€ {fmt(materialCost + workerTotal)}</span>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
