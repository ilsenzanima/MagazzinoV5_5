"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageStrip, NotchHelp, NotchActions, NotchSearch, NotchButton } from "@/components/ui/notch-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import {
  JobAnalysis,
  JobOption,
  MAX_COMPARED_JOBS,
  TimelineMode,
  analyticsApi,
  analyzeJob,
  buildComparisonRows,
  buildTimeline,
} from "@/lib/services/analytics";

// Un colore per commessa, nello stesso ordine in tabella, riepilogo e grafici
const JOB_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#9333ea", "#0891b2", "#e11d48"];

const TH = "text-xs font-semibold uppercase tracking-wide text-slate-600";

const STATUS_LABEL: Record<string, string> = { active: "Attiva", completed: "Completata" };

const formatDate = (d: Date | null): string => (d ? d.toLocaleDateString("it-IT") : "—");

const jobLabel = (job: JobOption): string => (job.title ? `${job.code} · ${job.title}` : job.code);

export function AnalyticsContent({ embedded = false }: { embedded?: boolean }) {
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, JobAnalysis>>({});
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [mode, setMode] = useState<TimelineMode>("calendar");

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .getJobOptions()
      .then((result) => { if (!cancelled) setJobs(result); })
      .catch((err) => {
        console.error("Errore caricamento commesse:", err);
        if (!cancelled) setJobsError(true);
      })
      .finally(() => { if (!cancelled) setJobsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // I movimenti si scaricano una sola volta per commessa, anche se la si toglie e rimette
  const loadJob = useCallback((id: string) => {
    setLoadError(false);
    setLoadingIds((prev) => [...prev, id]);
    analyticsApi
      .getJobMovements(id)
      .then((rows) => setAnalyses((prev) => ({ ...prev, [id]: analyzeJob(id, rows) })))
      .catch((err) => {
        console.error("Errore caricamento movimenti commessa:", err);
        setLoadError(true);
        setSelectedIds((prev) => prev.filter((x) => x !== id));
      })
      .finally(() => setLoadingIds((prev) => prev.filter((x) => x !== id)));
  }, []);

  const toggleJob = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= MAX_COMPARED_JOBS) return;
    setSelectedIds([...selectedIds, id]);
    if (!analyses[id]) loadJob(id);
  };

  const colorOf = (id: string): string => JOB_COLORS[selectedIds.indexOf(id) % JOB_COLORS.length];

  const selectedAnalyses = useMemo(
    () => selectedIds.map((id) => analyses[id]).filter((a): a is JobAnalysis => !!a),
    [selectedIds, analyses]
  );

  const allRows = useMemo(() => buildComparisonRows(selectedAnalyses), [selectedAnalyses]);

  const rows = useMemo(() => {
    const words = itemSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return allRows.filter((row) => {
      if (hideZero && selectedAnalyses.every((a) => !row.byJob[a.jobId] || Math.abs(row.byJob[a.jobId].net) < 0.001)) {
        return false;
      }
      if (words.length === 0) return true;
      const target = `${row.name} ${row.code} ${row.model}`.toLowerCase();
      return words.every((w) => target.includes(w));
    });
  }, [allRows, itemSearch, hideZero, selectedAnalyses]);

  // Se l'articolo scelto non compare più (commessa tolta) si torna alla panoramica
  const selectedRow = allRows.find((r) => r.key === selectedItemKey) || null;

  const timeline = useMemo(
    () => buildTimeline(selectedAnalyses, selectedRow ? selectedRow.key : null, mode),
    [selectedAnalyses, selectedRow, mode]
  );

  const pickerJobs = useMemo(() => {
    const words = jobSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return jobs;
    return jobs.filter((j) => {
      const target = `${j.code} ${j.title} ${j.clientName}`.toLowerCase();
      return words.every((w) => target.includes(w));
    });
  }, [jobs, jobSearch]);

  const loading = loadingIds.length > 0;
  const limitReached = selectedIds.length >= MAX_COMPARED_JOBS;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        <PageStrip embedded={embedded} title="Analisi spostamenti">
          <NotchHelp
            title="Analisi spostamenti"
            lines={["Scegli una o più commesse: vedi quali materiali sono andati e quali sono rientrati, la quantità reale rimasta in commessa e come cambia nel tempo."]}
          />
          <NotchActions>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <NotchButton type="button" disabled={jobsLoading || jobsError}>
                    {jobsLoading ? "Carico le commesse…" : "Scegli le commesse"}
                    <ChevronsUpDown />
                  </NotchButton>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[26rem] max-w-[90vw] p-0">
                  <div className="p-2 border-b relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      placeholder="Cerca per codice, nome o committente"
                      className="pl-8"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {pickerJobs.length === 0 && (
                      <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nessuna commessa trovata.</p>
                    )}
                    {pickerJobs.map((job) => {
                      const checked = selectedIds.includes(job.id);
                      const disabled = !checked && limitReached;
                      return (
                        <label
                          key={job.id}
                          className={cn(
                            "flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-accent",
                            disabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleJob(job.id)} className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{jobLabel(job)}</span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {[job.clientName, STATUS_LABEL[job.status]].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {limitReached && (
                    <p className="px-3 py-2 border-t text-xs text-muted-foreground">
                      Puoi confrontare al massimo {MAX_COMPARED_JOBS} commesse alla volta.
                    </p>
                  )}
                </PopoverContent>
              </Popover>

              {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-300" />}
              {selectedAnalyses.length > 0 && <NotchSearch value={itemSearch} onChange={setItemSearch} placeholder="Cerca articolo o codice" />}
              {selectedAnalyses.length > 0 && (
                <NotchButton type="button" onClick={() => setHideZero(v => !v)} className={hideZero ? "ring-2 ring-blue-400" : undefined}>
                  Nascondi i rientrati del tutto
                </NotchButton>
              )}
              {selectedAnalyses.length > 0 && <span className="text-xs text-slate-300">{rows.length} articoli</span>}
          </NotchActions>
        </PageStrip>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm"
                style={{ borderColor: colorOf(id) }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(id) }} />
                {jobById.get(id)?.code || id}
                <button type="button" aria-label="Togli la commessa" onClick={() => toggleJob(id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {(jobsError || loadError) && (
          <p className="flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="h-4 w-4" />
            {jobsError ? "Impossibile caricare l'elenco delle commesse." : "Impossibile caricare i movimenti di una commessa. Riprova."}
          </p>
        )}

        {selectedIds.length === 0 && !jobsLoading && !jobsError && (
          <p className="py-10 text-center text-slate-500">Scegli almeno una commessa per iniziare.</p>
        )}

        {selectedAnalyses.length > 0 && (
          <>
            {/* Riepilogo per commessa */}
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <Table className="min-w-[760px] border-collapse [&_td]:px-2 [&_th]:px-2">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                    <TableHead className={TH}>Commessa</TableHead>
                    <TableHead className={`w-48 ${TH}`}>Committente</TableHead>
                    <TableHead className={`w-28 ${TH}`}>Stato</TableHead>
                    <TableHead className={`w-32 text-right ${TH}`}>In commessa</TableHead>
                    <TableHead className={`w-28 text-right ${TH}`}>Con rientri</TableHead>
                    <TableHead className={`w-28 text-right ${TH}`}>Movimenti</TableHead>
                    <TableHead className={`w-48 ${TH}`}>Periodo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedAnalyses.map((analysis) => {
                    const job = jobById.get(analysis.jobId);
                    const inJob = analysis.items.filter((i) => Math.abs(i.net) >= 0.001).length;
                    const withReturns = analysis.items.filter((i) => i.returned > 0).length;
                    const empty = analysis.movementCount === 0;
                    return (
                      <TableRow key={analysis.jobId}>
                        <TableCell className="py-1.5 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(analysis.jobId) }} />
                            {job ? jobLabel(job) : analysis.jobId}
                          </span>
                        </TableCell>
                        <TableCell className="truncate py-1.5">{job?.clientName || "—"}</TableCell>
                        <TableCell className="py-1.5">{job && STATUS_LABEL[job.status] ? <Badge variant="outline">{STATUS_LABEL[job.status]}</Badge> : "—"}</TableCell>
                        {empty ? (
                          <TableCell colSpan={4} className="py-1.5 text-muted-foreground">Nessun movimento di magazzino su questa commessa.</TableCell>
                        ) : (
                          <>
                            <TableCell className="py-1.5 text-right">{inJob} su {analysis.items.length}</TableCell>
                            <TableCell className="py-1.5 text-right">{withReturns}</TableCell>
                            <TableCell className="py-1.5 text-right">{analysis.movementCount}</TableCell>
                            <TableCell className="whitespace-nowrap py-1.5 text-muted-foreground">{formatDate(analysis.firstDate)} – {formatDate(analysis.lastDate)}</TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Andamento nel tempo */}
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
                <div>
                  <CardTitle>
                    {selectedRow ? `Quantità in commessa: ${selectedRow.name}` : "Attività nel tempo"}
                  </CardTitle>
                  <CardDescription>
                    {selectedRow
                      ? `Quantità reale in ${selectedRow.unit} (andata meno rientrata), mese per mese. Clicca di nuovo la riga per tornare alla panoramica.`
                      : "Numero di movimenti per mese. Clicca un articolo nella tabella per vedere la sua quantità reale nel tempo."}
                  </CardDescription>
                </div>
                <Select value={mode} onValueChange={(v) => setMode(v as TimelineMode)}>
                  <SelectTrigger className="w-full sm:w-56" aria-label="Asse del tempo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">Mesi reali</SelectItem>
                    <SelectItem value="fromStart">Dall&apos;inizio di ogni commessa</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="h-[320px] min-h-[320px] min-w-[100px]">
                {timeline.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">Nessun movimento da mostrare.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {selectedRow ? (
                      <LineChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatNumber(Number(v))} width={60} />
                        <Tooltip formatter={(v) => `${formatNumber(Number(v))} ${selectedRow.unit}`} />
                        <Legend />
                        {selectedAnalyses.map((a) => (
                          <Line
                            key={a.jobId}
                            type="stepAfter"
                            dataKey={a.jobId}
                            name={jobById.get(a.jobId)?.code || a.jobId}
                            stroke={colorOf(a.jobId)}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} width={40} />
                        <Tooltip formatter={(v) => `${formatNumber(Number(v))} movimenti`} />
                        <Legend />
                        {selectedAnalyses.map((a) => (
                          <Bar
                            key={a.jobId}
                            dataKey={a.jobId}
                            name={jobById.get(a.jobId)?.code || a.jobId}
                            fill={colorOf(a.jobId)}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Materiali e confronto */}
            <div className="space-y-1">
              <p className="px-1 text-xs text-muted-foreground">
                Materiali in commessa: quantità reale (andata meno rientrata). Gli acquisti fatti direttamente sulla commessa contano come andati.
              </p>
                {rows.length === 0 ? (
                  <p className="rounded-xl border bg-card py-8 text-center text-sm text-slate-500 shadow-sm">
                    {allRows.length === 0 ? "Nessun movimento sulle commesse scelte." : "Nessun articolo corrisponde ai filtri."}
                  </p>
                ) : (
                  <div className="max-h-[600px] overflow-auto rounded-xl border bg-card shadow-sm">
                    <Table className="border-collapse [&_td]:px-2 [&_th]:px-2">
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                          <TableHead className={`min-w-56 ${TH}`}>Articolo</TableHead>
                          {selectedAnalyses.map((a) => (
                            <TableHead key={a.jobId} className={`min-w-40 text-right ${TH}`}>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(a.jobId) }} />
                                {jobById.get(a.jobId)?.code || a.jobId}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow
                            key={row.key}
                            onClick={() => setSelectedItemKey(selectedItemKey === row.key ? null : row.key)}
                            className={cn("cursor-pointer", selectedRow?.key === row.key && "bg-accent")}
                          >
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.code}{row.model ? ` · ${row.model}` : ""}{row.isFictitious ? " · fittizio" : ""}
                              </div>
                            </TableCell>
                            {selectedAnalyses.map((a) => {
                              const s = row.byJob[a.jobId];
                              if (!s) {
                                return <TableCell key={a.jobId} className="text-right text-muted-foreground">—</TableCell>;
                              }
                              return (
                                <TableCell key={a.jobId} className="text-right">
                                  <div className={cn("font-medium", s.net < -0.001 && "text-red-600")}>
                                    {formatNumber(s.net)} {s.unit}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    andati {formatNumber(s.sent)} · rientrati {formatNumber(s.returned)}
                                  </div>
                                  {s.netPieces !== null && Math.abs(s.netPieces - s.net) > 0.001 && (
                                    <div className="text-xs text-muted-foreground">= {formatNumber(s.netPieces)} pz</div>
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function AnalyticsPage() {
    return <AnalyticsContent />;
}
