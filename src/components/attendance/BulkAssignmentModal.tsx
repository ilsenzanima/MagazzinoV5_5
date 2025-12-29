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

interface BulkAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (workerIds: string[], startDate: Date, endDate: Date, assignment: Partial<Attendance>) => Promise<void>;
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

    const [jobId, setJobId] = useState<string>("");
    const [hours, setHours] = useState<number>(8);
    const [status, setStatus] = useState<string>("presence");
    const [notes, setNotes] = useState<string>("");
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

    const handleSave = async () => {
        if (selectedWorkers.length === 0) return;
        setIsLoading(true);
        try {
            const assignmentData = {
                jobId: jobId === 'none' ? undefined : jobId,
                hours,
                status: status as any,
                notes
            };

            await onSave(
                selectedWorkers,
                new Date(startDate),
                new Date(endDate),
                assignmentData
            );
            onClose();
            // Reset logic could go here
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
                                <div key={worker.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded">
                                    <Checkbox
                                        id={`bulk-worker-${worker.id}`}
                                        checked={selectedWorkers.includes(worker.id)}
                                        onCheckedChange={() => toggleWorker(worker.id)}
                                    />
                                    <Label htmlFor={`bulk-worker-${worker.id}`} className="flex-1 cursor-pointer font-normal">
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

                        <div className="space-y-2 pt-2 border-t">
                            <Label>Stato</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="presence">Presenza</SelectItem>
                                    <SelectItem value="absence">Assenza Ingiustificata</SelectItem>
                                    <SelectItem value="sick">Malattia</SelectItem>
                                    <SelectItem value="holiday">Ferie</SelectItem>
                                    <SelectItem value="permit">Permesso</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(status === 'presence' || status === 'permit') && (
                            <>
                                <div className="space-y-2">
                                    <Label>Cantiere</Label>
                                    <Select value={jobId} onValueChange={setJobId}>
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
                                <div className="space-y-2">
                                    <Label>Ore Giornaliere</Label>
                                    <Input
                                        type="number" step="0.5"
                                        value={hours} onChange={(e) => setHours(Number(e.target.value))}
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Note</Label>
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || selectedWorkers.length === 0}>
                        {isLoading ? "Salvataggio..." : "Assegna a Tutti"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
