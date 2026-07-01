import { supabase } from '@/lib/supabase';

export interface JobArticle {
    id: string;
    name: string;
    model?: string;
}

// Tutti gli articoli mai passati da questa commessa: assegnati direttamente
// all'acquisto/riga acquisto, oppure movimentati (uscite/rientri/fittizi)
// verso il cantiere. Usato per suggerire certificati di conformità collegati
// agli articoli nella tab "Suggeriti da articoli".
export const jobArticlesApi = {
    getItemsForJob: async (jobId: string): Promise<JobArticle[]> => {
        const [itemsFromPurchaseItems, itemsFromMovements, itemsFromDeliveryNotes] = await Promise.all([
            supabase.from('purchase_items').select('item_id').eq('job_id', jobId),
            supabase.from('movements').select('item_id').eq('job_id', jobId),
            supabase
                .from('delivery_note_items')
                .select('inventory_id, delivery_notes!inner(job_id)')
                .eq('delivery_notes.job_id', jobId),
        ]);
        if (itemsFromPurchaseItems.error) throw itemsFromPurchaseItems.error;
        if (itemsFromMovements.error) throw itemsFromMovements.error;
        if (itemsFromDeliveryNotes.error) throw itemsFromDeliveryNotes.error;

        const itemIds = new Set<string>();
        (itemsFromPurchaseItems.data || []).forEach((r: any) => { if (r.item_id) itemIds.add(r.item_id); });
        (itemsFromMovements.data || []).forEach((r: any) => { if (r.item_id) itemIds.add(r.item_id); });
        (itemsFromDeliveryNotes.data || []).forEach((r: any) => { if (r.inventory_id) itemIds.add(r.inventory_id); });

        if (itemIds.size === 0) return [];

        const { data, error } = await supabase
            .from('inventory')
            .select('id, name, model')
            .in('id', Array.from(itemIds))
            .is('deleted_at', null)
            .order('name');
        if (error) throw error;
        return (data || []).map((r: any) => ({ id: r.id, name: r.name, model: r.model || undefined }));
    },
};
