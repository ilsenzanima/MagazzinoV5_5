import { supabase } from '@/lib/supabase';

export interface JobConformitaDocumentType {
    id: string;
    name: string;
    createdAt: string;
}

const map = (db: any): JobConformitaDocumentType => ({
    id: db.id,
    name: db.name,
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

    create: async (name: string): Promise<JobConformitaDocumentType> => {
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .insert({ name })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, name: string): Promise<JobConformitaDocumentType> => {
        const { data, error } = await supabase
            .from('job_conformita_document_types')
            .update({ name })
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
