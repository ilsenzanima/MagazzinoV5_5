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
import { WorkerCourse } from "@/lib/api";
import { format } from "date-fns";

interface WorkerCourseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    course: WorkerCourse | null;
    onSave: (data: Partial<WorkerCourse>) => Promise<void>;
}

export function WorkerCourseDialog({
    open,
    onOpenChange,
    course,
    onSave,
}: WorkerCourseDialogProps) {
    const [courseName, setCourseName] = useState("");
    const [completionDate, setCompletionDate] = useState("");
    const [validityYears, setValidityYears] = useState(1);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (course) {
            setCourseName(course.courseName);
            setCompletionDate(course.completionDate);
            setValidityYears(course.validityYears);
        } else {
            setCourseName("");
            setCompletionDate(format(new Date(), 'yyyy-MM-dd'));
            setValidityYears(1);
        }
    }, [course, open]);

    const handleSave = async () => {
        if (!courseName.trim() || !completionDate) return;

        try {
            setSaving(true);
            await onSave({
                courseName: courseName.trim(),
                completionDate,
                validityYears,
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
                        {course ? "Modifica Corso" : "Aggiungi Corso"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="courseName">Nome Corso</Label>
                        <Input
                            id="courseName"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            placeholder="es. Sicurezza sul lavoro"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="completionDate">Data Completamento</Label>
                        <Input
                            id="completionDate"
                            type="date"
                            value={completionDate}
                            onChange={(e) => setCompletionDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validityYears">Validità (anni)</Label>
                        <Input
                            id="validityYears"
                            type="number"
                            min={1}
                            max={10}
                            value={validityYears}
                            onChange={(e) => setValidityYears(parseInt(e.target.value) || 1)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Annulla
                    </Button>
                    <Button onClick={handleSave} disabled={!courseName.trim() || !completionDate || saving}>
                        {saving ? "Salvataggio..." : "Salva"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
