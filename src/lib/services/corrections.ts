import { supabase } from '@/lib/supabase';
import { AttendanceCorrection } from '@/lib/types';

const mapDbToCorrection = (db: any): AttendanceCorrection => ({
    id: db.id,
    workerId: db.worker_id,
    workerName: db.workers ? `${db.workers.first_name} ${db.workers.last_name || ''}`.trim() : undefined,
    jobId: db.job_id,
    jobName: db.jobs?.name,
    jobCode: db.jobs?.code,
    warehouseId: db.warehouse_id,
    warehouseName: db.warehouses?.name,
    date: db.date,
    hoursDelta: Number(db.hours_delta),
    createdAt: db.created_at,
});

export const correctionsApi = {
    getByMonth: async (year: number, month: number): Promise<AttendanceCorrection[]> => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('attendance_corrections')
            .select('*, workers(first_name, last_name), jobs(code, name), warehouses(name)')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToCorrection);
    },

    getByWorkerMonth: async (workerId: string, year: number, month: number): Promise<AttendanceCorrection[]> => {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('attendance_corrections')
            .select('*, workers(first_name, last_name), jobs(code, name), warehouses(name)')
            .eq('worker_id', workerId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToCorrection);
    },

    getByJobId: async (jobId: string): Promise<AttendanceCorrection[]> => {
        const { data, error } = await supabase
            .from('attendance_corrections')
            .select('*, workers(first_name, last_name), jobs(code, name), warehouses(name)')
            .eq('job_id', jobId)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapDbToCorrection);
    },

    upsert: async (
        workerId: string,
        date: string,
        hoursDelta: number,
        jobId?: string,
        warehouseId?: string
    ): Promise<void> => {
        if (hoursDelta === 0) {
            // Delete correction if delta is zero (clean up)
            let query = supabase
                .from('attendance_corrections')
                .delete()
                .eq('worker_id', workerId)
                .eq('date', date);

            if (jobId) query = query.eq('job_id', jobId);
            else if (warehouseId) query = query.eq('warehouse_id', warehouseId);

            const { error } = await query;
            if (error) throw error;
            return;
        }

        const record: any = {
            worker_id: workerId,
            date,
            hours_delta: hoursDelta,
            job_id: jobId || null,
            warehouse_id: warehouseId || null,
        };

        // Use upsert with onConflict handled by the unique partial indexes
        // We need to check if a record already exists and update or insert
        let existingQuery = supabase
            .from('attendance_corrections')
            .select('id')
            .eq('worker_id', workerId)
            .eq('date', date);

        if (jobId) existingQuery = existingQuery.eq('job_id', jobId);
        else if (warehouseId) existingQuery = existingQuery.eq('warehouse_id', warehouseId);

        const { data: existing } = await existingQuery.maybeSingle();

        if (existing?.id) {
            const { error } = await supabase
                .from('attendance_corrections')
                .update({ hours_delta: hoursDelta })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('attendance_corrections')
                .insert(record);
            if (error) throw error;
        }
    },
};
