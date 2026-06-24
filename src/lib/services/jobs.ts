import { supabase } from '@/lib/supabase';
import { Job, JobLog, JobDocument, Site } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';

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
    name: db.name,
    description: db.description,
    status: db.status,
    startDate: db.start_date,
    endDate: db.end_date,
    createdAt: db.created_at,
    siteAddress: db.site_address,
    siteManager: db.site_manager,
    cig: db.cig,
    cup: db.cup,
    estimatedCost: db.estimated_cost ?? null,
});

const mapJobToDb = (job: Partial<Job>) => {
    const dbJob: any = {};

    // Only include fields that are explicitly passed (not undefined)
    if (job.code !== undefined) dbJob.code = job.code;
    if (job.name !== undefined) dbJob.name = job.name;
    if (job.description !== undefined) dbJob.description = job.description;
    if (job.status !== undefined) dbJob.status = job.status;
    if (job.startDate !== undefined) dbJob.start_date = job.startDate;
    if (job.siteAddress !== undefined) dbJob.site_address = job.siteAddress;
    if (job.siteManager !== undefined) dbJob.site_manager = job.siteManager;
    if (job.cig !== undefined) dbJob.cig = job.cig;
    if (job.cup !== undefined) dbJob.cup = job.cup;
    if ('estimatedCost' in job) dbJob.estimated_cost = job.estimatedCost ?? null;
    if (job.createdAt !== undefined) dbJob.created_at = job.createdAt;

    // Handle nullable fields - only include when explicitly passed
    if ('endDate' in job) {
        dbJob.end_date = job.endDate || null;
    }
    if ('clientId' in job) {
        dbJob.client_id = job.clientId || null;
    }

    return dbJob;
};

const mapDbToJobLog = (db: any): JobLog => ({
    id: db.id,
    jobId: db.job_id,
    userId: db.user_id,
    userName: db.profiles?.full_name,
    date: db.date,
    content: db.content,
    isCompleted: db.is_completed ?? false,
    weatherInfo: db.weather_info,
    condition: db.weather_info?.condition,
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
    is_completed: log.isCompleted,
    weather_info: log.weatherInfo,
    tags: log.tags
});

const mapDbToJobDocument = (db: any): JobDocument => ({
    id: db.id,
    jobId: db.job_id,
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type,
    fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
    category: db.category,
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.job_site_document_types?.name || '',
    conformitaDocumentTypeId: db.conformita_document_type_id || null,
    conformitaDocumentTypeName: db.job_conformita_document_types?.name || '',
    uploadedBy: db.uploaded_by,
    uploadedByName: db.profiles?.full_name,
    createdAt: db.created_at
});

const mapJobDocumentToDb = (doc: Partial<JobDocument>) => ({
    job_id: doc.jobId,
    name: doc.name,
    notes: doc.notes || null,
    file_url: doc.fileUrl,
    file_type: doc.fileType,
    file_size: doc.fileSize ?? null,
    category: doc.category,
    document_type_id: doc.documentTypeId || null,
    conformita_document_type_id: doc.conformitaDocumentTypeId || null,
    uploaded_by: doc.uploadedBy
});

const mapJobToSite = (job: Job): Site => ({
    id: job.id,
    name: job.name,
    address: job.siteAddress,
    manager: job.siteManager,
    jobId: job.id,
    jobDescription: job.description || job.name,
    status: job.status
});

