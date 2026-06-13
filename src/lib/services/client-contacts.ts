import { supabase } from '@/lib/supabase';

export interface ClientContact {
    id: string;
    clientId: string;
    name: string;
    role: string;
    phone: string;
    email: string;
    notes: string;
    createdAt: string;
}

const map = (db: any): ClientContact => ({
    id: db.id,
    clientId: db.client_id,
    name: db.name,
    role: db.role || '',
    phone: db.phone || '',
    email: db.email || '',
    notes: db.notes || '',
    createdAt: db.created_at,
});

export const clientContactsApi = {
    getByClientId: async (clientId: string): Promise<ClientContact[]> => {
        const { data, error } = await supabase
            .from('client_contacts')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (clientId: string, contact: Omit<ClientContact, 'id' | 'clientId' | 'createdAt'>): Promise<ClientContact> => {
        const { data, error } = await supabase
            .from('client_contacts')
            .insert({
                client_id: clientId,
                name: contact.name,
                role: contact.role || null,
                phone: contact.phone || null,
                email: contact.email || null,
                notes: contact.notes || null,
            })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, contact: Partial<Omit<ClientContact, 'id' | 'clientId' | 'createdAt'>>): Promise<void> => {
        const { error } = await supabase
            .from('client_contacts')
            .update({
                name: contact.name,
                role: contact.role ?? null,
                phone: contact.phone ?? null,
                email: contact.email ?? null,
                notes: contact.notes ?? null,
            })
            .eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('client_contacts').delete().eq('id', id);
        if (error) throw error;
    },
};
