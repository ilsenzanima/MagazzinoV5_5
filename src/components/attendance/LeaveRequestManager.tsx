"use client"

import { useState } from "react"
import { LeaveRequestForm } from "./LeaveRequestForm"
import { LeaveRequestList } from "./LeaveRequestList"
import { Worker, LeaveRequest, leaveRequestsApi } from "@/lib/api"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { NotchTabs, NotchHelp } from "@/components/ui/notch-tabs"
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
            <div className="space-y-2">
                <Link href="/attendance" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="mr-1 h-4 w-4" /> Presenze
                </Link>
                <NotchTabs title="Richiesta Permesso">
                    <NotchHelp title="Richiesta permesso" lines={["Inserisci una nuova richiesta di ferie o permesso per un dipendente."]} />
                </NotchTabs>
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