// APIs
export const jobsApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('jobs')
                .select('*, clients(*)')
                .is('deleted_at', null)
                .order('status_sort_order', { ascending: true })
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
            .select('*, clients!inner(name)', { count: 'estimated' })
            .is('deleted_at', null);

        if (clientId) {
            query = query.eq('client_id', clientId);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            // Split search into words for fuzzy matching
            const words = search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);

            // Find matching clients
            let clientIds: string[] = [];
            for (const word of words) {
                const { data: clients } = await supabase
                    .from('clients')
                    .select('id')
                    .ilike('name', `%${word}%`);
                if (clients) {
                    clientIds = [...new Set([...clientIds, ...clients.map(c => c.id)])];
                }
            }

            // For each word, apply OR conditions (chained = AND between words)
            for (const word of words) {
                let orConditions = [
                    `code.ilike.%${word}%`,
                    `name.ilike.%${word}%`,
                    `description.ilike.%${word}%`,
                    `cig.ilike.%${word}%`,
                    `cup.ilike.%${word}%`,
                    `site_address.ilike.%${word}%`
                ];
                if (clientIds.length > 0) {
                    orConditions.push(`client_id.in.(${clientIds.join(',')})`);
                }
                query = query.or(orConditions.join(','));
            }
        }

        query = query.select('*, clients(*)');
        query = query
            .order('status_sort_order', { ascending: true })
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
                    .is('deleted_at', null)
                    .order('status_sort_order', { ascending: true })
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
    /** Verifica se una commessa esiste ancora (anche se soft-deleted), senza lanciare errore se è stata eliminata definitivamente. */
    getStatusById: async (id: string): Promise<{ exists: boolean; deletedAt: string | null }> => {
        const { data, error } = await supabase
            .from('jobs')
            .select('deleted_at')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return { exists: !!data, deletedAt: data?.deleted_at ?? null };
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
        // Blocca se ci sono movimenti (delivery_notes) collegati alla commessa
        const { count: movCount } = await supabase
            .from('delivery_notes')
            .select('*', { count: 'estimated', head: true })
            .eq('job_id', id);
        if (movCount && movCount > 0) {
            throw new Error(`Impossibile eliminare la commessa: ha ${movCount} ${movCount === 1 ? 'movimento' : 'movimenti'} collegati. Eliminare prima i movimenti.`);
        }

        // Blocca se ci sono acquisti collegati alla commessa
        const { count: purCount } = await supabase
            .from('purchases')
            .select('*', { count: 'estimated', head: true })
            .eq('job_id', id)
            .is('deleted_at', null);
        if (purCount && purCount > 0) {
            throw new Error(`Impossibile eliminare la commessa: ha ${purCount} ${purCount === 1 ? 'acquisto collegato' : 'acquisti collegati'}. Eliminare prima gli acquisti.`);
        }

        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('jobs').update(payload).eq('id', id);
        if (error) throw error;

        // Se la commessa era stata generata da una proposta, riportala "In attesa"
        // così l'utente può riconvertirla (riusando la stessa commessa o creandone una nuova)
        const { data: linkedProposal } = await supabase
            .from('client_proposals')
            .select('id')
            .eq('converted_job_id', id)
            .maybeSingle();
        if (linkedProposal) {
            await supabase.from('client_proposals').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', linkedProposal.id);
        }
    },

    restore: async (id: string) => {
        const { error } = await supabase
            .from('jobs')
            .update({ deleted_at: null, deleted_by: null, deleted_by_name: null })
            .eq('id', id);
        if (error) throw error;
    },

    getDeleted: async () => {
        const { data, error } = await supabase
            .from('jobs')
            .select('*, clients(name)')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...mapDbToJob(d),
            deletedAt: d.deleted_at as string,
            deletedByName: d.deleted_by_name as string | null,
        }));
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
    },
    update: async (id: string, log: Partial<JobLog>) => {
        const { data, error } = await supabase
            .from('job_logs')
            .update(mapJobLogToDb(log))
            .eq('id', id)
            .select('*, profiles:user_id(full_name)')
            .single();
        if (error) throw error;
        return mapDbToJobLog(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase
            .from('job_logs')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};

export const jobDocumentsApi = {
    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('job_documents')
                .select('*, profiles:uploaded_by(full_name), job_site_document_types(name), job_conformita_document_types(name)')
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
            .select('*, profiles:uploaded_by(full_name), job_site_document_types(name), job_conformita_document_types(name)')
            .single();
        if (error) throw error;
        return mapDbToJobDocument(data);
    },
    update: async (id: string, patch: Partial<Pick<JobDocument, 'name' | 'notes' | 'documentTypeId' | 'conformitaDocumentTypeId' | 'fileUrl' | 'fileType' | 'fileSize'>>) => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.documentTypeId !== undefined) update.document_type_id = patch.documentTypeId || null;
        if (patch.conformitaDocumentTypeId !== undefined) update.conformita_document_type_id = patch.conformitaDocumentTypeId || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        const { data, error } = await supabase
            .from('job_documents')
            .update(update)
            .eq('id', id)
            .select('*, profiles:uploaded_by(full_name), job_site_document_types(name), job_conformita_document_types(name)')
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
