"use client"

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { purchaseAuditApi, PackItem } from "@/lib/services/purchase-audit";

export default function ConfezioniPage() {
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
                    <Card>
                        <CardHeader>
                            <CardTitle>Quantità per confezione</CardTitle>
                            <CardDescription>
                                Quanti pezzi, metri o chili ci sono normalmente in una confezione, nell&apos;unità dell&apos;articolo.
                                Si salva da solo uscendo dal campo o premendo Invio. Serve al Controllo Acquisti per segnalare
                                prezzi o quantità che non tornano con la confezione.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <Input
                                className="sm:w-72"
                                placeholder="Cerca per nome, modello, marca o codice..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={onlyMissing} onCheckedChange={v => setOnlyMissing(v === true)} />
                                Solo senza quantità
                            </label>
                            <Button variant="outline" onClick={load} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Ricarica
                            </Button>
                            {!loading && !error && (
                                <span className="text-sm text-muted-foreground">
                                    {filledCount} di {items.length} compilati · {visible.length} mostrati
                                </span>
                            )}
                        </CardContent>
                    </Card>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Errore</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardContent className="overflow-x-auto p-0">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-background">
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <th className="px-3 py-2">Articolo</th>
                                        <th className="px-3 py-2">Modello</th>
                                        <th className="px-3 py-2">Marca</th>
                                        <th className="px-3 py-2">Unità</th>
                                        <th className="px-3 py-2">Quantità per confezione</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((it, idx) => {
                                        const sameAsPrev = idx > 0 && visible[idx - 1].name === it.name;
                                        return (
                                            <tr key={it.id} className="border-b last:border-0">
                                                <td className="px-3 py-1.5">
                                                    <Link
                                                        href={`/inventory/${it.id}`}
                                                        className={sameAsPrev ? "text-muted-foreground hover:underline" : "font-medium hover:underline"}
                                                    >
                                                        {sameAsPrev ? `↳ ${it.name}` : it.name}
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-1.5">{it.model || "-"}</td>
                                                <td className="px-3 py-1.5">{it.brand || "-"}</td>
                                                <td className="px-3 py-1.5">{it.unit || "-"}</td>
                                                <td className="px-3 py-1.5">
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
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!loading && visible.length === 0 && (
                                        <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nessun articolo trovato</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </DashboardLayout>
    );
}
