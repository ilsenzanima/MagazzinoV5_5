import { supabase } from '@/lib/supabase';

// Nota della raccolta di foto senza cartella (una per tipo di documento, per offerta)
export const proposalSiteTypeNotesApi = {
    getByProposalId: async (proposalId: string): Promise<Record<string, string>> => {
        const { data, error } = await supabase
            .from('proposal_site_type_notes')
            .select('document_type_id, notes')
            .eq('proposal_id', proposalId);
        if (error) throw error;
        return Object.fromEntries((data || []).map(r => [r.document_type_id as string, (r.notes as string) || '']));
    },

    set: async (proposalId: string, documentTypeId: string, notes: string): Promise<void> => {
        const { error } = await supabase
            .from('proposal_site_type_notes')
            .upsert({ proposal_id: proposalId, document_type_id: documentTypeId, notes, updated_at: new Date().toISOString() });
        if (error) throw error;
    },

    // Alla conversione in commessa le note passano alla commessa
    copyToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const notes = await proposalSiteTypeNotesApi.getByProposalId(proposalId);
        const rows = Object.entries(notes).filter(([, n]) => n).map(([typeId, n]) => ({ job_id: jobId, document_type_id: typeId, notes: n, updated_at: new Date().toISOString() }));
        if (rows.length === 0) return;
        const { error } = await supabase.from('job_site_type_notes').upsert(rows);
        if (error) throw error;
    },
};
