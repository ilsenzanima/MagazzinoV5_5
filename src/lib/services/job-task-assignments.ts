import { supabase } from '@/lib/supabase';
import { JobTaskAssignment } from '@/lib/types';

const mapDbToAssignment = (db: any): JobTaskAssignment => ({
    id: db.id,
    taskId: db.task_id,
    workerId: db.worker_id,
    workerName: db.workers?.first_name ? `${db.workers.first_name} ${db.workers.last_name || ''}`.trim() : undefined,
    createdAt: db.created_at,
});

export const jobTaskAssignmentsApi = {
    // Recupera le assegnazioni pianificate per un insieme di fasi (usato per popolare l'intero cronoprogramma in un'unica query)
    getByTaskIds: async (taskIds: string[]): Promise<JobTaskAssignment[]> => {
        if (taskIds.length === 0) return [];
        const { data, error } = await supabase
            .from('job_task_assignments')
            .select('*, workers(first_name, last_name)')
            .in('task_id', taskIds);
        if (error) throw error;
        return data.map(mapDbToAssignment);
    },

    // Sostituisce l'intero elenco di operai pianificati per una fase (approccio set-based: piu' semplice e robusto di un diff)
    setForTask: async (taskId: string, workerIds: string[]): Promise<JobTaskAssignment[]> => {
        const { error: deleteError } = await supabase.from('job_task_assignments').delete().eq('task_id', taskId);
        if (deleteError) throw deleteError;
        if (workerIds.length === 0) return [];
        const { data, error } = await supabase
            .from('job_task_assignments')
            .insert(workerIds.map(workerId => ({ task_id: taskId, worker_id: workerId })))
            .select('*, workers(first_name, last_name)');
        if (error) throw error;
        return data.map(mapDbToAssignment);
    },
};
