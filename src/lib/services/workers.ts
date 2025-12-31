import { supabase } from '@/lib/supabase';
import { Worker } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToWorker = (db: any): Worker => ({
    id: db.id,
    firstName: db.first_name,
    lastName: db.last_name,
    email: db.email,
    isActive: db.is_active,
    createdAt: db.created_at
});

const mapWorkerToDb = (worker: Partial<Worker>) => ({
    first_name: worker.firstName,
    last_name: worker.lastName,
    email: worker.email,
    is_active: worker.isActive
});

export const workersApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('workers')
                .select('*')
                .order('last_name', { ascending: true })
        );
        if (error) throw error;
        return (data || []).map(mapDbToWorker);
    },

    create: async (worker: Partial<Worker>) => {
        const { data, error } = await supabase
            .from('workers')
            .insert(mapWorkerToDb(worker))
            .select()
            .single();
        if (error) throw error;
        return mapDbToWorker(data);
    },

    update: async (id: string, worker: Partial<Worker>) => {
        const { data, error } = await supabase
            .from('workers')
            .update(mapWorkerToDb(worker))
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapDbToWorker(data);
    },

    toggleStatus: async (id: string, isActive: boolean) => {
        const { data, error } = await supabase
            .from('workers')
            .update({ is_active: isActive })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapDbToWorker(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase
            .from('workers')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
