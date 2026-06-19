import { supabase } from '@/lib/supabase';
import { getSoftDeletePayload } from './utils';

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
    documentType: ComplianceDocumentType;
    name: string;
    notes?: string;
    fileUrl: string;
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
        documentType: db.document_type,
        name: db.name,
        notes: db.notes,
        fileUrl: db.file_url,
        purchaseId: purchaseDeleted ? undefined : db.purchase_id,
        purchaseNumber: purchaseDeleted ? undefined : db.purchases?.delivery_note_number,
        createdBy: db.created_by,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
};

export const complianceApi = {
    getAll: async (search?: string): Promise<ComplianceDocument[]> => {
        let query = supabase
            .from('supplier_compliance_documents')
            .select('*, brands(name), purchases(delivery_note_number, deleted_at)')
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
            .select('*, brands(name), purchases(delivery_note_number, deleted_at)')
            .eq('supplier_id', supplierId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    create: async (doc: {
        supplierId: string;
        brandId: string;
        documentType: ComplianceDocumentType;
        name: string;
        notes?: string;
        fileUrl: string;
        purchaseId?: string;
    }): Promise<ComplianceDocument> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .insert({
                supplier_id: doc.supplierId,
                brand_id: doc.brandId,
                document_type: doc.documentType,
                name: doc.name,
                notes: doc.notes || null,
                file_url: doc.fileUrl,
                purchase_id: doc.purchaseId || null,
                created_by: user?.id,
            })
            .select('*, brands(name), purchases(delivery_note_number, deleted_at)')
            .single();
        if (error) throw error;
        return mapDbToDoc(data);
    },

    update: async (id: string, doc: {
        brandId?: string;
        documentType?: ComplianceDocumentType;
        name?: string;
        notes?: string;
        purchaseId?: string | null;
    }): Promise<ComplianceDocument> => {
        const payload: any = {};
        if (doc.brandId !== undefined) payload.brand_id = doc.brandId;
        if (doc.documentType !== undefined) payload.document_type = doc.documentType;
        if (doc.name !== undefined) payload.name = doc.name;
        if (doc.notes !== undefined) payload.notes = doc.notes;
        if ('purchaseId' in doc) payload.purchase_id = doc.purchaseId ?? null;

        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .update(payload)
            .eq('id', id)
            .select('*, brands(name), purchases(delivery_note_number, deleted_at)')
            .single();
        if (error) throw error;
        return mapDbToDoc(data);
    },

    delete: async (id: string): Promise<void> => {
        const payload = await getSoftDeletePayload();
        const { error } = await supabase
            .from('supplier_compliance_documents')
            .update(payload)
            .eq('id', id);
        if (error) throw error;
    },

    uploadFile: async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `compliance_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('documents').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName);
        return publicUrl;
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
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at))')
            .eq('job_id', jobId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToAssociation);
    },

    associate: async (jobId: string, complianceDocumentId: string): Promise<JobComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('job_compliance_associations')
            .insert({ job_id: jobId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at))')
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
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at))')
            .eq('proposal_id', proposalId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToProposalAssociation);
    },

    associate: async (proposalId: string, complianceDocumentId: string): Promise<ProposalComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('proposal_compliance_associations')
            .insert({ proposal_id: proposalId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at))')
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
