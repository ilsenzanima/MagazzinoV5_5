import { supabase } from '@/lib/supabase';
import { Purchase, PurchaseItem } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToPurchase = (db: any): Purchase => ({
    id: db.id,
    supplierId: db.supplier_id,
    supplierName: db.suppliers?.name,
    deliveryNoteNumber: db.delivery_note_number,
    deliveryNoteDate: db.delivery_note_date,
    status: db.status,
    notes: db.notes,
    createdBy: db.created_by,
    createdByName: db.profiles?.full_name,
    createdAt: db.created_at,
    items: db.purchase_items,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    documentUrl: db.document_url,
    totalAmount: db.purchase_items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0)
});

export const mapPurchaseToDb = (purchase: Partial<Purchase>) => ({
    supplier_id: purchase.supplierId,
    delivery_note_number: purchase.deliveryNoteNumber,
    delivery_note_date: purchase.deliveryNoteDate,
    status: purchase.status,
    notes: purchase.notes,
    created_by: purchase.createdBy,
    job_id: purchase.jobId || null,
    document_url: purchase.documentUrl
});

export const purchasesApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('*, suppliers(name), purchase_items(price, quantity)')
                .order('created_at', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToPurchase);
    },
    getPaginated: async ({ page = 1, limit = 10, search = '', supplierId = '' }) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('purchases')
            .select('*, suppliers(name), purchase_items(price, quantity)', { count: 'estimated' });

        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }

        if (search) {
            // 1. Find matching suppliers to include them in the OR search
            const { data: suppliers } = await supabase
                .from('suppliers')
                .select('id')
                .ilike('name', `%${search}%`);

            const supplierIds = suppliers?.map(s => s.id) || [];

            // 2. Build OR filter
            let orConditions = [
                `delivery_note_number.ilike.%${search}%`,
                `notes.ilike.%${search}%`
            ];

            if (supplierIds.length > 0) {
                orConditions.push(`supplier_id.in.(${supplierIds.join(',')})`);
            }

            query = query.or(orConditions.join(','));
        }

        query = query
            .order('created_at', { ascending: false })
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        return {
            data: data.map(mapDbToPurchase),
            total: count || 0
        };
    },
    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('*, suppliers(name)')
                .eq('id', id)
                .single()
        );
        if (error) throw error;
        return mapDbToPurchase(data);
    },
    create: async (purchase: Partial<Purchase>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const dbPurchase = mapPurchaseToDb({ ...purchase, createdBy: user.id });

        const { data, error } = await supabase.from('purchases').insert(dbPurchase).select('*, suppliers(name)').single();
        if (error) throw error;
        return mapDbToPurchase(data);
    },

    uploadDocument: async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return publicUrl;
    },

    update: async (id: string, purchase: Partial<Purchase>) => {
        const dbPurchase = mapPurchaseToDb(purchase);

        const { data, error } = await supabase.from('purchases').update(dbPurchase).eq('id', id).select('*, suppliers(name)').single();
        if (error) throw error;
        return mapDbToPurchase(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('purchases').delete().eq('id', id);
        if (error) throw error;
    },
    // Get batch availability for a specific purchase (all items)
    getPurchaseBatchAvailability: async (purchaseId: string) => {
        // First get the purchase items to get their IDs
        const { data: items } = await supabase.from('purchase_items').select('id').eq('purchase_id', purchaseId);

        if (!items || items.length === 0) return [];

        const ids = items.map(i => i.id);

        const { data, error } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .in('purchase_item_id', ids);

        if (error) throw error;
        return data.map((b: any) => ({
            id: b.purchase_item_id,
            purchaseRef: b.purchase_ref,
            date: b.purchase_date,
            originalQty: b.original_quantity,
            remainingQty: b.remaining_quantity,
            originalPieces: b.original_pieces,
            remainingPieces: b.remaining_pieces,
            price: b.unit_price,
            coefficient: b.coefficient
        }));
    },

    // Items management
    getItems: async (purchaseId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchase_items')
                .select('*, inventory(name, code, model), jobs(code)')
                .eq('purchase_id', purchaseId)
        );

        if (error) throw error;
        return data.map((item: any) => ({
            id: item.id,
            purchaseId: item.purchase_id,
            itemId: item.item_id,
            itemName: item.inventory?.name,
            itemModel: item.inventory?.model,
            itemCode: item.inventory?.code,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            price: item.price,
            jobId: item.job_id,
            jobCode: item.jobs?.code,
            createdAt: item.created_at
        }));
    },
    addItem: async (item: Partial<PurchaseItem>) => {
        const dbItem = {
            purchase_id: item.purchaseId,
            item_id: item.itemId,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            price: item.price,
            job_id: item.jobId
        };
        const { data, error } = await supabase.from('purchase_items').insert(dbItem).select().single();
        if (error) throw error;
        return data;
    },
    updateItem: async (id: string, item: Partial<PurchaseItem>) => {
        const dbItem: any = {};
        if (item.quantity !== undefined) dbItem.quantity = item.quantity;
        if (item.pieces !== undefined) dbItem.pieces = item.pieces;
        if (item.price !== undefined) dbItem.price = item.price;
        if (item.jobId !== undefined) dbItem.job_id = item.jobId;

        const { data, error } = await supabase.from('purchase_items').update(dbItem).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    deleteItem: async (id: string) => {
        const { error } = await supabase.from('purchase_items').delete().eq('id', id);
        if (error) throw error;
    }
};
