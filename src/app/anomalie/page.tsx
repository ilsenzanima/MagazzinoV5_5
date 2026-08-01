"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { inventoryApi, NegativeLotMovement, OrphanedJobReference } from "@/lib/services/inventory";
import { notify } from "@/lib/notify";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("it-IT", {
        day: "2-digit", month: "short", year: "numeric"
    });
}

export default function AnomaliePage() {
    const { userRole } = useAuth();

    const [negativeLots, setNegativeLots] = useState<NegativeLotMovement[]>([]);
    const [loadingNegativeLots, setLoadingNegativeLots] = useState(true);

    const [orphanedJobs, setOrphanedJobs] = useState<OrphanedJobReference[]>([]);
    const [loadingOrphanedJobs, setLoadingOrphanedJobs] = useState(true);

    const loadNegativeLots = useCallback(async () => {
        setLoadingNegativeLots(true);
        try {
            setNegativeLots(await inventoryApi.getNegativeLotMovements());
        } catch (error) {
            console.error("Failed to load negative lot movements", error);
            notify.error("Errore nel caricamento dei lotti negativi");
        } finally {
            setLoadingNegativeLots(false);
        }
    }, []);

    const loadOrphanedJobs = useCallback(async () => {
        setLoadingOrphanedJobs(true);
        try {
            setOrphanedJobs(await inventoryApi.getOrphanedJobReferences());
        } catch (error) {
            console.error("Failed to load orphaned job references", error);
            notify.error("Errore nel caricamento delle commesse eliminate");
        } finally {
            setLoadingOrphanedJobs(false);
        }
    }, []);

    useEffect(() => {
        if (userRole === "admin") {
            loadNegativeLots();
            loadOrphanedJobs();
        }
    }, [userRole, loadNegativeLots, loadOrphanedJobs]);

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
                </div>

                <Tabs defaultValue="lotti-negativi">
                    <TabsList>
                        <TabsTrigger value="lotti-negativi" className="gap-2">
                            Lotti negativi
                            {negativeLots.length > 0 && <Badge variant="secondary">{negativeLots.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="commesse-eliminate" className="gap-2">
                            Commesse eliminate
                            {orphanedJobs.length > 0 && <Badge variant="secondary">{orphanedJobs.length}</Badge>}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="lotti-negativi" className="mt-4 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Righe di bolle collegate a un lotto d&apos;acquisto la cui quantità residua è scesa sotto zero — di solito perché agganciate per errore al lotto di un acquisto fatto direttamente per un&apos;altra commessa. Clicca su una bolla per aprirla e correggere il collegamento al lotto (tab Lotti nella scheda articolo).
                        </p>

                        {loadingNegativeLots ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : negativeLots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
                                <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
                                <p>Nessuna anomalia rilevata.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {negativeLots.map(row => (
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
                    </TabsContent>

                    <TabsContent value="commesse-eliminate" className="mt-4 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Acquisti o bolle ancora collegati a una commessa che è stata spostata nel cestino. Riferimenti &quot;orfani&quot; che vale la pena controllare prima di eliminare definitivamente la commessa.
                        </p>

                        {loadingOrphanedJobs ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : orphanedJobs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
                                <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
                                <p>Nessuna anomalia rilevata.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orphanedJobs.map(row => (
                                    <Card key={`${row.sourceType}-${row.sourceId}`}>
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium">
                                                        {row.sourceType === "purchase" ? "Acquisto" : "Bolla"} {row.reference}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {formatDate(row.referenceDate)} · commessa eliminata:{" "}
                                                    <span className="font-mono">{row.jobCode}</span>
                                                </div>
                                            </div>
                                            <Link
                                                href={row.sourceType === "purchase" ? `/purchases/${row.sourceId}` : `/movements/${row.sourceId}/edit`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 text-sm font-medium hover:underline flex items-center gap-1"
                                            >
                                                Apri
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
