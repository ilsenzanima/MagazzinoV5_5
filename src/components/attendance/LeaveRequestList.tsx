"use client"

import { format, isSameDay } from "date-fns"
import { it } from "date-fns/locale"
import { FileText, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LeaveRequest } from "@/lib/services/leave-requests"
import { toast } from "sonner"
import { leaveRequestsApi } from "@/lib/api"
import { generateLeaveRequestPDF } from "@/lib/pdf/leave-request-pdf"
import { confirmDialog } from "@/components/ui/confirm-host"

interface LeaveRequestListProps {
    requests: LeaveRequest[]
    isAdmin: boolean
    onDelete?: () => void
}

const headCls = "text-xs font-semibold uppercase tracking-wide text-slate-600"

export function LeaveRequestList({ requests, isAdmin, onDelete }: LeaveRequestListProps) {
    const handlePdf = async (req: LeaveRequest) => {
        try {
            await generateLeaveRequestPDF(req)
            toast.success("PDF generato!")
        } catch (error) {
            console.error("PDF generation error:", error)
            toast.error("Errore generazione PDF")
        }
    }

    const handleDelete = async (req: LeaveRequest) => {
        const who = `${req.worker?.first_name ?? ""} ${req.worker?.last_name ?? ""}`.trim()
        if (!await confirmDialog(`Eliminare la richiesta di ${who || "questo dipendente"}? Verranno tolte anche le ore inserite in automatico nelle presenze.`)) return
        try {
            await leaveRequestsApi.delete(req.id)
            toast.success("Richiesta eliminata")
            if (onDelete) onDelete()
        } catch (error) {
            console.error(error)
            toast.error("Errore durante l'eliminazione")
        }
    }

    const formatDateRange = (startDate: string, endDate: string) => {
        const start = new Date(`${startDate}T12:00:00`)
        const end = new Date(`${endDate}T12:00:00`)
        if (isSameDay(start, end)) return format(start, "EEE d MMM yyyy", { locale: it })
        return `${format(start, "EEE d MMM", { locale: it })} → ${format(end, "EEE d MMM yyyy", { locale: it })}`
    }

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                <TableHeader>
                    <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                        <TableHead className={headCls}>Dipendente</TableHead>
                        <TableHead className={`w-64 ${headCls}`}>Periodo</TableHead>
                        <TableHead className={`hidden w-32 sm:table-cell ${headCls}`}>Ore al giorno</TableHead>
                        <TableHead className="w-24" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="py-14 text-center text-slate-400">Nessuna richiesta recente.</TableCell>
                        </TableRow>
                    ) : requests.map((req) => (
                        <TableRow key={req.id}>
                            <TableCell className="truncate py-2 text-sm font-medium">{req.worker?.first_name} {req.worker?.last_name}</TableCell>
                            <TableCell className="py-2 text-sm capitalize">{formatDateRange(req.date, req.end_date || req.date)}</TableCell>
                            <TableCell className="hidden py-2 text-sm sm:table-cell">{req.hours}</TableCell>
                            <TableCell className="py-2">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePdf(req)} title="Scarica PDF"><FileText className="h-4 w-4" /></Button>
                                    {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(req)} title="Elimina"><Trash2 className="h-4 w-4" /></Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
