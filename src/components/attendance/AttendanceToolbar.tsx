import { cn } from "@/lib/utils";
import { Info, Trash2, HardHat, X } from "lucide-react";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoursStepper } from "./HoursStepper";

export type AttendanceStatus = 'presence' | 'absence' | 'sick' | 'holiday' | 'permit' | 'injury' | 'transfer' | 'course' | 'strike' | 'medical_exam';

interface ToolbarProps {
    selectedTool: AttendanceStatus | 'delete' | null;
    onSelectTool: (tool: AttendanceStatus | 'delete' | null) => void;
    // Cantieri e magazzini tra cui scegliere
    targets: SearchableSelectOption[];
    quickJobId: string;
    onQuickJobChange: (jobId: string) => void;
    quickHours: number;
    onQuickHoursChange: (delta: number) => void;
}

// Voci a scelta rapida: stessi colori della griglia
const tools: { id: AttendanceStatus; label: string; color: string }[] = [
    { id: 'holiday', label: 'Ferie/Perm.', color: 'bg-red-600' },
    { id: 'sick', label: 'Malattia', color: 'bg-yellow-400' },
    { id: 'injury', label: 'Infortunio', color: 'bg-amber-700' },
    { id: 'course', label: 'Corso', color: 'bg-blue-500' },
    { id: 'strike', label: 'Sciopero', color: 'bg-gray-800' },
    { id: 'absence', label: 'Assenza Ing.', color: 'bg-black' },
];

export function AttendanceToolbar({ selectedTool, onSelectTool, targets, quickJobId, onQuickJobChange, quickHours, onQuickHoursChange }: ToolbarProps) {
    const targetActive = selectedTool === 'presence';
    const otherActive = selectedTool !== null && selectedTool !== 'presence';
    const activeTool = tools.find(t => t.id === selectedTool);

    return (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-card rounded-lg shadow-sm border dark:border-border mb-4">
            <div className="text-sm font-medium mr-2 text-gray-500 dark:text-gray-400">Scelta Rapida:</div>

            <div className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border-2 p-1",
                targetActive ? "border-green-600 ring-2 ring-offset-1 ring-green-300" : "border-transparent"
            )}>
                <HardHat className="ml-1 h-5 w-5 text-green-600" />
                <SearchableSelect
                    options={targets}
                    value={quickJobId}
                    onValueChange={(id) => { onQuickJobChange(id); onSelectTool(id ? 'presence' : null); }}
                    placeholder="Cantiere o magazzino…"
                    searchPlaceholder="Cerca commessa…"
                    className="w-56"
                />
                <HoursStepper hours={quickHours} onChange={onQuickHoursChange} />
                {targetActive && (
                    <button onClick={() => { onQuickJobChange(""); onSelectTool(null); }} title="Disattiva" className="p-1 text-slate-500 hover:text-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1" />

            <div className={cn(
                "flex items-center gap-1 rounded-md border-2 p-1",
                otherActive ? (selectedTool === 'delete' ? "border-red-600 ring-2 ring-offset-1 ring-red-300" : "border-gray-900 dark:border-white ring-2 ring-offset-1 ring-gray-400") : "border-transparent"
            )}>
                <Select
                    value={otherActive ? selectedTool! : ""}
                    onValueChange={(v) => { onQuickJobChange(""); onSelectTool(v as AttendanceStatus | 'delete'); }}
                >
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Assenze e altro…">
                            {selectedTool === 'delete' ? (
                                <span className="flex items-center gap-2 text-red-600"><Trash2 className="h-4 w-4" />Elimina</span>
                            ) : activeTool ? (
                                <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", activeTool.color)} />{activeTool.label}</span>
                            ) : null}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {tools.map(t => (
                            <SelectItem key={t.id} value={t.id}>
                                <span className="flex items-center gap-2"><span className={cn("h-3 w-3 rounded-sm", t.color)} />{t.label}</span>
                            </SelectItem>
                        ))}
                        <SelectItem value="delete">
                            <span className="flex items-center gap-2 text-red-600"><Trash2 className="h-4 w-4" />Elimina (svuota giornata)</span>
                        </SelectItem>
                    </SelectContent>
                </Select>
                {otherActive && (
                    <button onClick={() => onSelectTool(null)} title="Disattiva" className="p-1 text-slate-500 hover:text-slate-800">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {selectedTool && (
                <div className="ml-auto flex items-center text-sm text-blue-600 dark:text-blue-400 animate-pulse">
                    <Info className="h-4 w-4 mr-1" />
                    Modalità {selectedTool === 'delete' ? 'cancellazione' : 'inserimento'} attiva
                </div>
            )}
        </div>
    );
}
