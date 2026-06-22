import { supabase } from '@/lib/supabase';

export type ProposalStatus = 'draft' | 'sent' | 'pending' | 'accepted' | 'rejected';

export interface ClientProposal {
    id: string;
    clientId: string;
    title: string;
    description: string;
    estimatedValue: number | null;
    status: ProposalStatus;
    date: string;
    notes: string;
    siteStreet: string;
    siteStreetNumber: string;
    sitePostalCode: string;
    siteCity: string;
    siteProvince: string;
    convertedJobId: string | null;
    createdAt: string;
    updatedAt: string;
}

const map = (db: any): ClientProposal => ({
    id: db.id,
    clientId: db.client_id,
    title: db.title,
    description: db.description || '',
    estimatedValue: db.estimated_value !== null ? Number(db.estimated_value) : null,
    status: db.status,
    date: db.date || '',
    notes: db.notes || '',
    siteStreet: db.site_street || '',
    siteStreetNumber: db.site_street_number || '',
    sitePostalCode: db.site_postal_code || '',
    siteCity: db.site_city || '',
    siteProvince: db.site_province || '',
    convertedJobId: db.converted_job_id || null,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
});

export const clientProposalsApi = {
    getByClientId: async (clientId: string): Promise<ClientProposal[]> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .select('*')
            .eq('client_id', clientId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    getById: async (id: string): Promise<ClientProposal | null> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw error;
        return data ? map(data) : null;
    },

    getDeleted: async (): Promise<(ClientProposal & { deletedAt: string })[]> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .select('*, clients(name)')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(d => ({ ...map(d), deletedAt: d.deleted_at, clientName: d.clients?.name || '' }));
    },

    restore: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('client_proposals')
            .update({ deleted_at: null, deleted_by: null })
            .eq('id', id);
        if (error) throw error;
    },

    create: async (clientId: string, proposal: Omit<ClientProposal, 'id' | 'clientId' | 'convertedJobId' | 'createdAt' | 'updatedAt'>): Promise<ClientProposal> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .insert({
                client_id: clientId,
                title: proposal.title,
                description: proposal.description || null,
                estimated_value: proposal.estimatedValue,
                status: proposal.status,
                date: proposal.date || null,
                notes: proposal.notes || null,
                site_street: proposal.siteStreet || null,
                site_street_number: proposal.siteStreetNumber || null,
                site_postal_code: proposal.sitePostalCode || null,
                site_city: proposal.siteCity || null,
                site_province: proposal.siteProvince || null,
            })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, fields: Partial<Omit<ClientProposal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
        const db: any = { updated_at: new Date().toISOString() };
        if (fields.clientId !== undefined) db.client_id = fields.clientId;
        if (fields.title !== undefined) db.title = fields.title;
        if (fields.description !== undefined) db.description = fields.description || null;
        if (fields.estimatedValue !== undefined) db.estimated_value = fields.estimatedValue;
        if (fields.status !== undefined) db.status = fields.status;
        if (fields.date !== undefined) db.date = fields.date || null;
        if (fields.notes !== undefined) db.notes = fields.notes || null;
        if (fields.siteStreet !== undefined) db.site_street = fields.siteStreet || null;
        if (fields.siteStreetNumber !== undefined) db.site_street_number = fields.siteStreetNumber || null;
        if (fields.sitePostalCode !== undefined) db.site_postal_code = fields.sitePostalCode || null;
        if (fields.siteCity !== undefined) db.site_city = fields.siteCity || null;
        if (fields.siteProvince !== undefined) db.site_province = fields.siteProvince || null;
        if (fields.convertedJobId !== undefined) db.converted_job_id = fields.convertedJobId || null;
        const { error } = await supabase.from('client_proposals').update(db).eq('id', id);
        if (error) throw error;
    },

    getAll: async (): Promise<(ClientProposal & { clientName: string })[]> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .select('*, clients(name)')
            .is('deleted_at', null)
            .is('converted_job_id', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(d => ({ ...map(d), clientName: d.clients?.name || '' }));
    },

    getByConvertedJobId: async (jobId: string): Promise<ClientProposal | null> => {
        const { data, error } = await supabase
            .from('client_proposals')
            .select('*')
            .eq('converted_job_id', jobId)
            .maybeSingle();
        if (error) throw error;
        return data ? map(data) : null;
    },

    delete: async (id: string): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('client_proposals')
            .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
            .eq('id', id);
        if (error) throw error;
    },
};
