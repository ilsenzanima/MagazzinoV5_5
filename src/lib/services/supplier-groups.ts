import { supabase } from '@/lib/supabase';
import { SupplierGroup } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';

const mapDbToSupplierGroup = (db: any): SupplierGroup => ({
    id: db.id,
    name: db.name,
    billingSupplierId: db.billing_supplier_id,
    memberSupplierIds: (db.supplier_group_members ?? []).map((m: any) => m.supplier_id),
    createdAt: db.created_at,
});

export const supplierGroupsApi = {
    getAll: async (): Promise<SupplierGroup[]> => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('supplier_groups')
                .select('*, supplier_group_members(supplier_id)')
                .is('deleted_at', null)
                .order('name')
        );
        if (error) throw error;
        return data.map(mapDbToSupplierGroup);
    },

    /**
     * Returns the full set of real supplier ids whose purchases should be
     * shown when `supplierId` is selected on an invoice: the billing
     * supplier itself plus all the suppliers it bills on behalf of.
     */
    getBillingScope: async (supplierId: string): Promise<string[]> => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('supplier_groups')
                .select('billing_supplier_id, supplier_group_members(supplier_id)')
                .eq('billing_supplier_id', supplierId)
                .is('deleted_at', null)
                .maybeSingle()
        );
        if (error) throw error;
        if (!data) return [supplierId];
        return [data.billing_supplier_id, ...data.supplier_group_members.map((m: any) => m.supplier_id)];
    },

    create: async (name: string, billingSupplierId: string, memberSupplierIds: string[]): Promise<SupplierGroup> => {
        const { data: group, error } = await supabase
            .from('supplier_groups')
            .insert({ name, billing_supplier_id: billingSupplierId })
            .select()
            .single();
        if (error) throw error;

        if (memberSupplierIds.length > 0) {
            const { error: membersError } = await supabase
                .from('supplier_group_members')
                .insert(memberSupplierIds.map(supplierId => ({ group_id: group.id, supplier_id: supplierId })));
            if (membersError) throw membersError;
        }

        return {
            id: group.id,
            name: group.name,
            billingSupplierId: group.billing_supplier_id,
            memberSupplierIds,
            createdAt: group.created_at,
        };
    },

    update: async (id: string, name: string, memberSupplierIds: string[]): Promise<void> => {
        const { error } = await supabase.from('supplier_groups').update({ name }).eq('id', id);
        if (error) throw error;

        const { error: deleteError } = await supabase.from('supplier_group_members').delete().eq('group_id', id);
        if (deleteError) throw deleteError;

        if (memberSupplierIds.length > 0) {
            const { error: insertError } = await supabase
                .from('supplier_group_members')
                .insert(memberSupplierIds.map(supplierId => ({ group_id: id, supplier_id: supplierId })));
            if (insertError) throw insertError;
        }
    },

    delete: async (id: string): Promise<void> => {
        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('supplier_groups').update(payload).eq('id', id);
        if (error) throw error;
    },
};
