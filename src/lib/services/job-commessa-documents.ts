import { supabase } from '@/lib/supabase';

export interface JobCommessaDocument {
    id: string;
    jobId: string;
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
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.job_commessa_document_types?.name || '',
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
            .from('job_commessa_documents')
            .select('*, job_commessa_document_types(name)')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<JobCommessaDocument, 'id' | 'createdAt' | 'documentTypeName'>): Promise<JobCommessaDocument> => {
        const { data, error } = await supabase
            .from('job_commessa_documents')
            .insert({
                job_id: doc.jobId,
                document_type_id: doc.documentTypeId || null,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_type: doc.fileType || null,
                file_size: doc.fileSize ?? null,
                uploaded_by: doc.uploadedBy || null,
                uploaded_by_name: doc.uploadedByName || null,
            })
            .select('*, job_commessa_document_types(name)')
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
        if (patch.documentTypeId !== undefined) update.document_type_id = patch.documentTypeId || null;
        const { data, error } = await supabase.from('job_commessa_documents').update(update).eq('id', id).select('*, job_commessa_document_types(name)').single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_commessa_documents').delete().eq('id', id);
        if (error) throw error;
    },
};
