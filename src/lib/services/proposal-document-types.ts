import { supabase } from '@/lib/supabase';

export interface ProposalDocumentType {
    id: string;
    name: string;
    createdAt: string;
}

const map = (db: any): ProposalDocumentType => ({
    id: db.id,
    name: db.name,
    createdAt: db.created_at,
});

export const proposalDocumentTypesApi = {
    getAll: async (): Promise<ProposalDocumentType[]> => {
        const { data, error } = await supabase
            .from('proposal_document_types')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (name: string): Promise<ProposalDocumentType> => {
        const { data, error } = await supabase
            .from('proposal_document_types')
            .insert({ name })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, name: string): Promise<ProposalDocumentType> => {
        const { data, error } = await supabase
            .from('proposal_document_types')
            .update({ name })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_document_types').delete().eq('id', id);
        if (error) throw error;
    },
};
