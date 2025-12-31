import { Worker, Attendance } from "@/lib/api";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, getDay, isWeekend, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AttendanceStatus } from "./AttendanceToolbar";

interface MonthGridProps {
    currentDate: Date;
    workers: Worker[];
    attendanceMap: Record<string, Record<string, Attendance>>;
    onCellClick: (worker: Worker, date: Date, currentAssignment?: Attendance) => void;
    selectedTool: AttendanceStatus | null;
}

const statusConfig: Record<string, { color: string; letter: string }> = {
    'presence': { color: 'bg-green-500 text-white', letter: 'w' }, // Default letter, overridden below
    'absence': { color: 'bg-black text-white', letter: 'a' },
    'sick': { color: 'bg-yellow-400 text-black', letter: 'm' },
    'holiday': { color: 'bg-red-600 text-white', letter: 'f' },
    'permit': { color: 'bg-red-600 text-white', letter: 'p' }, // Same color as holiday
    'injury': { color: 'bg-amber-700 text-white', letter: 'i' },
    'transfer': { color: 'bg-purple-700 text-white', letter: 't' },
    'course': { color: 'bg-blue-500 text-white', letter: 'c' },
};

export default function AttendanceMonthGrid({
    currentDate,
    workers,
    attendanceMap,
    onCellClick,
    selectedTool
}: MonthGridProps) {

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
        <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse bg-white dark:bg-card">
                <thead>
                    <tr>
                        <th className="sticky left-0 z-20 bg-gray-100 dark:bg-slate-800 p-2 text-left font-semibold border dark:border-slate-700 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            Dipendenti
                        </th>
                        {days.map(day => {
                            const dayNum = format(day, "d");
                            const dayName = format(day, "EEEEEE", { locale: it }); // 2 letters
                            const isWknd = isWeekend(day);

                            return (
                                <th key={day.toString()} className={cn(
                                    "p-1 border text-center min-w-[30px]",
                                    isWknd ? "bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500" : "bg-white dark:bg-card",
                                    isToday(day) && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                                )}>
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-[10px] uppercase font-normal mb-0.5">{dayName}</span>
                                        <span>{dayNum}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {workers.map(worker => (
                        <tr key={worker.id} className="group hover:bg-gray-50 dark:hover:bg-slate-800">
                            <td className="sticky left-0 z-10 p-2 font-medium bg-white dark:bg-card group-hover:bg-gray-50 dark:group-hover:bg-slate-800 border-r dark:border-slate-700 border-b shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                                {worker.lastName} {worker.firstName}
                            </td>
                            {days.map(day => {
                                const dateKey = format(day, "yyyy-MM-dd");
                                const assignment = attendanceMap[worker.id]?.[dateKey];
                                const isWknd = isWeekend(day);

                                // Determine style based on status
                                let cellClass = isWknd ? "bg-gray-50 dark:bg-slate-800" : "bg-white dark:bg-card";
                                let content = "";

                                if (assignment) {
                                    const config = statusConfig[assignment.status] || statusConfig['presence'];
                                    cellClass = config.color;

                                    if (assignment.status === 'presence') {
                                        // For presence, show hours
                                        content = `${assignment.hours}`;
                                    } else if (assignment.status === 'permit') {
                                        // For permit, might explicitly show hours if variable?
                                        // User said "F/P x", so showing hours for permit as well is good practice
                                        content = `${assignment.hours}h`; // "4h"
                                    } else {
                                        content = config.letter;
                                    }
                                }

                                return (
                                    <td
                                        key={`${worker.id}-${dateKey}`}
                                        className={cn(
                                            "border p-0 cursor-pointer transition-colors relative h-8 text-center align-middle",
                                            cellClass,
                                            selectedTool && "hover:opacity-80 hover:ring-2 hover:ring-inset hover:ring-gray-400 dark:hover:ring-slate-500",
                                            !assignment && !isWknd && "hover:bg-gray-100 dark:hover:bg-slate-700"
                                        )}
                                        onClick={() => onCellClick(worker, day, assignment)}
                                    >
                                        <span className="font-semibold select-none">{content}</span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
