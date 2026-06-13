import { supabase } from '@/lib/supabase';
import { Purchase, PurchaseItem } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';

export const mapDbToPurchase = (db: any): Purchase => ({
    id: db.id,
    supplierId: db.supplier_id,
    supplierName: db.suppliers?.name,
    deliveryNoteNumber: db.delivery_note_number,
    deliveryNoteDate: db.delivery_note_date,
    notes: db.notes,
    createdBy: db.created_by,
    createdByName: db.profiles?.full_name,
    createdAt: db.created_at,
    items: db.purchase_items?.map((item: any) => ({
        price: item.price,
        quantity: item.quantity,
        itemName: item.inventory?.name,
        itemModel: item.inventory?.model,
    })),
    orderType: db.order_type ?? 'purchase',
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    documentUrl: db.document_url,
    documentUrls: (db.document_urls && db.document_urls.length > 0)
        ? db.document_urls
        : (db.document_url ? [db.document_url] : []),
    totalAmount: db.purchase_items?.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0),
    invoiceId: db.invoice_id ?? null,
    invoiceNumber: db.invoices?.invoice_number ?? null,
    convertedPurchaseId: db.converted_purchase_id ?? null,
    convertedPurchaseNumber: db.converted_purchase?.delivery_note_number ?? null,
    transportCost: db.transport_cost ?? 0,
});


export const mapPurchaseToDb = (purchase: Partial<Purchase>) => {
    const dbPurchase: any = {};

    // Only include fields that are explicitly passed (not undefined)
    if (purchase.supplierId !== undefined) dbPurchase.supplier_id = purchase.supplierId;
    if (purchase.deliveryNoteNumber !== undefined) dbPurchase.delivery_note_number = purchase.deliveryNoteNumber;
    if (purchase.deliveryNoteDate !== undefined) dbPurchase.delivery_note_date = purchase.deliveryNoteDate;
    if (purchase.notes !== undefined) dbPurchase.notes = purchase.notes;
    if (purchase.createdBy !== undefined) dbPurchase.created_by = purchase.createdBy;
    if (purchase.documentUrl !== undefined) dbPurchase.document_url = purchase.documentUrl;
    if (purchase.documentUrls !== undefined) {
        dbPurchase.document_urls = purchase.documentUrls;
        dbPurchase.document_url = purchase.documentUrls[0] ?? null;
    }

    // CRITICAL: Only update job_id when explicitly passed (even if null/empty to clear it)
    // This prevents accidental clearing of job_id when editing other fields
    if ('jobId' in purchase) {
        dbPurchase.job_id = purchase.jobId || null;
    }

    if (purchase.transportCost !== undefined) dbPurchase.transport_cost = purchase.transportCost;

    return dbPurchase;
};

