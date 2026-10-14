"use client"

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Package, RefreshCw, ShieldAlert, Users } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { purchaseAuditApi } from "@/lib/services/purchase-audit";
import { auditPurchases, AuditLot } from "@/lib/utils/purchase-price-audit";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type Mode = 'any' | 'price' | 'pack' | 'authors';

export default function ControlloAcquistiPage() {
    const { userRole, realRole } = useAuth();
    const isAdmin = userRole === 'admin' || realRole === 'admin';

    const [lots, setLots] = useState<AuditLot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<Mode>('any');
    const [threshold, setThreshold] = useState("0.5");
    const [search, setSearch] = useState("");
    const [showReviewed, setShowReviewed] = useState(false);
    const [packDrafts, setPackDrafts] = useState<Record<string, string>>({});

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

    const hasFlags = (item: { hasPriceAnomaly: boolean; hasPackIssue: boolean; hasMultipleAuthors: boolean }) =>
        item.hasPriceAnomaly || item.hasPackIssue || item.hasMultipleAuthors;

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(item => {
            if (q && !item.itemName.toLowerCase().includes(q)) return false;
            if (mode === 'price') return item.hasPriceAnomaly;
            if (mode === 'pack') return item.hasPackIssue;
            if (mode === 'authors') return item.hasMultipleAuthors;
            // Tutte le segnalazioni: i controllati compaiono solo se richiesto o se ci sono lotti nuovi da vedere
            if (showReviewed && item.reviewedAt) return true;
            return hasFlags(item);
        });
    }, [items, mode, search, showReviewed]);

    // Aggiorna lo stato locale dei lotti di un articolo senza ricaricare tutto
    const patchItem = (itemId: string, patch: Partial<AuditLot>) =>
        setLots(prev => prev.map(l => (l.itemId === itemId ? { ...l, ...patch } : l)));

    const toggleReviewed = async (itemId: string, reviewed: boolean) => {
        try {
            const at = await purchaseAuditApi.setReviewed(itemId, reviewed);
            patchItem(itemId, { reviewedAt: at });
        } catch (e: any) {
            notify.error(e?.message || "Impossibile salvare il controllo");
        }
    };

    const savePack = async (itemId: string, current: number | null) => {
        const raw = (packDrafts[itemId] ?? "").trim().replace(",", ".");
        if (packDrafts[itemId] === undefined) return;
        const value = raw === "" ? null : Number(raw);
        if (value !== null && (!Number.isFinite(value) || value <= 0)) {
            notify.error("La quantità per confezione deve essere maggiore di 0");
            return;
        }
        if (value === current) return;
        try {
            await purchaseAuditApi.setPackQuantity(itemId, value);
            patchItem(itemId, { packQuantity: value });
            notify.success("Quantità per confezione salvata");
        } catch (e: any) {
            notify.error(e?.message || "Impossibile salvare la quantità per confezione");
        }
    };

    return (
        <DashboardLayout>
            {!isAdmin ? (
                <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Accesso Limitato</AlertTitle>
                    <AlertDescription>Non hai i permessi di amministratore per visualizzare questa sezione.</AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Controllo acquisti</CardTitle>
                            <CardDescription>
                                Per ogni articolo confronta i prezzi unitari dei lotti d&apos;acquisto (solo acquisti veri, non
                                ordini). Un lotto è anomalo se il prezzo si discosta dalla mediana degli altri lotti oltre la
                                soglia. Spunta &quot;Controllato&quot; quando le differenze sono accettabili: verranno segnalati
                                di nuovo solo i lotti inseriti dopo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                            <Select value={mode} onValueChange={(v: Mode) => setMode(v)}>
                                <SelectTrigger className="lg:w-64"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">Tutte le segnalazioni</SelectItem>
                                    <SelectItem value="price">Solo prezzi anomali</SelectItem>
                                    <SelectItem value="pack">Solo quantità per confezione</SelectItem>
                                    <SelectItem value="authors">Solo autori diversi</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={threshold} onValueChange={setThreshold}>
                                <SelectTrigger className="lg:w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0.3">Soglia +30%</SelectItem>
                                    <SelectItem value="0.5">Soglia +50%</SelectItem>
                                    <SelectItem value="1">Soglia +100%</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                className="lg:w-60"
                                placeholder="Cerca articolo..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={showReviewed} onCheckedChange={v => setShowReviewed(v === true)} />
                                Mostra anche i controllati
                            </label>
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
                            {visible.length} articoli da vedere su {items.length} con acquisti ({lots.length} righe).
                        </p>
                    )}

                    {visible.map(item => (
                        <Card key={item.itemId} className={item.reviewedAt && !hasFlags(item) ? "opacity-70" : ""}>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                                    {item.itemName}
                                    {item.itemUnit && <span className="text-xs font-normal text-muted-foreground">({item.itemUnit})</span>}
                                    {item.hasPriceAnomaly && (
                                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Prezzo anomalo</Badge>
                                    )}
                                    {item.hasPackIssue && (
                                        <Badge variant="destructive" className="gap-1"><Package className="h-3 w-3" />Confezione</Badge>
                                    )}
                                    {item.hasMultipleAuthors && (
                                        <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />Autori diversi</Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Mediana {item.medianPrice !== null ? formatCurrency(item.medianPrice) : "-"} · inserito da{" "}
                                    {item.authors.map(a => `${a.name} (${a.count})`).join(", ")}
                                </CardDescription>
                                <div className="flex flex-wrap items-center gap-4 pt-2 text-sm">
                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={!!item.reviewedAt}
                                            onCheckedChange={v => toggleReviewed(item.itemId, v === true)}
                                        />
                                        Controllato
                                        {item.reviewedAt && (
                                            <span className="text-xs text-muted-foreground">
                                                il {new Date(item.reviewedAt).toLocaleDateString("it-IT")}
                                            </span>
                                        )}
                                    </label>
                                    <label className="flex items-center gap-2">
                                        Quantità per confezione
                                        <Input
                                            className="h-8 w-24"
                                            inputMode="decimal"
                                            placeholder="es. 18"
                                            value={packDrafts[item.itemId] ?? (item.packQuantity !== null ? String(item.packQuantity) : "")}
                                            onChange={e => setPackDrafts(p => ({ ...p, [item.itemId]: e.target.value }))}
                                            onBlur={() => savePack(item.itemId, item.packQuantity)}
                                        />
                                        <span className="text-xs text-muted-foreground">{item.itemUnit ?? ""}</span>
                                    </label>
                                </div>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-muted-foreground">
                                            <th className="py-1 pr-3">Data</th>
                                            <th className="py-1 pr-3">Bolla</th>
                                            <th className="py-1 pr-3">Fornitore</th>
                                            <th className="py-1 pr-3">Inserito da</th>
                                            <th className="py-1 pr-3 text-right">Quantità</th>
                                            <th className="py-1 pr-3 text-right">Prezzo</th>
                                            <th className="py-1 pr-3 text-right">Scarto</th>
                                            <th className="py-1">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {item.lots.map((l, i) => (
                                            <tr key={`${l.purchaseId}-${i}`} className={l.isNew && (l.priceAnomaly || l.packPriceSuspect) ? "bg-red-50 dark:bg-red-950/30" : ""}>
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
                                                <td className="py-1 pr-3 text-right">{l.quantity !== null ? formatNumber(l.quantity) : "-"}</td>
                                                <td className="py-1 pr-3 text-right">{formatCurrency(l.price)}</td>
                                                <td className="py-1 pr-3 text-right">
                                                    {l.deviation === null ? "-" : `${l.deviation > 0 ? "+" : ""}${formatNumber(l.deviation * 100, { maximumFractionDigits: 0 })}%`}
                                                </td>
                                                <td className="py-1 text-xs text-muted-foreground">
                                                    {l.packPriceSuspect && "sembra il prezzo della confezione"}
                                                    {l.qtyNotMultiple && !l.packPriceSuspect && "quantità non multipla della confezione"}
                                                    {!l.isNew && " già controllato"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </DashboardLayout>
    );
}
