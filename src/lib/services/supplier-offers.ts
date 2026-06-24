import { supabase } from '@/lib/supabase';

export interface SupplierOffer {
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

const map = (db: any): SupplierOffer => ({
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

export const supplierOffersApi = {
    getByJobId: async (jobId: string): Promise<SupplierOffer[]> => {
        const { data, error } = await supabase
            .from('shared_supplier_offers')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    getByProposalId: async (proposalId: string): Promise<SupplierOffer[]> => {
        const { data, error } = await supabase
            .from('shared_supplier_offers')
            .select('*')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: { proposalId?: string; jobId?: string; name: string; notes?: string; fileUrl: string; fileType?: string; fileSize?: number | null }): Promise<SupplierOffer> => {
        const { data: { user } } = await supabase.auth.getUser();
        // Se l'offerta viene caricata sulla proposta ed è già stata convertita in commessa,
        // è subito visibile anche lì (stesso record, nessuna copia).
        let jobId = doc.jobId || null;
        if (doc.proposalId && !jobId) {
            const { data: proposal } = await supabase
                .from('client_proposals')
                .select('converted_job_id')
                .eq('id', doc.proposalId)
                .single();
            jobId = proposal?.converted_job_id || null;
        }
        const { data, error } = await supabase
            .from('shared_supplier_offers')
            .insert({
                proposal_id: doc.proposalId || null,
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

    update: async (id: string, patch: { name?: string; notes?: string }): Promise<SupplierOffer> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        const { data, error } = await supabase.from('shared_supplier_offers').update(update).eq('id', id).select('*').single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('shared_supplier_offers').delete().eq('id', id);
        if (error) throw error;
    },

    // Collega alla commessa appena creata tutte le offerte già caricate sulla proposta,
    // così restano gli stessi record (nessuna copia) e sono visibili da entrambe le pagine.
    linkToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_supplier_offers')
            .update({ job_id: jobId })
            .eq('proposal_id', proposalId);
        if (error) throw error;
    },
};
