"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { attendanceApi, Attendance } from "@/lib/api";
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";

interface JobAttendanceProps {
    jobId: string;
}

interface WeeklyData {
    weekLabel: string;
    weekStart: Date;
    weekEnd: Date;
    workerHours: Map<string, number>; // workerId -> hours
}

export function JobAttendance({ jobId }: JobAttendanceProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await attendanceApi.getByJobId(jobId);
                setAttendanceData(data);
            } catch (error) {
                console.error("Error loading job attendance:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [jobId]);

    const handlePrevMonth = () => {
        setCurrentMonth(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(addMonths(currentMonth, 1));
    };

    // Filter data for current month
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const monthData = attendanceData.filter(att => {
        const attDate = new Date(att.date);
        return attDate >= monthStart && attDate <= monthEnd;
    });

    // Get unique workers
    const workers = Array.from(
        new Map(
            monthData
                .filter(att => att.workerId && att.workerName)
                .map(att => [att.workerId, att.workerName!])
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
        const workerHours = new Map<string, number>();

        monthData.forEach(att => {
            const attDate = new Date(att.date);
            if (attDate >= weekStartDate && attDate <= weekEndDate && att.status === 'presence') {
                const current = workerHours.get(att.workerId) || 0;
                workerHours.set(att.workerId, current + (att.hours || 0));
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
    const workerTotals = new Map<string, number>();
    const weekTotals = weeklyData.map(week => {
        let weekTotal = 0;
        week.workerHours.forEach((hours, workerId) => {
            weekTotal += hours;
            const current = workerTotals.get(workerId) || 0;
            workerTotals.set(workerId, current + hours);
        });
        return weekTotal;
    });

    const grandTotal = Array.from(workerTotals.values()).reduce((sum, hours) => sum + hours, 0);

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
                                            const hours = week.workerHours.get(worker.id) || 0;
                                            return (
                                                <td key={idx} className="text-center p-3 text-slate-700 dark:text-slate-300">
                                                    {hours > 0 ? `${hours}h` : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className="text-center p-3 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                                            {workerTotals.get(worker.id) || 0}h
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
