"use client";

import { useEffect, useRef } from "react";
import "@/styles/frappe-gantt.css";
import { JobTask } from "@/lib/api";

const STATUS_CLASS: Record<JobTask['status'], string> = {
    planned: "task-status-planned",
    in_progress: "task-status-in-progress",
    completed: "task-status-completed",
    delayed: "task-status-delayed",
};

interface TimelineChartProps {
    tasks: JobTask[];
    onTaskClick?: (taskId: string) => void;
    onDateChange?: (taskId: string, start: Date, end: Date) => void;
    onProgressChange?: (taskId: string, progress: number) => void;
    readonly?: boolean;
}

export function TimelineChart({ tasks, onTaskClick, onDateChange, onProgressChange, readonly = false }: TimelineChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || tasks.length === 0) return;

        let ganttInstance: any;
        (async () => {
            const { default: Gantt } = await import("frappe-gantt");
            const ganttTasks = tasks.map(t => ({
                id: t.id,
                name: t.name,
                start: t.startDate,
                end: t.endDate,
                progress: t.progress,
                custom_class: STATUS_CLASS[t.status],
            }));

            ganttInstance = new Gantt(containerRef.current!, ganttTasks, {
                view_mode: "Week",
                language: "it",
                readonly,
                on_click: (task) => onTaskClick?.(task.id),
                on_date_change: (task, start, end) => onDateChange?.(task.id, start, end),
                on_progress_change: (task, progress) => onProgressChange?.(task.id, progress),
            });
        })();

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [tasks, onTaskClick, onDateChange, onProgressChange, readonly]);

    if (tasks.length === 0) {
        return (
            <div className="text-sm text-slate-500 text-center py-10 border rounded-md border-dashed">
                Nessuna fase pianificata. Aggiungi la prima fase per visualizzare il cronoprogramma.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto border rounded-md bg-white dark:bg-slate-900">
            <div ref={containerRef} />
        </div>
    );
}
