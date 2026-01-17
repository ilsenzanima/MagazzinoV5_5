/**
 * Integration Tests for Purchases and FIFO Flow
 * 
 * These tests run against the real Supabase database.
 * They create test data, verify behavior, and clean up afterwards.
 * 
 * To run: npm test -- --testPathPattern=integration
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createTestClient, TestDataFactory } from './test-utils';
import { SupabaseClient } from '@supabase/supabase-js';

describe('Purchases Integration Tests', () => {
    let supabase: SupabaseClient;
    let factory: TestDataFactory;

    beforeAll(() => {
        try {
            supabase = createTestClient();
            factory = new TestDataFactory(supabase);
        } catch (error) {
            console.warn('Skipping integration tests: Missing Supabase credentials');
        }
    });

    afterAll(async () => {
        if (factory) {
            await factory.cleanup();
        }
    });

    // Skip tests if no credentials
    const testOrSkip = process.env.NEXT_PUBLIC_SUPABASE_URL ? test : test.skip;

    testOrSkip('should create a purchase and update inventory batches', async () => {
        // 1. Create test supplier
        const supplier = await factory.createSupplier();
        expect(supplier.id).toBeDefined();

        // 2. Create test inventory item
        const item = await factory.createInventoryItem({ quantity: 0 });
        expect(item.id).toBeDefined();
        expect(item.quantity).toBe(0);

        // 3. Create purchase with this item
        const purchase = await factory.createPurchase(supplier.id, [
            { itemId: item.id, quantity: 10, price: 5.50 },
        ]);
        expect(purchase.id).toBeDefined();

        // 4. Verify batch was created in purchase_batch_availability
        const { data: batches, error: batchError } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .eq('item_id', item.id);

        expect(batchError).toBeNull();
        expect(batches).toHaveLength(1);
        expect(batches![0].original_quantity).toBe(10);
        expect(batches![0].remaining_quantity).toBe(10);

        // 5. Verify inventory quantity was updated
        const { data: updatedItem } = await supabase
            .from('inventory')
            .select('quantity, pieces')
            .eq('id', item.id)
            .single();

        expect(updatedItem?.quantity).toBe(10);
    }, 30000);

    testOrSkip('should update batch availability when purchase price changes', async () => {
        // 1. Setup
        const supplier = await factory.createSupplier();
        const item = await factory.createInventoryItem();
        const purchase = await factory.createPurchase(supplier.id, [
            { itemId: item.id, quantity: 5, price: 10 },
        ]);

        // 2. Get the purchase item
        const { data: purchaseItems } = await supabase
            .from('purchase_items')
            .select('id, price')
            .eq('purchase_id', purchase.id)
            .single();

        expect(purchaseItems?.price).toBe(10);

        // 3. Update the price
        await supabase
            .from('purchase_items')
            .update({ price: 15 })
            .eq('id', purchaseItems!.id);

        // 4. Verify batch reflects new price
        const { data: batches } = await supabase
            .from('purchase_batch_availability')
            .select('price')
            .eq('item_id', item.id);

        expect(batches![0].price).toBe(15);
    }, 30000);
});

describe('FIFO Flow Integration Tests', () => {
    let supabase: SupabaseClient;
    let factory: TestDataFactory;

    beforeAll(() => {
        try {
            supabase = createTestClient();
            factory = new TestDataFactory(supabase);
        } catch (error) {
            console.warn('Skipping integration tests: Missing Supabase credentials');
        }
    });

    afterAll(async () => {
        if (factory) {
            await factory.cleanup();
        }
    });

    const testOrSkip = process.env.NEXT_PUBLIC_SUPABASE_URL ? test : test.skip;

    testOrSkip('should correctly track batch availability after multiple purchases', async () => {
        // 1. Create supplier and item
        const supplier = await factory.createSupplier();
        const item = await factory.createInventoryItem();

        // 2. Create first purchase (older)
        await factory.createPurchase(supplier.id, [
            { itemId: item.id, quantity: 10, price: 5 },
        ]);

        // 3. Create second purchase (newer, different price)
        await factory.createPurchase(supplier.id, [
            { itemId: item.id, quantity: 15, price: 7 },
        ]);

        // 4. Verify we have 2 batches
        const { data: batches } = await supabase
            .from('purchase_batch_availability')
            .select('*')
            .eq('item_id', item.id)
            .order('created_at', { ascending: true });

        expect(batches).toHaveLength(2);
        expect(batches![0].original_quantity).toBe(10);
        expect(batches![0].price).toBe(5);
        expect(batches![1].original_quantity).toBe(15);
        expect(batches![1].price).toBe(7);

        // 5. Verify total inventory
        const { data: totalItem } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('id', item.id)
            .single();

        expect(totalItem?.quantity).toBe(25);
    }, 30000);
});
