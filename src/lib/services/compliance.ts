import { supabase } from '@/lib/supabase';
import { getSoftDeletePayload } from './utils';
import { compressImageIfNeeded } from '@/lib/image-compress';

export type ComplianceDocumentType =
    | 'RDC_RDV_FT'
    | 'ETA'
    | 'DOP'
    | 'CONFORMITA_PRODUTTORE'
    | 'OMOLOGAZIONE_MINISTERIALE';

export const DOCUMENT_TYPE_LABELS: Record<ComplianceDocumentType, string> = {
    RDC_RDV_FT: 'RDC/RDV/FT',
    ETA: 'ETA',
    DOP: 'DOP',
    CONFORMITA_PRODUTTORE: 'Conformità Produttore',
    OMOLOGAZIONE_MINISTERIALE: 'Omologazione Ministeriale',
};

export interface ComplianceDocument {
    id: string;
    supplierId: string;
    brandId: string;
    brandName?: string;
    documentType: ComplianceDocumentType | '';
    documentTypeId: string | null;
    documentTypeName: string;
    name: string;
    notes?: string;
    fileUrl: string;
    fileSize: number | null;
    purchaseId?: string;
    purchaseNumber?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

const mapDbToDoc = (db: any): ComplianceDocument => {
    // Se la bolla associata è stata eliminata (soft-delete), non mostrare il collegamento
    const purchaseDeleted = db.purchases?.deleted_at != null;
    return {
        id: db.id,
        supplierId: db.supplier_id,
        brandId: db.brand_id,
        brandName: db.brands?.name,
        documentType: db.document_type || '',
        documentTypeId: db.document_type_id || null,
        documentTypeName: db.compliance_document_types?.name || (db.document_type ? DOCUMENT_TYPE_LABELS[db.document_type as ComplianceDocumentType] : '') || '',
        name: db.name,
        notes: db.notes,
        fileUrl: db.file_url,
        fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
        purchaseId: purchaseDeleted ? undefined : db.purchase_id,
        purchaseNumber: purchaseDeleted ? undefined : db.purchases?.delivery_note_number,
        createdBy: db.created_by,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
};

const SELECT_WITH_RELATIONS = '*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name)';

export const complianceApi = {
    getAll: async (search?: string): Promise<ComplianceDocument[]> => {
        let query = supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(50);
        if (search) query = query.ilike('name', `%${search}%`);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    getBySupplier: async (supplierId: string): Promise<ComplianceDocument[]> => {
        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .eq('supplier_id', supplierId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    create: async (doc: {
        supplierId: string;
        brandId: string;
        documentTypeId?: string | null;
        name: string;
        notes?: string;
        fileUrl: string;
        fileSize?: number | null;
        purchaseId?: string;
    }): Promise<ComplianceDocument> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .insert({
                supplier_id: doc.supplierId,
                brand_id: doc.brandId,
                document_type_id: doc.documentTypeId || null,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                file_size: doc.fileSize ?? null,
                purchase_id: doc.purchaseId || null,
                created_by: user?.id,
            })
            .select(SELECT_WITH_RELATIONS)
            .single();
        if (error) throw error;
        return mapDbToDoc(data);
    },

    update: async (id: string, doc: {
        brandId?: string;
        documentTypeId?: string | null;
        name?: string;
        notes?: string;
        fileUrl?: string;
        fileSize?: number | null;
        purchaseId?: string | null;
    }): Promise<ComplianceDocument> => {
        const payload: any = {};
        if (doc.brandId !== undefined) payload.brand_id = doc.brandId;
        if (doc.documentTypeId !== undefined) payload.document_type_id = doc.documentTypeId;
        if (doc.name !== undefined) payload.name = doc.name;
        if (doc.notes !== undefined) payload.notes = doc.notes;
        if (doc.fileUrl !== undefined) payload.file_url = doc.fileUrl;
        if (doc.fileSize !== undefined) payload.file_size = doc.fileSize;
        if ('purchaseId' in doc) payload.purchase_id = doc.purchaseId ?? null;

        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .update(payload)
            .eq('id', id)
            .select(SELECT_WITH_RELATIONS)
            .single();
        if (error) throw error;
        return mapDbToDoc(data);
    },

    delete: async (id: string): Promise<void> => {
        const payload = await getSoftDeletePayload();
        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .update(payload)
            .eq('id', id)
            .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('Documento non trovato o permessi insufficienti per l\'eliminazione');
        }
    },

    uploadFile: async (file: File, supplierName: string): Promise<{ fileId: string; name: string }> => {
        const compressed = await compressImageIfNeeded(file);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folderPath', JSON.stringify(['Fornitori', supplierName, 'Compliance']));
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Errore upload su Google Drive');
        return { fileId: result.fileId, name: result.name };
    },

    searchPurchasesBySupplier: async (supplierId: string, search: string) => {
        const { data, error } = await supabase
            .from('purchases')
            .select('id, delivery_note_number, delivery_note_date')
            .eq('supplier_id', supplierId)
            .eq('order_type', 'purchase')
            .is('deleted_at', null)
            .ilike('delivery_note_number', `%${search}%`)
            .order('delivery_note_date', { ascending: false })
            .limit(20);
        if (error) throw error;
        return (data || []) as { id: string; delivery_note_number: string; delivery_note_date: string }[];
    },
};

export interface JobComplianceAssociation {
    id: string;
    jobId: string;
    complianceDocumentId: string;
    customName?: string;
    customNotes?: string;
    createdAt: string;
    document?: ComplianceDocument;
}

const mapDbToAssociation = (db: any): JobComplianceAssociation => ({
    id: db.id,
    jobId: db.job_id,
    complianceDocumentId: db.compliance_document_id,
    customName: db.custom_name ?? undefined,
    customNotes: db.custom_notes ?? undefined,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDbToDoc(db.supplier_compliance_documents) : undefined,
});

export const jobComplianceApi = {
    getByJobId: async (jobId: string): Promise<JobComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('job_compliance_associations')
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))')
            .eq('job_id', jobId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToAssociation);
    },

