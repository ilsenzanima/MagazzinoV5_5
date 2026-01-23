import { supabase } from '@/lib/supabase';
import { InventoryItem, InventorySupplierCode, Brand, ItemType, Unit } from '@/lib/types';
import { fetchWithTimeout } from './utils';

// Mappers
export const mapDbItemToInventoryItem = (dbItem: any): InventoryItem => ({
    id: dbItem.id,
    code: dbItem.code,
    name: dbItem.name,
    brand: dbItem.brand,
    type: dbItem.category, // Map category -> type
    quantity: dbItem.quantity,
    minStock: dbItem.min_stock, // Map min_stock -> minStock
    status: dbItem.quantity <= 0 ? 'out_of_stock' : dbItem.quantity <= dbItem.min_stock ? 'low_stock' : 'in_stock',
    image: dbItem.image_url, // Map image_url -> image
    description: dbItem.description,
    price: dbItem.price,
    location: dbItem.location,
    unit: dbItem.unit,
    coefficient: dbItem.coefficient ? Number(dbItem.coefficient) : 1,
    pieces: dbItem.pieces,
    realPieces: dbItem.pieces,  // Real physical pieces count
    supplierCode: dbItem.supplier_code,
    realQuantity: dbItem.real_quantity,
    model: dbItem.model
});

export const mapInventoryItemToDbItem = (item: Partial<InventoryItem>) => {
    const dbItem: any = {};

    // Only include fields that are explicitly passed (not undefined)
    if (item.code !== undefined) dbItem.code = item.code;
    if (item.name !== undefined) dbItem.name = item.name;
    if (item.brand !== undefined) dbItem.brand = item.brand;
    if (item.type !== undefined) dbItem.category = item.type; // Map type -> category
    if (item.quantity !== undefined) dbItem.quantity = item.quantity;
    if (item.minStock !== undefined) dbItem.min_stock = item.minStock;
    if (item.image !== undefined) dbItem.image_url = item.image;
    if (item.description !== undefined) dbItem.description = item.description;
    if (item.price !== undefined) dbItem.price = item.price;
    if (item.location !== undefined) dbItem.location = item.location;
    if (item.unit !== undefined) dbItem.unit = item.unit;
    if (item.coefficient !== undefined) dbItem.coefficient = item.coefficient;
    if (item.supplierCode !== undefined) dbItem.supplier_code = item.supplierCode;
    if (item.realQuantity !== undefined) dbItem.real_quantity = item.realQuantity;
    if (item.model !== undefined) dbItem.model = item.model;

    return dbItem;
};

const mapDbToInventorySupplierCode = (db: any): InventorySupplierCode => ({
    id: db.id,
    inventoryId: db.inventory_id,
    code: db.code,
    supplierId: db.supplier_id,
    supplierName: db.supplier_name || db.suppliers?.name,
    note: db.note,
    createdAt: db.created_at
});

// APIs
export const inventorySupplierCodesApi = {
    getByItemId: async (itemId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('inventory_supplier_codes')
                .select('*, suppliers(name)')
                .eq('inventory_id', itemId)
                .order('created_at', { ascending: false })
        );
        if (error) throw error;
        return data.map(mapDbToInventorySupplierCode);
    },
    create: async (code: Partial<InventorySupplierCode>) => {
        const dbCode = {
            inventory_id: code.inventoryId,
            code: code.code,
            supplier_id: code.supplierId,
            supplier_name: code.supplierName,
            note: code.note
        };
        const { data, error } = await supabase.from('inventory_supplier_codes').insert(dbCode).select('*, suppliers(name)').single();
        if (error) throw error;
        return mapDbToInventorySupplierCode(data);
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('inventory_supplier_codes').delete().eq('id', id);
        if (error) throw error;
    }
};

