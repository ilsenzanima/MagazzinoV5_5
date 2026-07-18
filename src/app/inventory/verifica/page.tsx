"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, ExternalLink, PackageSearch } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { inventoryApi, UntrackedStockItem } from "@/lib/services/inventory";
import { InventoryItem } from "@/lib/types";
import { notify } from "@/lib/notify";

type UnverifiedItem = InventoryItem & { createdAt: string };

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("it-IT", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
}

export default function InventoryVerificaPage() {
    const { userRole } = useAuth();

    const [items, setItems] = useState<UnverifiedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState<string | null>(null);

    const [untracked, setUntracked] = useState<UntrackedStockItem[]>([]);
    const [loadingUntracked, setLoadingUntracked] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setItems(await inventoryApi.getUnverified());
        } catch (error) {
            console.error("Failed to load unverified items", error);
            notify.error("Errore nel caricamento degli articoli da controllare");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUntracked = useCallback(async () => {
        setLoadingUntracked(true);
        try {
            setUntracked(await inventoryApi.getUntrackedStock());
        } catch (error) {
            console.error("Failed to load untracked stock", error);
            notify.error("Errore nel caricamento degli articoli fuori lotto");
        } finally {
            setLoadingUntracked(false);
        }
    }, []);

    useEffect(() => {
        if (userRole === "admin") {
            load();
            loadUntracked();
        }
    }, [userRole, load, loadUntracked]);

    const handleVerify = async (id: string) => {
        setVerifying(id);
        try {
            await inventoryApi.verify(id);
            setItems(prev => prev.filter(i => i.id !== id));
            notify.success("Articolo verificato");
        } catch (error) {
            console.error("Failed to verify item", error);
            notify.error("Errore durante la verifica");
        } finally {
            setVerifying(null);
        }
    };

    if (userRole !== "admin") {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                    <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
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
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                        Controllo Articoli
                    </h1>
                </div>

                <Tabs defaultValue="nuovi">
                    <TabsList>
                        <TabsTrigger value="nuovi" className="gap-2">
                            Nuovi Articoli
                            {items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="fuori-lotto" className="gap-2">
                            Fuori Lotto
                            {untracked.length > 0 && <Badge variant="secondary">{untracked.length}</Badge>}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="nuovi" className="mt-4 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nuovi articoli in attesa di verifica, dal più recente. Controlla i dati (in particolare il coefficiente) e spunta quando è tutto corretto; clicca sull&apos;articolo per aprirne la scheda e correggerlo.
                        </p>

                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
                                <ShieldCheck className="h-12 w-12 opacity-20 mb-4" />
                                <p>Nessun articolo da controllare.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map(item => (
                                    <Card key={item.id}>
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <Checkbox
                                                checked={false}
                                                disabled={verifying === item.id}
                                                onCheckedChange={() => handleVerify(item.id)}
                                                className="h-5 w-5 shrink-0"
                                                aria-label={`Segna come verificato: ${item.name}`}
                                            />
                                            <Link
                                                href={`/inventory/${item.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 min-w-0 flex items-center gap-4 group"
                                            >
                                                <div className="w-12 h-12 rounded bg-slate-100 dark:bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                                                    {item.image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ShieldCheck className="h-5 w-5 text-slate-300" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-xs text-slate-400">{item.code}</span>
                                                        <span className="font-medium truncate group-hover:underline">{item.name}</span>
                                                        {item.model && <span className="text-xs text-slate-500">({item.model})</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {item.brand} · {item.type} · Coeff. {item.coefficient} · {item.unit}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-slate-400 shrink-0 flex items-center gap-1 whitespace-nowrap">
                                                    {formatDate(item.createdAt)}
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            </Link>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="fuori-lotto" className="mt-4 space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Articoli il cui stock a magazzino non è interamente coperto da lotti d&apos;acquisto residui — di solito per un movimento agganciato al lotto sbagliato o un acquisto modificato dopo essere già stato in parte scaricato. Clicca sull&apos;articolo per aprire la scheda (si apre già sul tab Lotti) e correggere.
                        </p>

                        {loadingUntracked ? (
                            <div className="flex justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : untracked.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
                                <PackageSearch className="h-12 w-12 opacity-20 mb-4" />
                                <p>Nessun articolo fuori lotto.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {untracked.map(item => (
                                    <Link
                                        key={item.itemId}
                                        href={`/inventory/${item.itemId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Card className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-xs text-slate-400">{item.code}</span>
                                                        <span className="font-medium truncate group-hover:underline">{item.name}</span>
                                                        {item.model && <span className="text-xs text-slate-500">({item.model})</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        {item.brand}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm">
                                                        <span className="text-slate-400">{item.trackedQuantity} / </span>
                                                        <span className="font-bold">{item.totalQuantity} {item.unit}</span>
                                                    </div>
                                                    <div className="text-xs text-orange-600 font-medium">
                                                        {item.untrackedQuantity} {item.unit} fuori lotto
                                                    </div>
                                                </div>
                                                <ExternalLink className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
