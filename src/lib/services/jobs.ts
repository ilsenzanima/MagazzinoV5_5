import { supabase } from '@/lib/supabase';
import { Job, JobLog, JobDocument, Site } from '@/lib/types';
import { fetchWithTimeout } from './utils';

// Mappers
export const mapDbToJob = (db: any): Job => ({
    id: db.id,
    clientId: db.client_id,
    clientName: db.clients?.name,
    clientAddress: db.clients?.address || [
        db.clients?.street ? `${db.clients.street} ${db.clients.street_number || ''}` : '',
        db.clients?.postal_code,
        db.clients?.city,
        db.clients?.province ? `(${db.clients.province})` : ''
    ].filter(Boolean).join(' - '),
    code: db.code,
    description: db.description,
    status: db.status,
    startDate: db.start_date,
    endDate: db.end_date,
    createdAt: db.created_at,
    siteAddress: db.site_address,
    siteManager: db.site_manager,
    cig: db.cig,
    cup: db.cup
});

const mapJobToDb = (job: Partial<Job>) => ({
    client_id: job.clientId,
    code: job.code,
    description: job.description,
    status: job.status,
    start_date: job.startDate,
    end_date: job.endDate || null,
    site_address: job.siteAddress,
    site_manager: job.siteManager,
    cig: job.cig,
    cup: job.cup
});

const mapDbToJobLog = (db: any): JobLog => ({
    id: db.id,
    jobId: db.job_id,
    userId: db.user_id,
    userName: db.profiles?.full_name,
    date: db.date,
    content: db.content,
    weatherInfo: db.weather_info,
    condition: db.weather_info?.condition, // Flatten for easier access if type mismatch, relying on type def
    tempMax: db.weather_info?.tempMax,
    tempMin: db.weather_info?.tempMin,
    tags: db.tags || [],
    createdAt: db.created_at
});

const mapJobLogToDb = (log: Partial<JobLog>) => ({
    job_id: log.jobId,
    user_id: log.userId,
    date: log.date,
    content: log.content,
    weather_info: log.weatherInfo,
    tags: log.tags
});

const mapDbToJobDocument = (db: any): JobDocument => ({
    id: db.id,
    jobId: db.job_id,
    name: db.name,
    fileUrl: db.file_url,
    fileType: db.file_type,
    category: db.category,
    uploadedBy: db.uploaded_by,
    uploadedByName: db.profiles?.full_name,
    createdAt: db.created_at
});

const mapJobDocumentToDb = (doc: Partial<JobDocument>) => ({
    job_id: doc.jobId,
    name: doc.name,
    file_url: doc.fileUrl,
    file_type: doc.fileType,
    category: doc.category,
    uploaded_by: doc.uploadedBy
});

const mapJobToSite = (job: Job): Site => ({
    id: job.id,
    name: job.description,
    address: job.siteAddress,
    manager: job.siteManager,
    jobId: job.id,
    jobDescription: job.description,
    status: job.status
});

