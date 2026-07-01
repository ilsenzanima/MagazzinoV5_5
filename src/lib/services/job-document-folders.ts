import { supabase } from '@/lib/supabase';

export interface JobDocumentFolder {
    id: string;
    jobId: string;
    documentTypeId: string;
    name: string;
    driveFolderId?: string;
    createdBy?: string;
    createdAt: string;
}

const map = (db: any): JobDocumentFolder => ({
    id: db.id,
    jobId: db.job_id,
    documentTypeId: db.document_type_id,
    name: db.name,
    driveFolderId: db.drive_folder_id ?? undefined,
    createdBy: db.created_by,
    createdAt: db.created_at,
});

export const jobDocumentFoldersApi = {
    getByJobId: async (jobId: string): Promise<JobDocumentFolder[]> => {
        const { data, error } = await supabase
            .from('job_document_folders')
            .select('*')
            .eq('job_id', jobId)
            .is('deleted_at', null)
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    getByJobAndType: async (jobId: string, documentTypeId: string): Promise<JobDocumentFolder[]> => {
        const { data, error } = await supabase
            .from('job_document_folders')
            .select('*')
            .eq('job_id', jobId)
            .eq('document_type_id', documentTypeId)
            .is('deleted_at', null)
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (folder: {
        jobId: string;
        documentTypeId: string;
        name: string;
        driveFolderId?: string;
    }): Promise<JobDocumentFolder> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('job_document_folders')
            .insert({
                job_id: folder.jobId,
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

    rename: async (id: string, name: string): Promise<JobDocumentFolder> => {
        const { data, error } = await supabase
            .from('job_document_folders')
            .update({ name })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('job_document_folders')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
};
