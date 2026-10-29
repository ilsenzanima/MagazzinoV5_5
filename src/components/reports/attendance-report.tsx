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

    // Anni selezionabili: corrente e 4 precedenti
    const currentYear = new Date().getFullYear();
    const years = [0, 1, 2, 3, 4].map(i => currentYear - i);

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
            // Si mantiene il dipendente scelto; altrimenti il primo che ha registrazioni nel mese
            setSelectedWorkerId(prev =>
                prev && activeWorkers.some(w => w.id === prev)
                    ? prev
                    : (activeWorkers.find(w => attendanceData.some(a => a.workerId === w.id)) ?? activeWorkers[0])?.id ?? null
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

    // Prospetto di tutti i dipendenti: ore di lavoro e per tipo di assenza
    const COLUMNS: { key: string; label: string; match: (status: string) => boolean }[] = [
        { key: 'work', label: 'Lavoro', match: st => st === 'presence' || st === 'transfer' },
        { key: 'holiday', label: 'Ferie/Perm.', match: st => st === 'holiday' || st === 'permit' },
        { key: 'sick', label: 'Malattia', match: st => st === 'sick' },
        { key: 'injury', label: 'Infortunio', match: st => st === 'injury' },
        { key: 'course', label: 'Corso', match: st => st === 'course' },
        { key: 'other', label: 'Altro', match: st => ['strike', 'absence', 'medical_exam'].includes(st) },
    ];
    const prospect = workers.map(w => {
        const mine = attendance.filter(a => a.workerId === w.id);
        const cells = COLUMNS.map(c => mine.filter(a => c.match(a.status)).reduce((sum, a) => sum + a.hours, 0));
        return { worker: w, cells, total: cells.reduce((x, y) => x + y, 0) };
    });
    const prospectTotals = COLUMNS.map((_, i) => prospect.reduce((sum, r) => sum + r.cells[i], 0));

    // Ore di lavoro per cantiere o magazzino nel mese
    const byTarget = (() => {
        const map = new Map<string, { hours: number; workers: Set<string> }>();
        attendance.filter(a => a.status === 'presence' || a.status === 'transfer').forEach(a => {
            const label = getAttendanceLocation(a);
            const t = map.get(label) || { hours: 0, workers: new Set<string>() };
            t.hours += a.hours;
            t.workers.add(a.workerId);
            map.set(label, t);
        });
        return Array.from(map.entries()).sort((x, y) => y[1].hours - x[1].hours);
    })();
    const fmtH = (h: number) => (h === 0 ? '' : String(Math.round(h * 100) / 100).replace('.', ','));

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

            {/* Prospetto di tutti i dipendenti */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg dark:text-white">Prospetto ore - {monthLabel}</CardTitle>
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
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-muted">
                                        <th className="px-3 py-2 text-left">Dipendente</th>
                                        {COLUMNS.map(c => <th key={c.key} className="px-3 py-2 text-right">{c.label}</th>)}
                                        <th className="px-3 py-2 text-right">Totale</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prospect.map(r => (
                                        <tr
                                            key={r.worker.id}
                                            onClick={() => setSelectedWorkerId(r.worker.id)}
                                            className={cn(
                                                "cursor-pointer border-t dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800",
                                                r.worker.id === selectedWorkerId && "bg-blue-50 hover:bg-blue-50 dark:bg-blue-950"
                                            )}
                                        >
                                            <td className="px-3 py-2 font-medium dark:text-white">{r.worker.lastName} {r.worker.firstName}</td>
                                            {r.cells.map((h, i) => (
                                                <td key={COLUMNS[i].key} className={cn("px-3 py-2 text-right tabular-nums", i === 0 ? "font-semibold" : "text-slate-600 dark:text-slate-300")}>{fmtH(h)}</td>
                                            ))}
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtH(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 bg-slate-100 font-bold dark:bg-muted dark:border-slate-600">
                                        <td className="px-3 py-2">Totale</td>
                                        {prospectTotals.map((h, i) => <td key={COLUMNS[i].key} className="px-3 py-2 text-right tabular-nums">{fmtH(h)}</td>)}
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtH(prospectTotals.reduce((x, y) => x + y, 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Ore per cantiere / magazzino */}
            {byTarget.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg dark:text-white">Ore per cantiere - {monthLabel}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-muted">
                                        <th className="px-3 py-2 text-left">Cantiere / magazzino</th>
                                        <th className="px-3 py-2 text-right w-28">Ore</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byTarget.map(([label, t]) => (
                                        <tr key={label} className="border-t dark:border-slate-800">
                                            <td className="px-3 py-2">{label}</td>
                                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtH(t.hours)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Dettaglio giornaliero del dipendente selezionato */}
            {selectedWorker && (
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-lg dark:text-white">
                                Dettaglio giornaliero - {monthLabel}
                            </CardTitle>
                            <Select value={selectedWorker.id} onValueChange={setSelectedWorkerId}>
                                <SelectTrigger className="w-full sm:w-64">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {workers.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.lastName} {w.firstName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
