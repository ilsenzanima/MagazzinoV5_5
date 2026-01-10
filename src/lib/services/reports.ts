import { supabase } from '@/lib/supabase';
import { InventoryItem } from '@/lib/types';

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
    // Get all inventory items with pieces > 0
    const { data: items, error: itemsError } = await supabase
        .from('inventory')
        .select('id, code, name, brand, type, unit, coefficient, pieces, quantity')
        .gt('pieces', 0)
        .order('code', { ascending: true });

    if (itemsError) throw itemsError;

    const articles: ArticleLot[] = [];

    // For each item, get its lots from purchase_batch_availability
    for (const item of items || []) {
        const { data: lots, error: lotsError } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .eq('item_id', item.id)
            .gt('remaining_pieces', 0)
            .order('purchase_date', { ascending: true });

        if (lotsError) throw lotsError;

        if (lots && lots.length > 0) {
            // Add each lot as a separate row
            for (const lot of lots) {
                const pieces = lot.remaining_pieces || 0;
                const coeff = lot.coefficient || item.coefficient || 1;
                const quantity = pieces * coeff;
                const price = lot.unit_price || 0;

                articles.push({
                    itemId: item.id,
                    itemCode: item.code,
                    itemName: item.name,
                    itemBrand: item.brand,
                    itemType: item.type,
                    itemUnit: item.unit,
                    coefficient: coeff,
                    lotRef: lot.purchase_ref || 'N/D',
                    lotDate: lot.purchase_date,
                    price: price,
                    pieces: pieces,
                    quantity: quantity,
                    totalValue: quantity * price
                });
            }
        } else {
            // Item has pieces but no tracked lots (legacy/untracked stock)
            const pieces = item.pieces || 0;
            const coeff = item.coefficient || 1;
            const quantity = pieces * coeff;

            articles.push({
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                itemBrand: item.brand,
                itemType: item.type,
                itemUnit: item.unit,
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

    const totalValue = articles.reduce((sum, a) => sum + a.totalValue, 0);

    return {
        articles,
        totalValue,
        generatedAt: new Date().toISOString()
    };
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

// Get all items for inventory count (including those with 0 pieces for verification)
export const getInventoryCountData = async (): Promise<InventoryCountData> => {
    // Get all inventory items ordered by type and code
    const { data: items, error: itemsError } = await supabase
        .from('inventory')
        .select('id, code, name, brand, type, unit, coefficient, pieces, quantity')
        .order('type', { ascending: true })
        .order('code', { ascending: true });

    if (itemsError) throw itemsError;

    const countItems: InventoryCountItem[] = [];

    for (const item of items || []) {
        // Get lots for this item
        const { data: lots, error: lotsError } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .eq('item_id', item.id)
            .gt('remaining_pieces', 0)
            .order('purchase_date', { ascending: true });

        if (lotsError) throw lotsError;

        if (lots && lots.length > 0) {
            // Add each lot separately for detailed counting
            for (const lot of lots) {
                const pieces = lot.remaining_pieces || 0;
                const coeff = lot.coefficient || item.coefficient || 1;

                countItems.push({
                    itemId: item.id,
                    itemCode: item.code,
                    itemName: item.name,
                    itemBrand: item.brand,
                    itemType: item.type,
                    itemUnit: item.unit,
                    coefficient: coeff,
                    lotRef: lot.purchase_ref || 'N/D',
                    systemPieces: pieces,
                    systemQuantity: pieces * coeff
                });
            }
        } else if (item.pieces && item.pieces > 0) {
            // Untracked stock
            const pieces = item.pieces || 0;
            const coeff = item.coefficient || 1;

            countItems.push({
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                itemBrand: item.brand,
                itemType: item.type,
                itemUnit: item.unit,
                coefficient: coeff,
                lotRef: 'Non tracciato',
                systemPieces: pieces,
                systemQuantity: pieces * coeff
            });
        }
    }

    return {
        items: countItems,
        generatedAt: new Date().toISOString()
    };
};
