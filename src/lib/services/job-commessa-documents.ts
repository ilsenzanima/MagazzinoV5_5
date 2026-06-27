import { supabase } from '@/lib/supabase';
import { deleteDriveFileIfApplicable } from './utils';

export interface JobCommessaDocument {
    id: string;
    jobId: string;
    proposalId: string | null;
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

const map = (db: any): JobCommessaDocument => ({
    id: db.id,
    jobId: db.job_id,
    proposalId: db.proposal_id || null,
    documentTypeId: db.proposal_document_type_id || null,
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

export const jobCommessaDocumentsApi = {
    getByJobId: async (jobId: string): Promise<JobCommessaDocument[]> => {
        const { data, error } = await supabase
            .from('shared_documents')
            .select('*, proposal_document_types(name)')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<JobCommessaDocument, 'id' | 'createdAt' | 'documentTypeName' | 'proposalId'>): Promise<JobCommessaDocument> => {
        // Se la commessa proviene da una proposta, il documento è subito visibile anche lì.
        const { data: proposal } = await supabase
            .from('client_proposals')
            .select('id')
            .eq('converted_job_id', doc.jobId)
            .maybeSingle();

        const { data, error } = await supabase
            .from('shared_documents')
            .insert({
                job_id: doc.jobId,
                proposal_id: proposal?.id || null,
                proposal_document_type_id: doc.documentTypeId || null,
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

    update: async (id: string, patch: Partial<Pick<JobCommessaDocument, 'name' | 'notes' | 'fileUrl' | 'fileType' | 'fileSize' | 'documentTypeId'>>): Promise<JobCommessaDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        if (patch.documentTypeId !== undefined) update.proposal_document_type_id = patch.documentTypeId || null;

        let oldFileUrl: string | undefined;
        if (patch.fileUrl !== undefined) {
            const { data: existing } = await supabase.from('shared_documents').select('file_url').eq('id', id).maybeSingle();
            oldFileUrl = existing?.file_url;
        }

        const { data, error } = await supabase.from('shared_documents').update(update).eq('id', id).select('*, proposal_document_types(name)').single();
        if (error) throw error;
        if (oldFileUrl && oldFileUrl !== patch.fileUrl) {
            await deleteDriveFileIfApplicable(oldFileUrl);
        }
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('shared_documents').select('file_url').eq('id', id).maybeSingle();
        const { error } = await supabase.from('shared_documents').delete().eq('id', id);
        if (error) throw error;
        await deleteDriveFileIfApplicable(existing?.file_url);
    },
};
