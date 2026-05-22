import { supabase } from '@/lib/supabase';
import { Attendance } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToAttendance = (db: any): Attendance => ({
    id: db.id,
    workerId: db.worker_id,
    workerName: db.workers?.first_name ? `${db.workers.first_name} ${db.workers.last_name || ''}` : undefined,
    hourlyRate: db.workers?.hourly_rate !== undefined ? Number(db.workers.hourly_rate) : undefined,
    trasfertaRate: db.workers?.trasferta_rate !== undefined ? Number(db.workers.trasferta_rate) : undefined,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    jobName: db.jobs?.name,
    jobDescription: db.jobs?.description,
    warehouseId: db.warehouse_id,
    warehouseName: db.warehouses?.name,
    date: db.date,
    hours: Number(db.hours),
    status: db.status,
    notes: db.notes,
    courseId: db.course_id,
    courseName: db.worker_courses?.course_name,
    createdAt: db.created_at
});

const mapAttendanceToDb = (att: Partial<Attendance>) => ({
    worker_id: att.workerId,
    job_id: att.jobId || null,
    warehouse_id: att.warehouseId || null,
    date: att.date,
    hours: att.hours,
    status: att.status,
    notes: att.notes,
    course_id: att.courseId || null
});

export const attendanceApi = {
    // Modified to return all records (no change strictly needed in query, but mapping usage on frontend changes)
    getByMonth: async (year: number, month: number): Promise<Attendance[]> => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        // Calculate actual last day of month (months are 0-indexed in JS Date, so month = next month, day 0 = last day of current month)
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        console.log(`📅 Fetching attendance for ${startDate} to ${endDate}`);

        const { data, error } = await supabase
            .from('attendance')
            .select('*, workers(first_name, last_name), jobs(code, name, description), warehouses(name), worker_courses(course_name)')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) {
            console.error('❌ Attendance query error:', error);
            console.error('❌ Error details:', JSON.stringify(error, null, 2));
            throw error;
        }
        return (data || []).map(mapDbToAttendance);
    },

    // New: Add a SINGLE entry (append)
    addAttendance: async (record: Partial<Attendance>) => {
        const { data, error } = await supabase
            .from('attendance')
            .insert(mapAttendanceToDb(record))
            .select('*, workers(first_name, last_name), jobs(code, name, description), warehouses(name)')
            .single();

        if (error) throw error;
        return mapDbToAttendance(data);
    },

    // New: Clear all entries for a specific worker on a specific day
    deleteAllForDay: async (workerId: string, date: string) => {
        const { error } = await supabase
            .from('attendance')
            .delete()
            .eq('worker_id', workerId)
            .eq('date', date);

        if (error) throw error;
    },

    // New: Update existing record by ID
    update: async (id: string, record: Partial<Attendance>) => {
        const { data, error } = await supabase
            .from('attendance')
            .update(mapAttendanceToDb(record))
            .eq('id', id)
            .select('*, workers(first_name, last_name), jobs(code, name, description), warehouses(name)')
            .single();

        if (error) throw error;
        return mapDbToAttendance(data);
    },

    // Kept for backward compatibility if needed, but likely replaced by addAttendance
    delete: async (id: string) => {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) throw error;
    },

    // Get attendance records for a specific job
    getByJobId: async (jobId: string): Promise<Attendance[]> => {
        const { data, error } = await supabase
            .from('attendance')
            .select('*, workers(first_name, last_name), jobs(code, name, description), warehouses(name)')
            .eq('job_id', jobId)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToAttendance);
    },

    // Get total hours for a specific job (sum of all attendance hours)
    getTotalHoursByJobId: async (jobId: string): Promise<number> => {
        const { data, error } = await supabase
            .from('attendance')
            .select('hours')
            .eq('job_id', jobId);

        if (error) throw error;
        return (data || []).reduce((sum, record) => sum + (Number(record.hours) || 0), 0);
    },

    // Get first and last presence date for a job (for SAL worker hours date suggestion)
    getJobPresenceDateRange: async (jobId: string): Promise<{ first: string | null; last: string | null }> => {
        const { data, error } = await supabase
            .from('attendance')
            .select('date')
            .eq('job_id', jobId)
            .in('status', ['presence', 'transfer'])
            .order('date', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return { first: null, last: null };
        return { first: data[0].date, last: data[data.length - 1].date };
    },

    // Get attendance for a job within a date range (for SAL worker hours)
    getByJobIdAndDateRange: async (jobId: string, dateFrom: string, dateTo: string): Promise<Attendance[]> => {
        const { data, error } = await supabase
            .from('attendance')
            .select('*, workers(first_name, last_name, hourly_rate, trasferta_rate)')
            .eq('job_id', jobId)
            .gte('date', dateFrom)
            .lte('date', dateTo)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToAttendance);
    },

    // Get aggregated statistics for the last N months (for dashboard chart)
    getAggregatedStats: async (months: number = 6): Promise<{ name: string; presenze: number; ferie: number; malattia: number; corso: number }[]> => {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
        const startDateStr = startDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance')
            .select('date, status, hours')
            .gte('date', startDateStr)
            .order('date', { ascending: true });

        if (error) throw error;

        // Aggregate by month
        const monthlyStats = new Map<string, { presenze: number; ferie: number; malattia: number; corso: number }>();

        (data || []).forEach((record: any) => {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyStats.has(monthKey)) {
                monthlyStats.set(monthKey, { presenze: 0, ferie: 0, malattia: 0, corso: 0 });
            }

            const stats = monthlyStats.get(monthKey)!;
            const hours = Number(record.hours) || 0;

            switch (record.status) {
                case 'presence':
                    stats.presenze += hours;
                    break;
                case 'holiday':
                case 'permit':
                    stats.ferie += hours;
                    break;
                case 'sick':
                    stats.malattia += hours;
                    break;
                case 'course':
                    stats.corso += hours;
                    break;
            }
        });

        // Convert to array format for chart
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const result = Array.from(monthlyStats.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, stats]) => {
                const [year, month] = key.split('-');
                const monthIndex = parseInt(month) - 1;
                return {
                    name: monthNames[monthIndex],
                    ...stats
                };
            });

        return result;
    },

    getYearlyStatsByWorker: async (workerId: string, year?: number): Promise<{
        presenze: number; orePresenza: number;
        malattie: number; infortuni: number;
        ferie: number; permessi: number;
        corsi: number; visiteMediche: number;
        trasferimenti: number; assenze: number;
        oreRettifica: number; oreTotali: number;
    }> => {
        const y = year ?? new Date().getFullYear();
        const start = `${y}-01-01`;
        const end   = `${y}-12-31`;

        const [attResult, rettResult] = await Promise.all([
            supabase
                .from('attendance')
                .select('status, hours')
                .eq('worker_id', workerId)
                .gte('date', start)
                .lte('date', end),
            supabase
                .from('attendance_corrections')
                .select('hours_delta')
                .eq('worker_id', workerId)
                .gte('date', start)
                .lte('date', end),
        ]);

        if (attResult.error) throw attResult.error;
        if (rettResult.error) throw rettResult.error;

        const stats = {
            presenze: 0, orePresenza: 0,
            malattie: 0, infortuni: 0,
            ferie: 0, permessi: 0,
            corsi: 0, visiteMediche: 0,
            trasferimenti: 0, assenze: 0,
            oreRettifica: 0, oreTotali: 0,
        };

        (attResult.data || []).forEach((r: any) => {
            const h = Number(r.hours) || 0;
            stats.oreTotali += h;
            switch (r.status) {
                case 'presence':     stats.presenze++;       stats.orePresenza += h; break;
                case 'sick':         stats.malattie++;       break;
                case 'injury':       stats.infortuni++;      break;
                case 'holiday':      stats.ferie++;          break;
                case 'permit':       stats.permessi++;       break;
                case 'course':       stats.corsi++;          break;
                case 'medical_exam': stats.visiteMediche++;  break;
                case 'transfer':     stats.trasferimenti++;  break;
                case 'absence':      stats.assenze++;        break;
            }
        });

        (rettResult.data || []).forEach((r: any) => {
            const delta = Number(r.hours_delta) || 0;
            stats.oreRettifica += delta;
            stats.oreTotali += delta;
        });

        return stats;
    },

    getWorkerCostsByJobId: async (jobId: string): Promise<{
        rows: { workerId: string; workerName: string; normalHours: number; transferHours: number; normalCost: number; trasfertaCost: number; total: number }[];
        totalCost: number;
    }> => {
        const [attResult, corrResult] = await Promise.all([
            supabase
                .from('attendance')
                .select('worker_id, date, hours, status, workers(first_name, last_name, hourly_rate, trasferta_rate)')
                .eq('job_id', jobId),
            supabase
                .from('attendance_corrections')
                .select('worker_id, hours_delta')
                .eq('job_id', jobId),
        ]);

        if (attResult.error) throw attResult.error;
        if (corrResult.error) throw corrResult.error;

        // Aggregate per worker
        const map = new Map<string, {
            workerName: string; hourlyRate: number; trasfertaRate: number;
            normalHours: number; transferHours: number; transferDates: Set<string>;
        }>();

        (attResult.data || []).forEach((r: any) => {
            const wid = r.worker_id;
            if (!map.has(wid)) {
                const w = r.workers;
                map.set(wid, {
                    workerName: w ? `${w.first_name} ${w.last_name || ''}`.trim() : wid,
                    hourlyRate: Number(w?.hourly_rate ?? 25),
                    trasfertaRate: Number(w?.trasferta_rate ?? 50),
                    normalHours: 0,
                    transferHours: 0,
                    transferDates: new Set<string>(),
                });
            }
            const entry = map.get(wid)!;
            const h = Number(r.hours) || 0;
            if (r.status === 'transfer') {
                entry.transferHours += h;
                if (r.date) entry.transferDates.add(r.date);
            } else {
                entry.normalHours += h;
            }
        });

        // Apply corrections to normal hours
        (corrResult.data || []).forEach((r: any) => {
            const wid = r.worker_id;
            if (map.has(wid)) {
                map.get(wid)!.normalHours += Number(r.hours_delta) || 0;
            }
        });

        let totalCost = 0;
        const rows = Array.from(map.entries()).map(([workerId, e]) => {
            const normalCost = Math.max(0, e.normalHours) * e.hourlyRate;
            const trasfertaCost = e.transferHours * e.hourlyRate + e.transferDates.size * e.trasfertaRate;
            const total = normalCost + trasfertaCost;
            totalCost += total;
            return { workerId, workerName: e.workerName, normalHours: e.normalHours, transferHours: e.transferHours, normalCost, trasfertaCost, total };
        }).sort((a, b) => b.total - a.total);

        return { rows, totalCost };
    },

    // New: Get total hours for all ACTIVE jobs (for dashboard)
    getActiveJobHours: async (client?: any): Promise<{ jobId: string; jobName: string; jobCode: string; totalHours: number }[]> => {
        const supabaseClient = client || supabase;

        // 1. Get Active Jobs first
        const { data: activeJobs, error: jobsError } = await supabaseClient
            .from('jobs')
            .select('id, name, code')
            .eq('status', 'active');

        if (jobsError) throw jobsError;
        if (!activeJobs || activeJobs.length === 0) return [];

        const activeJobIds = activeJobs.map((j: any) => j.id);

        // 2. Get Attendance for these jobs
        const { data: attendance, error: attError } = await supabaseClient
            .from('attendance')
            .select('job_id, hours')
            .in('job_id', activeJobIds);

        if (attError) throw attError;

        // 3. Aggregate
        const hoursMap = new Map<string, number>();
        (attendance || []).forEach((record: any) => {
            const current = hoursMap.get(record.job_id) || 0;
            hoursMap.set(record.job_id, current + (Number(record.hours) || 0));
        });

        // 4. Map back to job details
        return activeJobs.map((job: any) => ({
            jobId: job.id,
            jobName: job.name,
            jobCode: job.code,
            totalHours: hoursMap.get(job.id) || 0
        })).sort((a: any, b: any) => b.totalHours - a.totalHours); // Sort by hours desc
    }
};
