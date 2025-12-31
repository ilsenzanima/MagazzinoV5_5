import { supabase } from '@/lib/supabase';
import { Supplier } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToSupplier = (db: any): Supplier => ({
    id: db.id,
    name: db.name,
    vatNumber: db.vat_number,
    email: db.email,
    phone: db.phone,
    address: db.address,
    createdAt: db.created_at
});

export const mapSupplierToDb = (supplier: Partial<Supplier>) => ({
    name: supplier.name,
    vat_number: supplier.vatNumber,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address
});

export const suppliersApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('suppliers')
                .select('*')
                .order('name')
        );
        if (error) throw error;
        return data.map(mapDbToSupplier);
    },
    getPaginated: async ({ page = 1, limit = 10, search = '' }) => {
        let query = supabase.from('suppliers').select('*', { count: 'estimated' });

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query
            .order('name')
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        return {
            data: data.map(mapDbToSupplier),
            total: count || 0
        };
    },
    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('suppliers')
                .select('*')
                .eq('id', id)
                .single()
        );
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    create: async (supplier: Partial<Supplier>) => {
        const dbSupplier = mapSupplierToDb(supplier);
        const { data, error } = await supabase.from('suppliers').insert(dbSupplier).select().single();
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    update: async (id: string, supplier: Partial<Supplier>) => {
        const dbSupplier = mapSupplierToDb(supplier);
        const { data, error } = await supabase.from('suppliers').update(dbSupplier).eq('id', id).select().single();
        if (error) throw error;
        return mapDbToSupplier(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) throw error;
    }
};
