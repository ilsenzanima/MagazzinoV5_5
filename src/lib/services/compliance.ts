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
        const formData = new FormData();
        formData.append('file', file);
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
