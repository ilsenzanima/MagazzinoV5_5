"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsumptionAnalytics, FORECAST_ALERT_DAYS, analyticsApi } from "@/lib/services/analytics";
import { formatNumber } from "@/lib/utils/format";

const MONTH_NAMES = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const PERIOD_OPTIONS = [3, 6, 12];
const TOP_LIMIT = 10;
const BAR_COLOR = "#2563eb";

// 'yyyy-MM' -> 'ott 26'
const monthLabel = (key: string): string => {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year.slice(2)}`;
};

const shorten = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export default function AnalyticsPage() {
  const [data, setData] = useState<ConsumptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unit, setUnit] = useState<string>("");
  const [periodMonths, setPeriodMonths] = useState<number>(6);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .getConsumptionAnalytics()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => {
        console.error("Errore caricamento analisi consumi:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Unità di misura ordinate dal consumo totale più alto: sommare MQ e PZ non avrebbe senso
  const units = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    data.items.forEach((item) => {
      totals.set(item.unit, (totals.get(item.unit) || 0) + item.monthly.reduce((s, q) => s + q, 0));
    });
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).map(([u]) => u);
  }, [data]);

  const activeUnit = unit && units.includes(unit) ? unit : units[0] || "";

  const monthlyChart = useMemo(() => {
    if (!data) return [];
    const items = data.items.filter((item) => item.unit === activeUnit);
    return data.months.map((month, idx) => ({
      month: monthLabel(month),
      quantity: Math.round(items.reduce((sum, item) => sum + item.monthly[idx], 0) * 100) / 100,
    }));
  }, [data, activeUnit]);

  const topItems = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((item) => item.unit === activeUnit)
      .map((item) => ({
        ...item,
        total: item.monthly.slice(-periodMonths).reduce((sum, q) => sum + q, 0),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_LIMIT)
      .map((item) => ({
        id: item.id,
        label: shorten(item.code ? `${item.code} · ${item.name}` : item.name, 34),
        quantity: Math.round(item.total * 100) / 100,
      }));
  }, [data, activeUnit, periodMonths]);

  const hasData = !!data && data.items.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Analisi consumi</h1>
            <p className="text-sm text-muted-foreground">
              Basata sulle uscite di magazzino (bolle di uscita e vendite) degli ultimi 12 mesi.
            </p>
          </div>
          {hasData && (
            <div className="flex gap-3">
              <Select value={activeUnit} onValueChange={setUnit}>
                <SelectTrigger className="w-32" aria-label="Unità di misura">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(periodMonths)} onValueChange={(v) => setPeriodMonths(Number(v))}>
                <SelectTrigger className="w-40" aria-label="Periodo classifica">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>Ultimi {m} mesi</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 py-10 justify-center text-red-500 text-sm">
            <AlertTriangle className="h-4 w-4" /> Errore nel caricamento dei dati. Ricarica la pagina.
          </div>
        )}

        {!loading && !error && !hasData && (
          <p className="py-10 text-center text-slate-500">Nessuna uscita registrata negli ultimi 12 mesi.</p>
        )}

        {!loading && !error && hasData && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Consumi mensili</CardTitle>
                  <CardDescription>Totale uscite in {activeUnit}, mese per mese.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] min-h-[320px] min-w-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(Number(v))} width={60} />
                      <Tooltip formatter={(v) => [`${formatNumber(Number(v))} ${activeUnit}`, "Consumo"]} />
                      <Bar dataKey="quantity" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Articoli più usati</CardTitle>
                  <CardDescription>
                    I {TOP_LIMIT} articoli con più uscite in {activeUnit} negli ultimi {periodMonths} mesi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px] min-h-[320px] min-w-[100px]">
                  {topItems.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-slate-500 text-sm">Nessuna uscita nel periodo.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItems} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(Number(v))} />
                        <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${formatNumber(Number(v))} ${activeUnit}`, "Consumo"]} />
                        <Bar dataKey="quantity" fill={BAR_COLOR} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Articoli in esaurimento</CardTitle>
                <CardDescription>
                  Stima basata sul consumo medio degli ultimi 90 giorni: articoli che finiscono entro {FORECAST_ALERT_DAYS} giorni.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data!.forecast.length === 0 ? (
                  <p className="text-sm text-slate-500">Nessun articolo previsto in esaurimento nei prossimi {FORECAST_ALERT_DAYS} giorni.</p>
                ) : (
                  <div className="divide-y">
                    {data!.forecast.slice(0, 30).map((f) => {
                      const days = Math.max(0, Math.floor(f.daysLeft));
                      return (
                        <Link
                          key={f.id}
                          href={`/inventory/${f.id}`}
                          className="flex items-center justify-between gap-4 py-3 hover:bg-accent/50 -mx-2 px-2 rounded-md transition-colors"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-medium truncate">{f.code ? `${f.code} · ${f.name}` : f.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              In magazzino: {formatNumber(f.stock)} {f.unit} · consumo medio {formatNumber(f.dailyRate, { maximumFractionDigits: 2 })} {f.unit}/giorno
                            </span>
                          </span>
                          <Badge
                            variant="outline"
                            className={days <= 14 ? "text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20" : "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20"}
                          >
                            ~{days} giorni
                          </Badge>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
