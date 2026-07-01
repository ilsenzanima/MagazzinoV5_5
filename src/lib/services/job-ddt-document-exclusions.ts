import { supabase } from '@/lib/supabase';

// Stato incluso/escluso per i documenti di conformità derivati automaticamente
// dai DDT (tab "Documenti da DDT"), usato per preparare lo zip finale di
// commessa: di default tutti inclusi, la presenza di una riga qui = escluso.
export const jobDdtDocumentExclusionsApi = {
    getExcludedIds: async (jobId: string): Promise<Set<string>> => {
        const { data, error } = await supabase
            .from('job_ddt_document_exclusions')
            .select('compliance_document_id')
            .eq('job_id', jobId);
        if (error) throw error;
        return new Set((data || []).map(r => r.compliance_document_id));
    },

    exclude: async (jobId: string, complianceDocumentId: string): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('job_ddt_document_exclusions')
            .upsert({ job_id: jobId, compliance_document_id: complianceDocumentId, created_by: user?.id }, {
                onConflict: 'job_id,compliance_document_id',
            });
        if (error) throw error;
    },

    include: async (jobId: string, complianceDocumentId: string): Promise<void> => {
        const { error } = await supabase
            .from('job_ddt_document_exclusions')
            .delete()
            .eq('job_id', jobId)
            .eq('compliance_document_id', complianceDocumentId);
        if (error) throw error;
    },
};
