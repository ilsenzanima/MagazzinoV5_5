import { supabase } from '@/lib/supabase';
import { GuestSite, GuestSiteJob } from '@/lib/types';

// Helper per generare un passcode alfanumerico casuale (es: OPI-X9F2A1)
export function generatePasscode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OPI-${code}`;
}

const mapSite = (db: any): GuestSite => ({
    id: db.id,
    name: db.name,
    address: db.address,
    passcode: db.passcode,
    createdBy: db.created_by,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    deletedAt: db.deleted_at,
});

const mapAssociation = (db: any): GuestSiteJob => ({
    id: db.id,
    guestSiteId: db.guest_site_id,
    jobId: db.job_id,
    customNotes: db.custom_notes,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    deletedAt: db.deleted_at,
    // Dati in join se presenti
    jobCode: db.jobs?.code,
    jobDescription: db.jobs?.description,
    jobStartDate: db.jobs?.start_date,
    jobEndDate: db.jobs?.end_date,
});

export const guestSitesApi = {
    getAll: async (): Promise<GuestSite[]> => {
        const { data, error } = await supabase
            .from('guest_sites')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSite);
    },

    getById: async (id: string): Promise<GuestSite | null> => {
        const { data, error } = await supabase
            .from('guest_sites')
            .select('*')
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) throw error;
        return data ? mapSite(data) : null;
    },

    create: async (payload: { name: string; address: string; passcode?: string }): Promise<GuestSite> => {
        const passcode = payload.passcode || generatePasscode();
        const { data, error } = await supabase
            .from('guest_sites')
            .insert({
                name: payload.name,
                address: payload.address,
                passcode,
            })
            .select()
            .single();
        if (error) throw error;
        return mapSite(data);
    },

    update: async (id: string, payload: { name?: string; address?: string; passcode?: string }): Promise<GuestSite> => {
        const { data, error } = await supabase
            .from('guest_sites')
            .update({
                ...payload,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapSite(data);
    },

    delete: async (id: string): Promise<void> => {
        const now = new Date().toISOString();
        
        // Soft delete del cantiere
        const { error: siteError } = await supabase
            .from('guest_sites')
            .update({ deleted_at: now })
            .eq('id', id);
        if (siteError) throw siteError;

        // Soft delete a cascata delle associazioni
        const { error: assocError } = await supabase
            .from('guest_site_jobs')
            .update({ deleted_at: now })
            .eq('guest_site_id', id);
        if (assocError) throw assocError;
    },

    // --- Gestione Associazioni Commesse ---

    getJobsForSite: async (guestSiteId: string): Promise<GuestSiteJob[]> => {
        const { data, error } = await supabase
            .from('guest_site_jobs')
            .select('*, jobs(code, description, start_date, end_date)')
            .eq('guest_site_id', guestSiteId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapAssociation);
    },

    associateJob: async (guestSiteId: string, jobId: string, customNotes?: string): Promise<GuestSiteJob> => {
        // Controlla prima se esiste già una relazione (anche soft-deleted)
        const { data: existing, error: checkError } = await supabase
            .from('guest_site_jobs')
            .select('*')
            .eq('guest_site_id', guestSiteId)
            .eq('job_id', jobId)
            .maybeSingle();
        
        if (checkError) throw checkError;

        if (existing) {
            // Se esiste ed è soft-deleted, la ripristiniamo
            const { data, error } = await supabase
                .from('guest_site_jobs')
                .update({
                    deleted_at: null,
                    custom_notes: customNotes !== undefined ? customNotes : existing.custom_notes,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select('*, jobs(code, description, start_date, end_date)')
                .single();
            if (error) throw error;
            return mapAssociation(data);
        } else {
            // Altrimenti ne creiamo una nuova
            const { data, error } = await supabase
                .from('guest_site_jobs')
                .insert({
                    guest_site_id: guestSiteId,
                    job_id: jobId,
                    custom_notes: customNotes || null,
                })
                .select('*, jobs(code, description, start_date, end_date)')
                .single();
            if (error) throw error;
            return mapAssociation(data);
        }
    },

    updateJobAssociation: async (associationId: string, customNotes: string | null): Promise<GuestSiteJob> => {
        const { data, error } = await supabase
            .from('guest_site_jobs')
            .update({
                custom_notes: customNotes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', associationId)
            .select('*, jobs(code, description, start_date, end_date)')
            .single();
        if (error) throw error;
        return mapAssociation(data);
    },

    disassociateJob: async (associationId: string): Promise<void> => {
        const { error } = await supabase
            .from('guest_site_jobs')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', associationId);
        if (error) throw error;
    },
};
