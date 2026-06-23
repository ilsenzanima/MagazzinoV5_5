import { supabase } from '@/lib/supabase';
import { SupplierGroup } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';

const mapDbToSupplierGroup = (db: any): SupplierGroup => ({
    id: db.id,
    name: db.name,
    billingSupplierId: db.billing_supplier_id,
    memberSupplierIds: (db.supplier_group_members ?? []).map((m: any) => m.supplier_id),
    visibleInPurchases: db.visible_in_purchases ?? false,
    showMembersInInvoices: db.show_members_in_invoices ?? true,
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
                .select('billing_supplier_id, show_members_in_invoices, supplier_group_members(supplier_id)')
                .eq('billing_supplier_id', supplierId)
                .is('deleted_at', null)
                .maybeSingle()
        );
        if (error) throw error;
        if (!data || !data.show_members_in_invoices) return [supplierId];
        return [data.billing_supplier_id, ...data.supplier_group_members.map((m: any) => m.supplier_id)];
    },

    /**
     * Billing supplier ids that should be hidden from the supplier dropdown
     * in orders/purchases forms (visible_in_purchases = false).
     */
    getHiddenFromPurchasesIds: async (): Promise<string[]> => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('supplier_groups')
                .select('billing_supplier_id')
                .eq('visible_in_purchases', false)
                .is('deleted_at', null)
        );
        if (error) throw error;
        return data.map((g: any) => g.billing_supplier_id);
    },

    /**
     * Member supplier ids that should be hidden from the supplier dropdown
     * when registering/editing invoices: once a supplier belongs to a
     * group, invoicing must go through the group's billing supplier.
     */
    getHiddenFromInvoicesIds: async (): Promise<string[]> => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('supplier_groups')
                .select('supplier_group_members(supplier_id)')
                .is('deleted_at', null)
        );
        if (error) throw error;
        return data.flatMap((g: any) => g.supplier_group_members.map((m: any) => m.supplier_id));
    },

    create: async (
        name: string,
        billingSupplierId: string,
        memberSupplierIds: string[],
        options: { visibleInPurchases: boolean; showMembersInInvoices: boolean }
    ): Promise<SupplierGroup> => {
        const { data: group, error } = await supabase
            .from('supplier_groups')
            .insert({
                name,
                billing_supplier_id: billingSupplierId,
                visible_in_purchases: options.visibleInPurchases,
                show_members_in_invoices: options.showMembersInInvoices,
            })
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
            visibleInPurchases: group.visible_in_purchases,
            showMembersInInvoices: group.show_members_in_invoices,
            createdAt: group.created_at,
        };
    },

    update: async (
        id: string,
        name: string,
        memberSupplierIds: string[],
        options: { visibleInPurchases: boolean; showMembersInInvoices: boolean }
    ): Promise<void> => {
        const { error } = await supabase
            .from('supplier_groups')
            .update({
                name,
                visible_in_purchases: options.visibleInPurchases,
                show_members_in_invoices: options.showMembersInInvoices,
            })
            .eq('id', id);
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
