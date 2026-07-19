"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, Users, MapPin } from "lucide-react";
import { attendanceApi, workersApi, Attendance, Worker } from "@/lib/api";
import { generateMonthlyReport } from "@/components/attendance/report-generator";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

const ABSENCE_LABELS: Record<string, string> = {
    holiday: 'Ferie',
    permit: 'Permesso',
    sick: 'Malattia',
    injury: 'Infortunio',
    course: 'Corso',
    strike: 'Sciopero',
    absence: 'Assenza Ingiustificata',
    medical_exam: 'Visita Medica',
};

function getAttendanceLocation(a: Attendance): string {
    if (a.status === 'presence' || a.status === 'transfer') {
        if (a.jobId) return a.jobName || a.jobDescription || a.jobCode || 'Commessa';
        if (a.warehouseId) return a.warehouseName || 'Magazzino';
        return '—';
    }
    return ABSENCE_LABELS[a.status] ?? a.status;
}

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
    const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

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
            setSelectedWorkerId(prev =>
                prev && activeWorkers.some(w => w.id === prev) ? prev : (activeWorkers[0]?.id ?? null)
            );
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

    const selectedWorker = workers.find(w => w.id === selectedWorkerId) ?? null;

    // Righe giorno per giorno per il dipendente selezionato: comprende ogni registrazione
    // (presenze, trasferte, magazzino, ferie, malattie, ecc.). Se in uno stesso giorno ci
    // sono più registrazioni, vengono aggiunte più righe lasciando vuoto il riferimento al
    // giorno per le righe successive alla prima.
    const selectedWorkerRows = (() => {
        if (!selectedWorkerId) return [];
        const entries = attendance
            .filter(a => a.workerId === selectedWorkerId)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date));

        let lastDate = '';
        return entries.map(a => {
            const isFirstOfDay = a.date !== lastDate;
            lastDate = a.date;
            const day = new Date(`${a.date}T00:00:00`);
            const isWork = a.status === 'presence' || a.status === 'transfer';
            return {
                id: a.id,
                dayNumber: isFirstOfDay ? format(day, 'd') : '',
                dayName: isFirstOfDay ? format(day, 'EEEE', { locale: it }) : '',
                hours: a.hours,
                isTransfer: a.status === 'transfer',
                isWork,
                location: getAttendanceLocation(a),
            };
        });
    })();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
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
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <CardContent className="pt-4 text-center text-red-600 dark:text-red-400">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="px-4 py-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Dipendenti Attivi</p>
                    <p className="text-2xl font-bold dark:text-white">{workers.length}</p>
                </Card>
                <Card className="px-4 py-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Registrazioni</p>
                    <p className="text-2xl font-bold dark:text-white">{attendance.length}</p>
                </Card>
                <Card className="px-4 py-3 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">Ore Lavorate</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalHours}</p>
                </Card>
                <Card className="px-4 py-3 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                    <p className="text-sm text-amber-600 dark:text-amber-400">Ore Assenze</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{absenceHours}</p>
                </Card>
            </div>

            {/* Workers Preview */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg dark:text-white">Dipendenti - {monthLabel}</CardTitle>
                    {workers.length > 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Clicca su un dipendente per vedere il dettaglio giornaliero qui sotto.
                        </p>
                    )}
                </CardHeader>
                <CardContent>
                    {workers.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            <Users className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                            <p>Nessun dipendente attivo trovato.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {workers.map(worker => {
                                const workerAttendance = attendance.filter(a => a.workerId === worker.id);
                                const workerHours = workerAttendance
                                    .filter(a => a.status === 'presence' || a.status === 'transfer')
                                    .reduce((sum, a) => sum + a.hours, 0);
                                const isSelected = worker.id === selectedWorkerId;

                                return (
                                    <button
                                        key={worker.id}
                                        type="button"
                                        onClick={() => setSelectedWorkerId(worker.id)}
                                        className={cn(
                                            "text-left p-3 border rounded-lg transition-colors",
                                            isSelected
                                                ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400 dark:bg-blue-950 dark:border-blue-600"
                                                : "bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        <p className="font-medium dark:text-white">{worker.lastName} {worker.firstName}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {workerHours} ore lavorate
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dettaglio giornaliero del dipendente selezionato */}
            {selectedWorker && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg dark:text-white">
                            {selectedWorker.lastName} {selectedWorker.firstName} - {monthLabel}
                        </CardTitle>
                        {selectedWorkerRows.length > 0 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Le righe evidenziate sono ferie, malattie e altre assenze.
                            </p>
                        )}
                    </CardHeader>
                    <CardContent>
                        {selectedWorkerRows.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                <MapPin className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                <p>Nessuna registrazione presente in questo mese.</p>
                            </div>
                        ) : (
                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white dark:bg-slate-900">
                                        <tr className="border-b dark:border-slate-700 text-left text-slate-500 dark:text-slate-400">
                                            <th className="py-2 pr-2 font-medium w-32">Giorno</th>
                                            <th className="py-2 pr-2 font-medium w-24">Ore</th>
                                            <th className="py-2 pr-2 font-medium">Presso</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedWorkerRows.map(row => (
                                            <tr
                                                key={row.id}
                                                className={cn(
                                                    "border-b dark:border-slate-800",
                                                    !row.isWork && "bg-amber-50/60 dark:bg-amber-950/20"
                                                )}
                                            >
                                                <td className="py-2 pr-2 dark:text-white">
                                                    {row.dayNumber && (
                                                        <span className="font-medium">
                                                            {row.dayNumber} <span className="capitalize text-slate-500 dark:text-slate-400">{row.dayName}</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={cn("py-2 pr-2", row.isWork ? "dark:text-slate-300" : "text-amber-700 dark:text-amber-300")}>
                                                    {row.hours}{row.isTransfer ? " (Trasferta)" : ""}
                                                </td>
                                                <td className="py-2 pr-2 dark:text-slate-300">{row.location}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
