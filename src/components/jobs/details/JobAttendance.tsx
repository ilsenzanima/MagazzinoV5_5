"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { attendanceApi, correctionsApi, Attendance, AttendanceCorrection } from "@/lib/api";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, endOfWeek, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";

interface JobAttendanceProps {
    jobId: string;
}

interface WorkerHours {
    normal: number;
    transfer: number;
}

interface WeeklyData {
    weekLabel: string;
    weekStart: Date;
    weekEnd: Date;
    workerHours: Map<string, WorkerHours>;
}

export function JobAttendance({ jobId }: JobAttendanceProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
    const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [data, corr] = await Promise.all([
                    attendanceApi.getByJobId(jobId),
                    correctionsApi.getByJobId(jobId),
                ]);
                setAttendanceData(data);
                setCorrections(corr);
            } catch (error) {
                console.error("Error loading job attendance:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [jobId]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Merge corrections into attendance: adjust hours or add virtual entries
    const mergedData = useMemo(() => {
        const result = attendanceData.map(a => ({ ...a }));

        corrections.forEach(corr => {
            const idx = result.findIndex(a =>
                a.workerId === corr.workerId &&
                a.date === corr.date &&
                (a.status === 'presence' || a.status === 'transfer')
            );

            if (idx >= 0) {
                result[idx] = { ...result[idx], hours: Math.max(0, result[idx].hours + corr.hoursDelta) };
            } else if (corr.hoursDelta > 0) {
                // Virtual entry: correction for this job with no base attendance
                result.push({
                    id: `virtual_${corr.id}`,
                    workerId: corr.workerId,
                    workerName: corr.workerName,
                    jobId: corr.jobId,
                    date: corr.date,
                    hours: corr.hoursDelta,
                    status: 'presence',
                });
            }
        });

        return result.filter(a => a.hours > 0);
    }, [attendanceData, corrections]);

    // Worker names: from attendance + from corrections (which now include workerName via join)
    const workerNameMap = useMemo(() => {
        const map = new Map<string, string>();
        attendanceData.forEach(a => {
            if (a.workerId && a.workerName) map.set(a.workerId, a.workerName);
        });
        corrections.forEach(c => {
            if (c.workerId && c.workerName) map.set(c.workerId, c.workerName);
        });
        return map;
    }, [attendanceData, corrections]);

    // Filter data for current month
    const monthData = mergedData.filter(att => {
        const attDate = new Date(att.date);
        return attDate >= monthStart && attDate <= monthEnd;
    });

    // Get unique workers (from merged data in this month)
    const workers = Array.from(
        new Map(
            monthData
                .filter(att => att.workerId)
                .map(att => [att.workerId, att.workerName || workerNameMap.get(att.workerId) || att.workerId])
        ).entries()
    ).map(([id, name]) => ({ id, name }));

    // Get weeks in month
    const weeks = eachWeekOfInterval(
        { start: monthStart, end: monthEnd },
        { weekStartsOn: 1, locale: it }
    );

    // Calculate weekly data
    const weeklyData: WeeklyData[] = weeks.map(weekStartDate => {
        const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1, locale: it });
        const workerHours = new Map<string, WorkerHours>();

        monthData.forEach(att => {
            const attDate = new Date(att.date);
            if (attDate >= weekStartDate && attDate <= weekEndDate &&
                (att.status === 'presence' || att.status === 'transfer')) {
                const current = workerHours.get(att.workerId) || { normal: 0, transfer: 0 };
                if (att.status === 'transfer') {
                    workerHours.set(att.workerId, { ...current, transfer: current.transfer + (att.hours || 0) });
                } else {
                    workerHours.set(att.workerId, { ...current, normal: current.normal + (att.hours || 0) });
                }
            }
        });

        return {
            weekLabel: `${format(weekStartDate, 'dd/MM', { locale: it })} - ${format(weekEndDate, 'dd/MM', { locale: it })}`,
            weekStart: weekStartDate,
            weekEnd: weekEndDate,
            workerHours
        };
    });

    // Calculate totals
    const workerTotals = new Map<string, WorkerHours>();
    const weekTotals = weeklyData.map(week => {
        let weekTotal = 0;
        week.workerHours.forEach((hours, workerId) => {
            const total = hours.normal + hours.transfer;
            weekTotal += total;
            const current = workerTotals.get(workerId) || { normal: 0, transfer: 0 };
            workerTotals.set(workerId, { normal: current.normal + hours.normal, transfer: current.transfer + hours.transfer });
        });
        return weekTotal;
    });

    const grandTotal = Array.from(workerTotals.values()).reduce((sum, h) => sum + h.normal + h.transfer, 0);

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Ore Lavoro per Operaio</CardTitle>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                        {format(currentMonth, 'MMMM yyyy', { locale: it })}
                    </span>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {workers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        Nessuna presenza registrata per questo cantiere
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">
                                        Operaio
                                    </th>
                                    {weeklyData.map((week, idx) => (
                                        <th key={idx} className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                                            {week.weekLabel}
                                        </th>
                                    ))}
                                    <th className="text-center p-3 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                                        Totale
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.map(worker => (
                                    <tr key={worker.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                                            {worker.name}
                                        </td>
                                        {weeklyData.map((week, idx) => {
                                            const h = week.workerHours.get(worker.id);
                                            const total = h ? h.normal + h.transfer : 0;
                                            return (
                                                <td key={idx} className="text-center p-3 text-slate-700 dark:text-slate-300">
                                                    {total > 0 ? (
                                                        <div>
                                                            <div>{total}h</div>
                                                            {h && h.transfer > 0 && (
                                                                <div className="text-xs text-slate-400">{h.normal}h + {h.transfer}h (T)</div>
                                                            )}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className="text-center p-3 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                                            {(() => {
                                                const t = workerTotals.get(worker.id);
                                                const tot = t ? t.normal + t.transfer : 0;
                                                return (
                                                    <div>
                                                        <div>{tot}h</div>
                                                        {t && t.transfer > 0 && (
                                                            <div className="text-xs text-blue-400">{t.normal}h + {t.transfer}h (T)</div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
                                    <td className="p-3 text-slate-900 dark:text-slate-100">
                                        Totale Settimana
                                    </td>
                                    {weekTotals.map((total, idx) => (
                                        <td key={idx} className="text-center p-3 text-slate-900 dark:text-slate-100">
                                            {total > 0 ? `${total}h` : '-'}
                                        </td>
                                    ))}
                                    <td className="text-center p-3 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                                        {grandTotal}h
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
