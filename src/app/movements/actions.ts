'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// Update interface to include ID
interface MovementLine {
  id?: string
  inventoryId: string
  quantity: number | string
  pieces?: number | string
  kgEccedenza?: number
  coefficient?: number
  price?: number
  purchaseItemId?: string
  isFictitious?: boolean
}

interface MovementData {
  type: 'entry' | 'exit' | 'sale' | 'waste'
  number: string
  date: string
  jobId?: string
  causal: string
  pickupLocation: string
  deliveryLocation: string
  transportMean?: string
  transportTime?: string
  appearance?: string
  packagesCount?: number
  notes?: string
}

export async function createMovement(data: MovementData, lines: MovementLine[]) {
  console.log('=== createMovement START ===')
  // ... (rest of createMovement remains exactly the same, no changes needed)
  console.log('Data:', JSON.stringify(data, null, 2))
  console.log('Lines count:', lines.length)

  let supabase;
  try {
    supabase = await createClient()
    console.log('Supabase client created')
  } catch (e: any) {
    console.error('Failed to create Supabase client:', e)
    throw new Error('Errore connessione database: ' + e.message)
  }

  // 0. Verify user is authenticated
  let user;
  try {
    const { data: authData, error: userError } = await supabase.auth.getUser()
    user = authData?.user

    if (userError || !user) {
      console.error('Auth error in createMovement:', userError)
      throw new Error('Non sei autenticato. Effettua il login e riprova.')
    }
    console.log('User authenticated:', user.id, user.email)
  } catch (e: any) {
    console.error('Auth check failed:', e)
    throw new Error('Errore verifica autenticazione: ' + e.message)
  }

  // 1. Create Note
  let noteData;
  try {
    console.log('Inserting delivery_note...')
    const insertData = {
      type: data.type,
      number: data.number,
      date: data.date,
      job_id: data.jobId || null,
      causal: data.causal,
      pickup_location: data.pickupLocation,
      delivery_location: data.deliveryLocation,
      transport_mean: data.transportMean || null,
      transport_time: data.transportTime || null,
      appearance: data.appearance || null,
      packages_count: data.packagesCount || null,
      notes: data.notes || null,
      created_by: user.id
    }
    console.log('Insert data:', JSON.stringify(insertData, null, 2))

    const { data: result, error: noteError } = await supabase
      .from('delivery_notes')
      .insert(insertData)
      .select()
      .single()

    if (noteError) {
      console.error('Error creating delivery note:', JSON.stringify(noteError))
      throw new Error(`Errore creazione bolla: ${noteError.message} (${noteError.code})`)
    }
    noteData = result
    console.log('Delivery note created:', noteData.id)
  } catch (e: any) {
    console.error('delivery_notes insert failed:', e)
    if (e instanceof Error) throw e;
    throw new Error('Errore sconosciuto durante creazione bolla: ' + JSON.stringify(e));
  }

  // 2. Create Items
  if (lines.length > 0) {
    try {
      console.log('Inserting', lines.length, 'items...')
      const itemsToInsert = lines.map(item => {
        const quantity = Number(item.quantity);
        if (isNaN(quantity)) throw new Error(`Quantità non valida per articolo ${item.inventoryId}`);

        return {
          delivery_note_id: noteData.id,
          inventory_id: item.inventoryId,
          quantity: quantity,
          pieces: item.pieces ? Number(item.pieces) : null,
          kg_eccedenza: item.kgEccedenza ?? null,
          coefficient: item.coefficient || 1,
          price: item.price || 0,
          purchase_item_id: item.purchaseItemId || null,
          is_fictitious: item.isFictitious || false
        };
      })
      console.log('Items to insert:', JSON.stringify(itemsToInsert, null, 2))

      const { error: itemsError } = await supabase
        .from('delivery_note_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error creating items:', JSON.stringify(itemsError))
        throw new Error(`Errore inserimento articoli: ${itemsError.message} (${itemsError.code})`)
      }
      console.log('Items created successfully')
    } catch (e: any) {
      console.error('delivery_note_items insert failed:', e)
      // If items fail, we might want to rollback the note? 
      // Ideally we should delete the note we just created to avoid orphans
      await supabase.from('delivery_notes').delete().eq('id', noteData.id);

      if (e instanceof Error) throw e;
      throw new Error('Errore sconosciuto durante inserimento articoli: ' + JSON.stringify(e));
    }
  }

  console.log('=== createMovement SUCCESS ===')

  // Revalidate cache (safe, wrapped)
  try {
    revalidatePath('/movements')
  } catch (e) {
    console.warn('Revalidate failed, but save successful:', e)
  }

  // Redirect MUST be called outside of try/catch because it throws NEXT_REDIRECT
  // which is expected behavior and should propagate to the client
  redirect('/movements')
}

