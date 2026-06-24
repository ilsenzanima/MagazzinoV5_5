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

const BAR_HEIGHT = 38;
const BAR_PADDING = 22;
const HEADER_HEIGHT = 80;

interface TimelineChartProps {
    tasks: JobTask[];
    /** Personalizza l'etichetta mostrata per ogni barra (es. con prefisso commessa) */
    taskLabel?: (task: JobTask) => string;
    onTaskClick?: (taskId: string) => void;
    onDateChange?: (taskId: string, start: Date, end: Date) => void;
    onProgressChange?: (taskId: string, progress: number) => void;
    readonly?: boolean;
}

export function TimelineChart({ tasks, taskLabel, onTaskClick, onDateChange, onProgressChange, readonly = false }: TimelineChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || tasks.length === 0) return;

        (async () => {
            const { default: Gantt } = await import("frappe-gantt");
            const ganttTasks = tasks.map(t => ({
                id: t.id,
                name: taskLabel ? taskLabel(t) : t.name,
                start: t.startDate,
                end: t.endDate,
                progress: t.progress,
                custom_class: STATUS_CLASS[t.status],
            }));

            new Gantt(containerRef.current!, ganttTasks, {
                view_mode: "Week",
                language: "it",
                readonly,
                bar_height: BAR_HEIGHT,
                padding: BAR_PADDING,
                on_click: (task) => onTaskClick?.(task.id),
                on_date_change: (task, start, end) => onDateChange?.(task.id, start, end),
                on_progress_change: (task, progress) => onProgressChange?.(task.id, progress),
            });
        })();

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [tasks, taskLabel, onTaskClick, onDateChange, onProgressChange, readonly]);

    if (tasks.length === 0) {
        return (
            <div className="text-sm text-slate-500 text-center py-10 border rounded-md border-dashed">
                Nessuna fase pianificata. Aggiungi la prima fase per visualizzare il cronoprogramma.
            </div>
        );
    }

    // Altezza minima calcolata come rete di sicurezza: il Gantt imposta la propria
    // altezza via JS, ma garantiamo comunque che il contenitore non venga mai tagliato.
    const minHeight = HEADER_HEIGHT + tasks.length * (BAR_HEIGHT + BAR_PADDING);

    return (
        <div
            className="w-full overflow-x-auto overflow-y-visible border rounded-md bg-white dark:bg-slate-900"
            style={{ minHeight }}
        >
            <div ref={containerRef} className="w-full" />
        </div>
    );
}
