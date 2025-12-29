import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Job, Worker, Attendance } from "@/lib/api";
import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<Attendance>, repeatUntil?: Date) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    worker: Worker | null;
    date: Date | null;
    currentAssignment: Attendance | null;
    jobs: Job[];
}

export default function AssignmentModal({
    isOpen,
    onClose,
    onSave,
    onDelete,
    worker,
    date,
    currentAssignment,
    jobs
}: AssignmentModalProps) {
    const [jobId, setJobId] = useState<string>("");
    const [hours, setHours] = useState<number>(8);
    const [status, setStatus] = useState<string>("presence");
    const [notes, setNotes] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    // Recurring
    const [isRecurring, setIsRecurring] = useState(false);
    const [repeatUntil, setRepeatUntil] = useState<string>("");

    useEffect(() => {
        if (isOpen && currentAssignment) {
            setJobId(currentAssignment.jobId || "");
            setHours(currentAssignment.hours || 8);
            setStatus(currentAssignment.status || "presence");
            setNotes(currentAssignment.notes || "");
            setIsRecurring(false);
            setRepeatUntil("");
        } else {
            setJobId("");
            setHours(8); // Default to full day
            setStatus("presence");
            setNotes("");
            setIsRecurring(false);
            if (date) {
                setRepeatUntil(format(addDays(date, 4), 'yyyy-MM-dd')); // Default +4 days
            }
        }
    }, [isOpen, currentAssignment, date]);

    if (!worker || !date) return null;

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const payload = {
                id: currentAssignment?.id,
                workerId: worker.id,
                date: format(date, 'yyyy-MM-dd'),
                jobId: jobId === 'none' ? undefined : jobId,
                hours,
                status: status as any,
                notes
            };

            const endDate = isRecurring && repeatUntil ? new Date(repeatUntil) : undefined;

            await onSave(payload, endDate);
            onClose();
        } catch (error) {
            console.error("Error saving:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!currentAssignment?.id) return;
        setIsLoading(true);
        try {
            await onDelete(currentAssignment.id);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Gestione Presenza - {worker.firstName} {worker.lastName}
                    </DialogTitle>
                    <div className="text-sm text-gray-500">
                        {format(date, 'EEEE d MMMM yyyy', { locale: it })}
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Stato</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
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
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona cantiere..." />
                                    </SelectTrigger>
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
                                <Label>Ore</Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="24"
                                    value={hours}
                                    onChange={(e) => setHours(Number(e.target.value))}
                                />
                            </div>
                        </>
                    )}

                    <div className="space-y-2">
                        <Label>Note</Label>
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>

                    {!currentAssignment && (
                        <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="recurring"
                                    checked={isRecurring}
                                    onCheckedChange={(c) => setIsRecurring(c as boolean)}
                                />
                                <Label htmlFor="recurring" className="cursor-pointer">Ripeti assegnazione</Label>
                            </div>

                            {isRecurring && (
                                <div className="pt-2">
                                    <Label>Fino al giorno:</Label>
                                    <Input
                                        type="date"
                                        value={repeatUntil}
                                        onChange={(e) => setRepeatUntil(e.target.value)}
                                        min={format(addDays(date, 1), 'yyyy-MM-dd')}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {currentAssignment && (
                        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            Elimina
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        Salva
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
