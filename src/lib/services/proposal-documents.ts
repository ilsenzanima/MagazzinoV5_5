import { supabase } from '@/lib/supabase';
import { supabase as supabaseClient } from '@/lib/supabase';

export interface ProposalDocument {
    id: string;
    proposalId: string;
    documentTypeId: string | null;
    documentTypeName: string;
    name: string;
    notes: string;
    fileUrl: string;
    fileType: string;
    fileSize: number | null;
    uploadedBy: string;
    uploadedByName: string;
    createdAt: string;
}

const map = (db: any): ProposalDocument => ({
    id: db.id,
    proposalId: db.proposal_id,
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.proposal_document_types?.name || '',
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type || '',
    fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
    uploadedBy: db.uploaded_by || '',
    uploadedByName: db.uploaded_by_name || '',
    createdAt: db.created_at,
});

export const proposalDocumentsApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalDocument[]> => {
        const { data, error } = await supabase
            .from('proposal_documents')
            .select('*, proposal_document_types(name)')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<ProposalDocument, 'id' | 'createdAt' | 'documentTypeName'>): Promise<ProposalDocument> => {
        const { data, error } = await supabase
            .from('proposal_documents')
            .insert({
                proposal_id: doc.proposalId,
                document_type_id: doc.documentTypeId || null,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_type: doc.fileType || null,
                file_size: doc.fileSize ?? null,
                uploaded_by: doc.uploadedBy || null,
                uploaded_by_name: doc.uploadedByName || null,
            })
            .select('*, proposal_document_types(name)')
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, patch: Partial<Pick<ProposalDocument, 'name' | 'notes' | 'fileUrl' | 'fileType' | 'fileSize' | 'documentTypeId'>>): Promise<ProposalDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        if (patch.documentTypeId !== undefined) update.document_type_id = patch.documentTypeId || null;
        const { data, error } = await supabase.from('proposal_documents').update(update).eq('id', id).select('*, proposal_document_types(name)').single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_documents').delete().eq('id', id);
        if (error) throw error;
    },
};
