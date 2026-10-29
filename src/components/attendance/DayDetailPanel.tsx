import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select";
import { Attendance, Worker } from "@/lib/api";
import { HoursStepper } from "./HoursStepper";

interface DayDetailPanelProps {
    worker: Worker;
    date: Date;
    entries: Attendance[];
    // Tutte le voci dell'operaio nel periodo mostrato, per il riepilogo
    periodEntries: Attendance[];
    periodLabel: string;
    targets: SearchableSelectOption[];
    canEdit: boolean;
    onChangeHours: (entry: Attendance, delta: number) => void;
    onEdit: (entry: Attendance) => void;
    onDelete: (id: string) => void;
    onAdd: (jobId: string, hours: number) => void;
    onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
    holiday: 'Ferie', permit: 'Permesso', sick: 'Malattia', strike: 'Sciopero', injury: 'Infortunio',
    transfer: 'Trasferta', course: 'Corso', absence: 'Assenza', medical_exam: 'Visita medica',
};

// Voci con ore regolabili: cantiere e trasferta; le assenze si modificano dalla matita
const isWorkEntry = (a: Attendance) => a.status === 'presence' || a.status === 'transfer';

const entryLabel = (a: Attendance) => isWorkEntry(a)
    ? a.warehouseName || (a.jobCode ? `${a.jobCode} - ${a.jobName || a.jobDescription || ''}` : a.jobName || a.jobDescription || 'Cantiere')
    : STATUS_LABELS[a.status] || a.status;

const fmtHours = (h: number) => `${String(h).replace('.', ',')} h`;

export default function DayDetailPanel({ worker, date, entries, periodEntries, periodLabel, targets, canEdit, onChangeHours, onEdit, onDelete, onAdd, onClose }: DayDetailPanelProps) {
    const [newJobId, setNewJobId] = useState("");
    const [newHours, setNewHours] = useState(8);
    const [showSummary, setShowSummary] = useState(false);

    // Riepilogo del periodo: ore e giorni per tipo, poi ore per cantiere
    const byType = new Map<string, { hours: number; days: Set<string> }>();
    const byTarget = new Map<string, number>();
    periodEntries.forEach(a => {
        const key = isWorkEntry(a) ? 'work' : a.status;
        const t = byType.get(key) || { hours: 0, days: new Set<string>() };
        t.hours += a.hours; t.days.add(a.date); byType.set(key, t);
        if (isWorkEntry(a)) byTarget.set(entryLabel(a), (byTarget.get(entryLabel(a)) || 0) + a.hours);
    });
    const typeRows = Array.from(byType.entries()).sort((x, y) => (x[0] === 'work' ? -1 : y[0] === 'work' ? 1 : y[1].hours - x[1].hours));
    const total = entries.reduce((s, a) => s + a.hours, 0);

    return (
        <div className="sticky bottom-2 z-30 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-border dark:bg-card">
            <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        <button type="button" onClick={() => setShowSummary(v => !v)} className="text-left underline decoration-dotted underline-offset-4 hover:text-blue-600" title="Mostra il riepilogo del periodo">
                            {worker.lastName} {worker.firstName}
                        </button>
                    </h2>
                    <p className="text-sm capitalize text-slate-500">
                        {format(date, 'EEEE d MMMM yyyy', { locale: it })}
                        {entries.length > 0 && <span className="normal-case"> · totale {fmtHours(total)}</span>}
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi dettaglio giornata"><X className="h-4 w-4" /></Button>
            </div>

            {showSummary && (
                <div className="mb-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                    <p className="mb-2 font-medium capitalize">Riepilogo {periodLabel}</p>
                    {typeRows.length === 0 ? (
                        <p className="text-slate-500">Nessuna voce nel periodo</p>
                    ) : (
                        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                            <div>
                                {typeRows.map(([key, v]) => (
                                    <div key={key} className="flex justify-between gap-4">
                                        <span>{key === 'work' ? 'Lavoro' : STATUS_LABELS[key] || key}</span>
                                        <span className="tabular-nums font-semibold">{fmtHours(v.hours)} <span className="font-normal text-slate-500">· {v.days.size} gg</span></span>
                                    </div>
                                ))}
                            </div>
                            {byTarget.size > 0 && (
                                <div className="border-t border-slate-200 pt-2 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 dark:border-slate-700">
                                    {Array.from(byTarget.entries()).sort((x, y) => y[1] - x[1]).map(([label, h]) => (
                                        <div key={label} className="flex justify-between gap-4">
                                            <span className="truncate">{label}</span>
                                            <span className="tabular-nums font-semibold">{fmtHours(h)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {entries.length === 0 ? (
                <p className="py-2 text-sm text-slate-500">Nessuna presenza registrata</p>
            ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entries.map(a => (
                        <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                            <div className="min-w-0 flex-1 basis-48">
                                <p className="truncate text-sm font-medium">
                                    {entryLabel(a)}
                                    {a.status === 'transfer' && <span className="ml-2 text-xs text-purple-600">(Trasferta)</span>}
                                </p>
                                {a.notes && <p className="truncate text-xs text-slate-400">{a.notes}</p>}
                            </div>
                            {canEdit && isWorkEntry(a) ? (
                                <HoursStepper hours={a.hours} onChange={d => onChangeHours(a, d)} />
                            ) : (
                                <span className="w-16 text-center text-sm font-semibold">{fmtHours(a.hours)}</span>
                            )}
                            {canEdit && (
                                <div className="flex">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(a)} aria-label="Modifica"><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(a.id)} aria-label="Elimina"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {canEdit && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <SearchableSelect
                        options={targets}
                        value={newJobId}
                        onValueChange={setNewJobId}
                        placeholder="Aggiungi cantiere o magazzino…"
                        searchPlaceholder="Cerca commessa…"
                        className="w-full sm:w-72"
                    />
                    <HoursStepper hours={newHours} onChange={d => setNewHours(h => Math.min(24, Math.max(0.5, h + d)))} />
                    <Button disabled={!newJobId} onClick={() => { onAdd(newJobId, newHours); setNewJobId(""); }} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="mr-1 h-4 w-4" />Aggiungi
                    </Button>
                </div>
            )}
        </div>
    );
}
