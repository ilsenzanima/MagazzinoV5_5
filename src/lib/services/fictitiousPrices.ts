import { supabase } from '@/lib/supabase';

export interface FictitiousItemPrice {
    id: string;
    jobId: string;
    itemId: string;
    price: number;
    updatedBy?: string;
    updatedAt: string;
    createdAt: string;
}

export const fictitiousPricesApi = {
    // Get prices for a specific job
    getByJob: async (jobId: string): Promise<Record<string, number>> => {
        const { data, error } = await supabase
            .from('fictitious_item_prices')
            .select('item_id, price')
            .eq('job_id', jobId);

        if (error) throw error;

        // Convert to map: itemId -> price
        const priceMap: Record<string, number> = {};
        data?.forEach(row => {
            priceMap[row.item_id] = row.price;
        });
        return priceMap;
    },

    // Set price for an item in a job (upsert)
    setPrice: async (jobId: string, itemId: string, price: number): Promise<void> => {
        const { error } = await supabase
            .from('fictitious_item_prices')
            .upsert({
                job_id: jobId,
                item_id: itemId,
                price: price,
                updated_by: (await supabase.auth.getUser()).data.user?.id
            }, {
                onConflict: 'job_id,item_id'
            });

        if (error) throw error;
    },

    // Delete price
    deletePrice: async (jobId: string, itemId: string): Promise<void> => {
        const { error } = await supabase
            .from('fictitious_item_prices')
            .delete()
            .eq('job_id', jobId)
            .eq('item_id', itemId);

        if (error) throw error;
    }
};
