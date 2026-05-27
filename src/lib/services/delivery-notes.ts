import { supabase } from '@/lib/supabase';
import { DeliveryNote, DeliveryNoteItem } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToDeliveryNote = (db: any): DeliveryNote => ({
    id: db.id,
    type: db.type,
    number: db.number,
    date: db.date,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    jobName: db.jobs?.job_name,
    jobClientName: db.jobs?.clients?.name,
    jobDescription: db.jobs?.description,
    jobAddress: db.jobs?.site_address,
    causal: db.causal,
    pickupLocation: db.pickup_location,
    deliveryLocation: db.delivery_location,
    transportMean: db.transport_mean,
    transportTime: db.transport_time,
    appearance: db.appearance,
    packagesCount: db.packages_count,
    notes: db.notes,
    created_at: db.created_at,
    items: db.delivery_note_items?.map((i: any) => ({
        ...i,
        inventoryId: i.inventory_id,
        purchaseItemId: i.purchase_item_id,
        isFictitious: i.is_fictitious,
        inventoryName: i.inventory?.name,
        inventoryModel: i.inventory?.model,
        inventoryCode: i.inventory?.code,
        inventoryUnit: i.inventory?.unit,
        inventoryBrand: i.inventory?.brand,
        inventoryCategory: i.inventory?.category,
        inventoryDescription: i.inventory?.description,
        price: i.price || i.purchase_items?.price || i.inventory?.price || 0,
        purchaseId: i.purchase_items?.purchases?.id,
        purchaseNumber: i.purchase_items?.purchases?.delivery_note_number,
        purchaseDate: i.purchase_items?.purchases?.delivery_note_date,
        purchaseSupplier: i.purchase_items?.purchases?.suppliers?.name,
        kgEccedenza: i.kg_eccedenza ?? undefined,
    }))
});

const mapDeliveryNoteToDb = (note: Partial<DeliveryNote>) => {
    const dbNote: any = {};

    // Only include fields that are explicitly passed (not undefined)
    if (note.type !== undefined) dbNote.type = note.type;
    if (note.number !== undefined) dbNote.number = note.number;
    if (note.date !== undefined) dbNote.date = note.date;
    if (note.causal !== undefined) dbNote.causal = note.causal;
    if (note.pickupLocation !== undefined) dbNote.pickup_location = note.pickupLocation;
    if (note.deliveryLocation !== undefined) dbNote.delivery_location = note.deliveryLocation;
    if (note.transportMean !== undefined) dbNote.transport_mean = note.transportMean;
    if (note.transportTime !== undefined) dbNote.transport_time = note.transportTime;
    if (note.appearance !== undefined) dbNote.appearance = note.appearance;
    if (note.packagesCount !== undefined) dbNote.packages_count = note.packagesCount;
    if (note.notes !== undefined) dbNote.notes = note.notes;

    // CRITICAL: Only update job_id when explicitly passed
    if ('jobId' in note) {
        dbNote.job_id = note.jobId || null;
    }

    return dbNote;
};

