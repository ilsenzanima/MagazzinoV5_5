'use client';

import { Worker, Job, Attendance, attendanceApi, workerCoursesApi, workerMedicalExamsApi } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import AttendanceMonthGrid from "./AttendanceMonthGrid"; // New grid
import { AttendanceToolbar, AttendanceStatus } from "./AttendanceToolbar"; // New toolbar
import AssignmentModal from "./AssignmentModal";
import BulkAssignmentModal from "./BulkAssignmentModal";
import DayDetailPanel from "./DayDetailPanel";
import { CourseQuickSelectDialog } from "./CourseQuickSelectDialog";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { warehousesApi } from "@/lib/services/warehouses";
import type { Warehouse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Users, Filter, X, FilePlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AttendanceClientProps {
    initialWorkers: Worker[];
    initialJobs: Job[];
}

export default function AttendanceClient({ initialWorkers, initialJobs }: AttendanceClientProps) {
    const { userRole } = useAuth();
    const canEdit = userRole === 'admin' || userRole === 'operativo';
    const { isMobile } = useIsMobile();

    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTool, setSelectedTool] = useState<AttendanceStatus | 'delete' | null>(null);

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [quickJobId, setQuickJobId] = useState("");
    const [quickHours, setQuickHours] = useState(8);
    // Riepilogo sempre mensile: su telefono la griglia ha solo la settimana, quindi il mese si legge a parte
    const [mobileMonthEntries, setMobileMonthEntries] = useState<Attendance[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    useEffect(() => {
        warehousesApi.getAll().then(setWarehouses).catch(console.error);
    }, []);

    useEffect(() => {
        if (!isMobile || !selectedWorker) return;
        let cancelled = false;
        attendanceApi.getByRange(format(startOfMonth(currentDate), 'yyyy-MM-dd'), format(endOfMonth(currentDate), 'yyyy-MM-dd'))
            .then(rows => { if (!cancelled) setMobileMonthEntries(rows.filter(r => r.workerId === selectedWorker.id)); })
            .catch(console.error);
        return () => { cancelled = true; };
    }, [isMobile, selectedWorker, currentDate, attendanceList]);

    // Dove si può registrare una presenza: commesse attive e magazzini
    const targets = useMemo(() => [
        ...initialJobs.map(j => ({ value: j.id, label: `${j.code} - ${j.name}` })),
        ...warehouses.map(w => ({ value: w.id, label: `📦 ${w.name}` })),
    ], [initialJobs, warehouses]);
    const targetFields = (id: string) => warehouses.some(w => w.id === id) ? { warehouseId: id } : { jobId: id };
    const sameTarget = (a: Attendance, id: string) => a.jobId === id || a.warehouseId === id;

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentAssignment, setCurrentAssignment] = useState<Attendance | null>(null);

    // Course quick-select dialog state
    const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
    const [pendingCourseEntry, setPendingCourseEntry] = useState<{ workerId: string, date: string } | null>(null);

    // Job filter state
    const [filterJobId, setFilterJobId] = useState<string | null>(null);

    // Computed: vista settimanale su mobile, mensile su desktop
    const viewStart = isMobile ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
    const viewEnd = isMobile ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);
    const monthStart = startOfMonth(currentDate); // usato solo per il report PDF mensile
    const days = useMemo(() => eachDayOfInterval({ start: viewStart, end: viewEnd }), [viewStart, viewEnd]);

    // Fetch Data
    const loadData = async () => {
        setIsLoading(true);
        try {
            const startDate = format(viewStart, 'yyyy-MM-dd');
            const endDate = format(viewEnd, 'yyyy-MM-dd');
            setAttendanceList(await attendanceApi.getByRange(startDate, endDate));
        } catch (error) {
            console.error("Failed to load attendance:", error);
            toast.error("Errore nel caricamento delle presenze");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDate, isMobile]);

    const mergedAttendanceList = attendanceList;

    // Transform Data for Grid: Map<WorkerId, Map<DateStr, Attendance[]>>
    const attendanceMap = useMemo(() => {
        const map: Record<string, Record<string, Attendance[]>> = {};
        mergedAttendanceList.forEach(att => {
            if (!map[att.workerId]) {
                map[att.workerId] = {};
            }
            if (!map[att.workerId][att.date]) {
                map[att.workerId][att.date] = [];
            }
            map[att.workerId][att.date].push(att);
        });
        return map;
    }, [mergedAttendanceList]);

    // Get unique jobs that have attendance records this month
    const jobsInMonth = useMemo(() => {
        const jobMap = new Map<string, { id: string; code: string; name: string; description: string }>();
        mergedAttendanceList.forEach(att => {
            if (att.jobId && att.jobCode) {
                jobMap.set(att.jobId, {
                    id: att.jobId,
                    code: att.jobCode,
                    name: att.jobName || att.jobDescription || '',
                    description: att.jobDescription || ''
                });
            }
        });
        return Array.from(jobMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    }, [mergedAttendanceList]);

    // Filtered attendance map when job filter is active
    const filteredAttendanceMap = useMemo(() => {
        if (!filterJobId) return attendanceMap;

        const filtered: Record<string, Record<string, Attendance[]>> = {};
        Object.entries(attendanceMap).forEach(([workerId, dates]) => {
            Object.entries(dates).forEach(([date, attendances]) => {
                const matchingAttendances = attendances.filter(a => a.jobId === filterJobId);
                if (matchingAttendances.length > 0) {
                    if (!filtered[workerId]) filtered[workerId] = {};
                    filtered[workerId][date] = matchingAttendances;
                }
            });
        });
        return filtered;
    }, [attendanceMap, filterJobId]);

    // Handlers
    const handlePrevMonth = () => setCurrentDate(isMobile ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(isMobile ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleCellClick = async (worker: Worker, date: Date, assignments: Attendance[]) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Regular users can only view details, not edit
        if (!canEdit) {
            setSelectedWorker(worker);
            setSelectedDate(date);
            return;
        }

        // DELETE MODE
        if (selectedTool === 'delete') {
            if (assignments.length === 0) return;
            try {
                // Delete ALL for day
                await attendanceApi.deleteAllForDay(worker.id, dateStr);
                toast.success("Cella svuotata", { duration: 1000, position: 'bottom-center' });
                loadData();
            } catch (e) {
                toast.error("Errore cancellazione");
            }
            return;
        }

        // PAINT MODE (Insert/Append)
        if (selectedTool) {
            // For course status, show dialog to select course
            if (selectedTool === 'course') {
                setPendingCourseEntry({ workerId: worker.id, date: dateStr });
                setIsCourseDialogOpen(true);
                return;
            }

            // Cantiere a scelta rapida: se la persona è già su quel cantiere nel giorno, si sommano le ore
            if (selectedTool === 'presence') {
                if (!quickJobId) return;
                const existing = assignments.find(a => a.status === 'presence' && sameTarget(a, quickJobId));
                try {
                    if (existing) await attendanceApi.update(existing.id, { ...existing, hours: Math.min(24, existing.hours + quickHours) });
                    else await attendanceApi.addAttendance({ workerId: worker.id, date: dateStr, status: 'presence', hours: quickHours, ...targetFields(quickJobId) });
                    toast.success(existing ? "Ore aggiunte" : "Aggiunto", { duration: 1000, position: 'bottom-center' });
                    loadData();
                } catch (e) {
                    toast.error("Errore salvataggio");
                }
                return;
            }

            // All quick-select tools use 8 hours by default
            const payload: Partial<Attendance> = {
                workerId: worker.id,
                date: dateStr,
                status: selectedTool,
                hours: 8,
                jobId: undefined
            };

            try {
                await attendanceApi.addAttendance(payload);

                // Auto-create medical exam record when painting medical_exam
                if (selectedTool === 'medical_exam') {
                    try {
                        const existingExams = await workerMedicalExamsApi.getByWorkerId(worker.id);
                        const alreadyExists = existingExams.some(e => e.examDate === dateStr);
                        if (!alreadyExists) {
                            const nextExamDate = format(addMonths(new Date(dateStr), 12), 'yyyy-MM-dd');
                            await workerMedicalExamsApi.create({
                                workerId: worker.id,
                                examDate: dateStr,
                                nextExamDate: nextExamDate
                            });
                        }
                    } catch (examError) {
                        console.error('⚠️ Failed to create medical exam record:', examError);
                        toast.warning("Presenza salvata, ma la creazione della visita medica è fallita");
                    }
                }

                toast.success("Aggiunto", { duration: 1000, position: 'bottom-center' });
                loadData();
            } catch (e) {
                toast.error("Errore salvataggio");
            }
        } else {
            // NORMAL MODE: dettaglio della giornata nel pannello in fondo
            setSelectedWorker(worker);
            setSelectedDate(date);
        }
    };


    const handleSave = async (data: Partial<Attendance>, repeatUntil?: Date) => {
        try {
            const promises = [];

            if (data.id) {
                // Update is not yet in API, we need it. 
                // I'll call a non-existent `update` and fix API immediately.
                // @ts-ignore
                promises.push(attendanceApi.update(data.id, data));
            } else {
                promises.push(attendanceApi.addAttendance(data));
            }

            if (repeatUntil && data.date) {
                let runnerDate = new Date(data.date);
                runnerDate.setDate(runnerDate.getDate() + 1);
                while (runnerDate <= repeatUntil) {
                    const payload = { ...data, date: format(runnerDate, 'yyyy-MM-dd'), id: undefined };
                    promises.push(attendanceApi.addAttendance(payload));
                    runnerDate.setDate(runnerDate.getDate() + 1);
                }
            }

            await Promise.all(promises);
            toast.success("Salvato");
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Errore durante il salvataggio");
        }
    };


    const handleBulkSave = async (workerIds: string[], startDate: Date, endDate: Date, entries: Partial<Attendance>[]) => {
        try {
            console.log('🔵 Starting bulk save with entries:', entries);
            const promises = [];
            for (const wId of workerIds) {
                let runnerDate = new Date(startDate);
                while (runnerDate <= endDate) {
                    const dateStr = format(runnerDate, 'yyyy-MM-dd');
                    // Create one attendance record for EACH entry
                    for (const entry of entries) {
                        const payload = {
                            ...entry,
                            workerId: wId,
                            date: dateStr
                        };
                        console.log('📝 Saving entry:', payload);
                        promises.push(attendanceApi.addAttendance(payload));

                        // Auto-create course record if status is course
                        if (entry.status === 'course' && entry.courseName) {
                            try {
                                await workerCoursesApi.upsertByName(wId, entry.courseName, dateStr, 5);
                                console.log('📚 Created/updated course record for worker:', wId);
                            } catch (courseError) {
                                console.error('⚠️ Failed to create course record:', courseError);
                                toast.warning("Presenza salvata, ma la creazione del corso è fallita");
                            }
                        }

                        // Auto-create medical exam record if status is medical_exam
                        if (entry.status === 'medical_exam') {
                            try {
                                // Check if worker already has a medical exam for this date
                                const existingExams = await workerMedicalExamsApi.getByWorkerId(wId);
                                const alreadyExists = existingExams.some(e => e.examDate === dateStr);

                                if (!alreadyExists) {
                                    // Create new medical exam record with 12-month validity
                                    const nextExamDate = format(addMonths(new Date(dateStr), 12), 'yyyy-MM-dd');
                                    await workerMedicalExamsApi.create({
                                        workerId: wId,
                                        examDate: dateStr,
                                        nextExamDate: nextExamDate
                                    });
                                    console.log('🏥 Created medical exam record for worker:', wId);
                                }
                            } catch (examError) {
                                console.error('⚠️ Failed to create medical exam record:', examError);
                                // Don't fail the whole operation, just log the error
                                toast.warning("Presenza salvata, ma la creazione della visita medica è fallita");
                            }
                        }
                    }
                    runnerDate.setDate(runnerDate.getDate() + 1);
                }
            }
            console.log(`🔵 Total promises to execute: ${promises.length}`);
            const results = await Promise.all(promises);
            console.log('✅ All entries saved:', results);
            toast.success(`Assegnazione completata`);
            await loadData(); // Ensure data is reloaded before closing
        } catch (error) {
            console.error('❌ Error during bulk save:', error);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));
            toast.error("Errore salvataggio multiplo");
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await attendanceApi.delete(id);
            toast.success("Eliminato");
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Errore");
        }
    };

    // Ore di una voce: +/- mezz'ora o un'ora, subito a schermo e poi salvate
    const handleChangeHours = async (entry: Attendance, delta: number) => {
        const hours = Math.min(24, Math.max(0.5, entry.hours + delta));
        if (hours === entry.hours) return;
        setAttendanceList(list => list.map(a => a.id === entry.id ? { ...a, hours } : a));
        try {
            await attendanceApi.update(entry.id, { ...entry, hours });
        } catch (error) {
            console.error(error);
            toast.error("Errore salvataggio ore");
            loadData();
        }
    };

    const handleAddToDay = async (jobId: string, hours: number) => {
        if (!selectedWorker || !selectedDate) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const existing = attendanceMap[selectedWorker.id]?.[dateStr]?.find(a => a.status === 'presence' && sameTarget(a, jobId));
        try {
            if (existing) await attendanceApi.update(existing.id, { ...existing, hours: Math.min(24, existing.hours + hours) });
            else await attendanceApi.addAttendance({ workerId: selectedWorker.id, date: dateStr, status: 'presence', hours, ...targetFields(jobId) });
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Errore salvataggio");
        }
    };

    const handleCourseConfirm = async (courseName: string) => {
        if (!pendingCourseEntry) return;

        try {
            // First, create/update the course in worker_courses table
            // Use today's date as completion date, default 1 year validity
            await workerCoursesApi.upsertByName(
                pendingCourseEntry.workerId,
                courseName,
                pendingCourseEntry.date, // Use attendance date as completion date
                5 // Default 5 years validity
            );

            // Then save the attendance record
            const payload: Partial<Attendance> = {
                workerId: pendingCourseEntry.workerId,
                date: pendingCourseEntry.date,
                status: 'course' as const,
                hours: 8,
                notes: `Corso: ${courseName}`
            };

            await attendanceApi.addAttendance(payload);
            toast.success(`Corso "${courseName}" aggiunto e registrato`, { duration: 1500, position: 'bottom-center' });
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Errore salvataggio corso");
        } finally {
            setPendingCourseEntry(null);
        }
    };

    return (
        <div className="space-y-4 min-w-0">
            <ListPageHeader
                title="Presenze / Assenze"
                actions={
                    <>
                        <Link href="/attendance/request" className="flex-1 sm:flex-none">
                            <Button variant="outline" className="w-full gap-2">
                                <FilePlus className="h-4 w-4" />
                                Richiesta Permesso
                            </Button>
                        </Link>
                        {canEdit && (
                            <Button onClick={() => setIsBulkModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 sm:flex-none">
                                <Users className="mr-2 h-4 w-4" />
                                Inserisci Presenze
                            </Button>
                        )}
                    </>
                }
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center justify-center space-x-2">
                        <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Periodo precedente">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="font-semibold w-48 text-center capitalize text-lg">
                            {isMobile
                                ? (viewStart.getMonth() === viewEnd.getMonth()
                                    ? `${format(viewStart, 'd')} - ${format(viewEnd, 'd MMMM yyyy', { locale: it })}`
                                    : `${format(viewStart, 'd MMM', { locale: it })} - ${format(viewEnd, 'd MMM yyyy', { locale: it })}`)
                                : format(monthStart, 'MMMM yyyy', { locale: it })}
                        </div>
                        <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Periodo successivo">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleToday} className="ml-2">
                            Oggi
                        </Button>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />}
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 shrink-0 text-slate-500" />
                        <Select
                            value={filterJobId || "all"}
                            onValueChange={(val) => setFilterJobId(val === "all" ? null : val)}
                        >
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder="Tutti i cantieri" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tutti i cantieri</SelectItem>
                                {jobsInMonth.length === 0 ? (
                                    <SelectItem value="none" disabled>
                                        Nessun cantiere nel mese
                                    </SelectItem>
                                ) : (
                                    jobsInMonth.map(job => (
                                        <SelectItem key={job.id} value={job.id}>
                                            {job.code} - {job.name}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        {filterJobId && (
                            <Button variant="ghost" size="icon" onClick={() => setFilterJobId(null)} aria-label="Rimuovi filtro" className="shrink-0 text-slate-600">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </ListPageHeader>

            {canEdit && <AttendanceToolbar
                selectedTool={selectedTool}
                onSelectTool={setSelectedTool}
                targets={targets}
                quickJobId={quickJobId}
                onQuickJobChange={setQuickJobId}
                quickHours={quickHours}
                onQuickHoursChange={d => setQuickHours(h => Math.min(24, Math.max(0.5, h + d)))}
            />}

            <div className="bg-white dark:bg-card rounded-lg shadow-sm border dark:border-border overflow-hidden">
                <AttendanceMonthGrid
                    days={days}
                    workers={initialWorkers}
                    attendanceMap={filteredAttendanceMap}
                    onCellClick={handleCellClick}
                    selectedTool={selectedTool}
                    focus={selectedWorker && selectedDate ? { workerId: selectedWorker.id, date: format(selectedDate, 'yyyy-MM-dd') } : null}
                />
            </div>

            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                * Clicca su uno strumento per attivare la modalità inserimento rapido. "Elimina" svuota l'intera giornata.
                <br />
                * Doppio click apre i dettagli.
            </div>

            <AssignmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                worker={selectedWorker}
                date={selectedDate}
                currentAssignment={currentAssignment}
                jobs={initialJobs}
            />

            <BulkAssignmentModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSave={handleBulkSave}
                workers={initialWorkers}
                jobs={initialJobs}
                preselectedWorkerId={selectedWorker?.id}
                preselectedDate={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined}
            />

            {selectedWorker && selectedDate && (
                <DayDetailPanel
                    worker={selectedWorker}
                    date={selectedDate}
                    entries={attendanceMap[selectedWorker.id]?.[format(selectedDate, 'yyyy-MM-dd')] || []}
                    periodEntries={isMobile ? mobileMonthEntries : days.flatMap(d => attendanceMap[selectedWorker.id]?.[format(d, 'yyyy-MM-dd')] || [])}
                    periodLabel={format(monthStart, 'MMMM yyyy', { locale: it })}
                    targets={targets}
                    canEdit={canEdit}
                    onChangeHours={handleChangeHours}
                    onEdit={(assignment) => { setCurrentAssignment(assignment); setIsModalOpen(true); }}
                    onDelete={handleDelete}
                    onAdd={handleAddToDay}
                    onClose={() => { setSelectedWorker(null); setSelectedDate(null); }}
                />
            )}

            <CourseQuickSelectDialog
                open={isCourseDialogOpen}
                onOpenChange={(open) => {
                    setIsCourseDialogOpen(open);
                    if (!open) setPendingCourseEntry(null);
                }}
                onConfirm={handleCourseConfirm}
            />
        </div>
    );
}
