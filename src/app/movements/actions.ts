'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface MovementLine {
  inventoryId: string
  quantity: number | string
  pieces?: number | string
  coefficient?: number
  price?: number
  purchaseItemId?: string
  isFictitious?: boolean
}

interface MovementData {
  type: 'entry' | 'exit' | 'sale'
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
  console.log('Data:', JSON.stringify(data, null, 2))
  console.log('Lines count:', lines.length)

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

    // 2. Update Items (Delete all and recreate)
    console.log('Deleting existing items...')
    const { error: deleteError } = await supabase
      .from('delivery_note_items')
      .delete()
      .eq('delivery_note_id', id)

    if (deleteError) {
      console.error('Error deleting items:', deleteError)
      return { success: false, error: `Errore eliminazione vecchi articoli: ${deleteError.message}` }
    }

    // Insert new
    if (lines.length > 0) {
      console.log('Inserting new items...')
      const itemsToInsert = lines.map(item => {
        const quantity = Number(item.quantity)
        if (isNaN(quantity)) return { success: false, error: `Quantità non valida per articolo ${item.inventoryId}` }

        return {
          delivery_note_id: id,
          inventory_id: item.inventoryId,
          quantity: quantity,
          pieces: item.pieces ? Number(item.pieces) : null,
          coefficient: item.coefficient,
          price: item.price,
          purchase_item_id: item.purchaseItemId || null,
          is_fictitious: item.isFictitious || false
        }
      })

      const { error: itemsError } = await supabase
        .from('delivery_note_items')
        .insert(itemsToInsert)

      if (itemsError) {
        console.error('Error inserting items:', itemsError)
        return { success: false, error: `Errore inserimento nuovi articoli: ${itemsError.message}` }
      }
    }

    console.log('=== updateMovement SUCCESS ===')

    // Disable revalidation temporarily to debug
    // try {
    //   revalidatePath('/movements')
    //   // FIXME: This revalidatePath might be causing the issue if the page render fails
    //   // revalidatePath(`/movements/${id}`) 
    // } catch (e) {
    //   console.warn('Revalidate failed:', e)
    // }

    return { success: true }

  } catch (e: any) {
    console.error('updateMovement FAILED:', e)
    return { success: false, error: 'Errore sconosciuto durante aggiornamento bolla: ' + (e.message || JSON.stringify(e)) }
  }
}
