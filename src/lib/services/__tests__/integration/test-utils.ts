/**
 * Integration Test Utilities
 * 
 * Provides helpers for running integration tests against the real Supabase database.
 * Tests use the actual database but clean up after themselves.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

/**
 * Create a Supabase client for integration tests
 */
export function createTestClient(): SupabaseClient {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials for integration tests');
    }
    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Generate a unique test ID to avoid conflicts
 */
export function generateTestId(): string {
    return `TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Clean up test data created during tests
 * Use this in afterEach/afterAll hooks
 */
export async function cleanupTestData(
    supabase: SupabaseClient,
    table: string,
    ids: string[]
): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await supabase
        .from(table)
        .delete()
        .in('id', ids);

    if (error) {
        console.warn(`Failed to cleanup ${table}:`, error.message);
    }
}

/**
 * Test data factory - creates test entities with cleanup tracking
 */
export class TestDataFactory {
    private supabase: SupabaseClient;
    private createdEntities: Map<string, string[]> = new Map();

    constructor(supabase: SupabaseClient) {
        this.supabase = supabase;
    }

    private trackEntity(table: string, id: string) {
        const ids = this.createdEntities.get(table) || [];
        ids.push(id);
        this.createdEntities.set(table, ids);
    }

    async createSupplier(name?: string): Promise<{ id: string; name: string }> {
        const supplierName = name || `Test Supplier ${generateTestId()}`;
        const { data, error } = await this.supabase
            .from('suppliers')
            .insert({ name: supplierName })
            .select()
            .single();

        if (error) throw new Error(`Failed to create test supplier: ${error.message}`);
        this.trackEntity('suppliers', data.id);
        return data;
    }

    async createInventoryItem(overrides?: Partial<any>): Promise<any> {
        const code = `TEST-${generateTestId().substring(0, 8)}`;
        const { data, error } = await this.supabase
            .from('inventory')
            .insert({
                code,
                name: `Test Item ${code}`,
                quantity: 0,
                min_stock: 0,
                coefficient: 1,
                pieces: 0,
                real_quantity: 0,
                ...overrides,
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create test inventory item: ${error.message}`);
        this.trackEntity('inventory', data.id);
        return data;
    }

    async createPurchase(supplierId: string, items: { itemId: string; quantity: number; price: number }[]): Promise<any> {
        const noteNumber = `TEST-DDT-${generateTestId().substring(0, 8)}`;

        // Create purchase
        const { data: purchase, error: purchaseError } = await this.supabase
            .from('purchases')
            .insert({
                supplier_id: supplierId,
                delivery_note_number: noteNumber,
                delivery_note_date: new Date().toISOString().split('T')[0],
            })
            .select()
            .single();

        if (purchaseError) throw new Error(`Failed to create test purchase: ${purchaseError.message}`);
        this.trackEntity('purchases', purchase.id);

        // Create purchase items
        for (const item of items) {
            const { data: purchaseItem, error: itemError } = await this.supabase
                .from('purchase_items')
                .insert({
                    purchase_id: purchase.id,
                    item_id: item.itemId,
                    quantity: item.quantity,
                    pieces: item.quantity,
                    price: item.price,
                    coefficient: 1,
                })
                .select()
                .single();

            if (itemError) throw new Error(`Failed to create test purchase item: ${itemError.message}`);
            this.trackEntity('purchase_items', purchaseItem.id);
        }

        return purchase;
    }

    /**
     * Clean up all created test data in reverse order
     */
    async cleanup(): Promise<void> {
        // Order matters due to foreign key constraints
        const cleanupOrder = [
            'delivery_note_items',
            'delivery_notes',
            'purchase_items',
            'purchases',
            'inventory',
            'suppliers',
        ];

        for (const table of cleanupOrder) {
            const ids = this.createdEntities.get(table);
            if (ids && ids.length > 0) {
                await cleanupTestData(this.supabase, table, ids);
            }
        }

        this.createdEntities.clear();
    }
}
