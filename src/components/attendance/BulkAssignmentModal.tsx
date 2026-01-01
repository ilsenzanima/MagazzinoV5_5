import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Job, Worker, Attendance } from "@/lib/api";
import { useState } from "react";
import { format, eachDayOfInterval, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface AttendanceEntry {
    status: string;
    jobId?: string;
    hours: number;
    notes?: string;
}

interface BulkAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (workerIds: string[], startDate: Date, endDate: Date, entries: Partial<Attendance>[]) => Promise<void>;
    workers: Worker[];
    jobs: Job[];
}

export default function BulkAssignmentModal({
    isOpen,
    onClose,
    onSave,
    workers,
    jobs
}: BulkAssignmentModalProps) {
    const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [entries, setEntries] = useState<AttendanceEntry[]>([{
        status: 'presence',
        jobId: '',
        hours: 8,
        notes: ''
    }]);
    const [isLoading, setIsLoading] = useState(false);

    // Toggle worker selection
    const toggleWorker = (id: string) => {
        setSelectedWorkers(prev =>
            prev.includes(id) ? prev.filter(wId => wId !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedWorkers.length === workers.length) {
            setSelectedWorkers([]);
        } else {
            setSelectedWorkers(workers.map(w => w.id));
        }
    };

    const addEntry = () => {
        setEntries([...entries, {
            status: 'presence',
            jobId: '',
            hours: 8,
            notes: ''
        }]);
    };

    const removeEntry = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const updateEntry = (index: number, field: keyof AttendanceEntry, value: any) => {
        const newEntries = [...entries];
        newEntries[index] = { ...newEntries[index], [field]: value };
        setEntries(newEntries);
    };

    const handleSave = async () => {
        if (selectedWorkers.length === 0) return;
        setIsLoading(true);
        try {
            const attendanceEntries = entries.map(entry => ({
                jobId: entry.jobId === 'none' || !entry.jobId ? undefined : entry.jobId,
                hours: entry.hours,
                status: entry.status as any,
                notes: entry.notes
            }));

            await onSave(
                selectedWorkers,
                new Date(startDate),
                new Date(endDate),
                attendanceEntries
            );
            onClose();
            setEntries([{ status: 'presence', jobId: '', hours: 8, notes: '' }]);
        } catch (error) {
            console.error("Error saving bulk:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Assegnazione di Squadra</DialogTitle>
                    <p className="text-sm text-gray-500">
                        Assegna più operai allo stesso cantiere per un periodo.
                    </p>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    {/* Column 1: Workers Selection */}
                    <div className="space-y-4 border-r pr-4">
                        <div className="flex justify-between items-center">
                            <Label>Operai ({selectedWorkers.length})</Label>
                            <Button variant="ghost" size="sm" onClick={selectAll}>
                                {selectedWorkers.length === workers.length ? "Deseleziona tutti" : "Seleziona tutti"}
                            </Button>
                        </div>
                        <div className="border rounded-md h-64 overflow-y-auto p-2 space-y-2">
                            {workers.map(worker => (
                                <div key={worker.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded">
                                    <Checkbox
                                        id={`bulk-worker-${worker.id}`}
                                        checked={selectedWorkers.includes(worker.id)}
                                        onCheckedChange={() => toggleWorker(worker.id)}
                                    />
                                    <Label htmlFor={`bulk-worker-${worker.id}`} className="flex-1 cursor-pointer font-normal text-gray-900 dark:text-gray-100">
                                        {worker.firstName} {worker.lastName}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Assignment Details */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Dal giorno</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Al giorno</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-base font-semibold">Stati da Assegnare</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addEntry} className="gap-1">
                                    <span className="text-lg">+</span> Aggiungi Stato
                                </Button>
                            </div>

                            {entries.map((entry, index) => (
                                <div key={index} className="border rounded-lg p-3 space-y-3 bg-gray-50 dark:bg-slate-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">Stato {index + 1}</span>
                                        {entries.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeEntry(index)}
                                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                            >
                                                ×
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select value={entry.status} onValueChange={(val) => updateEntry(index, 'status', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="presence">Presenza</SelectItem>
                                                <SelectItem value="absence">Assenza Ingiustificata</SelectItem>
                                                <SelectItem value="sick">Malattia</SelectItem>
                                                <SelectItem value="holiday">Ferie/Permesso</SelectItem>
                                                <SelectItem value="injury">Infortunio</SelectItem>
                                                <SelectItem value="transfer">Trasferta</SelectItem>
                                                <SelectItem value="course">Corso</SelectItem>
                                                <SelectItem value="strike">Sciopero</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(entry.status === 'presence' || entry.status === 'holiday') && (
                                        <div className="space-y-2">
                                            <Label>Cantiere</Label>
                                            <Select value={entry.jobId || 'none'} onValueChange={(val) => updateEntry(index, 'jobId', val)}>
                                                <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Nessun cantiere</SelectItem>
                                                    {jobs.map(job => (
                                                        <SelectItem key={job.id} value={job.id}>
                                                            {job.code} - {job.description}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>Ore</Label>
                                        <Input
                                            type="number"
                                            step="0.5"
                                            value={entry.hours}
                                            onChange={(e) => updateEntry(index, 'hours', Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Note</Label>
                                        <Input
                                            value={entry.notes || ''}
                                            onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || selectedWorkers.length === 0}>
                        {isLoading ? "Salvataggio..." : selectedWorkers.length === 1 ? "Salva" : `Assegna a ${selectedWorkers.length} Operai`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
