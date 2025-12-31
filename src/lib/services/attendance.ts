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
    date: db.date,
    hours: Number(db.hours),
    status: db.status,
    notes: db.notes,
    createdAt: db.created_at
});

const mapAttendanceToDb = (att: Partial<Attendance>) => ({
    worker_id: att.workerId,
    job_id: att.jobId || null,
    date: att.date,
    hours: att.hours,
    status: att.status,
    notes: att.notes
});

export const attendanceApi = {
    getByDateRange: async (startDate: string, endDate: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('attendance')
                .select('*, workers(first_name, last_name), jobs(code, description)')
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true })
        );

        if (error) throw error;
        return (data || []).map(mapDbToAttendance);
    },

    upsert: async (record: Partial<Attendance>) => {
        // We use upsert with onConflict to handle unique constraint on (worker_id, date)
        const { data, error } = await supabase
            .from('attendance')
            .upsert(mapAttendanceToDb(record), { onConflict: 'worker_id, date' })
            .select('*, workers(first_name, last_name), jobs(code, description)')
            .single();

        if (error) throw error;
        return mapDbToAttendance(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) throw error;
    }
};
