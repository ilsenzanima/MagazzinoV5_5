"use client"

import { useState } from "react"
import { LeaveRequestForm } from "./LeaveRequestForm"
import { LeaveRequestList } from "./LeaveRequestList"
import { Worker, LeaveRequest, leaveRequestsApi } from "@/lib/api"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/components/auth-provider"
import { notify } from "@/lib/notify"

interface LeaveRequestManagerProps {
    workers: Worker[]
    initialRequests: LeaveRequest[]
}

export function LeaveRequestManager({ workers, initialRequests }: LeaveRequestManagerProps) {
    const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests)
    const { userRole } = useAuth()
    const isAdmin = userRole === 'admin'

    const loadRequests = async () => {
        try {
            const data = await leaveRequestsApi.getAll()
            setRequests(data)
        } catch (error) {
            console.error("Failed to load requests", error)
            notify.error("Errore nel caricamento delle richieste")
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/attendance">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Richiesta Permesso</h2>
                    <p className="text-muted-foreground">
                        Inserisci una nuova richiesta di ferie o permesso per un dipendente.
                    </p>
                </div>
            </div>

            <LeaveRequestForm
                workers={workers}
                onSuccess={loadRequests}
            />

            <Separator />

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Ultime Richieste</h3>
                <LeaveRequestList
                    requests={requests}
                    isAdmin={isAdmin}
                    onDelete={loadRequests}
                />
            </div>
        </div>
    )
}
