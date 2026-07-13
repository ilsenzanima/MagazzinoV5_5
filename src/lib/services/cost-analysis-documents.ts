import { supabase } from '@/lib/supabase';
import { deleteDriveFileIfApplicable } from './utils';

export interface CostAnalysisDocument {
    id: string;
    proposalId: string | null;
    jobId: string | null;
    name: string;
    notes: string;
    fileUrl: string;
    fileType: string;
    fileSize: number | null;
    uploadedBy: string;
    uploadedByName: string;
    createdAt: string;
}

const map = (db: any): CostAnalysisDocument => ({
    id: db.id,
    proposalId: db.proposal_id || null,
    jobId: db.job_id || null,
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type || '',
    fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
    uploadedBy: db.uploaded_by || '',
    uploadedByName: db.uploaded_by_name || '',
    createdAt: db.created_at,
});

export const costAnalysisDocumentsApi = {
    getByJobId: async (jobId: string): Promise<CostAnalysisDocument[]> => {
        const { data, error } = await supabase
            .from('shared_cost_analysis_documents')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    getByProposalId: async (proposalId: string): Promise<CostAnalysisDocument[]> => {
        const { data, error } = await supabase
            .from('shared_cost_analysis_documents')
            .select('*')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: { proposalId?: string; jobId?: string; name: string; notes?: string; fileUrl: string; fileType?: string; fileSize?: number | null }): Promise<CostAnalysisDocument> => {
        const { data: { user } } = await supabase.auth.getUser();
        // Se il documento viene caricato sulla proposta ed è già stata convertita in commessa,
        // è subito visibile anche lì (stesso record, nessuna copia).
        let jobId = doc.jobId || null;
        let proposalId = doc.proposalId || null;
        if (doc.proposalId && !jobId) {
            const { data: proposal } = await supabase
                .from('client_proposals')
                .select('converted_job_id')
                .eq('id', doc.proposalId)
                .single();
            jobId = proposal?.converted_job_id || null;
        } else if (doc.jobId && !proposalId) {
            // Se il documento viene caricato sulla commessa e questa proviene da una
            // proposta, è subito visibile anche lì (stesso record, nessuna copia).
            const { data: proposal } = await supabase
                .from('client_proposals')
                .select('id')
                .eq('converted_job_id', doc.jobId)
                .maybeSingle();
            proposalId = proposal?.id || null;
        }
        const { data, error } = await supabase
            .from('shared_cost_analysis_documents')
            .insert({
                proposal_id: proposalId,
                job_id: jobId,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_type: doc.fileType || null,
                file_size: doc.fileSize ?? null,
                uploaded_by: user?.id || null,
                uploaded_by_name: user?.user_metadata?.full_name || null,
            })
            .select('*')
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, patch: { name?: string; notes?: string }): Promise<CostAnalysisDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        const { data, error } = await supabase.from('shared_cost_analysis_documents').update(update).eq('id', id).select('*').single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('shared_cost_analysis_documents').select('file_url').eq('id', id).maybeSingle();
        const { error } = await supabase.from('shared_cost_analysis_documents').delete().eq('id', id);
        if (error) throw error;
        await deleteDriveFileIfApplicable(existing?.file_url);
    },

    // Collega alla commessa appena creata tutte le analisi già caricate sulla proposta,
    // così restano gli stessi record (nessuna copia) e sono visibili da entrambe le pagine.
    linkToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_cost_analysis_documents')
            .update({ job_id: jobId })
            .eq('proposal_id', proposalId);
        if (error) throw error;
    },
};
