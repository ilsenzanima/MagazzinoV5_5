"use client"

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import type { Movement } from "@/lib/types";
import {
    monthlyUsage, pricePoints, PurchaseStatRow, USAGE_START_YEAR, usageYears, yearlyPurchases,
} from "@/lib/utils/item-stats";

interface ItemStatsProps {
    itemId: string;
    unit: string;
    movements: Movement[];
    showPrices: boolean;   // i prezzi sono visibili solo ad admin e operativi
}

const MONTHS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const BLUE = "#2a78d6";
const GRID = "#e1e0d9";
const TICK = "#898781";

const eur = (n: number | null) => n == null ? "—" : n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const num = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });

// Statistiche dell'articolo: acquisti per anno, andamento del prezzo e utilizzo mensile
export function ItemStats({ itemId, unit, movements, showPrices }: ItemStatsProps) {
    const [rows, setRows] = useState<PurchaseStatRow[] | null>(null);
    const [error, setError] = useState(false);
    const [usageYear, setUsageYear] = useState(Math.max(new Date().getFullYear(), USAGE_START_YEAR));

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data, error: err } = await supabase
                .from("purchase_items")
                .select("quantity, price, returned_quantity, exclude_from_reference, purchases!inner(order_type, delivery_note_date, created_at, deleted_at)")
                .eq("item_id", itemId);
            if (cancelled) return;
            if (err) { setError(true); return; }
            const list: PurchaseStatRow[] = [];
            for (const r of (data || []) as any[]) {
                const p = Array.isArray(r.purchases) ? r.purchases[0] : r.purchases;
                if (!p || p.deleted_at || p.order_type === "order") continue;
                const date = p.delivery_note_date || p.created_at;
                if (!date) continue;
                list.push({
                    date: String(date),
                    quantity: Number(r.quantity) || 0,
                    returnedQuantity: Number(r.returned_quantity) || 0,
                    price: r.price != null ? Number(r.price) : null,
                    excluded: r.exclude_from_reference === true,
                });
            }
            setRows(list);
        })();
        return () => { cancelled = true; };
    }, [itemId]);

    const years = useMemo(() => yearlyPurchases(rows || []), [rows]);
    const points = useMemo(() => pricePoints(rows || []).map(p => ({ label: `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}/${p.date.slice(2, 4)}`, price: p.price })), [rows]);
    const availableYears = useMemo(() => usageYears(movements), [movements]);
    const usage = useMemo(() => monthlyUsage(movements, usageYear).map((v, i) => ({ month: MONTHS[i], value: v })), [movements, usageYear]);
    const usageTotal = usage.reduce((s, m) => s + m.value, 0);

    if (error) return <Card><CardContent className="py-8 text-center text-slate-400">Impossibile caricare le statistiche.</CardContent></Card>;
    if (!rows) return <Card><CardContent className="py-8 text-center text-slate-400">Caricamento statistiche...</CardContent></Card>;

    const withoutPriceNew = years.filter(y => y.year >= USAGE_START_YEAR).reduce((s, y) => s + y.withoutPrice, 0);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Acquisti per anno</CardTitle></CardHeader>
                <CardContent>
                    {years.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-400">Nessun acquisto registrato per questo articolo.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Anno</TableHead>
                                        <TableHead className="text-right">Acquisti</TableHead>
                                        <TableHead className="text-right">Quantità ({unit})</TableHead>
                                        {showPrices && <><TableHead className="text-right">Prezzo medio</TableHead><TableHead className="text-right">Min – max</TableHead><TableHead className="text-right">Speso</TableHead></>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {years.map(y => (
                                        <TableRow key={y.year}>
                                            <TableCell className="font-medium">{y.year}</TableCell>
                                            <TableCell className="text-right">
                                                {y.purchases}
                                                {showPrices && y.withoutPrice > 0 && <span className="ml-1 text-[10px] text-amber-600" title="Acquisti senza prezzo">({y.withoutPrice} senza prezzo)</span>}
                                            </TableCell>
                                            <TableCell className="text-right">{num(y.quantity)}</TableCell>
                                            {showPrices && (
                                                <>
                                                    <TableCell className="text-right">{eur(y.avgPrice)}</TableCell>
                                                    <TableCell className="text-right text-slate-500">{y.minPrice == null ? "—" : `${num(y.minPrice)} – ${num(y.maxPrice as number)}`}</TableCell>
                                                    <TableCell className="text-right">{eur(y.spent)}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {showPrices && withoutPriceNew > 0 && (
                        <p className="mt-2 text-xs text-slate-500">Dal {USAGE_START_YEAR}: {withoutPriceNew} acquisti senza prezzo, in attesa della fattura. Entrano nella quantità ma non nel prezzo medio.</p>
                    )}
                </CardContent>
            </Card>

            <div className={`grid gap-4 ${showPrices ? "lg:grid-cols-2" : ""}`}>
                {showPrices && (
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Prezzo di acquisto nel tempo (€/{unit})</CardTitle></CardHeader>
                        <CardContent>
                            {points.length < 2 ? (
                                <p className="py-10 text-center text-sm text-slate-400">Servono almeno due acquisti con prezzo per vedere l&apos;andamento.</p>
                            ) : (
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                            <CartesianGrid stroke={GRID} vertical={false} />
                                            <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} tickLine={false} minTickGap={24} />
                                            <YAxis tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                                            <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(l) => `Acquisto del ${l}`} />
                                            <Line type="monotone" dataKey="price" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base">Uscite per mese ({unit})</CardTitle>
                            {availableYears.length > 1 && (
                                <div className="flex gap-1">
                                    {availableYears.map(y => (
                                        <Button key={y} size="sm" variant={y === usageYear ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => setUsageYear(y)}>{y}</Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={usage} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke={GRID} vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: TICK, fontSize: 11 }} tickLine={false} interval={0} />
                                    <YAxis tick={{ fill: TICK, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip formatter={(v) => `${num(Number(v))} ${unit}`} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                                    <Bar dataKey="value" fill={BLUE} radius={[3, 3, 0, 0]} maxBarSize={22} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Totale {usageYear}: <span className="font-medium">{num(usageTotal)} {unit}</span>. Contano le uscite, le vendite e gli scarti; dal {USAGE_START_YEAR}, quando sono partite le bolle di movimentazione.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