export const purchasesApi = {
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('*, suppliers(name), purchase_items(price, quantity, inventory(name, model))')
                .is('deleted_at', null)
                .order('delivery_note_date', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToPurchase);
    },
    getPaginated: async ({ page = 1, limit = 10, search = '', supplierId = '', dateFrom = '', dateTo = '', orderType = 'purchase' as 'purchase' | 'order' }) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('purchases')
            .select('*, suppliers(name), purchase_items(price, quantity, inventory(name, model)), invoices(invoice_number), converted_purchase:converted_purchase_id(delivery_note_number)', { count: 'estimated' })
            .eq('order_type', orderType)
            .is('deleted_at', null);

        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }

        if (dateFrom) {
            query = query.gte('delivery_note_date', dateFrom);
        }

        if (dateTo) {
            query = query.lte('delivery_note_date', dateTo);
        }

        if (search) {
            // Split search into words for fuzzy matching
            const words = search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);

            // Find matching suppliers
            let supplierIds: string[] = [];
            for (const word of words) {
                const { data: suppliers } = await supabase
                    .from('suppliers')
                    .select('id')
                    .ilike('name', `%${word}%`);
                if (suppliers) {
                    supplierIds = [...new Set([...supplierIds, ...suppliers.map(s => s.id)])];
                }
            }

            // For each word, apply OR conditions (chained = AND between words)
            for (const word of words) {
                let orConditions = [
                    `delivery_note_number.ilike.%${word}%`,
                    `notes.ilike.%${word}%`
                ];
                if (supplierIds.length > 0) {
                    orConditions.push(`supplier_id.in.(${supplierIds.join(',')})`);
                }
                query = query.or(orConditions.join(','));
            }
        }

        query = query
            .order('delivery_note_date', { ascending: false })
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        // Get exhausted purchase IDs (all items used)
        const { data: exhaustedData } = await supabase.rpc('get_exhausted_purchase_ids');
        const exhaustedSet = new Set((exhaustedData || []).map((e: any) => e.purchase_id));

        return {
            data: data.map((d: any) => ({
                ...mapDbToPurchase(d),
                isExhausted: exhaustedSet.has(d.id)
            })),
            total: count || 0
        };
    },
    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('*, suppliers(name), purchase_items(price, quantity), profiles(full_name)')
                .eq('job_id', jobId)
                .is('deleted_at', null)
                .order('delivery_note_date', { ascending: false })
        );
        if (error) throw error;
        return (data || []).map(mapDbToPurchase);
    },

    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchases')
                .select('*, suppliers(name), profiles(full_name), invoices(invoice_number), converted_purchase:converted_purchase_id(id, delivery_note_number)')
                .eq('id', id)
                .single()
        );
        if (error) throw error;
        return mapDbToPurchase(data);
    },
    create: async (purchase: Partial<Purchase>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        const dbPurchase = {
            ...mapPurchaseToDb({ ...purchase, createdBy: user.id }),
            order_type: purchase.orderType ?? 'purchase',
        };

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

        const { data, error } = await supabase.from('purchases').update(dbPurchase).eq('id', id).select('*, suppliers(name), profiles(full_name)').single();
        if (error) throw error;
        return mapDbToPurchase(data);
    },
    delete: async (id: string) => {
        // Blocca se l'acquisto è collegato a una fattura
        const { data: purchaseData } = await supabase
            .from('purchases')
            .select('invoice_id, invoices(invoice_number)')
            .eq('id', id)
            .single();
        if (purchaseData?.invoice_id) {
            const invoiceNum = (purchaseData as any).invoices?.invoice_number || purchaseData.invoice_id;
            throw new Error(`Impossibile eliminare l'acquisto: è collegato alla fattura ${invoiceNum}. Scollegarlo prima dalla fattura.`);
        }

        // Blocca se ci sono articoli già movimentati in bolle
        const { data: items } = await supabase.from('purchase_items').select('id').eq('purchase_id', id);
        const itemIds = (items || []).map((i: any) => i.id);
        if (itemIds.length > 0) {
            const { count } = await supabase
                .from('delivery_note_items')
                .select('id', { count: 'estimated', head: true })
                .in('purchase_item_id', itemIds);
            if (count && count > 0) {
                throw new Error("Impossibile eliminare l'acquisto: alcuni articoli sono già stati movimentati in bolle di uscita/vendita. Eliminare prima le bolle collegate.");
            }
        }

        // Se ci sono ordini sorgente che puntano a questo acquisto, pulisce il link
        // (gli ordini tornano allo stato "non convertito" e possono essere riconvertiti)
        const { data: sourceOrders } = await supabase
            .from('purchases')
            .select('id')
            .eq('converted_purchase_id', id)
            .eq('order_type', 'order');
        if (sourceOrders && sourceOrders.length > 0) {
            const orderIds = sourceOrders.map((o: any) => o.id);
            await supabase.from('purchases').update({ converted_purchase_id: null }).in('id', orderIds);
        }

        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('purchases').update(payload).eq('id', id);
        if (error) throw error;
    },

    restore: async (id: string) => {
        const { error } = await supabase
            .from('purchases')
            .update({ deleted_at: null, deleted_by: null, deleted_by_name: null })
            .eq('id', id);
        if (error) throw error;
    },

    getDeleted: async () => {
        const { data, error } = await supabase
            .from('purchases')
            .select('*, suppliers(name), purchase_items(price, quantity, inventory(name, model))')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...mapDbToPurchase(d),
            deletedAt: d.deleted_at as string,
            deletedByName: d.deleted_by_name as string | null,
        }));
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
                .select('*, inventory(name, code, model, unit), jobs(code)')
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
            itemUnit: item.inventory?.unit,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            price: item.price,
            jobId: item.job_id,
            jobCode: item.jobs?.code,
            createdAt: item.created_at,
            transportApplied: item.transport_applied ?? false,
            transportUnitCost: item.transport_unit_cost ?? 0,
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
        if (item.transportApplied !== undefined) dbItem.transport_applied = item.transportApplied;

        const { data, error } = await supabase.from('purchase_items').update(dbItem).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },
    deleteItem: async (id: string) => {
        const { error } = await supabase.from('purchase_items').delete().eq('id', id);
        if (error) throw error;
    },

    // Mark source orders as converted (sets converted_purchase_id on each order)
    markOrdersAsConverted: async (orderIds: string[], purchaseId: string) => {
        const { error } = await supabase
            .from('purchases')
            .update({ converted_purchase_id: purchaseId })
            .in('id', orderIds);
        if (error) throw error;
    },

    // Fetch orders that have been converted into this purchase (reverse lookup)
    getSourceOrders: async (purchaseId: string): Promise<{ id: string; deliveryNoteNumber: string }[]> => {
        const { data, error } = await supabase
            .from('purchases')
            .select('id, delivery_note_number')
            .eq('converted_purchase_id', purchaseId)
            .eq('order_type', 'order');
        if (error) throw error;
        return (data ?? []).map((r: any) => ({ id: r.id, deliveryNoteNumber: r.delivery_note_number }));
    },

    // Fetch full order data for conversion to purchase (includes item_id, coefficient, pieces)
    getOrdersForConversion: async (ids: string[]) => {
        const { data, error } = await supabase
            .from('purchases')
            .select('id, supplier_id, transport_cost, suppliers(name), job_id, jobs(code), purchase_items(item_id, price, quantity, pieces, coefficient, job_id, transport_applied, jobs(code), inventory(id, name, model, code, unit, coefficient))')
            .in('id', ids)
            .eq('order_type', 'order');
        if (error) throw error;
        return (data ?? []).map((p: any) => ({
            id: p.id,
            supplierId: p.supplier_id,
            supplierName: p.suppliers?.name,
            jobId: p.job_id ?? null,
            jobCode: p.jobs?.code ?? null,
            transportCost: p.transport_cost ?? 0,
            items: (p.purchase_items ?? []).map((i: any) => ({
                itemId: i.item_id,
                itemName: i.inventory?.name ?? '',
                itemModel: i.inventory?.model,
                itemCode: i.inventory?.code,
                itemUnit: i.inventory?.unit ?? 'PZ',
                coefficient: Number(i.inventory?.coefficient ?? i.coefficient ?? 1),
                quantity: i.quantity,
                pieces: i.pieces,
                price: i.price,
                jobId: i.job_id ?? null,
                jobCode: i.jobs?.code ?? null,
                transportApplied: i.transport_applied ?? false,
            })),
        }));
    },

    // Save transport cost on the purchase and apply it to all item prices
    applyTransportToAllItems: async (purchaseId: string, transportCost: number, items: PurchaseItem[]) => {
        if (items.length === 0) return;

        const transportPerRow = transportCost / items.length;

        // Update each item: add transport per unit to price, mark transport_applied = true
        const updates = items.map(item => {
            const transportPerUnit = transportPerRow / item.quantity;
            const newPrice = parseFloat((item.price + transportPerUnit).toFixed(5));
            return supabase
                .from('purchase_items')
                .update({ price: newPrice, transport_applied: true, transport_unit_cost: transportPerUnit })
                .eq('id', item.id);
        });

        await Promise.all(updates);

        // Save transport_cost on the purchase record
        const { error } = await supabase
            .from('purchases')
            .update({ transport_cost: transportCost })
            .eq('id', purchaseId);
        if (error) throw error;
    },

    // Reverse transport on items that had it applied (restore original price)
    reverseTransportOnItems: async (items: PurchaseItem[]) => {
        const applied = items.filter(i => i.transportApplied && (i.transportUnitCost ?? 0) > 0);
        if (applied.length === 0) return;
        const updates = applied.map(item => {
            const originalPrice = parseFloat((item.price - (item.transportUnitCost ?? 0)).toFixed(5));
            return supabase
                .from('purchase_items')
                .update({ price: originalPrice, transport_applied: false, transport_unit_cost: 0 })
                .eq('id', item.id);
        });
        await Promise.all(updates);
    },

    // Save transport cost without applying to items
    saveTransportCost: async (purchaseId: string, transportCost: number) => {
        const { error } = await supabase
            .from('purchases')
            .update({ transport_cost: transportCost })
            .eq('id', purchaseId);
        if (error) throw error;
    },

    // Get job movements for all items in a purchase
    getPurchaseItemJobMovements: async (purchaseId: string) => {
        // First get all purchase_item_ids for this purchase
        const { data: items } = await supabase
            .from('purchase_items')
            .select('id')
            .eq('purchase_id', purchaseId);

        if (!items || items.length === 0) return {};

        const purchaseItemIds = items.map(i => i.id);

        // Query the view for job movements
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('purchase_item_job_movements')
                .select('*')
                .in('purchase_item_id', purchaseItemIds)
        );

        if (error) throw error;

        // Group by purchase_item_id
        const grouped: Record<string, any[]> = {};
        data?.forEach((movement: any) => {
            const itemId = movement.purchase_item_id;
            if (!grouped[itemId]) {
                grouped[itemId] = [];
            }
            grouped[itemId].push({
                jobId: movement.job_id,
                jobCode: movement.job_code,
                jobName: movement.job_name,
                jobDescription: movement.job_description,
                totalQuantity: movement.total_quantity,
                totalPieces: movement.total_pieces
            });
        });

        return grouped;
    }
};
