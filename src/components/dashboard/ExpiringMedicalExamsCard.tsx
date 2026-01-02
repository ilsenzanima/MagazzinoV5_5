"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkerMedicalExam, workerMedicalExamsApi, workersApi } from "@/lib/api";
import { Stethoscope, Loader2 } from "lucide-react";
import { format, isBefore, subMonths, endOfYear } from "date-fns";
import { it } from "date-fns/locale";

interface ExamWithWorker extends WorkerMedicalExam {
    workerName: string;
}

export function ExpiringMedicalExamsCard() {
    const [loading, setLoading] = useState(true);
    const [expiringExams, setExpiringExams] = useState<ExamWithWorker[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Get all workers
            const workers = await workersApi.getAll();
            const workersMap = new Map(workers.map(w => [w.id, `${w.lastName} ${w.firstName}`]));

            // Get all medical exams from all workers
            const allExams: ExamWithWorker[] = [];
            const endOfThisYear = endOfYear(new Date());

            for (const worker of workers) {
                if (!worker.isActive) continue;

                const exams = await workerMedicalExamsApi.getByWorkerId(worker.id);

                // Get only the latest exam (first one since sorted desc)
                if (exams.length > 0) {
                    const latestExam = exams[0];
                    const nextExamDate = new Date(latestExam.nextExamDate);

                    // Only include if expiring this year
                    if (isBefore(nextExamDate, endOfThisYear)) {
                        allExams.push({
                            ...latestExam,
                            workerName: workersMap.get(latestExam.workerId) || 'N/D'
                        });
                    }
                }
            }

            // Sort by next exam date
            allExams.sort((a, b) =>
                new Date(a.nextExamDate).getTime() - new Date(b.nextExamDate).getTime()
            );
            setExpiringExams(allExams);
        } catch (error) {
            console.error("Error loading expiring medical exams:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (nextExamDate: string) => {
        const expDate = new Date(nextExamDate);
        const now = new Date();
        const oneMonth = subMonths(expDate, 1);

        if (isBefore(expDate, now)) return 'expired';
        if (isBefore(oneMonth, now)) return 'expiring';
        return 'valid';
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Stethoscope className="h-5 w-5 text-teal-600" />
                    Visite Mediche in Scadenza {new Date().getFullYear()}
                    {expiringExams.length > 0 && (
                        <Badge variant="outline" className="ml-auto">
                            {expiringExams.length}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : expiringExams.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                        Nessuna visita in scadenza quest'anno
                    </p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {expiringExams.map((exam) => {
                            const status = getStatus(exam.nextExamDate);
                            return (
                                <div
                                    key={exam.id}
                                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{exam.workerName}</p>
                                        {exam.doctorName && (
                                            <p className="text-xs text-slate-500 truncate">{exam.doctorName}</p>
                                        )}
                                    </div>
                                    <Badge
                                        variant={status === 'expired' ? 'destructive' : status === 'expiring' ? 'outline' : 'default'}
                                        className={
                                            status === 'expiring'
                                                ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                                                : status === 'valid'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                                                    : ''
                                        }
                                    >
                                        {format(new Date(exam.nextExamDate), 'dd/MM/yy', { locale: it })}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
