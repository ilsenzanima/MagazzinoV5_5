import { supabase } from '@/lib/supabase';
import { proposalCostAnalysisApi } from './proposal-cost-analysis';

export interface CostAnalysisParams {
    jobId: string;
    sfrido: number;
    sconto: number;
    trasporto: number;
    posa: number;
    ricarico: number;
    margineTrattativa: number;
}

const DEFAULT_PARAMS: Omit<CostAnalysisParams, 'jobId'> = {
    sfrido: 5, sconto: 0, trasporto: 0, posa: 0, ricarico: 30, margineTrattativa: 10,
};

export interface CostAnalysisRow {
    id: string;
    jobId: string;
    type: 'inventory' | 'generic';
    itemId: string | null;
    itemName: string;
    itemModel: string;
    itemUnit: string;
    maxPurchasePrice: number | null;
    unitPrice: number | null;
    qtyEstimated: number;
    qtyActual: number;
    sortOrder: number;
    createdAt: string;
}

const mapRow = (db: any): CostAnalysisRow => ({
    id: db.id,
    jobId: db.job_id,
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

export const costAnalysisApi = {
    getByJobId: async (jobId: string): Promise<CostAnalysisRow[]> => {
        const { data, error } = await supabase
            .from('job_cost_analysis_rows')
            .select('*')
            .eq('job_id', jobId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapRow);
    },

    add: async (jobId: string, row: Omit<CostAnalysisRow, 'id' | 'jobId' | 'createdAt'>): Promise<CostAnalysisRow> => {
        const { data, error } = await supabase
            .from('job_cost_analysis_rows')
            .insert({
                job_id: jobId,
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
        const { error } = await supabase.from('job_cost_analysis_rows').update(db).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_cost_analysis_rows').delete().eq('id', id);
        if (error) throw error;
    },

    // Prezzo unitario più alto per un articolo su tutti gli acquisti
    getMaxPurchasePrice: async (itemId: string): Promise<number | null> => {
        const { data, error } = await supabase
            .from('purchase_items')
            .select('price')
            .eq('item_id', itemId)
            .order('price', { ascending: false })
            .limit(1);
        if (error) throw error;
        return data && data.length > 0 ? Number(data[0].price) : null;
    },

    getParams: async (jobId: string): Promise<CostAnalysisParams> => {
        const { data } = await supabase
            .from('job_cost_analysis_params')
            .select('*')
            .eq('job_id', jobId)
            .maybeSingle();
        if (!data) return { jobId, ...DEFAULT_PARAMS };
        return {
            jobId: data.job_id,
            sfrido: Number(data.sfrido),
            sconto: Number(data.sconto),
            trasporto: Number(data.trasporto),
            posa: Number(data.posa),
            ricarico: Number(data.ricarico),
            margineTrattativa: Number(data.margine_trattativa),
        };
    },

    upsertParams: async (jobId: string, p: Omit<CostAnalysisParams, 'jobId'>, sourceProposalVersionId?: string | null): Promise<void> => {
        const db: any = {
            job_id: jobId,
            sfrido: p.sfrido,
            sconto: p.sconto,
            trasporto: p.trasporto,
            posa: p.posa,
            ricarico: p.ricarico,
            margine_trattativa: p.margineTrattativa,
            updated_at: new Date().toISOString(),
        };
        if (sourceProposalVersionId !== undefined) db.source_proposal_version_id = sourceProposalVersionId;
        const { error } = await supabase
            .from('job_cost_analysis_params')
            .upsert(db, { onConflict: 'job_id' });
        if (error) throw error;
    },

    // Prezzi massimi per più articoli in una sola query
    getMaxPurchasePrices: async (itemIds: string[]): Promise<Map<string, number>> => {
        if (itemIds.length === 0) return new Map();
        const { data, error } = await supabase
            .rpc('get_max_purchase_prices', { item_ids: itemIds });
        if (error) {
            // Fallback: query manuale se la RPC non esiste
            const { data: rows, error: e2 } = await supabase
                .from('purchase_items')
                .select('item_id, price')
                .in('item_id', itemIds);
            if (e2) throw e2;
            const map = new Map<string, number>();
            for (const r of rows || []) {
                const cur = map.get(r.item_id) ?? 0;
                if (Number(r.price) > cur) map.set(r.item_id, Number(r.price));
            }
            return map;
        }
        const map = new Map<string, number>();
        for (const r of data || []) map.set(r.item_id, Number(r.max_price));
        return map;
    },

    getSourceProposalVersionId: async (jobId: string): Promise<string | null> => {
        const { data } = await supabase
            .from('job_cost_analysis_params')
            .select('source_proposal_version_id')
            .eq('job_id', jobId)
            .maybeSingle();
        return data?.source_proposal_version_id || null;
    },

    // Sostituisce righe e parametri della commessa con quelli di una versione di analisi costi della proposta
    replaceFromProposalVersion: async (jobId: string, versionId: string): Promise<void> => {
        const [rows, params] = await Promise.all([
            proposalCostAnalysisApi.getByVersionId(versionId),
            proposalCostAnalysisApi.getParams(versionId),
        ]);
        const { error: delError } = await supabase.from('job_cost_analysis_rows').delete().eq('job_id', jobId);
        if (delError) throw delError;
        if (rows.length > 0) {
            const { error: insError } = await supabase.from('job_cost_analysis_rows').insert(rows.map(r => ({
                job_id: jobId,
                type: r.type,
                item_id: r.itemId || null,
                item_name: r.itemName,
                item_model: r.itemModel,
                item_unit: r.itemUnit,
                max_purchase_price: r.maxPurchasePrice,
                unit_price: r.unitPrice,
                qty_estimated: r.qtyEstimated,
                qty_actual: r.qtyActual,
                sort_order: r.sortOrder,
            })));
            if (insError) throw insError;
        }
        await costAnalysisApi.upsertParams(jobId, {
            sfrido: params.sfrido,
            sconto: params.sconto,
            trasporto: params.trasporto,
            posa: params.posa,
            ricarico: params.ricarico,
            margineTrattativa: params.margineTrattativa,
        }, versionId);
    },
};
