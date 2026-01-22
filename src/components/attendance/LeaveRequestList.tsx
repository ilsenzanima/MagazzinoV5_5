"use client"

import { format } from "date-fns"
import { it } from "date-fns/locale"
import { FileText, User, Calendar, Clock, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LeaveRequest } from "@/lib/services/leave-requests"
import { toast } from "sonner"
import { leaveRequestsApi } from "@/lib/api"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface LeaveRequestListProps {
    requests: LeaveRequest[]
    isAdmin: boolean
    onDelete?: () => void
}

export function LeaveRequestList({ requests, isAdmin, onDelete }: LeaveRequestListProps) {

    const handleCardClick = (req: LeaveRequest) => {
        toast.info("Generazione PDF in arrivo...", {
            description: `Richiesta permessi per ${req.worker?.first_name}`
        })
    }

    const handleDelete = async (e: React.MouseEvent, req: LeaveRequest) => {
        e.stopPropagation()
        try {
            await leaveRequestsApi.delete(req.id)
            toast.success("Richiesta eliminata")
            if (onDelete) onDelete()
        } catch (error) {
            console.error(error)
            toast.error("Errore durante l'eliminazione")
        }
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
                    className="cursor-pointer hover:bg-accent/50 transition-colors border-l-4 border-l-red-500 relative group"
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

                        {isAdmin && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Eliminare questa richiesta?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Questa azione non può essere annullata. La richiesta verrà eliminata permanentemente.
                                            <br /><br />
                                            <strong>Nota:</strong> I dati nelle presenze dovranno essere gestiti manualmente.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={(e) => handleDelete(e as any, req)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Elimina
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
