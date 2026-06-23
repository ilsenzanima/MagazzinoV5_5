import { supabase } from '@/lib/supabase';
import { CostAnalysisRow, CostAnalysisParams } from './cost-analysis';

// Re-uses the same types as job cost analysis, just different tables
const DEFAULT_PARAMS = { sfrido: 5, sconto: 0, trasporto: 0, posa: 0, ricarico: 30, margineTrattativa: 10 };

export interface ProposalCostAnalysisVersion {
    id: string;
    proposalId: string;
    name: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
}

const mapVersion = (db: any): ProposalCostAnalysisVersion => ({
    id: db.id,
    proposalId: db.proposal_id,
    name: db.name,
    note: db.note,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
});

const mapRow = (db: any): CostAnalysisRow => ({
    id: db.id,
    jobId: db.version_id,
    type: db.type,
    itemId: db.item_id,
    itemName: db.item_name,
    itemModel: db.item_model,
    itemUnit: db.item_unit,
    maxPurchasePrice: db.max_purchase_price !== null ? Number(db.max_purchase_price) : null,
    unitPrice: db.unit_price !== null ? Number(db.unit_price) : null,
    qtyEstimated: Number(db.qty_estimated),
    qtyActual: Number(db.qty_actual),
    sortOrder: db.sort_order,
    createdAt: db.created_at,
});

export const proposalCostAnalysisVersionsApi = {
    getByProposalId: async (proposalId: string): Promise<ProposalCostAnalysisVersion[]> => {
        const { data, error } = await supabase
            .from('proposal_cost_analysis_versions')
            .select('*')
            .eq('proposal_id', proposalId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapVersion);
    },

    getById: async (id: string): Promise<ProposalCostAnalysisVersion> => {
        const { data, error } = await supabase
            .from('proposal_cost_analysis_versions')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return mapVersion(data);
    },

    create: async (proposalId: string, name: string, note?: string): Promise<ProposalCostAnalysisVersion> => {
        const { data, error } = await supabase
            .from('proposal_cost_analysis_versions')
            .insert({ proposal_id: proposalId, name, note: note || null })
            .select()
            .single();
        if (error) throw error;
        return mapVersion(data);
    },

    update: async (id: string, fields: { name?: string; note?: string | null }): Promise<ProposalCostAnalysisVersion> => {
        const db: any = { updated_at: new Date().toISOString() };
        if (fields.name !== undefined) db.name = fields.name;
        if (fields.note !== undefined) db.note = fields.note || null;
        const { data, error } = await supabase
            .from('proposal_cost_analysis_versions')
            .update(db)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapVersion(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_cost_analysis_versions').delete().eq('id', id);
        if (error) throw error;
    },
};

export const proposalCostAnalysisApi = {
    getByVersionId: async (versionId: string): Promise<CostAnalysisRow[]> => {
        const { data, error } = await supabase
            .from('proposal_cost_analysis_rows')
            .select('*')
            .eq('version_id', versionId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapRow);
    },

    add: async (proposalId: string, versionId: string, row: Omit<CostAnalysisRow, 'id' | 'jobId' | 'createdAt'>): Promise<CostAnalysisRow> => {
        const { data, error } = await supabase
            .from('proposal_cost_analysis_rows')
            .insert({
                proposal_id: proposalId,
                version_id: versionId,
                type: row.type,
                item_id: row.itemId || null,
                item_name: row.itemName,
                item_model: row.itemModel,
                item_unit: row.itemUnit,
                max_purchase_price: row.maxPurchasePrice,
                unit_price: row.unitPrice,
                qty_estimated: row.qtyEstimated,
                qty_actual: row.qtyActual,
                sort_order: row.sortOrder,
            })
            .select()
            .single();
        if (error) throw error;
        return mapRow(data);
    },

    update: async (id: string, fields: Partial<Pick<CostAnalysisRow, 'unitPrice' | 'qtyEstimated' | 'qtyActual' | 'itemName' | 'sortOrder'>>): Promise<void> => {
        const db: any = {};
        if (fields.unitPrice !== undefined) db.unit_price = fields.unitPrice;
        if (fields.qtyEstimated !== undefined) db.qty_estimated = fields.qtyEstimated;
        if (fields.qtyActual !== undefined) db.qty_actual = fields.qtyActual;
        if (fields.itemName !== undefined) db.item_name = fields.itemName;
        if (fields.sortOrder !== undefined) db.sort_order = fields.sortOrder;
        const { error } = await supabase.from('proposal_cost_analysis_rows').update(db).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('proposal_cost_analysis_rows').delete().eq('id', id);
        if (error) throw error;
    },

    getParams: async (versionId: string): Promise<CostAnalysisParams> => {
        const { data } = await supabase
            .from('proposal_cost_analysis_params')
            .select('*')
            .eq('version_id', versionId)
            .maybeSingle();
        if (!data) return { jobId: versionId, ...DEFAULT_PARAMS };
        return {
            jobId: data.version_id,
            sfrido: Number(data.sfrido),
            sconto: Number(data.sconto),
            trasporto: Number(data.trasporto),
            posa: Number(data.posa),
            ricarico: Number(data.ricarico),
            margineTrattativa: Number(data.margine_trattativa),
        };
    },

    upsertParams: async (proposalId: string, versionId: string, p: Omit<CostAnalysisParams, 'jobId'>): Promise<void> => {
        const { error } = await supabase
            .from('proposal_cost_analysis_params')
            .upsert({
                proposal_id: proposalId,
                version_id: versionId,
                sfrido: p.sfrido,
                sconto: p.sconto,
                trasporto: p.trasporto,
                posa: p.posa,
                ricarico: p.ricarico,
                margine_trattativa: p.margineTrattativa,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'version_id' });
        if (error) throw error;
    },
};
