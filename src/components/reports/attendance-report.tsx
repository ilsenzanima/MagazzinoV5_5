"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Users } from "lucide-react";
import { attendanceApi, workersApi, Attendance, Worker } from "@/lib/api";
import { generateMonthlyReport } from "@/components/attendance/report-generator";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const MONTHS = [
    { value: 0, label: "Gennaio" },
    { value: 1, label: "Febbraio" },
    { value: 2, label: "Marzo" },
    { value: 3, label: "Aprile" },
    { value: 4, label: "Maggio" },
    { value: 5, label: "Giugno" },
    { value: 6, label: "Luglio" },
    { value: 7, label: "Agosto" },
    { value: 8, label: "Settembre" },
    { value: 9, label: "Ottobre" },
    { value: 10, label: "Novembre" },
    { value: 11, label: "Dicembre" }
];

export default function AttendanceReport() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Generate year options (current year and 2 previous)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [workersData, attendanceData] = await Promise.all([
                workersApi.getAll(),
                attendanceApi.getByMonth(selectedYear, selectedMonth + 1) // month is 1-indexed in API
            ]);

            // Filter only active workers
            const activeWorkers = workersData.filter(w => w.isActive);
            setWorkers(activeWorkers);
            setAttendance(attendanceData);
        } catch (err) {
            console.error("Error loading attendance data:", err);
            setError("Errore nel caricamento dei dati presenze");
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePDF = async () => {
        if (workers.length === 0) return;

        try {
            setGenerating(true);
            const targetDate = new Date(selectedYear, selectedMonth, 1);
            generateMonthlyReport(targetDate, workers, attendance);
        } catch (err) {
            console.error("Error generating PDF:", err);
            setError("Errore nella generazione del PDF");
        } finally {
            setGenerating(false);
        }
    };

    // Calculate summary stats
    const totalHours = attendance
        .filter(a => a.status === 'presence' || a.status === 'transfer')
        .reduce((sum, a) => sum + a.hours, 0);

    const absenceHours = attendance
        .filter(a => !['presence', 'transfer'].includes(a.status))
        .reduce((sum, a) => sum + a.hours, 0);

    const monthLabel = format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy', { locale: it });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Month/Year Selection */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex gap-3 items-center">
                            <Select
                                value={selectedMonth.toString()}
                                onValueChange={(v) => setSelectedMonth(parseInt(v))}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Mese" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map(m => (
                                        <SelectItem key={m.value} value={m.value.toString()}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={selectedYear.toString()}
                                onValueChange={(v) => setSelectedYear(parseInt(v))}
                            >
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Anno" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(y => (
                                        <SelectItem key={y} value={y.toString()}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={handleGeneratePDF}
                            disabled={generating || workers.length === 0}
                            className="gap-2"
                        >
                            {generating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileDown className="h-4 w-4" />
                            )}
                            Genera PDF
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-4 text-center text-red-600">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="px-4 py-3">
                    <p className="text-sm text-slate-500">Dipendenti Attivi</p>
                    <p className="text-2xl font-bold">{workers.length}</p>
                </Card>
                <Card className="px-4 py-3">
                    <p className="text-sm text-slate-500">Registrazioni</p>
                    <p className="text-2xl font-bold">{attendance.length}</p>
                </Card>
                <Card className="px-4 py-3 bg-emerald-50 border-emerald-200">
                    <p className="text-sm text-emerald-600">Ore Lavorate</p>
                    <p className="text-2xl font-bold text-emerald-700">{totalHours}</p>
                </Card>
                <Card className="px-4 py-3 bg-amber-50 border-amber-200">
                    <p className="text-sm text-amber-600">Ore Assenze</p>
                    <p className="text-2xl font-bold text-amber-700">{absenceHours}</p>
                </Card>
            </div>

            {/* Workers Preview */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Dipendenti - {monthLabel}</CardTitle>
                </CardHeader>
                <CardContent>
                    {workers.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                            <p>Nessun dipendente attivo trovato.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {workers.map(worker => {
                                const workerAttendance = attendance.filter(a => a.workerId === worker.id);
                                const workerHours = workerAttendance
                                    .filter(a => a.status === 'presence' || a.status === 'transfer')
                                    .reduce((sum, a) => sum + a.hours, 0);

                                return (
                                    <div key={worker.id} className="p-3 border rounded-lg bg-slate-50">
                                        <p className="font-medium">{worker.lastName} {worker.firstName}</p>
                                        <p className="text-sm text-slate-500">
                                            {workerHours} ore lavorate
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
