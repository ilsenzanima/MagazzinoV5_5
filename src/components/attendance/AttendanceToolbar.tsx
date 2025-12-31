import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Info } from "lucide-react";

export type AttendanceStatus = 'presence' | 'absence' | 'sick' | 'holiday' | 'permit' | 'injury' | 'transfer' | 'course';

interface ToolbarProps {
    selectedTool: AttendanceStatus | null;
    onSelectTool: (tool: AttendanceStatus | null) => void;
}

// User Requirements:
// - Remove 'presence' button.
// - Holiday (Ferie) -> "F/P 8" (Red)
// - Permit (Permesso) -> "F/P x" (Red)
// - Add Course (Corso) -> "Corso" (Blue? Or distinct?)

const tools: { id: AttendanceStatus; label: string; color: string; letter: string }[] = [
    // { id: 'presence', label: 'Presenza / Week', color: 'bg-green-500', letter: 'w' }, // Removed
    { id: 'holiday', label: 'F/P 8', color: 'bg-red-600 text-white', letter: 'f' },
    { id: 'permit', label: 'F/P x', color: 'bg-red-600 text-white', letter: 'p' },
    { id: 'sick', label: 'Malattia', color: 'bg-yellow-400 text-black', letter: 'm' },
    { id: 'injury', label: 'Infortunio', color: 'bg-amber-700 text-white', letter: 'i' },
    { id: 'transfer', label: 'Trasferta', color: 'bg-purple-700 text-white', letter: 't' },
    { id: 'course', label: 'Corso', color: 'bg-blue-500 text-white', letter: 'c' },
    { id: 'absence', label: 'Assenza Ing.', color: 'bg-black text-white', letter: 'a' },
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
                        "flex items-center gap-2 px-3 py-1.5 rounded-md transition-all border-2 text-sm font-medium",
                        tool.color,
                        selectedTool === tool.id
                            ? "border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-400 dark:ring-slate-500 scale-105"
                            : "border-transparent opacity-90 hover:opacity-100 hover:scale-105"
                    )}
                >
                    <span className="uppercase font-bold">{tool.letter}</span>
                    <span className="hidden sm:inline">{tool.label}</span>
                    {selectedTool === tool.id && <Check className="h-3 w-3 ml-1" />}
                </button>
            ))}

            {selectedTool && (
                <div className="ml-auto flex items-center text-sm text-blue-600 dark:text-blue-400 animate-pulse">
                    <Info className="h-4 w-4 mr-1" />
                    Modalità inserimento attiva (riclicca per annullare)
                </div>
            )}
        </div>
    );
}
