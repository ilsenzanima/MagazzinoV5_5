import { supabase } from '@/lib/supabase';
import { GuestSite, GuestSiteJob } from '@/lib/types';

// Helper per generare un passcode alfanumerico casuale e crittograficamente sicuro (es: OPI-X9F2A1K7)
export function generatePasscode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomValues = new Uint32Array(8);
    crypto.getRandomValues(randomValues);
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(randomValues[i] % chars.length);
    }
    return `OPI-${code}`;
}

export const MIN_PASSCODE_LENGTH = 6;

// Un codice scelto a mano troppo corto si indovina in pochi tentativi
function checkPasscode(passcode: string) {
    if (passcode.length < MIN_PASSCODE_LENGTH) {
        throw new Error(`Il codice di accesso deve avere almeno ${MIN_PASSCODE_LENGTH} caratteri`);
    }
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
    jobName: db.jobs?.name,
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

    // Codici delle commesse collegate, per cantiere: serve alla lista per mostrare cosa vedra' l'ospite
    getJobCodesBySite: async (): Promise<Record<string, string[]>> => {
        const { data, error } = await supabase
            .from('guest_site_jobs')
            .select('guest_site_id, jobs!inner(code, deleted_at)')
            .is('deleted_at', null)
            .is('jobs.deleted_at', null);
        if (error) throw error;
        const bySite: Record<string, string[]> = {};
        for (const row of (data || []) as any[]) {
            const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
            if (!job?.code) continue;
            (bySite[row.guest_site_id] ||= []).push(job.code);
        }
        for (const codes of Object.values(bySite)) codes.sort();
        return bySite;
    },

    // Portali (non eliminati) che contengono almeno una delle commesse indicate, con le commesse collegate
    findSitesForJobs: async (jobIds: string[]): Promise<{ site: GuestSite; jobIds: string[] }[]> => {
        if (jobIds.length === 0) return [];
        const { data, error } = await supabase
            .from('guest_site_jobs')
            .select('job_id, guest_site_id, guest_sites!inner(*)')
            .in('job_id', jobIds)
            .is('deleted_at', null)
            .is('guest_sites.deleted_at', null);
        if (error) throw error;
        const bySite = new Map<string, { site: GuestSite; jobIds: string[] }>();
        for (const row of (data || []) as any[]) {
            const raw = Array.isArray(row.guest_sites) ? row.guest_sites[0] : row.guest_sites;
            if (!raw) continue;
            const entry = bySite.get(raw.id) ?? { site: mapSite(raw), jobIds: [] };
            entry.jobIds.push(row.job_id);
            bySite.set(raw.id, entry);
        }
        return Array.from(bySite.values());
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
        const passcode = payload.passcode?.trim() || generatePasscode();
        checkPasscode(passcode);
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
        if (payload.passcode !== undefined) checkPasscode(payload.passcode.trim());
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

    // Cantieri ospiti nel cestino
    getDeleted: async (): Promise<GuestSite[]> => {
        const { data, error } = await supabase
            .from('guest_sites')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSite);
    },

    // Ripristina il cantiere e le associazioni che erano state eliminate insieme a lui
    restore: async (id: string): Promise<void> => {
        const { data: site, error: readError } = await supabase.from('guest_sites').select('deleted_at').eq('id', id).single();
        if (readError) throw readError;
        const { error: siteError } = await supabase.from('guest_sites').update({ deleted_at: null }).eq('id', id);
        if (siteError) throw siteError;
        if (site?.deleted_at) {
            const { error: assocError } = await supabase
                .from('guest_site_jobs')
                .update({ deleted_at: null })
                .eq('guest_site_id', id)
                .eq('deleted_at', site.deleted_at);
            if (assocError) throw assocError;
        }
    },

    // --- Gestione Associazioni Commesse ---

    getJobsForSite: async (guestSiteId: string): Promise<GuestSiteJob[]> => {
        const { data, error } = await supabase
            .from('guest_site_jobs')
            .select('*, jobs!inner(code, name, description, start_date, end_date, deleted_at)')
            .eq('guest_site_id', guestSiteId)
            .is('deleted_at', null)
            .is('jobs.deleted_at', null)
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
                .select('*, jobs(code, name, description, start_date, end_date)')
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
                .select('*, jobs(code, name, description, start_date, end_date)')
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
            .select('*, jobs(code, name, description, start_date, end_date)')
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
