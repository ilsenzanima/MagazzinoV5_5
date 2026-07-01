import { supabase } from '@/lib/supabase';
import { deleteDriveFileIfApplicable } from './utils';
import { SiteDocument } from './job-site-documents';

const map = (db: any): SiteDocument => ({
    id: db.id,
    jobId: db.job_id || null,
    proposalId: db.proposal_id || null,
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.job_site_document_types?.name || '',
    name: db.name,
    notes: db.notes || '',
    fileUrl: db.file_url,
    fileType: db.file_type || '',
    fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
    uploadedBy: db.uploaded_by || '',
    uploadedByName: db.uploaded_by_name || '',
    createdAt: db.created_at,
    isOld: db.is_old === true,
    isRev: db.is_rev === true,
});

const SELECT_WITH_TYPE = '*, job_site_document_types(name)';

// Documenti di cantiere condivisi tra proposta e commessa generata dalla
// conversione (stesso record visibile da entrambe le pagine).
export const proposalSiteDocumentsApi = {
    getByProposalId: async (proposalId: string): Promise<SiteDocument[]> => {
        const { data, error } = await supabase
            .from('shared_site_documents')
            .select(SELECT_WITH_TYPE)
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<SiteDocument, 'id' | 'createdAt' | 'documentTypeName' | 'jobId'>): Promise<SiteDocument> => {
        // Se la proposta è già stata convertita in commessa, il documento è subito visibile anche lì.
        const { data: proposal } = await supabase
            .from('client_proposals')
            .select('converted_job_id')
            .eq('id', doc.proposalId)
            .single();

        const { data, error } = await supabase
            .from('shared_site_documents')
            .insert({
                proposal_id: doc.proposalId,
                job_id: proposal?.converted_job_id || null,
                document_type_id: doc.documentTypeId || null,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_type: doc.fileType || null,
                file_size: doc.fileSize ?? null,
                uploaded_by: doc.uploadedBy || null,
                uploaded_by_name: doc.uploadedByName || null,
                is_old: doc.isOld ?? false,
                is_rev: doc.isRev ?? false,
            })
            .select(SELECT_WITH_TYPE)
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, patch: Partial<Pick<SiteDocument, 'name' | 'notes' | 'fileUrl' | 'fileType' | 'fileSize' | 'documentTypeId' | 'isOld' | 'isRev'>>): Promise<SiteDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        if (patch.documentTypeId !== undefined) update.document_type_id = patch.documentTypeId || null;
        if (patch.isOld !== undefined) update.is_old = patch.isOld;
        if (patch.isRev !== undefined) update.is_rev = patch.isRev;
        const { data, error } = await supabase.from('shared_site_documents').update(update).eq('id', id).select(SELECT_WITH_TYPE).single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('shared_site_documents').select('file_url').eq('id', id).maybeSingle();
        const { error } = await supabase.from('shared_site_documents').delete().eq('id', id);
        if (error) throw error;
        await deleteDriveFileIfApplicable(existing?.file_url);
    },

    // Collega alla commessa appena creata tutti i documenti di cantiere già
    // caricati sulla proposta, così restano gli stessi record (nessuna copia).
    linkToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_site_documents')
            .update({ job_id: jobId })
            .eq('proposal_id', proposalId);
        if (error) throw error;
    },
};