    associate: async (jobId: string, complianceDocumentId: string): Promise<JobComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();
        const selectQuery = '*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))';

        // Se esiste già un'associazione soft-deleted per la stessa coppia (es. commessa
        // ricreata dopo cancellazione e riusata lo stesso job_id), la resuscita invece
        // di inserirne una nuova, che andrebbe in conflitto con l'indice unico.
        const { data: existing } = await supabase
            .from('job_compliance_associations')
            .select('id')
            .eq('job_id', jobId)
            .eq('compliance_document_id', complianceDocumentId)
            .not('deleted_at', 'is', null)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('job_compliance_associations')
                .update({ deleted_at: null, created_by: user?.id, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select(selectQuery)
                .single();
            if (error) throw error;
            return mapDbToAssociation(data);
        }

        const { data, error } = await supabase
            .from('job_compliance_associations')
            .insert({ job_id: jobId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(selectQuery)
            .single();
        if (error) throw error;
        return mapDbToAssociation(data);
    },

    update: async (id: string, payload: { customName?: string | null; customNotes?: string | null }): Promise<void> => {
        const { error } = await supabase
            .from('job_compliance_associations')
            .update({ custom_name: payload.customName ?? null, custom_notes: payload.customNotes ?? null })
            .eq('id', id);
        if (error) throw error;
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('job_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
    disassociateAll: async (jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('job_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('job_id', jobId)
            .is('deleted_at', null);
        if (error) throw error;
    },
};

export interface ProposalComplianceAssociation {
    id: string;
    proposalId: string;
    complianceDocumentId: string;
    customName?: string;
    customNotes?: string;
    createdAt: string;
    document?: ComplianceDocument;
}

const mapDbToProposalAssociation = (db: any): ProposalComplianceAssociation => ({
    id: db.id,
    proposalId: db.proposal_id,
    complianceDocumentId: db.compliance_document_id,
    customName: db.custom_name ?? undefined,
    customNotes: db.custom_notes ?? undefined,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDbToDoc(db.supplier_compliance_documents) : undefined,
});

export const proposalComplianceApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('proposal_compliance_associations')
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))')
            .eq('proposal_id', proposalId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToProposalAssociation);
    },

    associate: async (proposalId: string, complianceDocumentId: string): Promise<ProposalComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();
        const selectQuery = '*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))';

        const { data: existing } = await supabase
            .from('proposal_compliance_associations')
            .select('id')
            .eq('proposal_id', proposalId)
            .eq('compliance_document_id', complianceDocumentId)
            .not('deleted_at', 'is', null)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('proposal_compliance_associations')
                .update({ deleted_at: null, created_by: user?.id, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select(selectQuery)
                .single();
            if (error) throw error;
            return mapDbToProposalAssociation(data);
        }

        const { data, error } = await supabase
            .from('proposal_compliance_associations')
            .insert({ proposal_id: proposalId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(selectQuery)
            .single();
        if (error) throw error;
        return mapDbToProposalAssociation(data);
    },

    update: async (id: string, payload: { customName?: string | null; customNotes?: string | null }): Promise<void> => {
        const { error } = await supabase
            .from('proposal_compliance_associations')
            .update({ custom_name: payload.customName ?? null, custom_notes: payload.customNotes ?? null })
            .eq('id', id);
        if (error) throw error;
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('proposal_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
};
