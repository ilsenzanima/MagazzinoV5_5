'use client';

import { Worker, Job, Attendance, attendanceApi } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import AttendanceMonthGrid from "./AttendanceMonthGrid"; // New grid
import { AttendanceToolbar, AttendanceStatus } from "./AttendanceToolbar"; // New toolbar
import AssignmentModal from "./AssignmentModal";
import BulkAssignmentModal from "./BulkAssignmentModal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface AttendanceClientProps {
    initialWorkers: Worker[];
    initialJobs: Job[];
}

export default function AttendanceClient({ initialWorkers, initialJobs }: AttendanceClientProps) {
    // State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTool, setSelectedTool] = useState<AttendanceStatus | null>(null);

    // Modals State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentAssignment, setCurrentAssignment] = useState<Attendance | null>(null);

    // Computed
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Fetch Data
    const loadData = async () => {
        setIsLoading(true);
        try {
            const startStr = format(monthStart, 'yyyy-MM-dd');
            const endStr = format(monthEnd, 'yyyy-MM-dd');
            const data = await attendanceApi.getByDateRange(startStr, endStr);
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

    // Transform Data for Grid
    const attendanceMap = useMemo(() => {
        const map: Record<string, Record<string, Attendance>> = {};
        attendanceList.forEach(att => {
            if (!map[att.workerId]) {
                map[att.workerId] = {};
            }
            map[att.workerId][att.date] = att;
        });
        return map;
    }, [attendanceList]);

    // Handlers
    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleCellClick = async (worker: Worker, date: Date, assignment?: Attendance) => {
        // PAINT MODE
        if (selectedTool) {
            // Toggle Logic: If clicking same status, delete (deselect)
            if (assignment && assignment.status === selectedTool) {
                try {
                    await attendanceApi.delete(assignment.id);
                    toast.success("Rimosso", { duration: 1000, position: 'bottom-center' });
                    loadData();
                } catch (e) {
                    toast.error("Errore cancellazione");
                }
                return;
            }

            // Permit Logic: Ask for hours
            let hours = 8;
            if (selectedTool === 'permit') {
                const input = window.prompt("Quante ore di permesso?", "4");
                // If cancelled, do nothing
                if (input === null) return;
                const h = parseFloat(input);
                if (isNaN(h) || h < 0 || h > 24) {
                    toast.error("Ore non valide");
                    return;
                }
                hours = h;
            }

            const dateStr = format(date, 'yyyy-MM-dd');
            const payload: Partial<Attendance> = {
                workerId: worker.id,
                date: dateStr,
                status: selectedTool,
                hours: hours,
                jobId: undefined
            };

            try {
                await attendanceApi.upsert(payload);
                toast.success("Aggiornato", { duration: 1000, position: 'bottom-center' });
                loadData();
            } catch (e) {
                toast.error("Errore salvataggio");
            }
        } else {
            // NORMAL MODE: Open Modal
            setSelectedWorker(worker);
            setSelectedDate(date);
            setCurrentAssignment(assignment || null);
            setIsModalOpen(true);
        }
    };

    const handleSave = async (data: Partial<Attendance>, repeatUntil?: Date) => {
        try {
            const promises = [];
            promises.push(attendanceApi.upsert(data));
            // ... Repeating logic (simplified for brevity, reused from before if needed) ...
            // Assuming modal handles logic, but here we just upsert.
            // Re-implement repeat logic if modal returns it:

            if (repeatUntil && data.date) {
                // ... Same repeat logic as before ...
                // We can extract this to a helper if it gets complex
                let runnerDate = new Date(data.date);
                runnerDate.setDate(runnerDate.getDate() + 1);
                while (runnerDate <= repeatUntil) {
                    const payload = { ...data, date: format(runnerDate, 'yyyy-MM-dd'), id: undefined };
                    promises.push(attendanceApi.upsert(payload));
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

    const handleBulkSave = async (workerIds: string[], startDate: Date, endDate: Date, assignment: Partial<Attendance>) => {
        try {
            const promises = [];
            for (const wId of workerIds) {
                let runnerDate = new Date(startDate);
                while (runnerDate <= endDate) {
                    const dateStr = format(runnerDate, 'yyyy-MM-dd');
                    const payload = {
                        ...assignment,
                        workerId: wId,
                        date: dateStr
                    };
                    promises.push(attendanceApi.upsert(payload));
                    runnerDate.setDate(runnerDate.getDate() + 1);
                }
            }
            await Promise.all(promises);
            toast.success(`Assegnazione completata`);
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Errore salvataggio multiplo");
            throw error;
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

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm">

                {/* Date Nav */}
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

                {/* Right Actions */}
                <div className="flex items-center space-x-4">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}

                    <Button onClick={() => setIsBulkModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Users className="mr-2 h-4 w-4" />
                        Assegnazione Squadra
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <AttendanceToolbar selectedTool={selectedTool} onSelectTool={setSelectedTool} />

            {/* Monthly Grid */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <AttendanceMonthGrid
                    currentDate={currentDate}
                    workers={initialWorkers}
                    attendanceMap={attendanceMap}
                    onCellClick={handleCellClick}
                    selectedTool={selectedTool}
                />
            </div>

            <div className="text-xs text-gray-400 mt-2">
                * Clicca su uno strumento per attivare la modalità inserimento rapido. Clicca di nuovo per disattivarla.
                <br />
                * Doppio click o click senza strumento apre i dettagli per assegnare cantieri specifici.
            </div>

            {/* Individual Modal */}
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

            {/* Bulk Modal */}
            <BulkAssignmentModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSave={handleBulkSave}
                workers={initialWorkers}
                jobs={initialJobs}
            />
        </div>
    );
}
