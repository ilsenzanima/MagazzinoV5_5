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
  const supabase = await createClient()
  
  // 1. Create Note
  const { data: noteData, error: noteError } = await supabase
    .from('delivery_notes')
    .insert({
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
    })
    .select()
    .single()

  if (noteError) {
    console.error('Error creating delivery note:', noteError)
    throw new Error(noteError.message)
  }

  // 2. Create Items
  if (lines.length > 0) {
    const itemsToInsert = lines.map(item => ({
      delivery_note_id: noteData.id,
      inventory_id: item.inventoryId,
      quantity: Number(item.quantity),
      pieces: item.pieces ? Number(item.pieces) : null,
      coefficient: item.coefficient,
      price: item.price,
      purchase_item_id: item.purchaseItemId || null,
      is_fictitious: item.isFictitious || false
    }))

    const { error: itemsError } = await supabase
      .from('delivery_note_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error creating items:', itemsError)
      // Optional: Delete the note if items fail? 
      // For now, throw error.
      throw new Error(itemsError.message)
    }
  }

  revalidatePath('/movements')
  redirect('/movements')
}

export async function updateMovement(id: string, data: MovementData, lines: MovementLine[]) {
  const supabase = await createClient()

  // 1. Update Note
  const { error: noteError } = await supabase
    .from('delivery_notes')
    .update({
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
    })
    .eq('id', id)

  if (noteError) {
    console.error('Error updating delivery note:', noteError)
    throw new Error(noteError.message)
  }

  // 2. Update Items (Delete all and recreate)
  // Delete existing
  const { error: deleteError } = await supabase
    .from('delivery_note_items')
    .delete()
    .eq('delivery_note_id', id)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  // Insert new
  if (lines.length > 0) {
    const itemsToInsert = lines.map(item => ({
      delivery_note_id: id,
      inventory_id: item.inventoryId,
      quantity: Number(item.quantity),
      pieces: item.pieces ? Number(item.pieces) : null,
      coefficient: item.coefficient,
      price: item.price,
      purchase_item_id: item.purchaseItemId || null,
      is_fictitious: item.isFictitious || false
    }))

    const { error: itemsError } = await supabase
      .from('delivery_note_items')
      .insert(itemsToInsert)

    if (itemsError) {
      throw new Error(itemsError.message)
    }
  }

  revalidatePath('/movements')
  revalidatePath(`/movements/${id}`)
  redirect('/movements')
}
