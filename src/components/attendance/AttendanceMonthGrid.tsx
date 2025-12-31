import { Worker, Attendance } from "@/lib/api";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isToday, isWeekend } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AttendanceStatus } from "./AttendanceToolbar";

interface MonthGridProps {
    currentDate: Date;
    workers: Worker[];
    attendanceMap: Record<string, Record<string, Attendance[]>>;
    onCellClick: (worker: Worker, date: Date, assignments: Attendance[]) => void;
    selectedTool: AttendanceStatus | 'delete' | null;
}

const statusConfig: Record<string, { color: string; letter: string }> = {
    'presence': { color: 'bg-green-500 text-white', letter: 'w' },
    'absence': { color: 'bg-black text-white', letter: 'a' },
    'sick': { color: 'bg-yellow-400 text-black', letter: 'm' },
    'holiday': { color: 'bg-red-600 text-white', letter: 'f' },
    'permit': { color: 'bg-red-600 text-white', letter: 'p' },
    'injury': { color: 'bg-amber-700 text-white', letter: 'i' },
    'transfer': { color: 'bg-purple-700 text-white', letter: 't' },
    'course': { color: 'bg-blue-500 text-white', letter: 'c' },
    'strike': { color: 'bg-gray-800 text-white', letter: 's' },
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
                            const dayName = format(day, "EEEEEE", { locale: it });
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
                                const assignments = attendanceMap[worker.id]?.[dateKey] || [];
                                const isWknd = isWeekend(day);

                                // Tooltip content
                                const tooltipText = assignments.map(a => {
                                    const jobCode = a.jobCode || (a.status === 'presence' ? 'Presenza' : a.status);
                                    return `${jobCode}: ${a.hours}h`;
                                }).join('\n');

                                return (
                                    <td
                                        key={`${worker.id}-${dateKey}`}
                                        className={cn(
                                            "border p-0 cursor-pointer transition-colors relative h-8 text-center align-middle",
                                            !assignments.length && isWknd ? "bg-gray-50 dark:bg-slate-800" : "bg-white dark:bg-card",
                                            !assignments.length && !isWknd && "hover:bg-gray-100 dark:hover:bg-slate-700",
                                            selectedTool && "hover:opacity-80 hover:ring-2 hover:ring-inset hover:ring-gray-400 dark:hover:ring-slate-500"
                                        )}
                                        onClick={() => onCellClick(worker, day, assignments)}
                                        title={tooltipText || undefined}
                                    >
                                        <div className="flex w-full h-full">
                                            {assignments.map((assignment, idx) => {
                                                const config = statusConfig[assignment.status] || statusConfig['presence'];
                                                let content = "";
                                                if (assignment.status === 'presence' || assignment.status === 'permit') {
                                                    content = `${assignment.hours}`; // "4"
                                                } else {
                                                    content = config.letter;
                                                }
                                                // If status is holiday/permit/strike/etc with specific override logic
                                                if (assignment.status === 'holiday') content = 'F';

                                                return (
                                                    <div
                                                        key={assignment.id}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center h-full text-[10px] sm:text-xs font-semibold select-none overflow-hidden",
                                                            config.color
                                                        )}
                                                    >
                                                        {content}
                                                    </div>
                                                );
                                            })}
                                        </div>
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
