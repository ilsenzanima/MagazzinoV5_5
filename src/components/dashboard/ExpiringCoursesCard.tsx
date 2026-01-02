"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkerCourse, workerCoursesApi, workersApi, Worker } from "@/lib/api";
import { Award, Loader2, AlertTriangle } from "lucide-react";
import { format, addYears, isBefore, subMonths, endOfYear } from "date-fns";
import { it } from "date-fns/locale";

interface CourseWithWorker extends WorkerCourse {
    workerName: string;
    expirationDate: Date;
}

export function ExpiringCoursesCard() {
    const [loading, setLoading] = useState(true);
    const [expiringCourses, setExpiringCourses] = useState<CourseWithWorker[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Get all workers
            const workers = await workersApi.getAll();
            const workersMap = new Map(workers.map(w => [w.id, `${w.lastName} ${w.firstName}`]));

            // Get all courses from all workers
            const allCourses: CourseWithWorker[] = [];
            const endOfThisYear = endOfYear(new Date());

            for (const worker of workers) {
                if (!worker.isActive) continue;

                const courses = await workerCoursesApi.getByWorkerId(worker.id);

                // Group by course name and get only latest per course
                const latestByCourse = new Map<string, WorkerCourse>();
                courses.forEach(c => {
                    const existing = latestByCourse.get(c.courseName);
                    if (!existing || c.completionDate > existing.completionDate) {
                        latestByCourse.set(c.courseName, c);
                    }
                });

                // Check if any are expiring this year
                latestByCourse.forEach(course => {
                    const expDate = addYears(new Date(course.completionDate), course.validityYears);

                    if (isBefore(expDate, endOfThisYear)) {
                        allCourses.push({
                            ...course,
                            workerName: workersMap.get(course.workerId) || 'N/D',
                            expirationDate: expDate
                        });
                    }
                });
            }

            // Sort by expiration date
            allCourses.sort((a, b) => a.expirationDate.getTime() - b.expirationDate.getTime());
            setExpiringCourses(allCourses);
        } catch (error) {
            console.error("Error loading expiring courses:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (expDate: Date) => {
        const now = new Date();
        const threeMonths = subMonths(expDate, 3);

        if (isBefore(expDate, now)) return 'expired';
        if (isBefore(threeMonths, now)) return 'expiring';
        return 'valid';
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Award className="h-5 w-5 text-blue-600" />
                    Corsi in Scadenza {new Date().getFullYear()}
                    {expiringCourses.length > 0 && (
                        <Badge variant="outline" className="ml-auto">
                            {expiringCourses.length}
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : expiringCourses.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">
                        Nessun corso in scadenza quest'anno
                    </p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {expiringCourses.map((course) => {
                            const status = getStatus(course.expirationDate);
                            return (
                                <div
                                    key={course.id}
                                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{course.workerName}</p>
                                        <p className="text-xs text-slate-500 truncate">{course.courseName}</p>
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
                                        {format(course.expirationDate, 'dd/MM/yy', { locale: it })}
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
