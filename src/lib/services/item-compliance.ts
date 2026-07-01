import { supabase } from '@/lib/supabase';
import { ComplianceDocument } from './compliance';

const SELECT_WITH_RELATIONS = '*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))';

export interface ItemComplianceAssociation {
    id: string;
    itemId: string;
    complianceDocumentId: string;
    createdAt: string;
    document?: ComplianceDocument;
}

// Riusa il mapper del documento da compliance.ts tramite un import circolare
// evitato: rimappiamo qui i campi minimi necessari (stessa forma di ComplianceDocument).
const mapDoc = (db: any): ComplianceDocument => ({
    id: db.id,
    supplierId: db.supplier_id,
    brandId: db.brand_id,
    brandName: db.brands?.name,
    documentType: db.document_type || '',
    documentTypeId: db.document_type_id || null,
    documentTypeName: db.compliance_document_types?.name || '',
    name: db.name,
    notes: db.notes,
    fileUrl: db.file_url,
    fileSize: db.file_size !== null && db.file_size !== undefined ? Number(db.file_size) : null,
    purchaseId: db.purchases?.deleted_at ? undefined : db.purchase_id,
    purchaseNumber: db.purchases?.deleted_at ? undefined : db.purchases?.delivery_note_number,
    documentScope: db.document_scope === 'ddt_specific' ? 'ddt_specific' : 'reusable',
    createdBy: db.created_by,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
});

const mapAssociation = (db: any): ItemComplianceAssociation => ({
    id: db.id,
    itemId: db.item_id,
    complianceDocumentId: db.compliance_document_id,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDoc(db.supplier_compliance_documents) : undefined,
});

export const itemComplianceApi = {
    getByItemId: async (itemId: string): Promise<ItemComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('item_compliance_associations')
            .select(SELECT_WITH_RELATIONS)
            .eq('item_id', itemId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapAssociation);
    },

    // Documenti riutilizzabili collegati a più articoli in una sola chiamata,
    // usato per "Suggeriti da articoli" nell'associazione conformità commessa.
    getByItemIds: async (itemIds: string[]): Promise<ItemComplianceAssociation[]> => {
        if (itemIds.length === 0) return [];
        const { data, error } = await supabase
            .from('item_compliance_associations')
            .select(SELECT_WITH_RELATIONS)
            .in('item_id', itemIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapAssociation);
    },

    associate: async (itemId: string, complianceDocumentId: string): Promise<ItemComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();

        const { data: existing } = await supabase
            .from('item_compliance_associations')
            .select('id')
            .eq('item_id', itemId)
            .eq('compliance_document_id', complianceDocumentId)
            .not('deleted_at', 'is', null)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('item_compliance_associations')
                .update({ deleted_at: null, created_by: user?.id, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select(SELECT_WITH_RELATIONS)
                .single();
            if (error) throw error;
            return mapAssociation(data);
        }

        const { data, error } = await supabase
            .from('item_compliance_associations')
            .insert({ item_id: itemId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(SELECT_WITH_RELATIONS)
            .single();
        if (error) throw error;
        return mapAssociation(data);
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('item_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
};
