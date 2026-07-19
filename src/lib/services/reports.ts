import { supabase } from '@/lib/supabase';

export interface ArticleLot {
    itemId: string;
    itemCode: string;
    itemName: string;
    itemModel: string; // variant/model
    itemBrand: string;
    itemType: string;
    itemUnit: string;
    coefficient: number;
    lotRef: string;
    lotDate: string;
    price: number;
    pieces: number;
    quantity: number; // pieces * coefficient
    totalValue: number; // quantity * price
}

export interface ArticlesReportData {
    articles: ArticleLot[];
    totalValue: number;
    generatedAt: string;
    asOfDate?: string; // Date for historical reports
}

// Get all articles with stock > 0, broken down by lot
// If targetDate is provided, calculates stock as of that date using RPC function
export const getArticlesWithStock = async (targetDate?: string): Promise<ArticlesReportData> => {
    try {
        let lots: any[] = [];

        if (targetDate) {
            // Use RPC function for historical calculation
            const { data, error } = await supabase
                .rpc('get_stock_at_date', { target_date: targetDate });

            if (error) {
                console.error('Error fetching historical lots:', error);
                throw error;
            }
            lots = data || [];
        } else {
            // Use the current view for real-time data
            const { data, error } = await supabase
                .from('purchase_batch_availability')
                .select('*')
                .gt('remaining_pieces', 0)
                .order('purchase_date', { ascending: true });

            if (error) {
                console.error('Error fetching lots:', error);
                throw error;
            }
            lots = data || [];
        }

        // Get all inventory items to get names and other details
        const { data: items, error: itemsError } = await supabase
            .from('inventory')
            .select('id, code, name, model, brand, category, unit, coefficient, pieces');

        if (itemsError) {
            console.error('Error fetching inventory:', itemsError);
            throw itemsError;
        }

        // Create a map of items for quick lookup
        const itemMap = new Map<string, any>();
        (items || []).forEach(item => {
            itemMap.set(item.id, item);
        });

        const articles: ArticleLot[] = [];

        // Process lots
        for (const lot of lots) {
            const item = itemMap.get(lot.item_id);
            if (!item) continue;

            const pieces = lot.remaining_pieces || 0;
            const coeff = lot.coefficient || item.coefficient || 1;
            const quantity = pieces * coeff;
            const price = lot.unit_price || 0;

            articles.push({
                itemId: item.id,
                itemCode: item.code || '',
                itemName: item.name || '',
                itemModel: item.model || '',
                itemBrand: item.brand || '',
                itemType: item.category || '',
                itemUnit: item.unit || '',
                coefficient: coeff,
                lotRef: lot.purchase_ref || 'N/D',
                lotDate: lot.purchase_date || '',
                price: price,
                pieces: pieces,
                quantity: quantity,
                totalValue: quantity * price
            });
        }

        // NOTE: Removed legacy fallback to inventory.pieces
        // All stock must come from tracked lots (purchase_items + delivery_notes)
        // This ensures historical reports always show correct lot references and prices

        // Sort by code
        articles.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

        const totalValue = articles.reduce((sum, a) => sum + a.totalValue, 0);

        return {
            articles,
            totalValue,
            generatedAt: new Date().toISOString(),
            asOfDate: targetDate
        };
    } catch (error) {
        console.error('getArticlesWithStock error:', error);
        throw error;
    }
};

export interface InventoryCountItem {
    itemId: string;
    itemCode: string;
    itemName: string;
    itemModel: string; // variant/model
    itemBrand: string;
    itemType: string;
    itemUnit: string;
    itemImage?: string; // Image URL, for the count sheet thumbnail
    coefficient: number;
    systemPieces: number;  // Total pieces across all lots
    systemQuantity: number;
    recentlyActive: boolean; // Movimentato o acquistato nell'ultimo anno
}

export interface InventoryCountData {
    items: InventoryCountItem[];
    generatedAt: string;
}

// Get all items for inventory count - aggregated by item (not by lot)
// Shows ALL items including those with 0 pieces (to confirm they are at zero)
export const getInventoryCountData = async (): Promise<InventoryCountData> => {
    try {
        // Get all lots (including those with 0 pieces for accurate calculation)
        const { data: lots, error: lotsError } = await supabase
            .from('purchase_batch_availability')
            .select('*');

        if (lotsError) {
            console.error('Error fetching lots:', lotsError);
            throw lotsError;
        }

        // Get ALL inventory items
        const { data: items, error: itemsError } = await supabase
            .from('inventory')
            .select('id, code, name, model, brand, category, unit, coefficient, pieces, image_url');

        if (itemsError) {
            console.error('Error fetching inventory:', itemsError);
            throw itemsError;
        }

        // Aggregate pieces by item (sum all lots)
        const itemPiecesMap = new Map<string, number>();
        for (const lot of lots || []) {
            const currentPieces = itemPiecesMap.get(lot.item_id) || 0;
            // Only add positive remaining pieces
            const piecesToAdd = Math.max(0, lot.remaining_pieces || 0);
            itemPiecesMap.set(lot.item_id, currentPieces + piecesToAdd);
        }

        // Articoli movimentati (bolle) o acquistati nell'ultimo anno: da evidenziare nel
        // foglio conta come "da controllare prima", perché più probabile che siano cambiati.
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const cutoffDate = oneYearAgo.toISOString().slice(0, 10);

        const [movementsRes, purchasesRes] = await Promise.all([
            supabase
                .from('delivery_note_items')
                .select('inventory_id, delivery_notes!inner(date)')
                .gte('delivery_notes.date', cutoffDate),
            supabase
                .from('purchase_items')
                .select('item_id, purchases!inner(delivery_note_date, deleted_at, order_type)')
                .gte('purchases.delivery_note_date', cutoffDate)
                .is('purchases.deleted_at', null)
                .eq('purchases.order_type', 'purchase'),
        ]);

        if (movementsRes.error) console.error('Error fetching recent movements:', movementsRes.error);
        if (purchasesRes.error) console.error('Error fetching recent purchases:', purchasesRes.error);

        const recentlyActiveIds = new Set<string>();
        (movementsRes.data || []).forEach((r: { inventory_id: string | null }) => {
            if (r.inventory_id) recentlyActiveIds.add(r.inventory_id);
        });
        (purchasesRes.data || []).forEach((r: { item_id: string | null }) => {
            if (r.item_id) recentlyActiveIds.add(r.item_id);
        });

        const countItems: InventoryCountItem[] = [];

        // Build items from ALL inventory (not just those with lots)
        // Exclude items with category 'attrezzatura'
        for (const item of items || []) {
            // Skip attrezzatura items
            if (item.category?.toLowerCase() === 'attrezzatura') continue;

            const totalPieces = itemPiecesMap.get(item.id) || 0;
            const coeff = item.coefficient || 1;

            countItems.push({
                itemId: item.id,
                itemCode: item.code || '',
                itemName: item.name || '',
                itemModel: item.model || '',
                itemBrand: item.brand || '',
                itemType: item.category || '',
                itemUnit: item.unit || '',
                itemImage: item.image_url || undefined,
                coefficient: coeff,
                systemPieces: totalPieces,
                systemQuantity: totalPieces * coeff,
                recentlyActive: recentlyActiveIds.has(item.id)
            });
        }

        // Sort by type and code
        countItems.sort((a, b) => {
            const typeCompare = a.itemType.localeCompare(b.itemType);
            if (typeCompare !== 0) return typeCompare;
            return a.itemCode.localeCompare(b.itemCode);
        });

        return {
            items: countItems,
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('getInventoryCountData error:', error);
        throw error;
    }
};
