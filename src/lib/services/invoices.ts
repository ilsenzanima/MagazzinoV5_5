import { supabase } from '@/lib/supabase';
import { Invoice } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';
import { compressImageIfNeeded } from '@/lib/image-compress';
import { supplierGroupsApi } from './supplier-groups';

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
        deliveryNoteDate: p.delivery_note_date,
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
            .is('deleted_at', null)
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
                .select('*, suppliers(name), purchases(id, delivery_note_number, delivery_note_date, transport_cost, purchase_items(id, price, quantity, transport_applied, transport_unit_cost, inventory(name, model)))')
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

    uploadDocument: async (file: File, supplierName?: string): Promise<string> => {
        const compressed = await compressImageIfNeeded(file);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('folderPath', JSON.stringify(['Fornitori', supplierName || 'Senza fornitore', 'Fatture']));
        const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Errore upload su Google Drive');
        return result.fileId as string;
    },

    getUnlinkedPurchasesBySupplier: async (supplierId: string) => {
        const scope = await supplierGroupsApi.getBillingScope(supplierId);
        return invoicesApi.getUnlinkedPurchasesBySupplierIds(scope);
    },

    getUnlinkedPurchasesBySupplierIds: async (supplierIds: string[]) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('id, delivery_note_number, delivery_note_date, supplier_id, suppliers(name), purchase_items(price, quantity)')
                .in('supplier_id', supplierIds)
                .eq('order_type', 'purchase')
                .is('invoice_id', null)
                .is('deleted_at', null)
                .order('delivery_note_date', { ascending: false })
        );
        if (error) throw error;
        return data.map((p: any) => ({
            id: p.id,
            deliveryNoteNumber: p.delivery_note_number,
            deliveryNoteDate: p.delivery_note_date,
            supplierId: p.supplier_id,
            supplierName: p.suppliers?.name,
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
        // Blocca se ci sono bolle collegate — devono essere scollegate prima
        const { count } = await supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true })
            .eq('invoice_id', id)
            .is('deleted_at', null);
        if (count && count > 0) {
            throw new Error(`Impossibile eliminare la fattura: ${count} ${count === 1 ? 'bolla collegata' : 'bolle collegate'}. Scollegarle prima dalla fattura.`);
        }
        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('invoices').update(payload).eq('id', id);
        if (error) throw error;
    },

    restore: async (id: string) => {
        const { error } = await supabase
            .from('invoices')
            .update({ deleted_at: null, deleted_by: null, deleted_by_name: null })
            .eq('id', id);
        if (error) throw error;
    },

    getDeleted: async () => {
        const { data, error } = await supabase
            .from('invoices')
            .select('*, suppliers(name)')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...mapDbToInvoice(d),
            deletedAt: d.deleted_at as string,
            deletedByName: d.deleted_by_name as string | null,
        }));
    },
};
