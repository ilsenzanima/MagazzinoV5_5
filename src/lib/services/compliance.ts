import { supabase } from '@/lib/supabase';
import { getSoftDeletePayload, deleteDriveFileIfApplicable } from './utils';
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

// 'reusable': certificato generico di Gestione Conformità, associabile a più
// DDT/commesse. 'ddt_specific': prova rilasciata dal produttore per un DDT
// preciso (riporta numero/data di quel DDT) e non riutilizzabile altrove.
export type ComplianceDocumentScope = 'reusable' | 'ddt_specific';

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
    documentScope: ComplianceDocumentScope;
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
        documentScope: db.document_scope === 'ddt_specific' ? 'ddt_specific' : 'reusable',
        createdBy: db.created_by,
        createdAt: db.created_at,
        updatedAt: db.updated_at,
    };
};

const SELECT_WITH_RELATIONS = '*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name)';

export const complianceApi = {
    // `excludeDdtSpecific`: da usare quando si cercano certificati da associare
    // ad ALTRI DDT/commesse (es. dialoghi "Associa esistente"), per non proporre
    // documenti che sono prova di un DDT specifico e non riutilizzabili altrove.
    getAll: async (search?: string, excludeDdtSpecific = false): Promise<ComplianceDocument[]> => {
        let query = supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(50);
        if (search) query = query.ilike('name', `%${search}%`);
        if (excludeDdtSpecific) query = query.eq('document_scope', 'reusable');
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    getBySupplier: async (supplierId: string, excludeDdtSpecific = false): Promise<ComplianceDocument[]> => {
        let query = supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .eq('supplier_id', supplierId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (excludeDdtSpecific) query = query.eq('document_scope', 'reusable');
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    getByPurchaseId: async (purchaseId: string): Promise<ComplianceDocument[]> => {
        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .eq('purchase_id', purchaseId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToDoc);
    },

    getByJobIdFromDDT: async (jobId: string): Promise<ComplianceDocument[]> => {
        // Raccoglie gli id degli acquisti collegati a questa commessa, per tre vie:
        // - l'intero acquisto è assegnato alla commessa (purchases.job_id)
        // - singole righe dell'acquisto sono assegnate alla commessa (purchase_items.job_id)
        // - il materiale è stato mandato/reso in cantiere tramite un DDT di
        //   movimentazione (delivery_notes.job_id) che referenzia quel lotto
        //   (delivery_note_items.purchase_item_id), incluso il caso "fittizio"
        //   in cui viene comunque scelto un lotto di riferimento per il prezzo.
        const [directPurchases, itemPurchases, deliveryItems] = await Promise.all([
            supabase.from('purchases').select('id').eq('job_id', jobId).is('deleted_at', null),
            supabase.from('purchase_items').select('purchase_id').eq('job_id', jobId),
            supabase
                .from('delivery_note_items')
                .select('purchase_item_id, delivery_notes!inner(job_id)')
                .eq('delivery_notes.job_id', jobId)
                .not('purchase_item_id', 'is', null),
        ]);
        if (directPurchases.error) throw directPurchases.error;
        if (itemPurchases.error) throw itemPurchases.error;
        if (deliveryItems.error) throw deliveryItems.error;

        const purchaseIds = new Set<string>();
        (directPurchases.data || []).forEach((p: any) => purchaseIds.add(p.id));
        (itemPurchases.data || []).forEach((pi: any) => { if (pi.purchase_id) purchaseIds.add(pi.purchase_id); });

        const purchaseItemIds = (deliveryItems.data || []).map((d: any) => d.purchase_item_id).filter(Boolean);
        if (purchaseItemIds.length > 0) {
            const { data: piRows, error: piError } = await supabase
                .from('purchase_items')
                .select('id, purchase_id')
                .in('id', purchaseItemIds);
            if (piError) throw piError;
            (piRows || []).forEach((pi: any) => { if (pi.purchase_id) purchaseIds.add(pi.purchase_id); });
        }

        if (purchaseIds.size === 0) return [];
        const purchaseIdList = Array.from(purchaseIds);

        // Documenti creati direttamente su questi acquisti
        const { data: directDocs, error: e1 } = await supabase
            .from('supplier_compliance_documents')
            .select(SELECT_WITH_RELATIONS)
            .in('purchase_id', purchaseIdList)
            .is('deleted_at', null);
        if (e1) throw e1;

        // Documenti associati manualmente a questi acquisti (certificati riutilizzabili)
        const { data: assocRows, error: e2 } = await supabase
            .from('purchase_compliance_associations')
            .select(`supplier_compliance_documents(${SELECT_WITH_RELATIONS})`)
            .in('purchase_id', purchaseIdList)
            .is('deleted_at', null);
        if (e2) throw e2;

        const seen = new Set<string>();
        const result: ComplianceDocument[] = [];
        const addDoc = (doc: ComplianceDocument) => {
            if (!seen.has(doc.id)) { seen.add(doc.id); result.push(doc); }
        };
        (directDocs || []).map(mapDbToDoc).forEach(addDoc);
        (assocRows || []).flatMap((r: any) => r.supplier_compliance_documents ? [mapDbToDoc(r.supplier_compliance_documents)] : []).forEach(addDoc);
        return result;
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
        documentScope?: ComplianceDocumentScope;
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
                document_scope: doc.documentScope || 'reusable',
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

        let oldFileUrl: string | undefined;
        if (doc.fileUrl !== undefined) {
            const { data: existing } = await supabase.from('supplier_compliance_documents').select('file_url').eq('id', id).maybeSingle();
            oldFileUrl = existing?.file_url;
        }

        const { data, error } = await supabase
            .from('supplier_compliance_documents')
            .update(payload)
            .eq('id', id)
            .select(SELECT_WITH_RELATIONS)
            .single();
        if (error) throw error;
        if (oldFileUrl && oldFileUrl !== doc.fileUrl) {
            await deleteDriveFileIfApplicable(oldFileUrl);
        }
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

export interface ProposalComplianceAssociation {
    id: string;
    proposalId: string;
    complianceDocumentId: string;
    customName?: string;
    customNotes?: string;
    createdAt: string;
    document?: ComplianceDocument;
}

const SELECT_ASSOC_WITH_RELATIONS = '*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))';

const mapDbToAssociation = (db: any): JobComplianceAssociation => ({
    id: db.id,
    jobId: db.job_id,
    complianceDocumentId: db.compliance_document_id,
    customName: db.custom_name ?? undefined,
    customNotes: db.custom_notes ?? undefined,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDbToDoc(db.supplier_compliance_documents) : undefined,
});

const mapDbToProposalAssociation = (db: any): ProposalComplianceAssociation => ({
    id: db.id,
    proposalId: db.proposal_id,
    complianceDocumentId: db.compliance_document_id,
    customName: db.custom_name ?? undefined,
    customNotes: db.custom_notes ?? undefined,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDbToDoc(db.supplier_compliance_documents) : undefined,
});

// Cerca una riga esistente in shared_compliance_associations per questa coppia
// documento + (job e/o proposta di origine), preferendo una riga già attiva
// a una soft-deleted. Permette di riusare/collegare lo stesso record invece
// di duplicarlo quando job e proposta condividono lo stesso documento.
const findExistingComplianceAssociation = async (
    jobId: string | null,
    proposalId: string | null,
    complianceDocumentId: string
): Promise<any | null> => {
    if (jobId) {
        const { data } = await supabase
            .from('shared_compliance_associations')
            .select('*')
            .eq('job_id', jobId)
            .eq('compliance_document_id', complianceDocumentId)
            .order('deleted_at', { ascending: true, nullsFirst: true })
            .limit(1)
            .maybeSingle();
        if (data) return data;
    }
    if (proposalId) {
        const { data } = await supabase
            .from('shared_compliance_associations')
            .select('*')
            .eq('proposal_id', proposalId)
            .eq('compliance_document_id', complianceDocumentId)
            .order('deleted_at', { ascending: true, nullsFirst: true })
            .limit(1)
            .maybeSingle();
        if (data) return data;
    }
    return null;
};

export const jobComplianceApi = {
    getByJobId: async (jobId: string): Promise<JobComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('shared_compliance_associations')
            .select(SELECT_ASSOC_WITH_RELATIONS)
            .eq('job_id', jobId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToAssociation);
    },

    associate: async (jobId: string, complianceDocumentId: string): Promise<JobComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();

        // Se la commessa proviene da una proposta, riusa/collega la stessa riga
        // così l'associazione resta sincronizzata tra le due pagine.
        const { data: sourceProposal } = await supabase
            .from('client_proposals')
            .select('id')
            .eq('converted_job_id', jobId)
            .maybeSingle();
        const proposalId = sourceProposal?.id || null;

        const existing = await findExistingComplianceAssociation(jobId, proposalId, complianceDocumentId);

        if (existing) {
            const patch: any = { deleted_at: null, job_id: jobId };
            if (proposalId && !existing.proposal_id) patch.proposal_id = proposalId;
            if (existing.deleted_at) { patch.created_by = user?.id; patch.created_at = new Date().toISOString(); }
            const { data, error } = await supabase
                .from('shared_compliance_associations')
                .update(patch)
                .eq('id', existing.id)
                .select(SELECT_ASSOC_WITH_RELATIONS)
                .single();
            if (error) throw error;
            return mapDbToAssociation(data);
        }

        const { data, error } = await supabase
            .from('shared_compliance_associations')
            .insert({ job_id: jobId, proposal_id: proposalId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(SELECT_ASSOC_WITH_RELATIONS)
            .single();
        if (error) throw error;
        return mapDbToAssociation(data);
    },

    update: async (id: string, payload: { customName?: string | null; customNotes?: string | null }): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ custom_name: payload.customName ?? null, custom_notes: payload.customNotes ?? null })
            .eq('id', id);
        if (error) throw error;
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
    disassociateAll: async (jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('job_id', jobId)
            .is('deleted_at', null);
        if (error) throw error;
    },
};

export const proposalComplianceApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('shared_compliance_associations')
            .select(SELECT_ASSOC_WITH_RELATIONS)
            .eq('proposal_id', proposalId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToProposalAssociation);
    },

    associate: async (proposalId: string, complianceDocumentId: string): Promise<ProposalComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();

        // Se la proposta è già stata convertita in commessa, riusa/collega la
        // stessa riga così l'associazione resta sincronizzata tra le due pagine.
        const { data: proposal } = await supabase
            .from('client_proposals')
            .select('converted_job_id')
            .eq('id', proposalId)
            .single();
        const jobId = proposal?.converted_job_id || null;

        const existing = await findExistingComplianceAssociation(jobId, proposalId, complianceDocumentId);

        if (existing) {
            const patch: any = { deleted_at: null, proposal_id: proposalId };
            if (jobId && !existing.job_id) patch.job_id = jobId;
            if (existing.deleted_at) { patch.created_by = user?.id; patch.created_at = new Date().toISOString(); }
            const { data, error } = await supabase
                .from('shared_compliance_associations')
                .update(patch)
                .eq('id', existing.id)
                .select(SELECT_ASSOC_WITH_RELATIONS)
                .single();
            if (error) throw error;
            return mapDbToProposalAssociation(data);
        }

        const { data, error } = await supabase
            .from('shared_compliance_associations')
            .insert({ proposal_id: proposalId, job_id: jobId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(SELECT_ASSOC_WITH_RELATIONS)
            .single();
        if (error) throw error;
        return mapDbToProposalAssociation(data);
    },

    update: async (id: string, payload: { customName?: string | null; customNotes?: string | null }): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ custom_name: payload.customName ?? null, custom_notes: payload.customNotes ?? null })
            .eq('id', id);
        if (error) throw error;
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    // Collega alla commessa appena creata tutte le associazioni di conformità
    // già presenti sulla proposta, così restano le stesse righe (nessuna copia).
    linkToJob: async (proposalId: string, jobId: string): Promise<void> => {
        const { error } = await supabase
            .from('shared_compliance_associations')
            .update({ job_id: jobId })
            .eq('proposal_id', proposalId)
            .is('job_id', null);
        if (error) throw error;
    },
};

