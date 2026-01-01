import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Info, Trash2 } from "lucide-react";

export type AttendanceStatus = 'presence' | 'absence' | 'sick' | 'holiday' | 'permit' | 'injury' | 'transfer' | 'course' | 'strike';

interface ToolbarProps {
    selectedTool: AttendanceStatus | 'delete' | null;
    onSelectTool: (tool: AttendanceStatus | 'delete' | null) => void;
}

const tools: { id: AttendanceStatus; label: string; color: string; icon: JSX.Element }[] = [
    {
        id: 'holiday',
        label: 'Ferie/Perm. 8h',
        color: 'bg-red-600 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v10h22V7h-2v4h-2z" /></svg>
    },
    {
        id: 'permit',
        label: 'Ferie/Perm. Xh',
        color: 'bg-red-600 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v10h22V7h-2v4h-2z" /></svg>
    },
    {
        id: 'sick',
        label: 'Malattia',
        color: 'bg-yellow-400 text-black',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" /></svg>
    },
    {
        id: 'injury',
        label: 'Infortunio',
        color: 'bg-amber-700 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" /></svg>
    },
    {
        id: 'transfer',
        label: 'Trasferta',
        color: 'bg-purple-700 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
    },
    {
        id: 'course',
        label: 'Corso',
        color: 'bg-blue-500 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /></svg>
    },
    {
        id: 'strike',
        label: 'Sciopero',
        color: 'bg-gray-800 text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /></svg>
    },
    {
        id: 'absence',
        label: 'Assenza Ing.',
        color: 'bg-black text-white',
        icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
    },
];

export function AttendanceToolbar({ selectedTool, onSelectTool }: ToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-card rounded-lg shadow-sm border dark:border-border mb-4">
            <div className="text-sm font-medium mr-2 text-gray-500 dark:text-gray-400">Scelta Rapida:</div>
            {tools.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => onSelectTool(selectedTool === tool.id ? null : tool.id)}
                    title={`Clicca sulla griglia per assegnare: ${tool.label}`}
                    className={cn(
                        "flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all border-2 text-sm font-medium min-w-[44px]",
                        tool.color,
                        selectedTool === tool.id
                            ? "border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-400 dark:ring-slate-500 scale-105"
                            : "border-transparent opacity-90 hover:opacity-100 hover:scale-105"
                    )}
                >
                    {tool.icon}
                    <span className="hidden sm:inline">{tool.label}</span>
                    {selectedTool === tool.id && <Check className="h-3 w-3 ml-1" />}
                </button>
            ))}

            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2" />

            <button
                onClick={() => onSelectTool(selectedTool === 'delete' ? null : 'delete')}
                title="Clicca sulla griglia per eliminare (pulisci cella)"
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all border-2 text-sm font-medium bg-white dark:bg-slate-800 text-red-600 border-red-200 hover:bg-red-50",
                    selectedTool === 'delete'
                        ? "border-red-600 ring-2 ring-offset-1 ring-red-400 scale-105"
                        : "opacity-90 hover:opacity-100"
                )}
            >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Elimina</span>
                {selectedTool === 'delete' && <Check className="h-3 w-3 ml-1" />}
            </button>

            {selectedTool && (
                <div className="ml-auto flex items-center text-sm text-blue-600 dark:text-blue-400 animate-pulse">
                    <Info className="h-4 w-4 mr-1" />
                    Modalità {selectedTool === 'delete' ? 'cancellazione' : 'inserimento'} attiva
                </div>
            )}
        </div>
    );
}
