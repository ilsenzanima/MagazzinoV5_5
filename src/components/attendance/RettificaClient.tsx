'use client';

import { Worker, Attendance, AttendanceCorrection, attendanceApi, correctionsApi } from "@/lib/api";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWeekend } from "date-fns";
import { it } from "date-fns/locale";
import { isItalianHoliday } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RettificaClientProps {
    initialWorkers: Worker[];
}

interface Column {
    id: string;
    label: string;
    type: 'job' | 'warehouse';
}

// key: `${workerId}_${date}_${jobId|warehouseId}`
type CorrectionMap = Map<string, number>;

export default function RettificaClient({ initialWorkers }: RettificaClientProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkers[0]?.id || '');
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
    const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Pending edits before save: key -> draft value string
    const [draftMap, setDraftMap] = useState<Map<string, string>>(new Map());
    // Saving state per key
    const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

    // useMemo ensures monthStart is a stable reference unless currentDate actually changes
    const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
    const days = useMemo(
        () => eachDayOfInterval({ start: monthStart, end: endOfMonth(currentDate) }),
        [monthStart, currentDate]
    );

    const selectedWorker = useMemo(
        () => initialWorkers.find(w => w.id === selectedWorkerId) || null,
        [initialWorkers, selectedWorkerId]
    );

    const loadData = useCallback(async () => {
        if (!selectedWorkerId) return;
        setIsLoading(true);
        setDraftMap(new Map());
        try {
            const year = monthStart.getFullYear();
            const month = monthStart.getMonth() + 1;
            const [att, corr] = await Promise.all([
                attendanceApi.getByMonth(year, month),
                correctionsApi.getByWorkerMonth(selectedWorkerId, year, month),
            ]);
            setAttendanceList(att.filter(a => a.workerId === selectedWorkerId));
            setCorrections(corr);
        } catch {
            toast.error("Errore nel caricamento dei dati");
        } finally {
            setIsLoading(false);
        }
    }, [selectedWorkerId, monthStart]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Build columns: jobs first (sorted by code), then warehouses - only where worker has presenze OR corrections
    const columns = useMemo<Column[]>(() => {
        const jobMap = new Map<string, string>();
        const warehouseMap = new Map<string, string>();

        attendanceList.forEach(a => {
            if (a.status === 'presence' || a.status === 'transfer') {
                if (a.jobId) jobMap.set(a.jobId, a.jobName || a.jobDescription || a.jobCode || a.jobId);
                if (a.warehouseId) warehouseMap.set(a.warehouseId, a.warehouseName || 'Magazzino');
            }
        });

        corrections.forEach(c => {
            if (c.jobId) jobMap.set(c.jobId, c.jobName || c.jobCode || c.jobId);
            if (c.warehouseId) warehouseMap.set(c.warehouseId, c.warehouseName || 'Magazzino');
        });

        const jobCols: Column[] = Array.from(jobMap.entries())
            .map(([id, label]) => ({ id, label, type: 'job' as const }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const whCols: Column[] = Array.from(warehouseMap.entries())
            .map(([id, label]) => ({ id, label, type: 'warehouse' as const }));

        return [...jobCols, ...whCols];
    }, [attendanceList, corrections]);

    // Base hours map: date -> columnId -> hours
    const baseHoursMap = useMemo(() => {
        const map = new Map<string, Map<string, number>>();
        attendanceList.forEach(a => {
            if (a.status !== 'presence' && a.status !== 'transfer') return;
            const colId = a.jobId || a.warehouseId;
            if (!colId) return;
            if (!map.has(a.date)) map.set(a.date, new Map());
            const existing = map.get(a.date)!.get(colId) || 0;
            map.get(a.date)!.set(colId, existing + a.hours);
        });
        return map;
    }, [attendanceList]);

    // Saved corrections map: date -> columnId -> hoursDelta
    const savedCorrMap = useMemo<CorrectionMap>(() => {
        const map = new Map<string, number>();
        corrections.forEach(c => {
            const colId = c.jobId || c.warehouseId;
            if (!colId) return;
            map.set(`${c.date}_${colId}`, c.hoursDelta);
        });
        return map;
    }, [corrections]);

    const getCorrKey = (date: string, colId: string) => `${date}_${colId}`;

    const getDraftValue = (date: string, colId: string): string => {
        const key = getCorrKey(date, colId);
        if (draftMap.has(key)) return draftMap.get(key)!;
        const saved = savedCorrMap.get(key);
        return saved !== undefined && saved !== 0 ? String(saved) : '';
    };

    const handleDraftChange = (date: string, colId: string, value: string) => {
        setDraftMap(prev => {
            const next = new Map(prev);
            next.set(getCorrKey(date, colId), value);
            return next;
        });
    };

    const handleSave = async (date: string, col: Column) => {
        const key = getCorrKey(date, col.id);
        const rawValue = draftMap.get(key);
        if (rawValue === undefined) return; // no change

        const parsed = parseFloat(rawValue.replace(',', '.'));
        const delta = isNaN(parsed) ? 0 : Math.round(parsed * 2) / 2; // round to nearest 0.5

        const saveKey = key;
        setSavingKeys(prev => new Set(prev).add(saveKey));
        try {
            await correctionsApi.upsert(
                selectedWorkerId,
                date,
                delta,
                col.type === 'job' ? col.id : undefined,
                col.type === 'warehouse' ? col.id : undefined
            );
            // Remove draft after save
            setDraftMap(prev => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            await loadData();
        } catch {
            toast.error("Errore nel salvataggio della rettifica");
        } finally {
            setSavingKeys(prev => {
                const next = new Set(prev);
                next.delete(saveKey);
                return next;
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, date: string, col: Column) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            handleSave(date, col);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header: month selector + worker selector */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-card p-4 rounded-lg shadow-sm border dark:border-border">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-semibold w-48 text-center capitalize text-lg">
                        {format(monthStart, 'MMMM yyyy', { locale: it })}
                    </div>
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-3">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                    <span className="text-sm text-slate-600 dark:text-slate-400">Operaio:</span>
                    <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                        <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Seleziona operaio" />
                        </SelectTrigger>
                        <SelectContent>
                            {initialWorkers.map(w => (
                                <SelectItem key={w.id} value={w.id}>
                                    {w.lastName} {w.firstName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-slate-100 border" />
                    Ore presenze (sola lettura)
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-white border border-orange-300" />
                    Rettifica (delta, multipli di 0,5)
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded bg-orange-50 border border-orange-200" />
                    Totale = presenze + rettifica
                </span>
            </div>

            {columns.length === 0 && !isLoading ? (
                <div className="bg-white dark:bg-card rounded-lg border p-8 text-center text-slate-500">
                    {selectedWorker
                        ? `Nessuna presenza trovata per ${selectedWorker.lastName} ${selectedWorker.firstName} nel mese selezionato.`
                        : 'Seleziona un operaio per visualizzare le presenze.'}
                </div>
            ) : (
                <div className="bg-white dark:bg-card rounded-lg shadow-sm border dark:border-border overflow-x-auto">
                    <table className="text-xs border-collapse min-w-full">
                        <thead>
                            <tr>
                                {/* Day column */}
                                <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 p-2 text-left font-semibold min-w-[90px] whitespace-nowrap">
                                    Giorno
                                </th>
                                {columns.map(col => (
                                    <th
                                        key={col.id}
                                        colSpan={2}
                                        className={cn(
                                            "border dark:border-slate-700 p-2 text-center font-semibold min-w-[120px]",
                                            col.type === 'warehouse'
                                                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300"
                                                : "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
                                        )}
                                    >
                                        {col.label}
                                        {col.type === 'warehouse' && (
                                            <span className="ml-1 text-xs font-normal opacity-70">(magazzino)</span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 p-1" />
                                {columns.map(col => (
                                    <React.Fragment key={col.id}>
                                        <th className="border dark:border-slate-700 p-1 text-center text-slate-500 font-normal bg-slate-50 dark:bg-slate-800 w-[55px]">
                                            Ore
                                        </th>
                                        <th className="border dark:border-slate-700 p-1 text-center text-orange-600 font-normal bg-orange-50/50 dark:bg-orange-900/10 w-[65px]">
                                            Rettifica
                                        </th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isWknd = isWeekend(day);
                                const isHoliday = isItalianHoliday(day);
                                const dayLabel = format(day, 'd', { locale: it });
                                const dayName = format(day, 'EEE', { locale: it }).toUpperCase();

                                const rowBg = isHoliday
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : isWknd
                                        ? 'bg-slate-50 dark:bg-slate-800/50'
                                        : 'bg-white dark:bg-card';

                                const textColor = isHoliday
                                    ? 'text-red-600 dark:text-red-400'
                                    : isWknd
                                        ? 'text-slate-400 dark:text-slate-500'
                                        : 'text-slate-800 dark:text-slate-200';

                                return (
                                    <tr key={dateStr} className={rowBg}>
                                        <td className={cn(
                                            "sticky left-0 z-10 border dark:border-slate-700 p-2 font-medium whitespace-nowrap",
                                            rowBg, textColor,
                                            "shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
                                        )}>
                                            {dayLabel} {dayName}
                                            {isHoliday && <span className="ml-1 text-xs">(F)</span>}
                                        </td>

                                        {columns.map(col => {
                                            const baseHours = baseHoursMap.get(dateStr)?.get(col.id) || 0;
                                            const savedDelta = savedCorrMap.get(getCorrKey(dateStr, col.id)) || 0;
                                            const total = baseHours + savedDelta;
                                            const draftVal = getDraftValue(dateStr, col.id);
                                            const isSaving = savingKeys.has(getCorrKey(dateStr, col.id));
                                            const hasDraft = draftMap.has(getCorrKey(dateStr, col.id));

                                            return (
                                                <React.Fragment key={col.id}>
                                                    {/* Base hours cell (readonly) */}
                                                    <td
                                                        className={cn(
                                                            "border dark:border-slate-700 p-1 text-center text-slate-600 dark:text-slate-400",
                                                            "bg-slate-100/60 dark:bg-slate-800/40 w-[55px]",
                                                            isHoliday && "bg-red-50/50",
                                                            isWknd && "bg-slate-100/80"
                                                        )}
                                                    >
                                                        {baseHours > 0 ? baseHours : ''}
                                                    </td>

                                                    {/* Correction input cell */}
                                                    <td
                                                        className={cn(
                                                            "border dark:border-slate-700 p-0.5 text-center w-[65px]",
                                                            savedDelta !== 0 && "bg-orange-50 dark:bg-orange-900/10",
                                                            hasDraft && "bg-yellow-50 dark:bg-yellow-900/10"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-0.5">
                                                            <input
                                                                type="number"
                                                                step="0.5"
                                                                value={draftVal}
                                                                disabled={isSaving}
                                                                onChange={e => handleDraftChange(dateStr, col.id, e.target.value)}
                                                                onBlur={() => handleSave(dateStr, col)}
                                                                onKeyDown={e => handleKeyDown(e, dateStr, col)}
                                                                className={cn(
                                                                    "w-full text-center text-xs py-0.5 px-1 rounded border",
                                                                    "border-orange-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-400 outline-none",
                                                                    "bg-white dark:bg-card dark:border-orange-700",
                                                                    "disabled:opacity-50",
                                                                    savedDelta !== 0 && !hasDraft && "text-orange-700 font-medium"
                                                                )}
                                                                placeholder="0"
                                                            />
                                                            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-orange-500 shrink-0" />}
                                                        </div>
                                                        {total !== baseHours && total !== 0 && (
                                                            <div className="text-orange-600 font-semibold text-[10px] mt-0.5">
                                                                = {total}
                                                            </div>
                                                        )}
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* Totals row */}
                        {columns.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                                    <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border dark:border-slate-700 p-2 text-slate-700 dark:text-slate-300">
                                        TOTALE
                                    </td>
                                    {columns.map(col => {
                                        let totalBase = 0;
                                        let totalCorr = 0;
                                        days.forEach(day => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            totalBase += baseHoursMap.get(dateStr)?.get(col.id) || 0;
                                            totalCorr += savedCorrMap.get(getCorrKey(dateStr, col.id)) || 0;
                                        });
                                        return (
                                            <React.Fragment key={col.id}>
                                                <td className="border dark:border-slate-700 p-2 text-center text-slate-700 dark:text-slate-300">
                                                    {totalBase > 0 ? totalBase : ''}
                                                </td>
                                                <td className={cn(
                                                    "border dark:border-slate-700 p-2 text-center",
                                                    totalCorr !== 0 ? "text-orange-700 dark:text-orange-400" : "text-slate-400"
                                                )}>
                                                    {totalCorr !== 0 ? (totalCorr > 0 ? `+${totalCorr}` : totalCorr) : ''}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            <div className="text-xs text-slate-400 px-1">
                * Inserisci il delta (es. +1, -0.5). Conferma con Enter o Tab, oppure clicca fuori dalla cella.
                <br />
                * Se la rettifica porta le ore a 0, verrà rimossa. Per rimuovere una rettifica imposta il valore a 0.
            </div>
        </div>
    );
}
