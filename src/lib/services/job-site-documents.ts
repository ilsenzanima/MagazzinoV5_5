import { supabase } from '@/lib/supabase';
import { deleteDriveFileIfApplicable } from './utils';

export interface SiteDocument {
    id: string;
    jobId: string | null;
    proposalId: string | null;
    documentTypeId: string | null;
    documentTypeName: string;
    folderId: string | null;
    name: string;
    notes: string;
    fileUrl: string;
    fileType: string;
    fileSize: number | null;
    uploadedBy: string;
    uploadedByName: string;
    createdAt: string;
    isOld: boolean;
    isRev: boolean;
}

const map = (db: any): SiteDocument => ({
    id: db.id,
    jobId: db.job_id || null,
    proposalId: db.proposal_id || null,
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.job_site_document_types?.name || '',
    folderId: db.folder_id || null,
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

// Documenti di cantiere condivisi tra commessa e proposta di origine (stesso
// record visibile da entrambe le pagine, come già avviene per "Documenti Commessa").
export const jobSiteDocumentsApi = {
    getByJobId: async (jobId: string): Promise<SiteDocument[]> => {
        const { data, error } = await supabase
            .from('shared_site_documents')
            .select(SELECT_WITH_TYPE)
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<SiteDocument, 'id' | 'createdAt' | 'documentTypeName' | 'proposalId'>): Promise<SiteDocument> => {
        // Se la commessa proviene da una proposta, il documento è subito visibile anche lì.
        const { data: proposal } = await supabase
            .from('client_proposals')
            .select('id')
            .eq('converted_job_id', doc.jobId)
            .maybeSingle();

        const { data, error } = await supabase
            .from('shared_site_documents')
            .insert({
                job_id: doc.jobId,
                proposal_id: proposal?.id || null,
                document_type_id: doc.documentTypeId || null,
                folder_id: doc.folderId || null,
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

    update: async (id: string, patch: Partial<Pick<SiteDocument, 'name' | 'notes' | 'fileUrl' | 'fileType' | 'fileSize' | 'documentTypeId' | 'folderId' | 'isOld' | 'isRev'>>): Promise<SiteDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        if (patch.documentTypeId !== undefined) update.document_type_id = patch.documentTypeId || null;
        if (patch.folderId !== undefined) update.folder_id = patch.folderId || null;
        if (patch.isOld !== undefined) update.is_old = patch.isOld;
        if (patch.isRev !== undefined) update.is_rev = patch.isRev;

        let oldFileUrl: string | undefined;
        if (patch.fileUrl !== undefined) {
            const { data: existing } = await supabase.from('shared_site_documents').select('file_url').eq('id', id).maybeSingle();
            oldFileUrl = existing?.file_url;
        }

        const { data, error } = await supabase.from('shared_site_documents').update(update).eq('id', id).select(SELECT_WITH_TYPE).single();
        if (error) throw error;
        if (oldFileUrl && oldFileUrl !== patch.fileUrl) {
            await deleteDriveFileIfApplicable(oldFileUrl);
        }
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('shared_site_documents').select('file_url').eq('id', id).maybeSingle();
        const { error } = await supabase.from('shared_site_documents').delete().eq('id', id);
        if (error) throw error;
        await deleteDriveFileIfApplicable(existing?.file_url);
    },
};
