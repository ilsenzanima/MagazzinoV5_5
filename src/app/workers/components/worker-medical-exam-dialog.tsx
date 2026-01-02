"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkerMedicalExam } from "@/lib/api";
import { format, addMonths } from "date-fns";

interface WorkerMedicalExamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    exam: WorkerMedicalExam | null;
    onSave: (data: Partial<WorkerMedicalExam>) => Promise<void>;
}

export function WorkerMedicalExamDialog({
    open,
    onOpenChange,
    exam,
    onSave,
}: WorkerMedicalExamDialogProps) {
    const [examDate, setExamDate] = useState("");
    const [nextExamDate, setNextExamDate] = useState("");
    const [doctorName, setDoctorName] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (exam) {
            setExamDate(exam.examDate);
            setNextExamDate(exam.nextExamDate);
            setDoctorName(exam.doctorName || "");
            setNotes(exam.notes || "");
        } else {
            const today = format(new Date(), 'yyyy-MM-dd');
            const oneYearLater = format(addMonths(new Date(), 12), 'yyyy-MM-dd');
            setExamDate(today);
            setNextExamDate(oneYearLater);
            setDoctorName("");
            setNotes("");
        }
    }, [exam, open]);

    // Auto-calculate next exam date when exam date changes (6 months)
    const handleExamDateChange = (value: string) => {
        setExamDate(value);
        if (value) {
            const nextDate = addMonths(new Date(value), 12);
            setNextExamDate(format(nextDate, 'yyyy-MM-dd'));
        }
    };

    const handleSave = async () => {
        if (!examDate || !nextExamDate) return;

        try {
            setSaving(true);
            await onSave({
                examDate,
                nextExamDate,
                doctorName: doctorName.trim() || undefined,
                notes: notes.trim() || undefined,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>
                        {exam ? "Modifica Visita" : "Aggiungi Visita Medica"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="examDate">Data Visita</Label>
                        <Input
                            id="examDate"
                            type="date"
                            value={examDate}
                            onChange={(e) => handleExamDateChange(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="nextExamDate">Prossima Visita</Label>
                        <Input
                            id="nextExamDate"
                            type="date"
                            value={nextExamDate}
                            onChange={(e) => setNextExamDate(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">
                            Calcolato automaticamente a 12 mesi, modificabile se necessario.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="doctorName">Nome Medico (opzionale)</Label>
                        <Input
                            id="doctorName"
                            value={doctorName}
                            onChange={(e) => setDoctorName(e.target.value)}
                            placeholder="es. Dott. Rossi"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Note (opzionale)</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Eventuali note..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={!examDate || !nextExamDate || saving}>
                        {saving ? "Salvataggio..." : "Salva"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
