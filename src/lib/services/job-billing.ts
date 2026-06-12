import { supabase } from '@/lib/supabase';
import { JobSalApprovato, JobFatturaCommittente, JobSalFatturaLink } from '@/lib/types';

const mapSal = (db: any): JobSalApprovato => ({
    id: db.id,
    jobId: db.job_id,
    name: db.name,
    amount: Number(db.amount) || 0,
    date: db.date ?? undefined,
    documentUrl: db.document_url ?? undefined,
    notes: db.notes ?? undefined,
    createdAt: db.created_at,
});

const mapFattura = (db: any): JobFatturaCommittente => ({
    id: db.id,
    jobId: db.job_id,
    name: db.name,
    amount: Number(db.amount) || 0,
    date: db.date ?? undefined,
    documentUrl: db.document_url ?? undefined,
    notes: db.notes ?? undefined,
    createdAt: db.created_at,
});

const mapLink = (db: any): JobSalFatturaLink => ({
    id: db.id,
    salId: db.sal_id,
    fatturaId: db.fattura_id,
    amount: Number(db.amount) || 0,
    createdAt: db.created_at,
});

// ── SAL approvati ──────────────────────────────────────────────────────────────

export const jobSalApprovatiApi = {
    getByJobId: async (jobId: string): Promise<JobSalApprovato[]> => {
        const { data, error } = await supabase
            .from('job_sal_approvati')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapSal);
    },

    create: async (jobId: string, payload: { name: string; amount: number; date?: string; documentUrl?: string; notes?: string }): Promise<JobSalApprovato> => {
        const { data, error } = await supabase
            .from('job_sal_approvati')
            .insert({
                job_id: jobId,
                name: payload.name,
                amount: payload.amount,
                date: payload.date ?? null,
                document_url: payload.documentUrl ?? null,
                notes: payload.notes ?? null,
            })
            .select()
            .single();
        if (error) throw error;
        return mapSal(data);
    },

    update: async (id: string, payload: { name?: string; amount?: number; date?: string | null; documentUrl?: string | null; notes?: string | null }): Promise<void> => {
        const updates: any = {};
        if (payload.name !== undefined) updates.name = payload.name;
        if (payload.amount !== undefined) updates.amount = payload.amount;
        if ('date' in payload) updates.date = payload.date ?? null;
        if ('documentUrl' in payload) updates.document_url = payload.documentUrl ?? null;
        if ('notes' in payload) updates.notes = payload.notes ?? null;
        const { error } = await supabase.from('job_sal_approvati').update(updates).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_sal_approvati').delete().eq('id', id);
        if (error) throw error;
    },

    uploadDocument: async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop();
        const path = `job-billing/sal/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        return data.publicUrl;
    },
};

// ── Fatture committente ────────────────────────────────────────────────────────

export const jobFattureCommittenteApi = {
    getByJobId: async (jobId: string): Promise<JobFatturaCommittente[]> => {
        const { data, error } = await supabase
            .from('job_fatture_committente')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapFattura);
    },

    create: async (jobId: string, payload: { name: string; amount: number; date?: string; documentUrl?: string; notes?: string }): Promise<JobFatturaCommittente> => {
        const { data, error } = await supabase
            .from('job_fatture_committente')
            .insert({
                job_id: jobId,
                name: payload.name,
                amount: payload.amount,
                date: payload.date ?? null,
                document_url: payload.documentUrl ?? null,
                notes: payload.notes ?? null,
            })
            .select()
            .single();
        if (error) throw error;
        return mapFattura(data);
    },

    update: async (id: string, payload: { name?: string; amount?: number; date?: string | null; documentUrl?: string | null; notes?: string | null }): Promise<void> => {
        const updates: any = {};
        if (payload.name !== undefined) updates.name = payload.name;
        if (payload.amount !== undefined) updates.amount = payload.amount;
        if ('date' in payload) updates.date = payload.date ?? null;
        if ('documentUrl' in payload) updates.document_url = payload.documentUrl ?? null;
        if ('notes' in payload) updates.notes = payload.notes ?? null;
        const { error } = await supabase.from('job_fatture_committente').update(updates).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_fatture_committente').delete().eq('id', id);
        if (error) throw error;
    },

    uploadDocument: async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop();
        const path = `job-billing/fatture/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        return data.publicUrl;
    },
};

// ── Collegamento SAL ↔ Fattura ────────────────────────────────────────────────

export const jobSalFatturaLinksApi = {
    getByJobId: async (jobId: string): Promise<JobSalFatturaLink[]> => {
        // Fetch all SAL ids for this job, then get their links
        const { data: sals, error: salError } = await supabase
            .from('job_sal_approvati')
            .select('id')
            .eq('job_id', jobId);
        if (salError) throw salError;
        if (!sals || sals.length === 0) return [];

        const salIds = sals.map((s: any) => s.id);
        const { data, error } = await supabase
            .from('job_sal_fattura_links')
            .select('*')
            .in('sal_id', salIds);
        if (error) throw error;
        return (data || []).map(mapLink);
    },

    upsert: async (salId: string, fatturaId: string, amount: number): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_fattura_links')
            .upsert({ sal_id: salId, fattura_id: fatturaId, amount }, { onConflict: 'sal_id,fattura_id' });
        if (error) throw error;
    },

    delete: async (salId: string, fatturaId: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_fattura_links')
            .delete()
            .eq('sal_id', salId)
            .eq('fattura_id', fatturaId);
        if (error) throw error;
    },
};
