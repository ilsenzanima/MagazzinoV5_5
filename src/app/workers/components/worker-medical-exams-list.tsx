"use client";

import { useState, useEffect } from "react";
import { WorkerMedicalExam, workerMedicalExamsApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Stethoscope, Loader2 } from "lucide-react";
import { format, addMonths, isBefore, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";
import { WorkerMedicalExamDialog } from "./worker-medical-exam-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WorkerMedicalExamsListProps {
    workerId: string;
    workerName: string;
}

export function WorkerMedicalExamsList({ workerId, workerName }: WorkerMedicalExamsListProps) {
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [exams, setExams] = useState<WorkerMedicalExam[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<WorkerMedicalExam | null>(null);

    const canEdit = userRole === 'admin' || userRole === 'operativo';

    const loadExams = async () => {
        try {
            setLoading(true);
            const data = await workerMedicalExamsApi.getByWorkerId(workerId);
            setExams(data);
        } catch (error) {
            console.error("Error loading exams:", error);
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile caricare le visite mediche.",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExams();
    }, [workerId]);

    const getExpirationStatus = (exam: WorkerMedicalExam) => {
        const nextDate = new Date(exam.nextExamDate);
        const now = new Date();
        const oneMonthBefore = subMonths(nextDate, 1);

        if (isBefore(nextDate, now)) {
            return "expired"; // Scaduta
        } else if (isBefore(oneMonthBefore, now)) {
            return "expiring"; // In scadenza (< 1 mese)
        }
        return "valid"; // Valida
    };

    const handleAddExam = () => {
        setEditingExam(null);
        setDialogOpen(true);
    };

    const handleEditExam = (exam: WorkerMedicalExam) => {
        setEditingExam(exam);
        setDialogOpen(true);
    };

    const handleDeleteExam = async (examId: string) => {
        try {
            await workerMedicalExamsApi.delete(examId);
            toast({
                title: "Visita eliminata",
                description: "La visita medica è stata rimossa.",
            });
            loadExams();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile eliminare la visita.",
            });
        }
    };

    const handleSave = async (data: Partial<WorkerMedicalExam>) => {
        try {
            if (editingExam) {
                await workerMedicalExamsApi.update(editingExam.id, data);
                toast({ title: "Visita aggiornata" });
            } else {
                await workerMedicalExamsApi.create({ ...data, workerId });
                toast({ title: "Visita aggiunta" });
            }
            setDialogOpen(false);
            loadExams();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile salvare la visita.",
            });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {canEdit && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddExam}>
                        <Plus className="h-4 w-4 mr-2" />
                        Aggiungi Visita
                    </Button>
                </div>
            )}

            {exams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <Stethoscope className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                        Nessuna visita registrata
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-2">
                        {canEdit
                            ? `Aggiungi le visite mediche per ${workerName}.`
                            : `Nessuna visita registrata per ${workerName}.`}
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Data Visita</th>
                                <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Prossima Visita</th>
                                <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Medico</th>
                                {canEdit && <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Azioni</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {exams.map((exam, index) => {
                                // Only show expiration status badge for the LATEST exam (index 0)
                                const isLatest = index === 0;
                                const status = isLatest ? getExpirationStatus(exam) : 'history';

                                return (
                                    <tr key={exam.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                                            {format(new Date(exam.examDate), 'dd/MM/yyyy', { locale: it })}
                                        </td>
                                        <td className="p-3 text-center">
                                            {isLatest ? (
                                                <Badge
                                                    variant={status === 'expired' ? 'destructive' : status === 'expiring' ? 'outline' : 'default'}
                                                    className={
                                                        status === 'expiring'
                                                            ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                            : status === 'valid'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : ''
                                                    }
                                                >
                                                    {format(new Date(exam.nextExamDate), 'dd/MM/yyyy', { locale: it })}
                                                </Badge>
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 text-sm">
                                                    {format(new Date(exam.nextExamDate), 'dd/MM/yyyy', { locale: it })}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-slate-600 dark:text-slate-400">
                                            {exam.doctorName || '-'}
                                        </td>
                                        {canEdit && (
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditExam(exam)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Eliminare visita?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Eliminare questa visita medica?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteExam(exam.id)} className="bg-red-600 hover:bg-red-700">
                                                                    Elimina
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <WorkerMedicalExamDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                exam={editingExam}
                onSave={handleSave}
            />
        </div>
    );
}
