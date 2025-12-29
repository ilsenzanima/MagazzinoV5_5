'use client';

import { Worker, Job, Attendance, attendanceApi } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday, addDays, isBefore, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import AttendanceGrid from "./AttendanceGrid";
import AssignmentModal from "./AssignmentModal";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react";
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

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentAssignment, setCurrentAssignment] = useState<Attendance | null>(null);

    // Computed
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday
    const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Fetch Data
    const loadData = async () => {
        setIsLoading(true);
        try {
            const startStr = format(weekStart, 'yyyy-MM-dd');
            const endStr = format(weekEnd, 'yyyy-MM-dd');
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
    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleCellClick = (worker: Worker, date: Date, assignment?: Attendance) => {
        setSelectedWorker(worker);
        setSelectedDate(date);
        setCurrentAssignment(assignment || null);
        setIsModalOpen(true);
    };

    const handleSave = async (data: Partial<Attendance>, repeatUntil?: Date) => {
        try {
            const promises = [];

            // 1. Save the primary entry
            promises.push(attendanceApi.upsert(data));

            // 2. Handle recurring (only if date is valid and repeatUntil is future)
            if (repeatUntil && data.date) {
                let runnerDate = addDays(new Date(data.date), 1);
                while (isBefore(runnerDate, repeatUntil) || isSameDay(runnerDate, repeatUntil)) {
                    const payload = { ...data, date: format(runnerDate, 'yyyy-MM-dd'), id: undefined }; // New ID for new entries
                    promises.push(attendanceApi.upsert(payload));
                    runnerDate = addDays(runnerDate, 1);
                }
            }

            await Promise.all(promises);
            toast.success(promises.length > 1 ? `Salvati ${promises.length} inserimenti` : "Salvato con successo");
            loadData(); // Refetch
        } catch (error) {
            console.error(error);
            toast.error("Errore durante il salvataggio");
            throw error;
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await attendanceApi.delete(id);
            toast.success("Eliminato con successo");
            loadData();
        } catch (error) {
            console.error(error);
            toast.error("Errore durante l'eliminazione");
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-semibold w-48 text-center capitalize">
                        {format(weekStart, 'd MMM', { locale: it })} - {format(weekEnd, 'd MMM yyyy', { locale: it })}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="ml-2">
                        Oggi
                    </Button>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-500">
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>Settimana {format(weekStart, 'w')}</span>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <AttendanceGrid
                        workers={initialWorkers}
                        weekDates={weekDates}
                        attendanceMap={attendanceMap}
                        onCellClick={handleCellClick}
                    />
                </div>
            </div>

            {/* Modal */}
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
        </div>
    );
}
