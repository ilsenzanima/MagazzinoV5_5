"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
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

const localIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function eachDate(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (cur <= last) {
        dates.push(localIso(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// Scale di tempo, dalla più compatta alla più dettagliata (la rotella le percorre)
const VIEW_MODES = ["Year", "Month", "Week", "Day"] as const;
type ViewMode = typeof VIEW_MODES[number];
const VIEW_MODE_LABEL: Record<ViewMode, string> = { Year: "Anni", Month: "Mesi", Week: "Settimane", Day: "Giorni" };
// i puntini delle presenze hanno senso solo quando un giorno è abbastanza largo
const PRESENCE_MODES: ViewMode[] = ["Week", "Day"];

interface GanttScale { gantt_start: Date; config: { unit: string; step: number; column_width: number } }

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// Data -> posizione in pixel e ritorno, con la stessa scala del diagramma
function xOfDate(g: GanttScale, date: Date): number {
    const { unit, step, column_width } = g.config;
    const s = g.gantt_start;
    let units: number;
    if (unit === "month") units = (date.getFullYear() - s.getFullYear()) * 12 + (date.getMonth() - s.getMonth()) + (date.getDate() - 1) / daysInMonth(date.getFullYear(), date.getMonth());
    else if (unit === "year") units = (date.getFullYear() - s.getFullYear()) + date.getMonth() / 12;
    else units = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())) / 86400000;
    return (units / step) * column_width;
}

function dateOfX(g: GanttScale, x: number): Date {
    const { unit, step, column_width } = g.config;
    const s = g.gantt_start;
    const units = (x / column_width) * step;
    if (unit === "month") {
        const whole = Math.floor(units);
        const base = new Date(s.getFullYear(), s.getMonth() + whole, 1);
        return new Date(base.getFullYear(), base.getMonth(), 1 + Math.round((units - whole) * daysInMonth(base.getFullYear(), base.getMonth())));
    }
    if (unit === "year") return new Date(s.getFullYear() + Math.floor(units), Math.round((units - Math.floor(units)) * 12), 1);
    return new Date(s.getFullYear(), s.getMonth(), s.getDate() + Math.round(units));
}

interface TimelineChartProps {
    tasks: JobTask[];
    /** Personalizza l'etichetta mostrata per ogni barra (es. con prefisso commessa) */
    taskLabel?: (task: JobTask) => string;
    /** Righe di riepilogo (es. il periodo di una commessa): colore diverso da quello delle fasi */
    isSummary?: (task: JobTask) => boolean;
    /** Classe CSS aggiuntiva per barra (es. colore per commessa nella vista globale) */
    barClass?: (task: JobTask) => string;
    /** HTML mostrato nel popup al click/hover sulla barra (es. presenze registrate nel periodo) */
    popupContent?: (task: JobTask) => string;
    /** Numero di lavoratori presenti per data (YYYY-MM-DD) nel cantiere della fase, da disegnare come striscia sotto la barra */
    rowPresence?: (task: JobTask) => Map<string, number>;
    onTaskClick?: (taskId: string) => void;
    onDateChange?: (taskId: string, start: Date, end: Date) => void;
    onProgressChange?: (taskId: string, progress: number) => void;
    readonly?: boolean;
}

export function TimelineChart({ tasks, taskLabel, isSummary, barClass, popupContent, rowPresence, onTaskClick, onDateChange, onProgressChange, readonly = false }: TimelineChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Posizione di scorrimento tra un ridisegno e l'altro (il diagramma si rifà a ogni modifica)
    const savedScroll = useRef<{ left: number; top: number } | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("Week");
    const viewModeRef = useRef<ViewMode>("Week");
    const ganttRef = useRef<GanttScale | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Punto del tempo da tenere fermo sotto il cursore mentre si cambia scala
    const zoomAnchor = useRef<{ date: Date; offset: number } | null>(null);
    const lastWheel = useRef(0);
    const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

    const scroller = () => containerRef.current?.querySelector(".gantt-container") as HTMLElement | null;
    // Cambia scala (verso il dettaglio o verso la vista d'insieme) tenendo fermo il punto sotto il cursore
    const zoom = (dir: 1 | -1, offsetX?: number) => {
        const el = scroller();
        const g = ganttRef.current;
        const i = VIEW_MODES.indexOf(viewModeRef.current);
        const next = VIEW_MODES[Math.min(VIEW_MODES.length - 1, Math.max(0, i + dir))];
        if (next === viewModeRef.current) return;
        if (el && g) {
            const offset = offsetX ?? el.clientWidth / 2;
            zoomAnchor.current = { date: dateOfX(g, el.scrollLeft + offset), offset };
        }
        viewModeRef.current = next;
        setViewMode(next);
    };

    // La rotella cambia scala (listener nativo: serve per poter bloccare lo scorrimento della pagina)
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = Date.now();
            if (now - lastWheel.current < 180) return;
            lastWheel.current = now;
            const rect = wrapper.getBoundingClientRect();
            zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left);
        };
        wrapper.addEventListener("wheel", onWheel, { passive: false });
        return () => wrapper.removeEventListener("wheel", onWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks.length]);

    const scrollByPage = (dir: 1 | -1) => {
        const el = scroller();
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
    };

    // Trascinando lo sfondo ci si sposta nel tempo (le barre e le maniglie restano trascinabili)
    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        if ((e.target as HTMLElement).closest(".bar-wrapper, .handle, .popup-wrapper, .side-header, button, select")) return;
        const el = scroller();
        if (!el) return;
        drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        const el = scroller();
        if (!el) return;
        el.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
        el.scrollTop = drag.current.top - (e.clientY - drag.current.y);
    };
    const endDrag = () => { drag.current = null; };

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
                custom_class: (() => {
                    const statusClass = isSummary?.(t) ? "task-status-summary" : STATUS_CLASS[t.status];
                    return barClass ? `${statusClass}--${barClass(t)}` : statusClass;
                })(),
            }));

            const showPresence = !!rowPresence && PRESENCE_MODES.includes(viewMode);
            const gantt = new Gantt(containerRef.current!, ganttTasks, {
                view_mode: viewMode,
                language: "it",
                readonly,
                bar_height: BAR_HEIGHT,
                padding: BAR_PADDING,
                infinite_padding: false,
                on_click: (task) => onTaskClick?.(task.id),
                on_date_change: (task, start, end) => onDateChange?.(task.id, start, end),
                on_progress_change: (task, progress) => onProgressChange?.(task.id, progress),
                popup_func: popupContent ? ({ task, set_details }) => {
                    const original = tasks.find(t => t.id === task.id);
                    if (original) set_details(popupContent(original));
                } : undefined,
            });

            ganttRef.current = gantt as unknown as GanttScale;

            // Posizione: dopo un cambio di scala il punto che era sotto il cursore; se si sta ridisegnando, quella di prima;
            // altrimenti con «oggi» a circa due terzi dello schermo
            requestAnimationFrame(() => {
                const el = scroller();
                if (cancelled || !el) return;
                if (zoomAnchor.current) {
                    const { date, offset } = zoomAnchor.current;
                    zoomAnchor.current = null;
                    el.scrollLeft = Math.max(0, xOfDate(gantt as unknown as GanttScale, date) - offset);
                    if (savedScroll.current) el.scrollTop = savedScroll.current.top;
                    return;
                }
                if (savedScroll.current) {
                    el.scrollLeft = savedScroll.current.left;
                    el.scrollTop = savedScroll.current.top;
                    return;
                }
                const today = el.querySelector(".current-highlight") as HTMLElement | null;
                if (today) el.scrollLeft = Math.max(0, today.offsetLeft - el.clientWidth * 0.66);
            });

            if (cancelled || !showPresence || !rowPresence || !containerRef.current) return;

            // Disegna sotto ogni barra una striscia di puntini (uno per giorno della fase)
            // posizionata esattamente sulla geometria della barra renderizzata da frappe-gantt,
            // cosi' le presenze restano allineate al periodo della fase anche con zoom/scroll diversi.
            requestAnimationFrame(() => {
                if (cancelled || !containerRef.current) return;
                const ganttContainer = containerRef.current.querySelector(".gantt-container") as HTMLElement | null;
                if (!ganttContainer) return;
                ganttContainer.querySelectorAll(".presence-row-overlay").forEach(el => el.remove());

                tasks.forEach(t => {
                    const presenceCounts = rowPresence(t);
                    if (!presenceCounts || presenceCounts.size === 0) return;
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
                    overlay.style.top = `${y + height + 2}px`;
                    overlay.style.width = `${width}px`;
                    overlay.style.height = "12px";
                    overlay.style.zIndex = "5";

                    const dayWidth = width / days.length;
                    days.forEach((date, i) => {
                        const count = presenceCounts.get(date) || 0;
                        const present = count > 0;
                        const size = present ? Math.max(12, 8 + String(count).length * 5) : 3;
                        const mark = document.createElement("div");
                        mark.title = `${date}${present ? ` · ${count} lavorator${count === 1 ? "e" : "i"} presenti` : ""}`;
                        if (present) {
                            mark.className = "absolute rounded-full bg-emerald-500 text-white flex items-center justify-center leading-none";
                            mark.style.fontSize = "8px";
                            mark.style.fontWeight = "600";
                            mark.textContent = String(count);
                        } else {
                            mark.className = "absolute rounded-full bg-slate-300 dark:bg-slate-600";
                        }
                        mark.style.left = `${i * dayWidth + dayWidth / 2 - size / 2}px`;
                        mark.style.top = "0px";
                        mark.style.width = `${size}px`;
                        mark.style.height = `${size}px`;
                        overlay.appendChild(mark);
                    });
                    ganttContainer.appendChild(overlay);
                });
            });
        })();

        return () => {
            cancelled = true;
            const el = scroller();
            if (el) savedScroll.current = { left: el.scrollLeft, top: el.scrollTop };
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [viewMode, tasks, taskLabel, isSummary, barClass, popupContent, rowPresence, onTaskClick, onDateChange, onProgressChange, readonly]);

    if (tasks.length === 0) {
        return (
            <div className="text-sm text-slate-500 text-center py-10 border rounded-md border-dashed">
                Nessuna fase pianificata. Aggiungi la prima fase per visualizzare il cronoprogramma.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">Rotella = cambia scala · trascina lo sfondo = spostati</p>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => zoom(-1)} disabled={viewMode === VIEW_MODES[0]} aria-label="Scala più ampia" className="rounded-md border p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="w-20 text-center text-xs text-slate-500">{VIEW_MODE_LABEL[viewMode]}</span>
                    <button type="button" onClick={() => zoom(1)} disabled={viewMode === VIEW_MODES[VIEW_MODES.length - 1]} aria-label="Scala più di dettaglio" className="rounded-md border p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <span className="mx-1 h-4 border-l" />
                    <button type="button" onClick={() => scrollByPage(-1)} aria-label="Indietro nel tempo" className="rounded-md border p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => scrollByPage(1)} aria-label="Avanti nel tempo" className="rounded-md border p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            {/* Riquadro di altezza fissa (minimo 420px, cresce con lo schermo): dentro ci si muove in tutte le direzioni */}
            <div
                ref={wrapperRef}
                className="gantt-chart-viewport w-full overflow-hidden border rounded-md bg-white dark:bg-slate-900 cursor-grab active:cursor-grabbing"
                style={{ height: "clamp(420px, 68vh, 900px)" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <div ref={containerRef} className="h-full w-full" />
            </div>
        </div>
    );
}
