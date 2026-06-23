"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, FileText, User, Calendar, Package, ExternalLink } from "lucide-react"
import Link from "next/link"
import { purchasesApi, Purchase } from "@/lib/api"
import { useAuth } from "@/components/auth-provider"
import { format } from "date-fns"
import { it } from "date-fns/locale"
import { notify } from "@/lib/notify"

interface JobOrdiniProps {
    jobId: string
    jobCode?: string
}

export function JobOrdini({ jobId, jobCode }: JobOrdiniProps) {
    const { userRole } = useAuth()
    const [orders, setOrders] = useState<Purchase[]>([])
    const [loading, setLoading] = useState(true)

    const canEdit = userRole === 'admin' || userRole === 'operativo'

    useEffect(() => {
        load()
    }, [jobId])

    const load = async () => {
        try {
            setLoading(true)
            const all = await purchasesApi.getByJobId(jobId)
            setOrders(all.filter(p => p.orderType === 'order'))
        } catch (err) {
            console.error("Errore caricamento ordini", err)
            notify.error("Errore nel caricamento degli ordini")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Caricamento ordini...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header con bottone nuovo ordine */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-slate-500">{orders.length} {orders.length === 1 ? 'ordine' : 'ordini'}</p>
                {canEdit && (
                    <Link href={`/purchases/new?type=order&jobId=${jobId}`}>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuovo Ordine
                        </Button>
                    </Link>
                )}
            </div>

            {/* Lista ordini */}
            {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Nessun ordine per questa commessa</p>
                    {canEdit && (
                        <p className="text-sm mt-1">Usa il bottone "Nuovo Ordine" per crearne uno</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orders.map(order => {
                        const articleNames = order.items
                            ?.filter(i => i.itemName)
                            .map(i => i.itemModel ? `${i.itemName} (${i.itemModel})` : i.itemName!)
                            .filter((v, idx, arr) => arr.indexOf(v) === idx)

                        return (
                            <Link href={`/purchases/${order.id}`} key={order.id}>
                                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200 dark:border-slate-700">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <span className="truncate">Ordine: {order.deliveryNoteNumber}</span>
                                                </h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <User className="h-3 w-3 shrink-0" />
                                                    {order.supplierName || 'Fornitore sconosciuto'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                <span>
                                                    {format(new Date(order.deliveryNoteDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: it })}
                                                </span>
                                            </div>
                                            {canEdit && order.totalAmount !== undefined && (
                                                <span className="font-semibold text-slate-900 dark:text-white">
                                                    € {order.totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                </span>
                                            )}
                                        </div>

                                        {articleNames && articleNames.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {articleNames.slice(0, 3).map((name, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs font-normal truncate max-w-[140px]">
                                                        {name}
                                                    </Badge>
                                                ))}
                                                {articleNames.length > 3 && (
                                                    <Badge variant="outline" className="text-xs font-normal">
                                                        +{articleNames.length - 3} altri
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
