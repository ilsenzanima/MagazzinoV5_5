import { supabase } from '@/lib/supabase';

export interface CostAnalysisVoceUnit {
    id: string;
    name: string;      // sul prezzo: «€/ora»
    qtyLabel: string;  // sulla quantità: «ore» (vuoto = stesso nome)
    sortOrder: number;
}

const map = (db: any): CostAnalysisVoceUnit => ({
    id: db.id,
    name: db.name,
    qtyLabel: db.qty_label ?? '',
    sortOrder: db.sort_order ?? 0,
});

export const costAnalysisVoceUnitsApi = {
    getAll: async (): Promise<CostAnalysisVoceUnit[]> => {
        const { data, error } = await supabase
            .from('cost_analysis_voce_units')
            .select('*')
            .order('sort_order')
            .order('name');
        if (error) throw error;
        return (data || []).map(map);
    },

    create: async (name: string, qtyLabel: string, sortOrder: number): Promise<CostAnalysisVoceUnit> => {
        const { data, error } = await supabase
            .from('cost_analysis_voce_units')
            .insert({ name, qty_label: qtyLabel, sort_order: sortOrder })
            .select()
            .single();
        if (error) throw error;
        return map(data);
    },

    // Se cambia il nome, le righe delle analisi che usavano il vecchio nome passano al nuovo
    update: async (id: string, oldName: string, name: string, qtyLabel: string): Promise<CostAnalysisVoceUnit> => {
        const { data, error } = await supabase
            .from('cost_analysis_voce_units')
            .update({ name, qty_label: qtyLabel })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        if (name !== oldName) {
            await supabase.from('proposal_cost_analysis_rows').update({ item_unit: name }).eq('item_unit', oldName).neq('type', 'inventory');
            await supabase.from('job_cost_analysis_rows').update({ item_unit: name }).eq('item_unit', oldName).neq('type', 'inventory');
        }
        return map(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('cost_analysis_voce_units').delete().eq('id', id);
        if (error) throw error;
    },
};
