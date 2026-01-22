
"use client"

import { format } from "date-fns"
import { it } from "date-fns/locale"
import { FileText, User, Calendar, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { LeaveRequest } from "@/lib/services/leave-requests"
import { toast } from "sonner"

interface LeaveRequestListProps {
    requests: LeaveRequest[]
}

export function LeaveRequestList({ requests }: LeaveRequestListProps) {

    const handleCardClick = (req: LeaveRequest) => {
        // "questa card se premuta genererà un PDF (ma di questo ne parliamo dopo...)"
        toast.info("Generazione PDF in arrivo...", {
            description: `Richiesta permessi per ${req.worker?.first_name}`
        })
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Nessuna richiesta recente.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {requests.map((req) => (
                <Card
                    key={req.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors border-l-4 border-l-red-500"
                    onClick={() => handleCardClick(req)}
                >
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 font-medium">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate">
                                    {req.worker?.first_name} {req.worker?.last_name}
                                </span>
                            </div>
                            {/* Icona Ferie/Permesso */}
                            <div className="bg-red-100 text-red-600 p-1.5 rounded-full">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Calendar className="h-4 w-4 opacity-70" />
                            <span>
                                {format(new Date(req.date), "d MMM yyyy", { locale: it })}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Clock className="h-4 w-4 opacity-70" />
                            <span>{req.hours} ore</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
