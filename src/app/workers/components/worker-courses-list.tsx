"use client";

import { useState, useEffect } from "react";
import { WorkerCourse, workerCoursesApi } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Award, Loader2 } from "lucide-react";
import { format, addYears, isBefore, isAfter, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";
import { WorkerCourseDialog } from "./worker-course-dialog";
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

interface WorkerCoursesListProps {
    workerId: string;
    workerName: string;
}

export function WorkerCoursesList({ workerId, workerName }: WorkerCoursesListProps) {
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [courses, setCourses] = useState<WorkerCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<WorkerCourse | null>(null);

    const canEdit = userRole === 'admin' || userRole === 'operativo';

    const loadCourses = async () => {
        try {
            setLoading(true);
            const data = await workerCoursesApi.getByWorkerId(workerId);
            setCourses(data);
        } catch (error) {
            console.error("Error loading courses:", error);
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile caricare i corsi.",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourses();
    }, [workerId]);

    const getExpirationDate = (course: WorkerCourse) => {
        return addYears(new Date(course.completionDate), course.validityYears);
    };

    const getExpirationStatus = (course: WorkerCourse) => {
        const expDate = getExpirationDate(course);
        const now = new Date();
        const threeMonthsFromNow = subMonths(expDate, 3);

        if (isBefore(expDate, now)) {
            return "expired"; // Scaduto
        } else if (isBefore(threeMonthsFromNow, now)) {
            return "expiring"; // In scadenza (< 3 mesi)
        }
        return "valid"; // Valido
    };

    const handleAddCourse = () => {
        setEditingCourse(null);
        setDialogOpen(true);
    };

    const handleEditCourse = (course: WorkerCourse) => {
        setEditingCourse(course);
        setDialogOpen(true);
    };

    const handleDeleteCourse = async (courseId: string) => {
        try {
            await workerCoursesApi.delete(courseId);
            toast({
                title: "Corso eliminato",
                description: "Il corso è stato rimosso.",
            });
            loadCourses();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile eliminare il corso.",
            });
        }
    };

    const handleSave = async (data: Partial<WorkerCourse>) => {
        try {
            if (editingCourse) {
                await workerCoursesApi.update(editingCourse.id, data);
                toast({ title: "Corso aggiornato" });
            } else {
                await workerCoursesApi.create({ ...data, workerId });
                toast({ title: "Corso aggiunto" });
            }
            setDialogOpen(false);
            loadCourses();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile salvare il corso.",
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
                    <Button size="sm" onClick={handleAddCourse}>
                        <Plus className="h-4 w-4 mr-2" />
                        Aggiungi Corso
                    </Button>
                </div>
            )}

            {courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <Award className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                        Nessun corso registrato
                    </h3>
                    <p className="text-sm text-slate-500 max-w-sm mt-2">
                        {canEdit
                            ? `Aggiungi i corsi di formazione per ${workerName}.`
                            : `Nessun corso registrato per ${workerName}.`}
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="text-left p-3 font-semibold text-slate-700 dark:text-slate-300">Nome Corso</th>
                                <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Ultimo Aggiornamento</th>
                                <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Validità</th>
                                <th className="text-center p-3 font-semibold text-slate-700 dark:text-slate-300">Scadenza</th>
                                {canEdit && <th className="text-right p-3 font-semibold text-slate-700 dark:text-slate-300">Azioni</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map((course) => {
                                const status = getExpirationStatus(course);
                                const expDate = getExpirationDate(course);

                                return (
                                    <tr key={course.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                                            {course.courseName}
                                        </td>
                                        <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                                            {format(new Date(course.completionDate), 'dd/MM/yyyy', { locale: it })}
                                        </td>
                                        <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                                            {course.validityYears} {course.validityYears === 1 ? 'anno' : 'anni'}
                                        </td>
                                        <td className="p-3 text-center">
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
                                                {format(expDate, 'dd/MM/yyyy', { locale: it })}
                                            </Badge>
                                        </td>
                                        {canEdit && (
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditCourse(course)}>
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
                                                                <AlertDialogTitle>Eliminare corso?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Eliminare il corso "{course.courseName}"?
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteCourse(course.id)} className="bg-red-600 hover:bg-red-700">
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

            <WorkerCourseDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                course={editingCourse}
                onSave={handleSave}
            />
        </div>
    );
}
