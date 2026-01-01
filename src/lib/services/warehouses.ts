import { createClient } from '@/lib/supabase/client';
import type { Warehouse } from '@/lib/types';

const supabase = createClient();

export const warehousesApi = {
    /**
     * Get all warehouses
     */
    async getAll(): Promise<Warehouse[]> {
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .order('is_primary', { ascending: false })
            .order('name');

        if (error) throw error;

        return (data || []).map(w => ({
            id: w.id,
            name: w.name,
            address: w.address,
            isPrimary: w.is_primary,
            createdAt: w.created_at,
            updatedAt: w.updated_at
        }));
    },

    /**
     * Get primary warehouse
     */
    async getPrimary(): Promise<Warehouse | null> {
        const { data, error } = await supabase
            .from('warehouses')
            .select('*')
            .eq('is_primary', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No rows
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            address: data.address,
            isPrimary: data.is_primary,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    /**
     * Create a new warehouse
     */
    async create(warehouse: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>): Promise<Warehouse> {
        const { data, error } = await supabase
            .from('warehouses')
            .insert({
                name: warehouse.name,
                address: warehouse.address,
                is_primary: warehouse.isPrimary
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            address: data.address,
            isPrimary: data.is_primary,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    /**
     * Update a warehouse
     */
    async update(id: string, warehouse: Partial<Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Warehouse> {
        const updateData: any = {};
        if (warehouse.name !== undefined) updateData.name = warehouse.name;
        if (warehouse.address !== undefined) updateData.address = warehouse.address;
        if (warehouse.isPrimary !== undefined) updateData.is_primary = warehouse.isPrimary;

        const { data, error } = await supabase
            .from('warehouses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            address: data.address,
            isPrimary: data.is_primary,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    /**
     * Delete a warehouse
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('warehouses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
