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
    }
};