export const inventoryApi = {
    // Fetch all items
    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('inventory')
                .select('*')
                .order('created_at', { ascending: false })
        );

        if (error) throw error;
        return data.map(mapDbItemToInventoryItem);
    },

    // Modificato per usare RPC avanzata se c'è ricerca o filtri complessi
    getPaginated: async (options: { page: number; limit: number; search?: string; tab?: string; brand?: string; type?: string }) => {
        const from = (options.page - 1) * options.limit;

        // Se c'è una ricerca o tab specifici, o filtri avanzati, usiamo la RPC get_inventory_search
        // Nota: La RPC deve essere stata creata nel DB e aggiornata per supportare brand/type
        if (options.search || options.tab || options.brand || options.type) {
            const { data, error } = await supabase.rpc('get_inventory_search', {
                p_search: options.search || '',
                p_status: options.tab || 'all',
                p_limit: options.limit,
                p_offset: from,
                p_brand: options.brand || null,
                p_type: options.type || null
            });

            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            // Estraiamo il total_count dal primo elemento (se esiste)
            const total = data && data.length > 0 ? Number(data[0].total_count) : 0;

            return {
                items: (data || []).map(mapDbItemToInventoryItem),
                total: total
            };
        }

        // Fallback alla query standard per "Tutti" senza ricerca (più veloce se non serve join)
        let query = supabase.from('inventory').select('*', { count: 'estimated' });
        query = query.order('name');
        query = query.range(from, from + options.limit - 1);

        const { data, error, count } = await fetchWithTimeout(query);
        if (error) throw error;

        return {
            items: data.map(mapDbItemToInventoryItem),
            total: count || 0
        };
    },

    // Check Duplicate
    checkDuplicate: async (item: { name: string; brand: string; type: string; model: string }) => {
        const { data, error } = await supabase.rpc('check_inventory_duplicate', {
            p_name: item.name,
            p_brand: item.brand,
            p_type: item.type,
            p_model: item.model
        });

        if (error) throw error;
        return data as boolean;
    },

    // Get single item
    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('inventory')
                .select('*')
                .eq('id', id)
                .single()
        );

        if (error) throw error;
        return mapDbItemToInventoryItem(data);
    },

    // Create item
    create: async (item: Omit<InventoryItem, 'id' | 'status'>) => {
        const dbItem = mapInventoryItemToDbItem(item);
        const { data, error } = await supabase
            .from('inventory')
            .insert(dbItem)
            .select()
            .single();

        if (error) throw error;
        return mapDbItemToInventoryItem(data);
    },

    // Update item
    update: async (id: string, item: Partial<InventoryItem>) => {
        const dbItem = mapInventoryItemToDbItem(item);
        const { data, error } = await supabase
            .from('inventory')
            .update(dbItem)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return mapDbItemToInventoryItem(data);
    },

    // Delete item
    delete: async (id: string) => {
        const { error } = await supabase
            .from('inventory')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Upload image to Storage
    uploadImage: async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    // Get next article code
    getNextCode: async () => {
        const { data, error } = await supabase
            .rpc('get_next_article_code');

        if (error) throw error;
        return data as string;
    },

    getHistory: async (itemId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('stock_movements_view')
                .select('*')
                .eq('item_id', itemId)
                .order('date', { ascending: false })
        );

        if (error) throw error;

        return data.map((m: any) => ({
            id: m.id,
            date: m.date,
            type: m.type,
            quantity: m.quantity,
            reference: m.reference,
            itemId: m.item_id,
            userId: m.user_id,
            userName: m.user_name,
            pieces: m.pieces,
            coefficient: m.coefficient,
            notes: m.notes,
            jobId: m.job_id,
            jobCode: m.job_code,
            jobDescription: m.job_description,
            isFictitious: m.is_fictitious
        }));
    },

    // Get available purchase batches for an item (for FIFO/Traceability)
    getAvailableBatches: async (itemId: string) => {
        const { data, error } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .eq('item_id', itemId)
            .order('purchase_date', { ascending: true }); // FIFO by default

        if (error) throw error;
        return data.map((b: any) => ({
            id: b.purchase_item_id,
            purchaseId: b.purchase_id,
            purchaseRef: b.purchase_ref,
            date: b.purchase_date,
            originalQty: b.original_quantity,
            remainingQty: b.remaining_quantity,
            originalPieces: b.original_pieces,
            remainingPieces: b.remaining_pieces,
            price: b.unit_price
        }));
    },

    // Get all lots for an item (for Lots tab in item detail)
    // Includes ALL lots - even exhausted ones (remaining = 0)
    getLotsForItem: async (itemId: string) => {
        // Get ALL purchase items for this item (not just available ones)
        const { data: purchaseItems, error: piError } = await supabase
            .from('purchase_items')
            .select(`
                id,
                purchase_id,
                quantity,
                pieces,
                price,
                coefficient,
                purchases!inner (
                    id,
                    delivery_note_number,
                    delivery_note_date,
                    job_id
                )
            `)
            .eq('item_id', itemId);

        if (piError) throw piError;

        // Filter out direct-to-job purchases (job_id not null on purchase header)
        const warehousePurchases = purchaseItems.filter((pi: any) => !pi.purchases.job_id);

        // For each purchase item, calculate remaining quantity
        const lotsWithRemaining = await Promise.all(warehousePurchases.map(async (pi: any) => {
            // Get total exits for this purchase item
            const { data: exits, error: exitsError } = await supabase
                .from('delivery_note_items')
                .select(`
                    quantity,
                    pieces,
                    is_fictitious,
                    delivery_notes!inner (type)
                `)
                .eq('purchase_item_id', pi.id);

            if (exitsError) throw exitsError;

            // Calculate used quantity (exits - returns)
            let usedQty = 0;
            let usedPieces = 0;
            exits?.forEach((dni: any) => {
                if (dni.is_fictitious) return; // Skip fictitious
                if (dni.delivery_notes.type === 'exit' || dni.delivery_notes.type === 'sale') {
                    usedQty += dni.quantity || 0;
                    usedPieces += dni.pieces || 0;
                } else if (dni.delivery_notes.type === 'entry') {
                    usedQty -= dni.quantity || 0;
                    usedPieces -= dni.pieces || 0;
                }
            });

            const remainingQty = Math.max(0, Math.min(pi.quantity - usedQty, pi.quantity));
            const remainingPieces = Math.max(0, Math.min((pi.pieces || 0) - usedPieces, pi.pieces || 0));

            return {
                id: pi.id,
                purchaseId: pi.purchase_id,
                purchaseRef: pi.purchases.delivery_note_number,
                date: pi.purchases.delivery_note_date,
                originalQty: pi.quantity,
                remainingQty: remainingQty,
                originalPieces: pi.pieces,
                remainingPieces: remainingPieces,
                price: pi.price
            };
        }));

        // Sort: first by availability (remaining > 0 first), then by date descending
        const sortedLots = lotsWithRemaining.sort((a, b) => {
            // First: available lots before exhausted
            const aAvailable = a.remainingQty > 0.001 ? 1 : 0;
            const bAvailable = b.remainingQty > 0.001 ? 1 : 0;
            if (bAvailable !== aAvailable) return bAvailable - aAvailable;

            // Then: by date descending (most recent first)
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        // Get total inventory quantity
        const { data: item, error: itemError } = await supabase
            .from('inventory')
            .select('quantity, pieces')
            .eq('id', itemId)
            .single();

        if (itemError) throw itemError;

        // Calculate tracked quantity (sum of all lots with remaining > 0)
        const trackedQuantity = sortedLots
            .filter(lot => lot.remainingQty > 0.001)
            .reduce((sum, lot) => sum + lot.remainingQty, 0);
        const trackedPieces = sortedLots
            .filter(lot => lot.remainingPieces && lot.remainingPieces > 0)
            .reduce((sum, lot) => sum + (lot.remainingPieces || 0), 0);

        // Calculate untracked (difference between total and tracked)
        const untrackedQuantity = Math.max(0, (item.quantity || 0) - trackedQuantity);
        const untrackedPieces = Math.max(0, (item.pieces || 0) - trackedPieces);

        return {
            lots: sortedLots,
            untrackedQuantity,
            untrackedPieces,
            totalQuantity: item.quantity,
            totalPieces: item.pieces
        };
    },

    // Get items currently at a specific job site (for Returns)
    getJobInventory: async (jobId: string) => {
        const { data, error } = await supabase
            .from('job_inventory')
            .select('*, inventory(*)')
            .eq('job_id', jobId)
            .gt('quantity', 0); // Only show items actually there

        if (error) throw error;
        return data.map((i: any) => ({
            itemId: i.item_id,
            quantity: i.quantity,
            item: mapDbItemToInventoryItem(i.inventory)
        }));
    },

    // Get job inventory broken down by purchase batch (for Returns with traceability)
    getJobBatchAvailability: async (jobId: string) => {
        const { data, error } = await supabase
            .from('job_batch_availability')
            .select('*')
            .eq('job_id', jobId)
            .order('item_name', { ascending: true });

        if (error) throw error;
        return data.map((b: any) => ({
            itemId: b.item_id,
            purchaseItemId: b.purchase_item_id,
            purchaseRef: b.purchase_ref,
            purchaseDate: b.purchase_date,
            itemName: b.item_name,
            itemModel: b.item_model,
            itemCode: b.item_code,
            itemUnit: b.item_unit,
            itemBrand: b.item_brand,
            itemCategory: b.item_category,
            quantity: b.quantity,
            pieces: b.pieces,
            coefficient: b.coefficient,
            originalQuantity: b.original_quantity,
            originalPieces: b.original_pieces
        }));
    },

    // Get job inventory detailed by batch with delivery notes aggregation
    getJobBatchDetailed: async (jobId: string) => {
        const { data, error } = await supabase
            .from('job_batch_detailed')
            .select('*')
            .eq('job_id', jobId)
            .order('item_name', { ascending: true });

        if (error) throw error;
        return data.map((b: any) => ({
            itemId: b.item_id,
            itemCode: b.item_code,
            itemName: b.item_name,
            itemUnit: b.item_unit,
            purchaseItemId: b.purchase_item_id,
            purchaseRef: b.purchase_ref,
            purchaseDate: b.purchase_date,
            supplierName: b.supplier_name,
            exitDeliveryNotes: b.exit_delivery_notes,
            entryDeliveryNotes: b.entry_delivery_notes,
            currentQuantity: b.current_quantity,
            currentPieces: b.current_pieces
        }));
    },

    // Seed database with mock data
    seed: async () => {
        // Check if data already exists
        const { count } = await supabase
            .from('inventory')
            .select('*', { count: 'estimated', head: true });

        if (count && count > 0) {
            console.log('Database already seeded');
            return;
        }
        return;
    }
};

export const brandsApi = {
    getAll: async () => {
        const { data, error } = await supabase.from('brands').select('*').order('name');
        if (error) throw error;
        return data as Brand[];
    },
    create: async (name: string) => {
        const { data, error } = await supabase.from('brands').insert({ name }).select().single();
        if (error) throw error;
        return data as Brand;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('brands').delete().eq('id', id);
        if (error) throw error;
    }
};

export const itemTypesApi = {
    getAll: async () => {
        const { data, error } = await supabase.from('item_types').select('*').order('name');
        if (error) throw error;
        return data.map((t: any) => ({
            id: t.id,
            name: t.name,
            imageUrl: t.image_url
        })) as ItemType[];
    },
    create: async (name: string) => {
        const { data, error } = await supabase.from('item_types').insert({ name }).select().single();
        if (error) throw error;
        return data as ItemType;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('item_types').delete().eq('id', id);
        if (error) throw error;
    }
};

export const unitsApi = {
    getAll: async () => {
        const { data, error } = await supabase.from('units').select('*').order('name');
        if (error) throw error;
        return data as Unit[];
    },
    create: async (name: string) => {
        const { data, error } = await supabase.from('units').insert({ name }).select().single();
        if (error) throw error;
        return data as Unit;
    },
    delete: async (id: string) => {
        const { error } = await supabase.from('units').delete().eq('id', id);
        if (error) throw error;
    }
};
