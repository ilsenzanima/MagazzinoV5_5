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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { workerCoursesApi } from "@/lib/api";

interface CourseQuickSelectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (courseName: string) => void;
}

export function CourseQuickSelectDialog({
    open,
    onOpenChange,
    onConfirm,
}: CourseQuickSelectDialogProps) {
    const [courseNames, setCourseNames] = useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [isNewCourse, setIsNewCourse] = useState(false);
    const [newCourseName, setNewCourseName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (open) {
            setLoading(true);
            workerCoursesApi.getAllCourseNames()
                .then(names => {
                    setCourseNames(names);
                    setSelectedCourse("");
                    setIsNewCourse(false);
                    setNewCourseName("");
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [open]);

    const handleConfirm = () => {
        const courseName = isNewCourse ? newCourseName.trim() : selectedCourse;
        if (courseName) {
            onConfirm(courseName);
            onOpenChange(false);
        }
    };

    const isValid = isNewCourse ? newCourseName.trim().length > 0 : selectedCourse.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Quale corso?</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {loading ? (
                        <div className="text-center py-4 text-slate-500">Caricamento...</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <Label>Corso</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => setIsNewCourse(!isNewCourse)}
                                >
                                    {isNewCourse ? "Seleziona esistente" : "+ Nuovo corso"}
                                </Button>
                            </div>

                            {isNewCourse ? (
                                <Input
                                    placeholder="Nome nuovo corso..."
                                    value={newCourseName}
                                    onChange={(e) => setNewCourseName(e.target.value)}
                                    autoFocus
                                />
                            ) : (
                                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleziona corso..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {courseNames.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-slate-500">
                                                Nessun corso. Usa "+ Nuovo corso" per aggiungerne uno.
                                            </div>
                                        ) : (
                                            courseNames.map(name => (
                                                <SelectItem key={name} value={name}>
                                                    {name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annulla
                    </Button>
                    <Button onClick={handleConfirm} disabled={!isValid || loading}>
                        Conferma
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
