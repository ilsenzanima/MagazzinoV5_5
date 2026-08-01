"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { inventoryApi, NegativeLotMovement } from "@/lib/services/inventory";
import { notify } from "@/lib/notify";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("it-IT", {
        day: "2-digit", month: "short", year: "numeric"
    });
}

export default function AnomaliePage() {
    const { userRole } = useAuth();

    const [rows, setRows] = useState<NegativeLotMovement[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRows(await inventoryApi.getNegativeLotMovements());
        } catch (error) {
            console.error("Failed to load negative lot movements", error);
            notify.error("Errore nel caricamento delle anomalie");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (userRole === "admin") load();
    }, [userRole, load]);

    if (userRole !== "admin") {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <AlertTriangle className="h-12 w-12 opacity-20 mb-4" />
                    <p>Accesso riservato agli amministratori.</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-orange-500" />
                        Anomalie
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Righe di bolle collegate a un lotto d&apos;acquisto la cui quantità residua è scesa sotto zero — di solito perché agganciate per errore al lotto di un acquisto fatto direttamente per un&apos;altra commessa. Clicca su una bolla per aprirla e correggere il collegamento al lotto (tab Lotti nella scheda articolo).
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
                        <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
                        <p>Nessuna anomalia rilevata.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rows.map(row => (
                            <Card key={`${row.purchaseItemId}-${row.deliveryNoteItemId}`}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs text-slate-400">{row.code}</span>
                                            <span className="font-medium truncate">{row.name}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Lotto acquisto {row.purchaseRef} del {formatDate(row.purchaseDate)} · residuo{" "}
                                            <span className="text-red-600 font-semibold">
                                                {row.remainingQuantity} {row.unit}
                                                {row.remainingPieces != null ? ` (${row.remainingPieces} pz)` : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <Link
                                        href={`/movements/${row.deliveryNoteId}/edit`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-right shrink-0 group"
                                    >
                                        <div className="text-sm font-medium group-hover:underline flex items-center gap-1 justify-end">
                                            Bolla {row.deliveryNoteNumber}
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatDate(row.deliveryNoteDate)} · {row.itemQuantity} {row.unit}
                                        </div>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
