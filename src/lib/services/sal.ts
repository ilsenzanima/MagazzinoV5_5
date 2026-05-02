import { supabase } from '@/lib/supabase';

export interface SalItem {
    id: string;
    jobId: string;
    salName: string;
    itemType: 'movement' | 'purchase' | 'worker_hours';
    itemId?: string;
    workerHoursData?: WorkerHoursSalData;
    dateFrom?: string;
    dateTo?: string;
    createdAt: string;
}

export interface WorkerHoursSalData {
    dateFrom: string;
    dateTo: string;
    workers: {
        workerId: string;
        workerName: string;
        days: {
            date: string;
            normalHours: number;
            transferHours: number;
        }[];
        totalNormal: number;
        totalTransfer: number;
        hourlyRate: number;
        trasfertaRate: number;
        totalCost: number;
    }[];
    grandTotal: number;
}

const mapDb = (db: any): SalItem => ({
    id: db.id,
    jobId: db.job_id,
    salName: db.sal_name,
    itemType: db.item_type,
    itemId: db.item_id,
    workerHoursData: db.worker_hours_data,
    dateFrom: db.date_from,
    dateTo: db.date_to,
    createdAt: db.created_at,
});

export const salApi = {
    getByJobId: async (jobId: string): Promise<SalItem[]> => {
        const { data, error } = await supabase
            .from('job_sal_items')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapDb);
    },

    getSalNames: async (jobId: string): Promise<string[]> => {
        const { data, error } = await supabase
            .from('job_sal_items')
            .select('sal_name')
            .eq('job_id', jobId);
        if (error) throw error;
        const names = [...new Set((data || []).map((r: any) => r.sal_name as string))];
        return names.sort();
    },

    tagItem: async (jobId: string, salName: string, itemType: 'movement' | 'purchase', itemId: string): Promise<SalItem> => {
        const { data, error } = await supabase
            .from('job_sal_items')
            .upsert({
                job_id: jobId,
                sal_name: salName,
                item_type: itemType,
                item_id: itemId,
            }, { onConflict: 'job_id,sal_name,item_type,item_id' })
            .select()
            .single();
        if (error) throw error;
        return mapDb(data);
    },

    tagItems: async (jobId: string, salName: string, items: { itemType: 'movement' | 'purchase'; itemId: string }[]): Promise<void> => {
        const rows = items.map(item => ({
            job_id: jobId,
            sal_name: salName,
            item_type: item.itemType,
            item_id: item.itemId,
        }));
        const { error } = await supabase
            .from('job_sal_items')
            .upsert(rows, { onConflict: 'job_id,sal_name,item_type,item_id' });
        if (error) throw error;
    },

    addWorkerHours: async (jobId: string, salName: string, data: WorkerHoursSalData): Promise<SalItem> => {
        const { data: result, error } = await supabase
            .from('job_sal_items')
            .insert({
                job_id: jobId,
                sal_name: salName,
                item_type: 'worker_hours',
                worker_hours_data: data,
                date_from: data.dateFrom,
                date_to: data.dateTo,
            })
            .select()
            .single();
        if (error) throw error;
        return mapDb(result);
    },

    deleteItem: async (id: string): Promise<void> => {
        const { error } = await supabase.from('job_sal_items').delete().eq('id', id);
        if (error) throw error;
    },

    deleteItemsByJobSalAndRef: async (jobId: string, salName: string, itemType: 'movement' | 'purchase', itemId: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_items')
            .delete()
            .eq('job_id', jobId)
            .eq('sal_name', salName)
            .eq('item_type', itemType)
            .eq('item_id', itemId);
        if (error) throw error;
    },
};
