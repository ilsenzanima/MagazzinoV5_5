import { supabase } from '@/lib/supabase';

export interface ProposalTask {
    id: string;
    proposalId: string;
    name: string;
    durationDays: number;
    sortOrder: number;
    notes: string;
    createdAt: string;
}

const map = (db: any): ProposalTask => ({
    id: db.id,
    proposalId: db.proposal_id,
    name: db.name,
    durationDays: db.duration_days ?? 1,
    sortOrder: db.sort_order ?? 0,
    notes: db.notes || '',
    createdAt: db.created_at,
});

export const proposalTasksApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalTask[]> => {
        const { data, error } = await supabase
            .from('proposal_tasks')
            .select('*')
            .eq('proposal_id', proposalId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (task: { proposalId: string; name: string; durationDays: number; sortOrder: number; notes?: string }): Promise<ProposalTask> => {
        const { data, error } = await supabase
            .from('proposal_tasks')
            .insert({
                proposal_id: task.proposalId,
                name: task.name,
                duration_days: task.durationDays,
                sort_order: task.sortOrder,
                notes: task.notes || null,
            })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, fields: Partial<{ name: string; durationDays: number; sortOrder: number; notes: string }>): Promise<void> => {
        const db: any = { updated_at: new Date().toISOString() };
        if (fields.name !== undefined) db.name = fields.name;
        if (fields.durationDays !== undefined) db.duration_days = fields.durationDays;
        if (fields.sortOrder !== undefined) db.sort_order = fields.sortOrder;
        if (fields.notes !== undefined) db.notes = fields.notes || null;
        const { error } = await supabase.from('proposal_tasks').update(db).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_tasks').delete().eq('id', id);
        if (error) throw error;
    },
};