export async function updateMovement(id: string, data: MovementData, lines: MovementLine[]): Promise<{ success: boolean; error?: string }> {
  console.log('=== updateMovement START ===')
  console.log('ID:', id)

  const supabase = await createClient()

  try {
    // 0. Verify user is authenticated
    const { data: authData, error: userError } = await supabase.auth.getUser()
    if (userError || !authData.user) {
      console.error('Auth error in updateMovement:', userError)
      return { success: false, error: 'Non sei autenticato. Effettua il login e riprova.' }
    }

    // 1. Update Note
    console.log('Updating delivery_note...')
    const updateData = {
      type: data.type,
      number: data.number,
      date: data.date,
      job_id: data.jobId || null,
      causal: data.causal,
      pickup_location: data.pickupLocation,
      delivery_location: data.deliveryLocation,
      transport_mean: data.transportMean,
      transport_time: data.transportTime,
      appearance: data.appearance,
      packages_count: data.packagesCount,
      notes: data.notes
    }

    const { error: noteError } = await supabase
      .from('delivery_notes')
      .update(updateData)
      .eq('id', id)

    if (noteError) {
      console.error('Error updating delivery note:', noteError)
      return { success: false, error: `Errore aggiornamento bolla: ${noteError.message}` }
    }

    // 2. Smart Item Update
    console.log('Fetching existing items...')
    const { data: existingItems, error: fetchError } = await supabase
      .from('delivery_note_items')
      .select('id, inventory_id, quantity')
      .eq('delivery_note_id', id)

    if (fetchError) {
      console.error('Error fetching existing items:', fetchError)
      return { success: false, error: `Errore lettura articoli esistenti: ${fetchError.message}` }
    }

    const newLines = lines || []

    // Identify Updates (lines with ID present in existing items)
    const toUpdate = newLines.filter(l => l.id && existingItems.some(e => e.id === l.id))

    // Identify Inserts (lines without ID)
    const toInsert = newLines.filter(l => !l.id)

    // Identify Deletes (existing items not present in new lines IDs)
    const newIds = new Set(newLines.map(l => l.id).filter(Boolean))
    const toDelete = existingItems.filter(e => !newIds.has(e.id))

    console.log(`Plan: Update ${toUpdate.length}, Insert ${toInsert.length}, Delete ${toDelete.length}`)

    // Execute Updates FIRST (safest for updates, might reduce qty)
    // Actually, update order vs delete order depends on stock.
    // If we update a line to reduce quantity (e.g. 100 -> 90), it frees up "stock" logic in some contexts or consumes less?
    // For Entry: 100 -> 90. Diff is -10. Req: current_stock >= 10.
    // If we Delete 100. Req: current_stock >= 100.
    // So Update is safer than Delete+Insert.

    if (toUpdate.length > 0) {
      console.log('Executing updates...')
      for (const item of toUpdate) {
        const quantity = Number(item.quantity)
        if (isNaN(quantity)) return { success: false, error: `Quantità non valida per articolo ${item.inventoryId}` }

        const { error: updateError } = await supabase
          .from('delivery_note_items')
          .update({
            inventory_id: item.inventoryId,
            quantity: quantity,
            pieces: item.pieces ? Number(item.pieces) : null,
            kg_eccedenza: item.kgEccedenza ?? null,
            coefficient: item.coefficient,
            price: item.price,
            purchase_item_id: item.purchaseItemId || null,
            is_fictitious: item.isFictitious || false
          })
          .eq('id', item.id!) // We know it has ID

        if (updateError) {
          console.error('Error updating item:', updateError)
          return { success: false, error: `Errore aggiornamento riga: ${updateError.message}` }
        }
      }
    }

    // Execute Inserts
    if (toInsert.length > 0) {
      console.log('Executing inserts...')
      const itemsToInsert = toInsert.map(item => {
        const quantity = Number(item.quantity)
        if (isNaN(quantity)) throw new Error(`Quantità non valida per articolo ${item.inventoryId}`)

        return {
          delivery_note_id: id,
          inventory_id: item.inventoryId,
          quantity: quantity,
          pieces: item.pieces ? Number(item.pieces) : null,
          kg_eccedenza: item.kgEccedenza ?? null,
          coefficient: item.coefficient,
          price: item.price,
          purchase_item_id: item.purchaseItemId || null,
          is_fictitious: item.isFictitious || false
        }
      })

      const { error: insertError } = await supabase
        .from('delivery_note_items')
        .insert(itemsToInsert)

      if (insertError) {
        console.error('Error inserting items:', insertError)
        return { success: false, error: `Errore inserimento nuove righe: ${insertError.message}` }
      }
    }

    // Execute Deletes LAST (most risky for constraints)
    if (toDelete.length > 0) {
      console.log('Executing deletes...')
      const idsToDelete = toDelete.map(i => i.id)
      const { error: deleteError } = await supabase
        .from('delivery_note_items')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) {
        console.error('Error deleting items:', deleteError)
        return { success: false, error: `Errore eliminazione righe: ${deleteError.message}` }
      }
    }

    console.log('=== updateMovement SUCCESS ===')

    // Enable Revalidation now that we handle updates safely?
    // Let's try to enable it, assuming logic was the issue not the revalidate itself.
    // Or we keep it disabled for this specific test step if user wants to be sure.
    // User said "Se funziona...". Let's try enabling it because it's better UX.
    try {
      revalidatePath('/movements')
      revalidatePath(`/movements/${id}`)
    } catch (e) {
      console.warn('Revalidate failed:', e)
    }

    return { success: true }

  } catch (e: any) {
    console.error('updateMovement FAILED:', e)
    return { success: false, error: 'Errore sconosciuto durante aggiornamento bolla: ' + (e.message || JSON.stringify(e)) }
  }
}
