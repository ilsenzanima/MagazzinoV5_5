declare module 'frappe-gantt' {
    export interface GanttTask {
        id: string;
        name: string;
        start: string;
        end: string;
        progress?: number;
        dependencies?: string;
        custom_class?: string;
    }

    export interface GanttOptions {
        view_mode?: 'Day' | 'Week' | 'Month' | 'Year';
        language?: string;
        readonly?: boolean;
        bar_height?: number;
        padding?: number;
        on_click?: (task: GanttTask) => void;
        on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
        on_progress_change?: (task: GanttTask, progress: number) => void;
        popup_func?: (opts: {
            task: GanttTask;
            set_subtitle: (html: string) => void;
            set_details: (html: string) => void;
        }) => void;
    }

    export default class Gantt {
        constructor(wrapper: HTMLElement | string, tasks: GanttTask[], options?: GanttOptions);
        refresh(tasks: GanttTask[]): void;
    }
}
