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
                                        {(() => {
                                            // Calculate total work hours (presence entries)
                                            const workHours = assignments
                                                .filter(a => a.status === 'presence')
                                                .reduce((sum, a) => sum + (a.hours || 0), 0);

                                            // Get non-work statuses
                                            const nonWorkStatuses = assignments.filter(a => a.status !== 'presence');

                                            // Helper to render status icon
                                            const getStatusIcon = (status: string) => {
                                                const iconClass = "w-3 h-3 sm:w-4 sm:h-4";
                                                switch (status) {
                                                    case 'holiday':
                                                    case 'permit':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v10h22V7h-2v4h-2z" /></svg>;
                                                    case 'sick':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" /></svg>;
                                                    case 'injury':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" /></svg>;
                                                    case 'transfer':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>;
                                                    case 'course':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /></svg>;
                                                    case 'strike':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>;
                                                    case 'absence':
                                                        return <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>;
                                                    default:
                                                        return null;
                                                }
                                            };

                                            if (assignments.length === 0) {
                                                return null;
                                            }

                                            // If only work hours
                                            if (workHours > 0 && nonWorkStatuses.length === 0) {
                                                const config = statusConfig['presence'];
                                                return (
                                                    <div className={cn("flex items-center justify-center h-full w-full text-[10px] sm:text-xs font-semibold", config.color)}>
                                                        {workHours}
                                                    </div>
                                                );
                                            }

                                            // If only non-work status (no work hours)
                                            if (workHours === 0 && nonWorkStatuses.length === 1) {
                                                const status = nonWorkStatuses[0];
                                                const config = statusConfig[status.status] || statusConfig['presence'];
                                                return (
                                                    <div className={cn("flex items-center justify-center h-full w-full", config.color)}>
                                                        {getStatusIcon(status.status)}
                                                    </div>
                                                );
                                            }

                                            // Mixed: work hours + status
                                            if (workHours > 0 && nonWorkStatuses.length > 0) {
                                                const status = nonWorkStatuses[0];
                                                const config = statusConfig[status.status] || statusConfig['presence'];
                                                return (
                                                    <div className="flex w-full h-full">
                                                        <div className={cn("flex-1 flex items-center justify-center text-[10px] sm:text-xs font-semibold", statusConfig['presence'].color)}>
                                                            {workHours}
                                                        </div>
                                                        <div className={cn("flex-1 flex items-center justify-center", config.color)}>
                                                            {getStatusIcon(status.status)}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // Multiple non-work statuses (rare case)
                                            return (
                                                <div className="flex w-full h-full">
                                                    {nonWorkStatuses.map((status, idx) => {
                                                        const config = statusConfig[status.status] || statusConfig['presence'];
                                                        return (
                                                            <div key={status.id} className={cn("flex-1 flex items-center justify-center", config.color)}>
                                                                {getStatusIcon(status.status)}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
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
