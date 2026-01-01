import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Attendance, Worker } from "@/lib/api";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";

interface AttendanceInfoPopupProps {
    isOpen: boolean;
    onClose: () => void;
    worker: Worker | null;
    date: string | null;
    assignments: Attendance[];
    onEdit: (assignment: Attendance) => void;
    onDelete: (id: string) => void;
    onAddPresence?: () => void;
}

export default function AttendanceInfoPopup({
    isOpen,
    onClose,
    worker,
    date,
    assignments,
    onEdit,
    onDelete,
    onAddPresence
}: AttendanceInfoPopupProps) {
    if (!worker || !date) return null;

    const formattedDate = format(new Date(date), 'dd MMMM yyyy', { locale: it });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        Presenze - {worker.firstName} {worker.lastName}
                    </DialogTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    {assignments.length === 0 ? (
                        <div className="text-center py-6 space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nessuna presenza registrata
                            </p>
                            {onAddPresence && (
                                <Button onClick={onAddPresence} className="bg-blue-600 hover:bg-blue-700">
                                    Aggiungi Presenza
                                </Button>
                            )}
                        </div>
                    ) : (
                        assignments.map((assignment) => (
                            <div
                                key={assignment.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                                <div className="flex-1">
                                    {assignment.status === 'presence' ? (
                                        <>
                                            <p className="font-medium text-sm">
                                                {assignment.jobCode || assignment.jobDescription || 'Cantiere'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {assignment.hours} ore
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-medium text-sm capitalize">
                                                {getStatusLabel(assignment.status)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {assignment.hours} ore
                                            </p>
                                        </>
                                    )}
                                    {assignment.notes && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {assignment.notes}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onEdit(assignment)}
                                        className="h-8 w-8 p-0"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onDelete(assignment.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex justify-end">
                    <Button variant="outline" onClick={onClose}>
                        Chiudi
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        holiday: 'Ferie',
        permit: 'Permesso',
        sick: 'Malattia',
        strike: 'Sciopero',
        injury: 'Infortunio',
        transfer: 'Trasferta',
        course: 'Corso',
        absence: 'Assenza'
    };
    return labels[status] || status;
}
