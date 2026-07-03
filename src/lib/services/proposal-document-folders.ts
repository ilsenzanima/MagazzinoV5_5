import { supabase } from '@/lib/supabase';

export interface ProposalDocumentFolder {
    id: string;
    jobId: string | null;
    proposalId: string | null;
    documentTypeId: string;
    name: string;
    driveFolderId?: string;
    createdBy?: string;
    createdAt: string;
}

const map = (db: any): ProposalDocumentFolder => ({
    id: db.id,
    jobId: db.job_id,
    proposalId: db.proposal_id,
    documentTypeId: db.document_type_id,
    name: db.name,
    driveFolderId: db.drive_folder_id ?? undefined,
    createdBy: db.created_by,
    createdAt: db.created_at,
});

export const proposalDocumentFoldersApi = {
    getByJobId: async (jobId: string): Promise<ProposalDocumentFolder[]> => {
        const { data, error } = await supabase
            .from('proposal_document_folders')
            .select('*')
            .eq('job_id', jobId)
            .is('deleted_at', null)
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    getByProposalId: async (proposalId: string): Promise<ProposalDocumentFolder[]> => {
        const { data, error } = await supabase
            .from('proposal_document_folders')
            .select('*')
            .eq('proposal_id', proposalId)
            .is('deleted_at', null)
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (folder: {
        jobId?: string;
        proposalId?: string;
        documentTypeId: string;
        name: string;
        driveFolderId?: string;
    }): Promise<ProposalDocumentFolder> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('proposal_document_folders')
            .insert({
                job_id: folder.jobId || null,
                proposal_id: folder.proposalId || null,
                document_type_id: folder.documentTypeId,
                name: folder.name,
                drive_folder_id: folder.driveFolderId || null,
                created_by: user?.id,
            })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    rename: async (id: string, name: string): Promise<ProposalDocumentFolder> => {
        const { data, error } = await supabase
            .from('proposal_document_folders')
            .update({ name })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('proposal_document_folders')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
};
