import { supabase } from '@/lib/supabase';

// Nota della raccolta di foto senza cartella (una per tipo di documento, per commessa)
export const jobSiteTypeNotesApi = {
    getByJobId: async (jobId: string): Promise<Record<string, string>> => {
        const { data, error } = await supabase
            .from('job_site_type_notes')
            .select('document_type_id, notes')
            .eq('job_id', jobId);
        if (error) throw error;
        return Object.fromEntries((data || []).map(r => [r.document_type_id as string, (r.notes as string) || '']));
    },

    set: async (jobId: string, documentTypeId: string, notes: string): Promise<void> => {
        const { error } = await supabase
            .from('job_site_type_notes')
            .upsert({ job_id: jobId, document_type_id: documentTypeId, notes, updated_at: new Date().toISOString() });
        if (error) throw error;
    },
};
