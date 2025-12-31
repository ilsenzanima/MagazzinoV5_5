import { Worker, Attendance, Job } from "@/lib/api";

interface AttendanceGridProps {
    workers: Worker[];
    weekDates: Date[];
    attendanceMap: Record<string, Record<string, Attendance>>;
    onCellClick: (worker: Worker, date: Date, currentAssignment?: Attendance) => void;
}

export default function AttendanceGrid({
    workers,
    weekDates,
    attendanceMap,
    onCellClick
}: AttendanceGridProps) {
    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-slate-800">
                    <tr>
                        <th className="px-4 py-3 sticky left-0 bg-gray-50 dark:bg-slate-800 z-10">Operaio</th>
                        {weekDates.map(date => (
                            <th key={date.toISOString()} className="px-4 py-3 min-w-[100px]">
                                {date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {workers.map(worker => (
                        <tr key={worker.id} className="border-b dark:border-slate-700 bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-slate-800">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-card z-10 border-r dark:border-slate-700">
                                {worker.firstName} {worker.lastName}
                            </td>
                            {weekDates.map(date => {
                                const dateKey = date.toISOString().split('T')[0];
                                const assignment = attendanceMap[worker.id]?.[dateKey];
                                return (
                                    <td
                                        key={`${worker.id}-${dateKey}`}
                                        className="px-4 py-3 border-l dark:border-slate-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                        onClick={() => onCellClick(worker, date, assignment)}
                                    >
                                        {assignment ? (
                                            <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs">
                                                <div className="font-bold">{assignment.jobCode}</div>
                                                <div className="truncate max-w-[80px]">{assignment.hours}h</div>
                                            </div>
                                        ) : (
                                            <div className="h-full min-h-[40px] flex items-center justify-center text-gray-300 dark:text-slate-600">
                                                -
                                            </div>
                                        )}
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
