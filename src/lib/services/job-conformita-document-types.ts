import { supabase } from '@/lib/supabase';

export interface JobConformitaDocumentType {
    id: string;
    name: string;
    allowsFolders: boolean;
    createdAt: string;
}

const map = (db: any): JobConformitaDocumentType => ({
    id: db.id,
    name: db.name,
    allowsFolders: db.allows_folders === true,
    createdAt: db.created_at,
});

export const jobConformitaDocumentTypesApi = {
    getAll: async (): Promise<JobConformitaDocumentType[]> => {
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (name: string, allowsFolders = false): Promise<JobConformitaDocumentType> => {
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .insert({ name, allows_folders: allowsFolders })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, name: string, allowsFolders?: boolean): Promise<JobConformitaDocumentType> => {
        const payload: any = { name };
        if (allowsFolders !== undefined) payload.allows_folders = allowsFolders;
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    setAllowsFolders: async (id: string, allowsFolders: boolean): Promise<JobConformitaDocumentType> => {
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .update({ allows_folders: allowsFolders })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_conformita_document_types').delete().eq('id', id);
        if (error) throw error;
    },
};
