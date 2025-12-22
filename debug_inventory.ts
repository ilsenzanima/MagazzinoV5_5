
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debug() {
  console.log('--- Debugging Inventory ---');

  // 1. Get all inventory items
  const { data: items, error: itemsError } = await supabase
    .from('inventory')
    .select('*');

  if (itemsError) {
    console.error('Error fetching inventory:', itemsError);
    return;
  }

  console.log(`Found ${items.length} items.`);

  for (const item of items) {
    console.log(`Item: ${item.name} (ID: ${item.id})`);
    console.log(`  Current Quantity: ${item.quantity}`);
    console.log(`  Coefficient: ${item.coefficient}`);

    // 2. Get purchase items for this item
    const { data: pItems, error: pError } = await supabase
        .from('purchase_items')
        .select('*, purchase:purchase_id(*)')
        .eq('item_id', item.id);
    
    if (pError) console.error('  Error fetching purchase items:', pError);
    else {
        console.log(`  Purchase Items: ${pItems.length}`);
        pItems.forEach(pi => {
            console.log(`    - ID: ${pi.id}, Qty: ${pi.quantity}, Pieces: ${pi.pieces}, Coeff: ${pi.coefficient}`);
        });
    }

    // 3. Get Stock History View
    const { data: history, error: hError } = await supabase
        .from('stock_movements_view')
        .select('*')
        .eq('item_id', item.id);

    if (hError) console.error('  Error fetching history:', hError);
    else {
        console.log(`  History Entries: ${history.length}`);
        history.forEach(h => {
             console.log(`    - Date: ${h.date}, Type: ${h.type}, Qty: ${h.quantity}`);
        });
    }

    // 4. Get Available Batches (View)
    const { data: batches, error: bError } = await supabase
        .from('purchase_batch_availability')
        .select('*')
        .eq('item_id', item.id);

    if (bError) console.error('  Error fetching batches:', bError);
    else {
        console.log(`  Available Batches: ${batches.length}`);
        batches.forEach(b => {
             console.log(`    - Ref: ${b.purchase_ref}, Original: ${b.original_quantity}, Remaining: ${b.remaining_quantity}`);
        });
    }
  }
}

debug();
