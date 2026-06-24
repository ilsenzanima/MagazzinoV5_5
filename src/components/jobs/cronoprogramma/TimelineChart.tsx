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
const BAR_PADDING = 34;
const HEADER_HEIGHT = 80;

function eachDate(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

interface TimelineChartProps {
    tasks: JobTask[];
    /** Personalizza l'etichetta mostrata per ogni barra (es. con prefisso commessa) */
    taskLabel?: (task: JobTask) => string;
    /** Classe CSS aggiuntiva per barra (es. colore per commessa nella vista globale) */
    barClass?: (task: JobTask) => string;
    /** HTML mostrato nel popup al click/hover sulla barra (es. presenze registrate nel periodo) */
    popupContent?: (task: JobTask) => string;
    /** Date (YYYY-MM-DD) con almeno una presenza per il cantiere della fase, da disegnare come striscia sotto la barra */
    rowPresence?: (task: JobTask) => Set<string>;
    onTaskClick?: (taskId: string) => void;
    onDateChange?: (taskId: string, start: Date, end: Date) => void;
    onProgressChange?: (taskId: string, progress: number) => void;
    readonly?: boolean;
}

export function TimelineChart({ tasks, taskLabel, barClass, popupContent, rowPresence, onTaskClick, onDateChange, onProgressChange, readonly = false }: TimelineChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || tasks.length === 0) return;

        let cancelled = false;

        (async () => {
            const { default: Gantt } = await import("frappe-gantt");
            const ganttTasks = tasks.map(t => ({
                id: t.id,
                name: taskLabel ? taskLabel(t) : t.name,
                start: t.startDate,
                end: t.endDate,
                progress: t.progress,
                custom_class: barClass ? `${STATUS_CLASS[t.status]}--${barClass(t)}` : STATUS_CLASS[t.status],
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
                popup_func: popupContent ? ({ task, set_details }) => {
                    const original = tasks.find(t => t.id === task.id);
                    if (original) set_details(popupContent(original));
                } : undefined,
            });

            if (cancelled || !rowPresence || !containerRef.current) return;

            // Disegna sotto ogni barra una striscia di puntini (uno per giorno della fase)
            // posizionata esattamente sulla geometria della barra renderizzata da frappe-gantt,
            // cosi' le presenze restano allineate al periodo della fase anche con zoom/scroll diversi.
            requestAnimationFrame(() => {
                if (cancelled || !containerRef.current) return;
                const ganttContainer = containerRef.current.querySelector(".gantt-container") as HTMLElement | null;
                if (!ganttContainer) return;
                ganttContainer.querySelectorAll(".presence-row-overlay").forEach(el => el.remove());

                tasks.forEach(t => {
                    const presenceDates = rowPresence(t);
                    if (!presenceDates || presenceDates.size === 0) return;
                    const wrapper = ganttContainer.querySelector(`.bar-wrapper[data-id="${t.id}"]`);
                    const bar = wrapper?.querySelector(".bar");
                    if (!bar) return;
                    const x = parseFloat(bar.getAttribute("x") || "0");
                    const y = parseFloat(bar.getAttribute("y") || "0");
                    const width = parseFloat(bar.getAttribute("width") || "0");
                    const height = parseFloat(bar.getAttribute("height") || "0");
                    const days = eachDate(t.startDate, t.endDate);
                    if (days.length === 0 || width <= 0) return;

                    const overlay = document.createElement("div");
                    overlay.className = "presence-row-overlay absolute pointer-events-none";
                    overlay.style.left = `${x}px`;
                    overlay.style.top = `${y + height + 3}px`;
                    overlay.style.width = `${width}px`;
                    overlay.style.height = "8px";
                    overlay.style.zIndex = "5";

                    const dayWidth = width / days.length;
                    days.forEach((date, i) => {
                        const present = presenceDates.has(date);
                        const size = present ? 6 : 3;
                        const dot = document.createElement("div");
                        dot.title = `${date}${present ? " · presenza registrata" : ""}`;
                        dot.className = present
                            ? "absolute rounded-full bg-emerald-500"
                            : "absolute rounded-full bg-slate-300 dark:bg-slate-600";
                        dot.style.left = `${i * dayWidth + dayWidth / 2 - size / 2}px`;
                        dot.style.top = "0px";
                        dot.style.width = `${size}px`;
                        dot.style.height = `${size}px`;
                        overlay.appendChild(dot);
                    });
                    ganttContainer.appendChild(overlay);
                });
            });
        })();

        return () => {
            cancelled = true;
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [tasks, taskLabel, barClass, popupContent, rowPresence, onTaskClick, onDateChange, onProgressChange, readonly]);

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