// APIs
export const jobsApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('jobs')
                .select('*, clients(*)')
                .order('created_at', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToJob);
    },
    getPaginated: async ({ page = 1, limit = 12, search = '', clientId = '', status = '' }) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('jobs')
            .select('*, clients!inner(name)', { count: 'estimated' });

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            const { data: clients } = await supabase
                .from('clients')
                .select('id')
                .ilike('name', `%${search}%`);

            const clientIds = clients?.map(c => c.id) || [];

            let orConditions = [
                `code.ilike.%${search}%`,
                `description.ilike.%${search}%`,
                `cig.ilike.%${search}%`,
                `cup.ilike.%${search}%`,
                `site_address.ilike.%${search}%`
            ];

            if (clientIds.length > 0) {
                orConditions.push(`client_id.in.(${clientIds.join(',')})`);
            }

            query = query.or(orConditions.join(','));
        }

        query = query.select('*, clients(*)');
        query = query
            .order('created_at', { ascending: false })
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        return {
            data: data.map(mapDbToJob),
            total: count || 0
        };
    },

    getByClientId: async (clientId: string) => {
        console.time('jobsApi.getByClientId');
        try {
            const { data, error } = await fetchWithTimeout(
                supabase
                    .from('jobs')
                    .select('*, clients(name, address, street, street_number, postal_code, city, province)')
                    .eq('client_id', clientId)
                    .order('created_at', { ascending: false })
            );

            if (error) throw error;
            return data.map(mapDbToJob);
        } finally {
            console.timeEnd('jobsApi.getByClientId');
        }
    },
    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase.from('jobs').select('*, clients(*)').eq('id', id).single()
        );
        if (error) throw error;
        return mapDbToJob(data);
    },
    create: async (job: Partial<Job>) => {
        const { data, error } = await supabase.from('jobs').insert(mapJobToDb(job)).select().single();
        if (error) throw error;
        return mapDbToJob(data);
    },
    update: async (id: string, job: Partial<Job>, updateMovements: boolean = false) => {
        const { data, error } = await supabase.from('jobs').update(mapJobToDb(job)).eq('id', id).select().single();
        if (error) throw error;

        // Update CIG/CUP in delivery notes if requested
        if (updateMovements) {
            const { data: notes } = await supabase
                .from('delivery_notes')
                .select('id, notes')
                .eq('job_id', id);

            if (notes && notes.length > 0) {
                const cigPart = job.cig ? `CIG: ${job.cig}` : '';
                const cupPart = job.cup ? `CUP: ${job.cup}` : '';
                const newCodes = [cigPart, cupPart].filter(Boolean).join(' ');

                const updates = notes.map(note => {
                    let currentNotes = note.notes || '';
                    // Remove existing CIG/CUP patterns more robustly
                    currentNotes = currentNotes
                        .replace(/CIG:\s*\S+/gi, '')
                        .replace(/CUP:\s*\S+/gi, '')
                        .replace(/\n{2,}/g, '\n')
                        .trim();

                    // Add new codes at the beginning if any
                    const updatedNotes = newCodes
                        ? (newCodes + (currentNotes ? '\n' + currentNotes : '')).trim()
                        : currentNotes;

                    return {
                        id: note.id,
                        notes: updatedNotes
                    };
                });

                const updatePromises = updates.map(u =>
                    supabase.from('delivery_notes').update({ notes: u.notes }).eq('id', u.id)
                );

                await Promise.all(updatePromises);
                console.log(`Updated CIG/CUP in ${notes.length} delivery notes`);
            }
        }

        return mapDbToJob(data);
    },
    delete: async (id: string) => {
        await supabase.from('job_logs').delete().eq('job_id', id);
        await supabase.from('job_documents').delete().eq('job_id', id);
        await supabase.from('sites').delete().eq('job_id', id);
        await supabase.from('job_inventory').delete().eq('job_id', id);

        const { data: notes } = await supabase.from('delivery_notes').select('id').eq('job_id', id);

        if (notes && notes.length > 0) {
            const noteIds = notes.map(n => n.id);
            await supabase.from('delivery_note_items').delete().in('delivery_note_id', noteIds);
        }

        await supabase.from('movements').delete().eq('job_id', id);
        await supabase.from('delivery_notes').delete().eq('job_id', id);
        await supabase.from('purchases').update({ job_id: null }).eq('job_id', id);
        await supabase.from('purchase_items').update({ job_id: null }).eq('job_id', id);

        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) throw error;
    },
    getCost: async (id: string) => {
        const { data, error } = await supabase
            .rpc('get_job_total_cost', { p_job_id: id });

        if (error) throw error;
        return data || 0;
    }
};

export const jobLogsApi = {
    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('job_logs')
                .select('*, profiles:user_id(full_name)')
                .eq('job_id', jobId)
                .order('date', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToJobLog);
    },
    create: async (log: Partial<JobLog>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const { data, error } = await supabase
            .from('job_logs')
            .insert(mapJobLogToDb({ ...log, userId: user.id }))
            .select('*, profiles:user_id(full_name)')
            .single();
        if (error) throw error;
        return mapDbToJobLog(data);
    }
};

export const jobDocumentsApi = {
    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('job_documents')
                .select('*, profiles:uploaded_by(full_name)')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToJobDocument);
    },
    create: async (doc: Partial<JobDocument>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const { data, error } = await supabase
            .from('job_documents')
            .insert(mapJobDocumentToDb({ ...doc, uploadedBy: user.id }))
            .select('*, profiles:uploaded_by(full_name)')
            .single();
        if (error) throw error;
        return mapDbToJobDocument(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase
            .from('job_documents')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

export const sitesApi = {
    getAll: async () => {
        const jobs = await jobsApi.getAll();
        return jobs.map(mapJobToSite);
    },
    getById: async (id: string) => {
        const job = await jobsApi.getById(id);
        return mapJobToSite(job);
    }
};
