import { supabase } from '@/lib/supabase';
import { Attendance } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToAttendance = (db: any): Attendance => ({
    id: db.id,
    workerId: db.worker_id,
    workerName: db.workers?.first_name ? `${db.workers.first_name} ${db.workers.last_name || ''}` : undefined,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    jobDescription: db.jobs?.description,
    warehouseId: db.warehouse_id,
    warehouseName: db.warehouses?.name,
    date: db.date,
    hours: Number(db.hours),
    status: db.status,
    notes: db.notes,
    createdAt: db.created_at
});

const mapAttendanceToDb = (att: Partial<Attendance>) => ({
    worker_id: att.workerId,
    job_id: att.jobId || null,
    warehouse_id: att.warehouseId || null,
    date: att.date,
    hours: att.hours,
    status: att.status,
    notes: att.notes
});

export const attendanceApi = {
    // Modified to return all records (no change strictly needed in query, but mapping usage on frontend changes)
    getByMonth: async (year: number, month: number): Promise<Attendance[]> => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

        const { data, error } = await supabase
            .from('attendance')
            .select('*, workers(first_name, last_name), jobs(code, description), warehouses(name)')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToAttendance);
    },

    // New: Add a SINGLE entry (append)
    addAttendance: async (record: Partial<Attendance>) => {
        const { data, error } = await supabase
            .from('attendance')
            .insert(mapAttendanceToDb(record))
            .select('*, workers(first_name, last_name), jobs(code, description), warehouses(name)')
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
            .select('*, workers(first_name, last_name), jobs(code, description), warehouses(name)')
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
            .select('*, workers(first_name, last_name), jobs(code, description), warehouses(name)')
            .eq('job_id', jobId)
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
    }
};