// ─── Purchase (DDT) ↔ Compliance associations ────────────────────────────────

export interface PurchaseComplianceAssociation {
    id: string;
    purchaseId: string;
    complianceDocumentId: string;
    createdAt: string;
    document?: ComplianceDocument;
}

const mapDbToPurchaseAssociation = (db: any): PurchaseComplianceAssociation => ({
    id: db.id,
    purchaseId: db.purchase_id,
    complianceDocumentId: db.compliance_document_id,
    createdAt: db.created_at,
    document: db.supplier_compliance_documents ? mapDbToDoc(db.supplier_compliance_documents) : undefined,
});

export const purchaseComplianceApi = {
    getByPurchaseId: async (purchaseId: string): Promise<PurchaseComplianceAssociation[]> => {
        const { data, error } = await supabase
            .from('purchase_compliance_associations')
            .select('*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))')
            .eq('purchase_id', purchaseId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapDbToPurchaseAssociation);
    },

    associate: async (purchaseId: string, complianceDocumentId: string): Promise<PurchaseComplianceAssociation> => {
        const { data: { user } } = await supabase.auth.getUser();
        const selectQuery = '*, supplier_compliance_documents(*, brands(name), purchases(delivery_note_number, deleted_at), compliance_document_types(name))';

        const { data: existing } = await supabase
            .from('purchase_compliance_associations')
            .select('id')
            .eq('purchase_id', purchaseId)
            .eq('compliance_document_id', complianceDocumentId)
            .not('deleted_at', 'is', null)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('purchase_compliance_associations')
                .update({ deleted_at: null, created_by: user?.id, created_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select(selectQuery)
                .single();
            if (error) throw error;
            return mapDbToPurchaseAssociation(data);
        }

        const { data, error } = await supabase
            .from('purchase_compliance_associations')
            .insert({ purchase_id: purchaseId, compliance_document_id: complianceDocumentId, created_by: user?.id })
            .select(selectQuery)
            .single();
        if (error) throw error;
        return mapDbToPurchaseAssociation(data);
    },

    disassociate: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('purchase_compliance_associations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },
};
