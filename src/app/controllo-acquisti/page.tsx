"use client"

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Package, RefreshCw, ShieldAlert, Users } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageStrip, NotchHelp, NotchActions, NotchSearch, NotchButton } from "@/components/ui/notch-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { purchaseAuditApi } from "@/lib/services/purchase-audit";
import { auditPurchases, AuditLot } from "@/lib/utils/purchase-price-audit";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

type Mode = 'any' | 'price' | 'pack' | 'authors';

const TH = "text-xs font-semibold uppercase tracking-wide text-slate-600";
const STRIP_SELECT = "h-8 border-slate-600 bg-slate-700 text-xs text-slate-100";

export function ControlloAcquistiContent({ embedded = false }: { embedded?: boolean }) {
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

    const toggleExcluded = async (purchaseItemId: string, excluded: boolean) => {
        try {
            await purchaseAuditApi.setExcluded(purchaseItemId, excluded);
            setLots(prev => prev.map(l => (l.purchaseItemId === purchaseItemId ? { ...l, excluded } : l)));
        } catch (e: any) {
            notify.error(e?.message || "Impossibile salvare l'esclusione del lotto");
        }
    };

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
                    <PageStrip embedded={embedded} title="Controllo acquisti">
                        <NotchHelp wide title="Controllo acquisti" lines={["Per ogni articolo confronta i prezzi unitari dei lotti d'acquisto (solo acquisti veri, non ordini). Un lotto è anomalo se il prezzo si discosta dalla mediana degli altri lotti oltre la soglia. Spunta \"Controllato\" quando le differenze sono accettabili: verranno segnalati di nuovo solo i lotti inseriti dopo."]} />
                        <NotchActions>
                            <NotchSearch value={search} onChange={setSearch} placeholder="Cerca articolo..." />
                            <Select value={mode} onValueChange={(v: Mode) => setMode(v)}>
                                <SelectTrigger className={`${STRIP_SELECT} w-52`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="any">Tutte le segnalazioni</SelectItem>
                                    <SelectItem value="price">Solo prezzi anomali</SelectItem>
                                    <SelectItem value="pack">Solo quantità per confezione</SelectItem>
                                    <SelectItem value="authors">Solo autori diversi</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={threshold} onValueChange={setThreshold}>
                                <SelectTrigger className={`${STRIP_SELECT} w-36`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0.3">Soglia +30%</SelectItem>
                                    <SelectItem value="0.5">Soglia +50%</SelectItem>
                                    <SelectItem value="1">Soglia +100%</SelectItem>
                                </SelectContent>
                            </Select>
                            <NotchButton type="button" onClick={() => setShowReviewed(v => !v)} className={showReviewed ? "ring-2 ring-blue-400" : undefined}>
                                Mostra anche i controllati
                            </NotchButton>
                            <NotchButton type="button" onClick={load} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Ricarica
                            </NotchButton>
                            {!loading && !error && (
                                <span className="text-xs text-slate-300">{visible.length} da vedere su {items.length} articoli ({lots.length} righe)</span>
                            )}
                        </NotchActions>
                    </PageStrip>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Errore</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                        <Table className="min-w-[860px] border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className={`w-28 ${TH}`}>Data</TableHead>
                                    <TableHead className={`w-28 ${TH}`}>Bolla</TableHead>
                                    <TableHead className={TH}>Fornitore</TableHead>
                                    <TableHead className={`w-36 ${TH}`}>Inserito da</TableHead>
                                    <TableHead className={`w-24 text-right ${TH}`}>Quantità</TableHead>
                                    <TableHead className={`w-24 text-right ${TH}`}>Prezzo</TableHead>
                                    <TableHead className={`w-20 text-right ${TH}`}>Scarto</TableHead>
                                    <TableHead className={`w-24 ${TH}`}>Non calcolare</TableHead>
                                    <TableHead className={`w-56 ${TH}`}>Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map(item => (
                                    <Fragment key={item.itemId}>
                                        <TableRow className={`border-t-2 bg-slate-50 hover:bg-slate-50 dark:bg-muted/40 ${item.reviewedAt && !hasFlags(item) ? "opacity-70" : ""}`}>
                                            <TableCell colSpan={9} className="py-2">
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                    <span className="font-semibold">{item.itemName}</span>
                                                    {item.itemUnit && <span className="text-xs text-muted-foreground">({item.itemUnit})</span>}
                                                    {item.hasPriceAnomaly && (
                                                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Prezzo anomalo</Badge>
                                                    )}
                                                    {item.hasPackIssue && (
                                                        <Badge variant="destructive" className="gap-1"><Package className="h-3 w-3" />Confezione</Badge>
                                                    )}
                                                    {item.hasMultipleAuthors && (
                                                        <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />Autori diversi</Badge>
                                                    )}
                                                    <span className="text-xs text-muted-foreground">
                                                        Mediana {item.medianPrice !== null ? formatCurrency(item.medianPrice) : "-"} · inserito da {item.authors.map(a => `${a.name} (${a.count})`).join(", ")}
                                                    </span>
                                                    <label className="flex items-center gap-2 text-sm">
                                                        <Checkbox checked={!!item.reviewedAt} onCheckedChange={v => toggleReviewed(item.itemId, v === true)} />
                                                        Controllato
                                                        {item.reviewedAt && <span className="text-xs text-muted-foreground">il {new Date(item.reviewedAt).toLocaleDateString("it-IT")}</span>}
                                                    </label>
                                                    <label className="flex items-center gap-2 text-sm">
                                                        Q.tà per confezione
                                                        <Input
                                                            className="h-7 w-20 bg-white"
                                                            inputMode="decimal"
                                                            placeholder="es. 18"
                                                            value={packDrafts[item.itemId] ?? (item.packQuantity !== null ? String(item.packQuantity) : "")}
                                                            onChange={e => setPackDrafts(p => ({ ...p, [item.itemId]: e.target.value }))}
                                                            onBlur={() => savePack(item.itemId, item.packQuantity)}
                                                            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                                        />
                                                        <span className="text-xs text-muted-foreground">{item.itemUnit ?? ""}</span>
                                                    </label>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {item.lots.map((l, i) => (
                                            <TableRow key={`${l.purchaseId}-${i}`} className={l.ignored ? "opacity-60" : l.isNew && (l.priceAnomaly || l.packPriceSuspect) ? "bg-red-50 hover:bg-red-50 dark:bg-red-950/30" : ""}>
                                                <TableCell className="whitespace-nowrap py-1.5">{l.date ?? "-"}</TableCell>
                                                <TableCell className="py-1.5">
                                                    <Link href={`/purchases/${l.purchaseId}`} className="text-blue-600 hover:underline">
                                                        {l.deliveryNoteNumber || "apri"}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="truncate py-1.5">{l.supplierName ?? "-"}</TableCell>
                                                <TableCell className={`truncate py-1.5 ${l.differentAuthor ? "font-semibold text-amber-700" : ""}`}>{l.createdByName ?? "Sconosciuto"}</TableCell>
                                                <TableCell className="py-1.5 text-right">{l.quantity !== null ? formatNumber(l.quantity) : "-"}</TableCell>
                                                <TableCell className="py-1.5 text-right">{formatCurrency(l.price)}</TableCell>
                                                <TableCell className="py-1.5 text-right">
                                                    {l.deviation === null ? "-" : `${l.deviation > 0 ? "+" : ""}${formatNumber(l.deviation * 100, { maximumFractionDigits: 0 })}%`}
                                                </TableCell>
                                                <TableCell className="py-1.5">
                                                    <Checkbox
                                                        checked={l.excluded}
                                                        onCheckedChange={v => toggleExcluded(l.purchaseItemId, v === true)}
                                                        aria-label="Non calcolare questo lotto nel prezzo di riferimento"
                                                    />
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {l.ignored === 'excluded' && "escluso dal prezzo di riferimento"}
                                                    {l.ignored === 'zero' && "quantità 0: non conteggiato"}
                                                    {l.packPriceSuspect && "sembra il prezzo della confezione"}
                                                    {l.qtyNotMultiple && !l.packPriceSuspect && "quantità non multipla della confezione"}
                                                    {!l.isNew && !l.ignored && " già controllato"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </Fragment>
                                ))}
                                {!loading && visible.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nessuna segnalazione</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

export default function ControlloAcquistiPage() {
    return <ControlloAcquistiContent />;
}
