import { supabase } from '@/lib/supabase';

export interface JobCommessaDocument {
    id: string;
    jobId: string;
    name: string;
    notes: string;
    fileUrl: string;
    fileType: string;
    uploadedBy: string;
    uploadedByName: string;
    createdAt: string;
}

const map = (db: any): JobCommessaDocument => ({
    id: db.id,
    jobId: db.job_id,
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type || '',
    uploadedBy: db.uploaded_by || '',
    uploadedByName: db.uploaded_by_name || '',
    createdAt: db.created_at,
});

export const jobCommessaDocumentsApi = {
    getByJobId: async (jobId: string): Promise<JobCommessaDocument[]> => {
        const { data, error } = await supabase
            .from('job_commessa_documents')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<JobCommessaDocument, 'id' | 'createdAt'>): Promise<JobCommessaDocument> => {
        const { data, error } = await supabase
            .from('job_commessa_documents')
            .insert({
                job_id: doc.jobId,
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

    update: async (id: string, patch: Partial<Pick<JobCommessaDocument, 'name' | 'notes' | 'fileUrl' | 'fileType'>>): Promise<JobCommessaDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        const { data, error } = await supabase.from('job_commessa_documents').update(update).eq('id', id).select().single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_commessa_documents').delete().eq('id', id);
        if (error) throw error;
    },
};
