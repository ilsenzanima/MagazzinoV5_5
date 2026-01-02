'use client';

import { Worker, Job, Attendance, attendanceApi, workerCoursesApi } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import AttendanceMonthGrid from "./AttendanceMonthGrid"; // New grid
import { AttendanceToolbar, AttendanceStatus } from "./AttendanceToolbar"; // New toolbar
import AssignmentModal from "./AssignmentModal";
import BulkAssignmentModal from "./BulkAssignmentModal";
import AttendanceInfoPopup from "./AttendanceInfoPopup";
import { CourseQuickSelectDialog } from "./CourseQuickSelectDialog";
import { generateMonthlyReport } from "./report-generator";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Users, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";

interface AttendanceClientProps {
    initialWorkers: Worker[];
    initialJobs: Job[];
}

export default function AttendanceClient({ initialWorkers, initialJobs }: AttendanceClientProps) {
    const { userRole } = useAuth();
    const canEdit = userRole === 'admin' || userRole === 'operativo';

    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTool, setSelectedTool] = useState<AttendanceStatus | 'delete' | null>(null);

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isInfoPopupOpen, setIsInfoPopupOpen] = useState(false);

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentAssignment, setCurrentAssignment] = useState<Attendance | null>(null);

    // Course quick-select dialog state
    const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
    const [pendingCourseEntry, setPendingCourseEntry] = useState<{ workerId: string, date: string } | null>(null);

    // Computed
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Fetch Data
    const loadData = async () => {
        setIsLoading(true);
        try {
            const year = monthStart.getFullYear();
            const month = monthStart.getMonth() + 1; // getMonth() is 0-indexed
            console.log('🔄 Loading data for:', year, 'month', month);
            const data = await attendanceApi.getByMonth(year, month);
            console.log('📊 Loaded attendance data:', data);
            const transfers = data.filter(a => a.status === 'transfer');
            console.log('🚗 Transfer entries:', transfers);
            setAttendanceList(data);
        } catch (error) {
            console.error("Failed to load attendance:", error);
            toast.error("Errore nel caricamento delle presenze");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentDate]);

    // Transform Data for Grid: Map<WorkerId, Map<DateStr, Attendance[]>>
    const attendanceMap = useMemo(() => {
        const map: Record<string, Record<string, Attendance[]>> = {};
        attendanceList.forEach(att => {
            if (!map[att.workerId]) {
                map[att.workerId] = {};
            }
            if (!map[att.workerId][att.date]) {
                map[att.workerId][att.date] = [];
            }
            map[att.workerId][att.date].push(att);
        });
        return map;
    }, [attendanceList]);

    // Handlers
    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleCellClick = async (worker: Worker, date: Date, assignments: Attendance[]) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Regular users can only view details, not edit
        if (!canEdit) {
            setSelectedWorker(worker);
            setSelectedDate(date);
            setIsInfoPopupOpen(true);
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

            // All quick-select tools use 8 hours by default
            const payload: Partial<Attendance> = {
                workerId: worker.id,
                date: dateStr,
                status: selectedTool,
                hours: 8,
                jobId: undefined
            };

            try {
                // Always append (manual insert) in manual mode, unless we want to prevent dups?
                // User said "add details... not overwritten but added".
                // So we always use addAttendance.
                await attendanceApi.addAttendance(payload);
                toast.success("Aggiunto", { duration: 1000, position: 'bottom-center' });
                loadData();
            } catch (e) {
                toast.error("Errore salvataggio");
            }
        } else {
            // NORMAL MODE: Open Info Popup
            setSelectedWorker(worker);
            setSelectedDate(date);
            setIsInfoPopupOpen(true);
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-card p-4 rounded-lg shadow-sm border dark:border-border">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-semibold w-48 text-center capitalize text-lg">
                        {format(monthStart, 'MMMM yyyy', { locale: it })}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="ml-2">
                        Oggi
                    </Button>
                </div>
                <div className="flex items-center space-x-4">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />}

                    <Button
                        variant="outline"
                        onClick={() => generateMonthlyReport(currentDate, initialWorkers, attendanceList)}
                        className="gap-2"
                    >
                        <FileDown className="h-4 w-4" />
                        PDF
                    </Button>

                    {canEdit && (
                        <Button onClick={() => setIsBulkModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <Users className="mr-2 h-4 w-4" />
                            Inserisci Presenze
                        </Button>
                    )}
                </div>
            </div>

            {canEdit && <AttendanceToolbar selectedTool={selectedTool} onSelectTool={setSelectedTool} />}

            <div className="bg-white dark:bg-card rounded-lg shadow-sm overflow-hidden border dark:border-border">
                <AttendanceMonthGrid
                    currentDate={currentDate}
                    workers={initialWorkers}
                    attendanceMap={attendanceMap}
                    onCellClick={handleCellClick}
                    selectedTool={selectedTool}
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

            <AttendanceInfoPopup
                isOpen={isInfoPopupOpen}
                onClose={() => setIsInfoPopupOpen(false)}
                worker={selectedWorker}
                date={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null}
                assignments={
                    selectedWorker && selectedDate
                        ? attendanceMap[selectedWorker.id]?.[format(selectedDate, 'yyyy-MM-dd')] || []
                        : []
                }
                onEdit={(assignment) => {
                    setCurrentAssignment(assignment);
                    setIsInfoPopupOpen(false);
                    setIsModalOpen(true);
                }}
                onDelete={handleDelete}
                onAddPresence={() => {
                    setIsInfoPopupOpen(false);
                    setIsBulkModalOpen(true);
                }}
            />

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
