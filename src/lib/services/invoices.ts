import { supabase } from '@/lib/supabase';
import { Invoice } from '@/lib/types';
import { fetchWithTimeout } from './utils';

const mapDbToInvoice = (db: any): Invoice => ({
    id: db.id,
    supplierId: db.supplier_id,
    supplierName: db.suppliers?.name,
    invoiceNumber: db.invoice_number,
    invoiceDate: db.invoice_date,
    documentUrls: db.document_urls ?? [],
    totalAmount: db.total_amount,
    notes: db.notes,
    createdBy: db.created_by,
    createdAt: db.created_at,
    purchases: db.purchases?.map((p: any) => ({
        id: p.id,
        deliveryNoteNumber: p.delivery_note_number,
        transportCost: p.transport_cost ?? 0,
        totalAmount: p.purchase_items?.reduce(
            (s: number, i: any) => s + (i.price || 0) * (i.quantity || 1),
            0
        ),
        items: p.purchase_items?.map((i: any) => ({
            id: i.id,
            itemName: i.inventory?.name,
            itemModel: i.inventory?.model,
            quantity: i.quantity,
            price: i.price,
            transportApplied: i.transport_applied ?? false,
            transportUnitCost: i.transport_unit_cost ?? 0,
        })),
    })),
});

export const invoicesApi = {
    getPaginated: async ({
        page = 1,
        limit = 12,
        search = '',
        supplierId = '',
        dateFrom = '',
        dateTo = '',
    }) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('invoices')
            .select(
                '*, suppliers(name), purchases(id, delivery_note_number, purchase_items(price, quantity))',
                { count: 'estimated' }
            )
            .order('invoice_date', { ascending: false })
            .range(from, to);

        if (supplierId) query = query.eq('supplier_id', supplierId);
        if (dateFrom) query = query.gte('invoice_date', dateFrom);
        if (dateTo) query = query.lte('invoice_date', dateTo);
        if (search) query = query.ilike('invoice_number', `%${search}%`);

        const { data, error, count } = await fetchWithTimeout(query);
        if (error) throw error;
        return { data: data.map(mapDbToInvoice), total: count ?? 0 };
    },

    getById: async (id: string): Promise<Invoice> => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('invoices')
                .select('*, suppliers(name), purchases(id, delivery_note_number, transport_cost, purchase_items(id, price, quantity, transport_applied, transport_unit_cost, inventory(name, model)))')
                .eq('id', id)
                .single()
        );
        if (error) throw error;
        return mapDbToInvoice(data);
    },

    create: async (invoice: {
        supplierId: string;
        invoiceNumber: string;
        invoiceDate: string;
        notes?: string;
        documentUrls?: string[];
    }): Promise<Invoice> => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('invoices')
            .insert({
                supplier_id: invoice.supplierId,
                invoice_number: invoice.invoiceNumber,
                invoice_date: invoice.invoiceDate,
                notes: invoice.notes || null,
                document_urls: invoice.documentUrls ?? [],
                created_by: user?.id,
            })
            .select('*, suppliers(name)')
            .single();
        if (error) throw error;
        return mapDbToInvoice(data);
    },

    linkPurchase: async (invoiceId: string, purchaseId: string) => {
        const { error } = await supabase
            .from('purchases')
            .update({ invoice_id: invoiceId })
            .eq('id', purchaseId);
        if (error) throw error;
    },

    unlinkPurchase: async (purchaseId: string) => {
        const { error } = await supabase
            .from('purchases')
            .update({ invoice_id: null })
            .eq('id', purchaseId);
        if (error) throw error;
    },

    updateTotal: async (invoiceId: string, totalAmount: number) => {
        const { error } = await supabase
            .from('invoices')
            .update({ total_amount: totalAmount })
            .eq('id', invoiceId);
        if (error) throw error;
    },

    uploadDocument: async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop();
        const path = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('documents').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('documents').getPublicUrl(path);
        return data.publicUrl;
    },

    getUnlinkedPurchasesBySupplier: async (supplierId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('id, delivery_note_number, delivery_note_date, purchase_items(price, quantity)')
                .eq('supplier_id', supplierId)
                .eq('order_type', 'purchase')
                .is('invoice_id', null)
                .order('delivery_note_date', { ascending: false })
        );
        if (error) throw error;
        return data.map((p: any) => ({
            id: p.id,
            deliveryNoteNumber: p.delivery_note_number,
            deliveryNoteDate: p.delivery_note_date,
            totalAmount: p.purchase_items?.reduce(
                (s: number, i: any) => s + (i.price || 0) * (i.quantity || 1),
                0
            ) ?? 0,
        }));
    },

    update: async (id: string, data: { invoiceNumber?: string; invoiceDate?: string; notes?: string; supplierId?: string }) => {
        const updates: any = {};
        if (data.invoiceNumber !== undefined) updates.invoice_number = data.invoiceNumber;
        if (data.invoiceDate !== undefined) updates.invoice_date = data.invoiceDate;
        if (data.notes !== undefined) updates.notes = data.notes;
        if (data.supplierId !== undefined) updates.supplier_id = data.supplierId;
        const { error } = await supabase.from('invoices').update(updates).eq('id', id);
        if (error) throw error;
    },

    delete: async (id: string) => {
        // Unlink all purchases first
        await supabase.from('purchases').update({ invoice_id: null }).eq('invoice_id', id);
        const { error } = await supabase.from('invoices').delete().eq('id', id);
        if (error) throw error;
    },
};
