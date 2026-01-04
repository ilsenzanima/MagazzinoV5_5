'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

/**
 * Reassign untracked inventory to a specific purchase lot
 * Finds entry delivery notes without purchase_item_id and assigns them
 */
export async function reassignLotToEntries(
    itemId: string,
    purchaseItemId: string,
    quantityToAssign: number
) {
    try {
        // Find entry delivery note items without lot assignment for this item
        const { data: entries, error: fetchError } = await supabase
            .from('delivery_note_items')
            .select('id, quantity, delivery_note_id, delivery_notes!inner(type, date)')
            .eq('inventory_id', itemId)
            .is('purchase_item_id', null)
            .eq('delivery_notes.type', 'entry')
            .order('delivery_notes.date', { ascending: false }); // Most recent first

        if (fetchError) throw fetchError;

        if (!entries || entries.length === 0) {
            return { success: false, error: 'No unassigned entries found' };
        }

        // Assign lots until we reach the desired quantity
        let remainingToAssign = quantityToAssign;
        const idsToUpdate: string[] = [];

        for (const entry of entries) {
            if (remainingToAssign <= 0) break;

            idsToUpdate.push(entry.id);
            remainingToAssign -= entry.quantity;
        }

        if (idsToUpdate.length === 0) {
            return { success: false, error: 'No entries to update' };
        }

        // Update the entries with the purchase_item_id
        const { error: updateError } = await supabase
            .from('delivery_note_items')
            .update({ purchase_item_id: purchaseItemId })
            .in('id', idsToUpdate);

        if (updateError) throw updateError;

        // Revalidate the item page
        revalidatePath(`/inventory/${itemId}`);
        revalidatePath('/inventory');

        return {
            success: true,
            updated: idsToUpdate.length,
            message: `${idsToUpdate.length} entry rows reassigned to lot`
        };
    } catch (error: any) {
        console.error('Error reassigning lot:', error);
        return { success: false, error: error.message };
    }
}
