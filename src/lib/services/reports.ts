import { supabase } from '@/lib/supabase';

export interface ArticleLot {
    itemId: string;
    itemCode: string;
    itemName: string;
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
}

// Get all articles with stock > 0, broken down by lot
export const getArticlesWithStock = async (): Promise<ArticlesReportData> => {
    try {
        // First, get all lots with remaining pieces directly from the view
        const { data: lots, error: lotsError } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .gt('remaining_pieces', 0)
            .order('purchase_date', { ascending: true });

        if (lotsError) {
            console.error('Error fetching lots:', lotsError);
            throw lotsError;
        }

        // Get all inventory items to get names and other details
        const { data: items, error: itemsError } = await supabase
            .from('inventory')
            .select('id, code, name, brand, type, unit, coefficient, pieces');

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
        for (const lot of lots || []) {
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
                itemBrand: item.brand || '',
                itemType: item.type || '',
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

        // Also check for items with pieces but no tracked lots (legacy stock)
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
                    itemBrand: item.brand || '',
                    itemType: item.type || '',
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

        // Sort by code
        articles.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

        const totalValue = articles.reduce((sum, a) => sum + a.totalValue, 0);

        return {
            articles,
            totalValue,
            generatedAt: new Date().toISOString()
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
            .select('id, code, name, brand, type, unit, coefficient, pieces');

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
                itemBrand: item.brand || '',
                itemType: item.type || '',
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
                    itemBrand: item.brand || '',
                    itemType: item.type || '',
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
