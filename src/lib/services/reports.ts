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

        // For current date only: Also check for items with pieces but no tracked lots (legacy stock)
        if (!targetDate) {
            const trackedItemIds = new Set(articles.map(a => a.itemId));
            for (const item of items || []) {
                if (!trackedItemIds.has(item.id) && item.pieces && item.pieces > 0) {
                    const pieces = item.pieces || 0;
                    const coeff = item.coefficient || 1;
                    const quantity = pieces * coeff;

                    articles.push({
                        itemId: item.id,
                        itemCode: item.code || '',
                        itemName: item.name || '',
                        itemModel: item.model || '',
                        itemBrand: item.brand || '',
                        itemType: item.category || '',
                        itemUnit: item.unit || '',
                        coefficient: coeff,
                        lotRef: 'Non tracciato',
                        lotDate: '',
                        price: 0,
                        pieces: pieces,
                        quantity: quantity,
                        totalValue: 0
                    });
                }
            }
        }

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
    coefficient: number;
    lotRef: string;
    systemPieces: number;
    systemQuantity: number;
}

export interface InventoryCountData {
    items: InventoryCountItem[];
    generatedAt: string;
}

// Get all items for inventory count
export const getInventoryCountData = async (): Promise<InventoryCountData> => {
    try {
        // Get all lots with remaining pieces
        const { data: lots, error: lotsError } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .gt('remaining_pieces', 0)
            .order('purchase_date', { ascending: true });

        if (lotsError) {
            console.error('Error fetching lots:', lotsError);
            throw lotsError;
        }

        // Get all inventory items
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

        const countItems: InventoryCountItem[] = [];

        // Process lots
        for (const lot of lots || []) {
            const item = itemMap.get(lot.item_id);
            if (!item) continue;

            const pieces = lot.remaining_pieces || 0;
            const coeff = lot.coefficient || item.coefficient || 1;

            countItems.push({
                itemId: item.id,
                itemCode: item.code || '',
                itemName: item.name || '',
                itemModel: item.model || '',
                itemBrand: item.brand || '',
                itemType: item.category || '',
                itemUnit: item.unit || '',
                coefficient: coeff,
                lotRef: lot.purchase_ref || 'N/D',
                systemPieces: pieces,
                systemQuantity: pieces * coeff
            });
        }

        // Also check for items with pieces but no tracked lots
        const trackedItemIds = new Set(countItems.map(i => i.itemId));
        for (const item of items || []) {
            if (!trackedItemIds.has(item.id) && item.pieces && item.pieces > 0) {
                const pieces = item.pieces || 0;
                const coeff = item.coefficient || 1;

                countItems.push({
                    itemId: item.id,
                    itemCode: item.code || '',
                    itemName: item.name || '',
                    itemModel: item.model || '',
                    itemBrand: item.brand || '',
                    itemType: item.category || '',
                    itemUnit: item.unit || '',
                    coefficient: coeff,
                    lotRef: 'Non tracciato',
                    systemPieces: pieces,
                    systemQuantity: pieces * coeff
                });
            }
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
