import { supabase } from '@/lib/supabase';
import { deleteDriveFileIfApplicable } from './utils';

export interface ProposalDocument {
    id: string;
    proposalId: string;
    jobId: string | null;
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

const map = (db: any): ProposalDocument => ({
    id: db.id,
    proposalId: db.proposal_id,
    jobId: db.job_id || null,
    documentTypeId: db.proposal_document_type_id || null,
    documentTypeName: db.proposal_document_types?.name || '',
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

export const proposalDocumentsApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalDocument[]> => {
        const { data, error } = await supabase
            .from('shared_documents')
            .select('*, proposal_document_types(name)')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (doc: Omit<ProposalDocument, 'id' | 'createdAt' | 'documentTypeName' | 'jobId'>): Promise<ProposalDocument> => {
        // Se la proposta è già stata convertita in commessa, il documento è subito visibile anche lì.
        const { data: proposal } = await supabase
            .from('client_proposals')
            .select('converted_job_id')
            .eq('id', doc.proposalId)
            .single();

        const { data, error } = await supabase
            .from('shared_documents')
            .insert({
                proposal_id: doc.proposalId,
                job_id: proposal?.converted_job_id || null,
                proposal_document_type_id: doc.documentTypeId || null,
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
            .select('*, proposal_document_types(name)')
            .single();
        if (error) throw error;
        return map(data);
    },

    update: async (id: string, patch: Partial<Pick<ProposalDocument, 'name' | 'notes' | 'fileUrl' | 'fileType' | 'fileSize' | 'documentTypeId' | 'folderId' | 'isOld' | 'isRev'>>): Promise<ProposalDocument> => {
        const update: any = {};
        if (patch.name !== undefined) update.name = patch.name;
        if (patch.notes !== undefined) update.notes = patch.notes || null;
        if (patch.fileUrl !== undefined) update.file_url = patch.fileUrl;
        if (patch.fileType !== undefined) update.file_type = patch.fileType;
        if (patch.fileSize !== undefined) update.file_size = patch.fileSize;
        if (patch.documentTypeId !== undefined) update.proposal_document_type_id = patch.documentTypeId || null;
        if (patch.folderId !== undefined) update.folder_id = patch.folderId || null;
        if (patch.isOld !== undefined) update.is_old = patch.isOld;
        if (patch.isRev !== undefined) update.is_rev = patch.isRev;
        const { data, error } = await supabase.from('shared_documents').update(update).eq('id', id).select('*, proposal_document_types(name)').single();
        if (error) throw error;
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('shared_documents').select('file_url').eq('id', id).maybeSingle();
        const { data, error } = await supabase.from('shared_documents').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error("Eliminazione non consentita o documento non trovato");
        }
        await deleteDriveFileIfApplicable(existing?.file_url);
    },

    // Collega alla commessa appena creata tutti i documenti già caricati sulla proposta,
    // così restano gli stessi record (nessuna copia) e sono visibili da entrambe le pagine.
    linkToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_documents')
            .update({ job_id: jobId })
            .eq('proposal_id', proposalId);
        if (error) throw error;
    },
};
