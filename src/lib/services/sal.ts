import { supabase } from '@/lib/supabase';
import { compressImageIfNeeded } from '@/lib/image-compress';
import { deleteDriveFileIfApplicable } from './utils';

export interface SalCost {
    id: string;
    jobId: string;
    salName: string | null;
    description: string;
    amount: number;
    documentUrls: string[];
    createdAt: string;
}

export interface SalItem {
    id: string;
    jobId: string;
    salName: string | null;
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
        // Delete existing entry first to avoid unique conflict, then insert
        const { error: delError } = await supabase.from('job_sal_items')
            .delete()
            .eq('job_id', jobId)
            .eq('sal_name', salName)
            .eq('item_type', itemType)
            .eq('item_id', itemId);
        if (delError) throw delError;

        const { data, error } = await supabase
            .from('job_sal_items')
            .insert({ job_id: jobId, sal_name: salName, item_type: itemType, item_id: itemId })
            .select()
            .single();
        if (error) throw error;
        return mapDb(data);
    },

    tagItems: async (jobId: string, salName: string, items: { itemType: 'movement' | 'purchase'; itemId: string }[]): Promise<void> => {
        if (items.length === 0) return;

        // Delete existing entries for these items+SAL, then re-insert
        for (const item of items) {
            const { error: delError } = await supabase.from('job_sal_items')
                .delete()
                .eq('job_id', jobId)
                .eq('sal_name', salName)
                .eq('item_type', item.itemType)
                .eq('item_id', item.itemId);
            if (delError) throw delError;
        }

        const rows = items.map(item => ({
            job_id: jobId,
            sal_name: salName,
            item_type: item.itemType,
            item_id: item.itemId,
        }));
        const { error } = await supabase.from('job_sal_items').insert(rows);
        if (error) throw error;
    },

    addWorkerHours: async (jobId: string, salName: string | null, data: WorkerHoursSalData): Promise<SalItem> => {
        const { data: result, error } = await supabase
            .from('job_sal_items')
            .insert({
                job_id: jobId,
                sal_name: salName || null,
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

    updateItemSalName: async (id: string, salName: string | null): Promise<void> => {
        const { error } = await supabase.from('job_sal_items').update({ sal_name: salName || null }).eq('id', id);
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

    renameSal: async (jobId: string, oldName: string, newName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_items')
            .update({ sal_name: newName })
            .eq('job_id', jobId)
            .eq('sal_name', oldName);
        if (error) throw error;
    },

    deleteSal: async (jobId: string, salName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_items')
            .delete()
            .eq('job_id', jobId)
            .eq('sal_name', salName);
        if (error) throw error;
    },
};

// ── SAL Names (standalone, no items required) ────────────────────────────────
export const salNamesApi = {
    getByJobId: async (jobId: string): Promise<string[]> => {
        const { data, error } = await supabase
            .from('job_sal_names')
            .select('sal_name')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map((r: any) => r.sal_name as string);
    },

    create: async (jobId: string, salName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_names')
            .insert({ job_id: jobId, sal_name: salName });
        // ignore unique violation (already exists)
        if (error && error.code !== '23505') throw error;
    },

    rename: async (jobId: string, oldName: string, newName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_names')
            .update({ sal_name: newName })
            .eq('job_id', jobId)
            .eq('sal_name', oldName);
        if (error) throw error;
    },

    delete: async (jobId: string, salName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_names')
            .delete()
            .eq('job_id', jobId)
            .eq('sal_name', salName);
        if (error) throw error;
    },
};

const mapCostDb = (db: any): SalCost => ({
    id: db.id,
    jobId: db.job_id,
    salName: db.sal_name,
    description: db.description,
    amount: Number(db.amount),
    documentUrls: db.document_urls || [],
    createdAt: db.created_at,
});

export const salCostsApi = {
    getByJobId: async (jobId: string): Promise<SalCost[]> => {
        const { data, error } = await supabase
            .from('job_sal_costs')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapCostDb);
    },

    add: async (jobId: string, description: string, amount: number, salName?: string | null): Promise<SalCost> => {
        const { data, error } = await supabase
            .from('job_sal_costs')
            .insert({ job_id: jobId, description, amount, sal_name: salName || null })
            .select()
            .single();
        if (error) throw error;
        return mapCostDb(data);
    },

    updateSal: async (id: string, salName: string | null): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_costs')
            .update({ sal_name: salName })
            .eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string): Promise<void> => {
        const { data: existing } = await supabase.from('job_sal_costs').select('document_urls').eq('id', id).maybeSingle();
        const { error } = await supabase.from('job_sal_costs').delete().eq('id', id);
        if (error) throw error;
        await Promise.all((existing?.document_urls || []).map(deleteDriveFileIfApplicable));
    },

    renameSalInCosts: async (jobId: string, oldName: string, newName: string): Promise<void> => {
        const { error } = await supabase
            .from('job_sal_costs')
            .update({ sal_name: newName })
            .eq('job_id', jobId)
            .eq('sal_name', oldName);
        if (error) throw error;
    },

    updateDocumentUrls: async (id: string, documentUrls: string[]): Promise<void> => {
        const { data: existing } = await supabase.from('job_sal_costs').select('document_urls').eq('id', id).maybeSingle();
        const { error } = await supabase
            .from('job_sal_costs')
            .update({ document_urls: documentUrls })
            .eq('id', id);
        if (error) throw error;
        const removed = (existing?.document_urls || []).filter((u: string) => !documentUrls.includes(u));
        await Promise.all(removed.map(deleteDriveFileIfApplicable));
    },

    uploadDocument: async (file: File, jobLabel?: string): Promise<string> => {
        const compressed = await compressImageIfNeeded(file);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folderPath', JSON.stringify(['Cantieri', jobLabel || 'Senza nome', 'Costi SAL']));
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Errore upload su Google Drive');
        return result.fileId as string;
    },
};