export const deliveryNotesApi = {
    getAll: async () => {
        console.time('deliveryNotesApi.getAll');
        try {
            const { data, error } = await fetchWithTimeout<any>(
                supabase
                    .from('delivery_notes')
                    .select('*, jobs(code, description, site_address, job_name:name, client_id, clients(id, name)), delivery_note_items(quantity)')
                    .order('date', { ascending: false })
                    .order('number_int', { ascending: false })
            );

            if (error) {
                console.warn("Delivery notes table not found, returning empty");
                return [];
            }

            return data.map((d: any) => ({
                ...mapDbToDeliveryNote(d),
                itemCount: d.delivery_note_items?.length || 0,
                totalQuantity: d.delivery_note_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
            }));
        } finally {
            console.timeEnd('deliveryNotesApi.getAll');
        }
    },

    getPaginated: async ({ page = 1, limit = 10, search = '', dateFrom = '', dateTo = '' }) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('delivery_notes')
            .select('*, jobs(code, description, job_name:name, client_id, clients(id, name)), delivery_note_items(quantity)', { count: 'estimated' });

        if (dateFrom) {
            query = query.gte('date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('date', dateTo);
        }

        if (search) {
            // Split search into words for fuzzy matching
            const words = search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);

            // Find matching jobs (skip words with '/' to avoid PostgREST filter parsing issues)
            let jobIds: string[] = [];
            for (const word of words) {
                if (word.includes('/')) continue;
                const { data: jobs } = await supabase
                    .from('jobs')
                    .select('id')
                    .or(`code.ilike."%${word}%",description.ilike."%${word}%"`);
                if (jobs) {
                    jobIds = [...new Set([...jobIds, ...jobs.map(j => j.id)])];
                }
            }

            // For each word, apply OR conditions (chained = AND between words)
            for (const word of words) {
                // Words containing '/' are bolla numbers — use direct ilike to avoid
                // PostgREST raw filter string issues with the '/' character
                if (word.includes('/')) {
                    query = query.ilike('number', `%${word}%`);
                    continue;
                }

                const orConditions: string[] = [
                    `number.ilike."%${word}%"`,
                    `causal.ilike."%${word}%"`,
                ];
                if (jobIds.length > 0) {
                    orConditions.push(`job_id.in.(${jobIds.join(',')})`);
                }
                query = query.or(orConditions.join(','));
            }
        }

        query = query
            .order('date', { ascending: false })
            .order('number_int', { ascending: false })
            .range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);

        if (error) throw error;

        return {
            data: data.map((d: any) => ({
                ...mapDbToDeliveryNote(d),
                itemCount: d.delivery_note_items?.length || 0,
                totalQuantity: d.delivery_note_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
            })),
            total: count || 0
        };
    },

    getById: async (id: string) => {
        const { data, error } = await supabase
            .from('delivery_notes')
            .select(`
        *,
        jobs(code, description, site_address, job_name:name, client_id, clients(id, name)),
        delivery_note_items(
          *,
          inventory(name, code, unit, brand, category, description, price, model),
          purchase_items(
            price,
            purchases(id, delivery_note_number, delivery_note_date, suppliers(name))
          )
        )
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return mapDbToDeliveryNote(data);
    },

    create: async (note: Omit<DeliveryNote, 'id' | 'created_at' | 'items'>, items: Omit<DeliveryNoteItem, 'id' | 'deliveryNoteId'>[]) => {
        console.time('deliveryNotesApi.create');
        try {
            console.time('insert_note');
            const { data: noteData, error: noteError } = await supabase
                .from('delivery_notes')
                .insert(mapDeliveryNoteToDb(note))
                .select()
                .single();
            console.timeEnd('insert_note');

            if (noteError) {
                console.error("Error creating delivery note:", noteError);
                throw noteError;
            }

            if (items.length > 0) {
                console.time('insert_items');
                const itemsToInsert = items.map(item => ({
                    delivery_note_id: noteData.id,
                    inventory_id: item.inventoryId,
                    quantity: item.quantity,
                    pieces: item.pieces,
                    kg_eccedenza: item.kgEccedenza ?? null,
                    coefficient: item.coefficient,
                    price: item.price,
                    purchase_item_id: item.purchaseItemId || null,
                    is_fictitious: item.isFictitious || false
                }));

                const { error: itemsError } = await supabase
                    .from('delivery_note_items')
                    .insert(itemsToInsert);
                console.timeEnd('insert_items');

                if (itemsError) throw itemsError;
            }

            return mapDbToDeliveryNote(noteData);
        } finally {
            console.timeEnd('deliveryNotesApi.create');
        }
    },

    update: async (id: string, note: Partial<DeliveryNote>, items?: Omit<DeliveryNoteItem, 'id' | 'deliveryNoteId'>[]) => {
        const { error: noteError } = await supabase
            .from('delivery_notes')
            .update(mapDeliveryNoteToDb(note))
            .eq('id', id);

        if (noteError) throw noteError;

        if (items) {
            await supabase.from('delivery_note_items').delete().eq('delivery_note_id', id);

            const itemsToInsert = items.map(item => ({
                delivery_note_id: id,
                inventory_id: item.inventoryId,
                quantity: item.quantity,
                pieces: item.pieces,
                kg_eccedenza: item.kgEccedenza ?? null,
                coefficient: item.coefficient,
                price: item.price,
                purchase_item_id: item.purchaseItemId || null,
                is_fictitious: item.isFictitious || false
            }));

            const { error: itemsError } = await supabase
                .from('delivery_note_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }
    },

    delete: async (id: string) => {
        const { error } = await supabase
            .from('delivery_notes')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    getWasteByJobId: async (jobId: string) => {
        const { data, error } = await supabase
            .from('delivery_notes')
            .select(`
                *,
                delivery_note_items(
                    id,
                    quantity,
                    pieces,
                    kg_eccedenza,
                    coefficient,
                    is_fictitious,
                    inventory:inventory_id(id, name, model, code, unit, brand, category)
                )
            `)
            .eq('job_id', jobId)
            .eq('type', 'waste')
            .order('date', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapDbToDeliveryNote);
    },

    getByJobAndType: async (jobId: string, type: string, excludeId: string): Promise<{ id: string; number: string; date: string }[]> => {
        const { data, error } = await supabase
            .from('delivery_notes')
            .select('id, number, date')
            .eq('job_id', jobId)
            .eq('type', type)
            .neq('id', excludeId)
            .order('date', { ascending: false })
            .order('number_int', { ascending: false });

        if (error) throw error;
        return (data || []).map((d: any) => ({ id: d.id, number: d.number, date: d.date }));
    },

    updateLocationBatch: async (jobIds: string[], newAddress: string, newClientName?: string) => {
        // If we have a new client name, we need to update each note individually
        // because we need to replace the client name pattern in the existing delivery_location
        if (newClientName) {
            // First, fetch all notes to update
            const { data: notes, error: fetchError } = await supabase
                .from('delivery_notes')
                .select('id, delivery_location')
                .in('job_id', jobIds);

            if (fetchError) throw fetchError;
            if (!notes || notes.length === 0) return 0;

            // Update each note with the new client name and address
            const updatePromises = notes.map(note => {
                let currentLocation = note.delivery_location || '';

                // Replace the client name line (CLIENTE: old name - address)
                // Pattern: CLIENTE: ... followed by newline or end of string
                const clientLinePattern = /^CLIENTE:.*?(?:\n|$)/i;

                // Build the new client line
                let newClientLine = `CLIENTE: ${newClientName}`;
                if (newAddress) {
                    newClientLine += ` - ${newAddress}`;
                }
                newClientLine += '\n';

                // Check if there's an existing client line to replace
                if (clientLinePattern.test(currentLocation)) {
                    currentLocation = currentLocation.replace(clientLinePattern, newClientLine);
                } else {
                    // No existing client line, prepend the new one
                    currentLocation = newClientLine + currentLocation;
                }

                // Also update the DESTINAZIONE line address if present
                const destLinePattern = /(DESTINAZIONE:\s*)([^\n]*)/i;
                if (destLinePattern.test(currentLocation) && newAddress) {
                    // Only update if it's not "Stessa"
                    currentLocation = currentLocation.replace(destLinePattern, (match: string, prefix: string, addr: string) => {
                        if (addr.toLowerCase().trim() === 'stessa') {
                            return match; // Keep as is
                        }
                        return `${prefix}${newAddress}`;
                    });
                }

                return supabase
                    .from('delivery_notes')
                    .update({ delivery_location: currentLocation.trim() })
                    .eq('id', note.id);
            });

            await Promise.all(updatePromises);
            return notes.length;
        } else {
            // Simple batch update for address only (original behavior)
            const { error, count } = await supabase
                .from('delivery_notes')
                .update({ delivery_location: newAddress }, { count: 'exact' })
                .in('job_id', jobIds);

            if (error) throw error;
            return count;
        }
    }
};
