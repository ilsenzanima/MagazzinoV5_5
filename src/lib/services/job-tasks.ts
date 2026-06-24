import { supabase } from '@/lib/supabase';
import { JobTask } from '@/lib/types';
import { fetchWithTimeout } from './utils';

const mapDbToJobTask = (db: any): JobTask => ({
    id: db.id,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    jobName: db.jobs?.name,
    jobStatus: db.jobs?.status,
    name: db.name,
    startDate: db.start_date,
    endDate: db.end_date,
    progress: db.progress ?? 0,
    status: db.status,
    sortOrder: db.sort_order ?? 0,
    notes: db.notes || '',
    createdAt: db.created_at,
});

const mapJobTaskToDb = (task: Partial<JobTask>) => {
    const dbTask: any = {};
    if (task.jobId !== undefined) dbTask.job_id = task.jobId;
    if (task.name !== undefined) dbTask.name = task.name;
    if (task.startDate !== undefined) dbTask.start_date = task.startDate;
    if (task.endDate !== undefined) dbTask.end_date = task.endDate;
    if (task.progress !== undefined) dbTask.progress = task.progress;
    if (task.status !== undefined) dbTask.status = task.status;
    if (task.sortOrder !== undefined) dbTask.sort_order = task.sortOrder;
    if (task.notes !== undefined) dbTask.notes = task.notes || null;
    return dbTask;
};

export const jobTasksApi = {
    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('job_tasks')
                .select('*')
                .eq('job_id', jobId)
                .order('sort_order', { ascending: true })
                .order('start_date', { ascending: true })
        );
        if (error) throw error;
        return data.map(mapDbToJobTask);
    },
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('job_tasks')
                .select('*, jobs!inner(code, name, status)')
                .is('jobs.deleted_at', null)
                .order('start_date', { ascending: true })
        );
        if (error) throw error;
        return data.map(mapDbToJobTask);
    },
    create: async (task: Partial<JobTask>) => {
        const { data, error } = await supabase.from('job_tasks').insert(mapJobTaskToDb(task)).select().single();
        if (error) throw error;
        return mapDbToJobTask(data);
    },
    update: async (id: string, task: Partial<JobTask>) => {
        const { data, error } = await supabase
            .from('job_tasks')
            .update({ ...mapJobTaskToDb(task), updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapDbToJobTask(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('job_tasks').delete().eq('id', id);
        if (error) throw error;
    },
};
