"use client"

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageStrip, NotchHelp, NotchActions, NotchSearch, NotchButton } from "@/components/ui/notch-tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { purchaseAuditApi, PackItem } from "@/lib/services/purchase-audit";

export function ConfezioniContent({ embedded = false }: { embedded?: boolean }) {
    const { userRole, realRole } = useAuth();
    const isAdmin = userRole === 'admin' || realRole === 'admin';

    const [items, setItems] = useState<PackItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            setItems(await purchaseAuditApi.getPackItems());
            setDrafts({});
        } catch (e: any) {
            setError(e?.message || "Errore nel caricamento degli articoli");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) load();
    }, [isAdmin]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter(it => {
            if (onlyMissing && it.packQuantity !== null) return false;
            if (!q) return true;
            return [it.name, it.model, it.brand, it.code].some(v => (v ?? "").toLowerCase().includes(q));
        });
    }, [items, search, onlyMissing]);

    const filledCount = items.filter(i => i.packQuantity !== null).length;

    const save = async (item: PackItem) => {
        if (drafts[item.id] === undefined) return;
        const raw = drafts[item.id].trim().replace(",", ".");
        const value = raw === "" ? null : Number(raw);
        if (value !== null && (!Number.isFinite(value) || value <= 0)) {
            notify.error("La quantità per confezione deve essere maggiore di 0");
            return;
        }
        if (value === item.packQuantity) {
            setDrafts(d => { const { [item.id]: _, ...rest } = d; return rest; });
            return;
        }
        setSaving(item.id);
        try {
            await purchaseAuditApi.setPackQuantity(item.id, value);
            setItems(prev => prev.map(i => (i.id === item.id ? { ...i, packQuantity: value } : i)));
            setDrafts(d => { const { [item.id]: _, ...rest } = d; return rest; });
        } catch (e: any) {
            notify.error(e?.message || "Impossibile salvare la quantità per confezione");
        } finally {
            setSaving(null);
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
                    <PageStrip embedded={embedded} title="Quantità per confezione">
                        <NotchHelp wide title="Quantità per confezione" lines={["Quanti pezzi, metri o chili ci sono normalmente in una confezione, nell'unità dell'articolo. Si salva da solo uscendo dal campo o premendo Invio. Serve al Controllo Acquisti per segnalare prezzi o quantità che non tornano con la confezione."]} />
                        <NotchActions>
                            <NotchSearch value={search} onChange={setSearch} placeholder="Cerca nome, modello, marca o codice..." />
                            <NotchButton type="button" onClick={() => setOnlyMissing(v => !v)} className={onlyMissing ? "ring-2 ring-blue-400" : undefined}>
                                Solo senza quantità
                            </NotchButton>
                            <NotchButton type="button" onClick={load} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Ricarica
                            </NotchButton>
                            {!loading && !error && (
                                <span className="text-xs text-slate-300">{filledCount} di {items.length} compilati · {visible.length} mostrati</span>
                            )}
                        </NotchActions>
                    </PageStrip>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Errore</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                        <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
                            <TableHeader>
                                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Articolo</TableHead>
                                    <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-slate-600 md:table-cell">Modello</TableHead>
                                    <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-slate-600 md:table-cell">Marca</TableHead>
                                    <TableHead className="w-20 text-xs font-semibold uppercase tracking-wide text-slate-600">Unità</TableHead>
                                    <TableHead className="w-44 text-xs font-semibold uppercase tracking-wide text-slate-600">Q.tà per confezione</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map((it, idx) => {
                                    const sameAsPrev = idx > 0 && visible[idx - 1].name === it.name;
                                    return (
                                        <TableRow key={it.id}>
                                            <TableCell className="truncate py-1.5">
                                                <Link
                                                    href={`/inventory/${it.id}`}
                                                    className={sameAsPrev ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}
                                                >
                                                    {sameAsPrev ? `↳ ${it.name}` : it.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="hidden truncate py-1.5 md:table-cell">{it.model || "-"}</TableCell>
                                            <TableCell className="hidden truncate py-1.5 md:table-cell">{it.brand || "-"}</TableCell>
                                            <TableCell className="py-1.5">{it.unit || "-"}</TableCell>
                                            <TableCell className="py-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        className="h-8 w-28"
                                                        inputMode="decimal"
                                                        placeholder="es. 18"
                                                        value={drafts[it.id] ?? (it.packQuantity !== null ? String(it.packQuantity) : "")}
                                                        onChange={e => setDrafts(d => ({ ...d, [it.id]: e.target.value }))}
                                                        onBlur={() => save(it)}
                                                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                                    />
                                                    {saving === it.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!loading && visible.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nessun articolo trovato</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

export default function ConfezioniPage() {
    return <ConfezioniContent />;
}
