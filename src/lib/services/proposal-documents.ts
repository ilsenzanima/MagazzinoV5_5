import { supabase } from '@/lib/supabase';
import { supabase as supabaseClient } from '@/lib/supabase';

export interface ProposalDocument {
    id: string;
    proposalId: string;
    name: string;
    notes: string;
    fileUrl: string;
    fileType: string;
    uploadedBy: string;
    uploadedByName: string;
    createdAt: string;
}

const map = (db: any): ProposalDocument => ({
    id: db.id,
    proposalId: db.proposal_id,
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type || '',
    uploadedBy: db.uploaded_by || '',
    uploadedByName: db.uploaded_by_name || '',
    createdAt: db.created_at,
});

export const proposalDocumentsApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalDocument[]> => {
        const { data, error } = await supabase
            .from('proposal_documents')
            .select('*')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<ProposalDocument, 'id' | 'createdAt'>): Promise<ProposalDocument> => {
        const { data, error } = await supabase
            .from('proposal_documents')
            .insert({
                proposal_id: doc.proposalId,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_type: doc.fileType || null,
                uploaded_by: doc.uploadedBy || null,
                uploaded_by_name: doc.uploadedByName || null,
            })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_documents').delete().eq('id', id);
        if (error) throw error;
    },
};
