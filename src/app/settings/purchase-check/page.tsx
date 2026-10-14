"use client"

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { purchaseAuditApi } from "@/lib/services/purchase-audit";
import { auditPurchases, AuditLot } from "@/lib/utils/purchase-price-audit";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type Mode = 'any' | 'price' | 'authors';

export default function PurchaseCheckPage() {
    const { userRole, realRole } = useAuth();
    const isAdmin = userRole === 'admin' || realRole === 'admin';

    const [lots, setLots] = useState<AuditLot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('any');
    const [threshold, setThreshold] = useState("0.5");
    const [search, setSearch] = useState("");

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setLots(await purchaseAuditApi.getLots());
        } catch (e: any) {
            setError(e?.message || "Errore nel caricamento degli acquisti");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) load();
    }, [isAdmin]);

    const items = useMemo(() => auditPurchases(lots, Number(threshold)), [lots, threshold]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(item => {
            if (q && !item.itemName.toLowerCase().includes(q)) return false;
            if (mode === 'price') return item.hasPriceAnomaly;
            if (mode === 'authors') return item.hasMultipleAuthors;
            return item.hasPriceAnomaly || item.hasMultipleAuthors;
        });
    }, [items, mode, search]);

    if (!isAdmin) {
        return (
            <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Accesso Limitato</AlertTitle>
                <AlertDescription>Non hai i permessi di amministratore per visualizzare questa sezione.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Controllo acquisti</CardTitle>
                    <CardDescription>
                        Per ogni articolo confronta i prezzi unitari dei lotti d'acquisto (solo acquisti veri, non ordini)
                        e mostra chi li ha inseriti. Un lotto è anomalo se il suo prezzo si discosta dalla mediana degli
                        altri lotti dello stesso articolo oltre la soglia.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Select value={mode} onValueChange={(v: Mode) => setMode(v)}>
                        <SelectTrigger className="sm:w-60"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="any">Prezzi anomali o autori diversi</SelectItem>
                            <SelectItem value="price">Solo prezzi anomali</SelectItem>
                            <SelectItem value="authors">Solo autori diversi</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={threshold} onValueChange={setThreshold}>
                        <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0.3">Soglia +30%</SelectItem>
                            <SelectItem value="0.5">Soglia +50%</SelectItem>
                            <SelectItem value="1">Soglia +100%</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        className="sm:w-60"
                        placeholder="Cerca articolo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <Button variant="outline" onClick={load} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Ricarica
                    </Button>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Errore</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!loading && !error && (
                <p className="text-sm text-muted-foreground">
                    {visible.length} articoli da controllare su {items.length} con acquisti ({lots.length} righe).
                </p>
            )}

            {visible.map(item => (
                <Card key={item.itemId}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                            {item.itemName}
                            {item.itemUnit && <span className="text-xs font-normal text-muted-foreground">({item.itemUnit})</span>}
                            {item.hasPriceAnomaly && (
                                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Prezzo anomalo</Badge>
                            )}
                            {item.hasMultipleAuthors && (
                                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />Autori diversi</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Mediana {item.medianPrice !== null ? formatCurrency(item.medianPrice) : "-"} · inserito da{" "}
                            {item.authors.map(a => `${a.name} (${a.count})`).join(", ")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground">
                                    <th className="py-1 pr-3">Data</th>
                                    <th className="py-1 pr-3">Bolla</th>
                                    <th className="py-1 pr-3">Fornitore</th>
                                    <th className="py-1 pr-3">Inserito da</th>
                                    <th className="py-1 pr-3 text-right">Prezzo</th>
                                    <th className="py-1 text-right">Scarto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.lots.map((l, i) => (
                                    <tr key={`${l.purchaseId}-${i}`} className={l.priceAnomaly ? "bg-red-50 dark:bg-red-950/30" : ""}>
                                        <td className="py-1 pr-3 whitespace-nowrap">{l.date ?? "-"}</td>
                                        <td className="py-1 pr-3">
                                            <Link href={`/purchases/${l.purchaseId}`} className="text-blue-600 hover:underline">
                                                {l.deliveryNoteNumber || "apri"}
                                            </Link>
                                        </td>
                                        <td className="py-1 pr-3">{l.supplierName ?? "-"}</td>
                                        <td className={`py-1 pr-3 ${l.differentAuthor ? "font-semibold text-amber-700" : ""}`}>
                                            {l.createdByName ?? "Sconosciuto"}
                                        </td>
                                        <td className="py-1 pr-3 text-right">{formatCurrency(l.price)}</td>
                                        <td className="py-1 text-right">
                                            {l.deviation === null ? "-" : `${l.deviation > 0 ? "+" : ""}${formatNumber(l.deviation * 100, { maximumFractionDigits: 0 })}%`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
