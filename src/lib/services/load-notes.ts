import { supabase } from "@/lib/supabase";
import { LoadNote, LoadNoteItem } from "@/lib/types";

export interface LoadNoteInput {
    date: string;
    noteType: 'uscita' | 'reso';
    jobId?: string;
    notes?: string;
    items: {
        inventoryId: string;
        pieces?: number;
        quantity: number;
    }[];
}

export const loadNotesService = {
    getAll: async (filters?: { search?: string; status?: string; jobId?: string }): Promise<LoadNote[]> => {
        let query = supabase
            .from('load_notes_with_details')
            .select('*')
            .order('status', { ascending: true }) // pending first
            .order('date', { ascending: false });

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        if (filters?.jobId) {
            query = query.eq('job_id', filters.jobId);
        }

        if (filters?.search) {
            query = query.or(`job_code.ilike.%${filters.search}%,job_description.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
        }

        const { data: notes, error } = await query;

        if (error) {
            console.error('Error fetching load notes:', error);
            throw error;
        }

        // Now fetch items for each note
        const notesWithItems = await Promise.all(
            (notes || []).map(async (note) => {
                const { data: items, error: itemsError } = await supabase
                    .from('load_note_items')
                    .select(`
                        id,
                        inventory_id,
                        pieces,
                        quantity,
                        is_checked,
                        inventory:inventory_id (
                            code,
                            name,
                            unit,
                            brand,
                            model
                        )
                    `)
                    .eq('load_note_id', note.id);

                if (itemsError) {
                    console.error('Error fetching items for note', note.id, itemsError);
                }

                const mappedItems: LoadNoteItem[] = (items || []).map((item: any) => ({
                    id: item.id,
                    inventoryId: item.inventory_id,
                    inventoryCode: item.inventory?.code || '',
                    inventoryName: item.inventory?.name || '',
                    inventoryUnit: item.inventory?.unit || '',
                    inventoryBrand: item.inventory?.brand || '',
                    inventoryModel: item.inventory?.model || '',
                    pieces: item.pieces,
                    quantity: item.quantity,
                    isChecked: item.is_checked
                }));

                return {
                    id: note.id,
                    date: note.date,
                    noteType: note.note_type,
                    jobId: note.job_id,
                    jobCode: note.job_code,
                    jobDescription: note.job_description,
                    notes: note.notes,
                    status: note.status,
                    items: mappedItems,
                    createdBy: note.created_by,
                    createdByName: note.created_by_name,
                    createdAt: note.created_at
                } as LoadNote;
            })
        );

        return notesWithItems;
    },

    getById: async (id: string): Promise<LoadNote | null> => {
        const { data: note, error } = await supabase
            .from('load_notes_with_details')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            console.error('Error fetching load note:', error);
            throw error;
        }

        // Fetch items
        const { data: items, error: itemsError } = await supabase
            .from('load_note_items')
            .select(`
                id,
                inventory_id,
                pieces,
                quantity,
                is_checked,
                inventory:inventory_id (
                    code,
                    name,
                    unit,
                    brand,
                    model
                )
            `)
            .eq('load_note_id', id);

        if (itemsError) {
            console.error('Error fetching items:', itemsError);
        }

        const mappedItems: LoadNoteItem[] = (items || []).map((item: any) => ({
            id: item.id,
            inventoryId: item.inventory_id,
            inventoryCode: item.inventory?.code || '',
            inventoryName: item.inventory?.name || '',
            inventoryUnit: item.inventory?.unit || '',
            inventoryBrand: item.inventory?.brand || '',
            inventoryModel: item.inventory?.model || '',
            pieces: item.pieces,
            quantity: item.quantity,
            isChecked: item.is_checked
        }));

        return {
            id: note.id,
            date: note.date,
            noteType: note.note_type,
            jobId: note.job_id,
            jobCode: note.job_code,
            jobDescription: note.job_description,
            notes: note.notes,
            status: note.status,
            items: mappedItems,
            createdBy: note.created_by,
            createdByName: note.created_by_name,
            createdAt: note.created_at
        } as LoadNote;
    },

    create: async (input: LoadNoteInput): Promise<LoadNote> => {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        // Create the note
        const { data: note, error } = await supabase
            .from('load_notes')
            .insert({
                date: input.date,
                note_type: input.noteType,
                job_id: input.jobId || null,
                notes: input.notes || null,
                created_by: userId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating load note:', error);
            throw error;
        }

        // Create items
        if (input.items.length > 0) {
            const itemsToInsert = input.items.map(item => ({
                load_note_id: note.id,
                inventory_id: item.inventoryId,
                pieces: item.pieces || null,
                quantity: item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('load_note_items')
                .insert(itemsToInsert);

            if (itemsError) {
                console.error('Error creating items:', itemsError);
                // Rollback note creation
                await supabase.from('load_notes').delete().eq('id', note.id);
                throw itemsError;
            }
        }

        // Return full note
        const fullNote = await loadNotesService.getById(note.id);
        return fullNote!;
    },

    update: async (id: string, input: Partial<LoadNoteInput>): Promise<LoadNote> => {
        const updates: any = {};
        if (input.date !== undefined) updates.date = input.date;
        if (input.noteType !== undefined) updates.note_type = input.noteType;
        if (input.jobId !== undefined) updates.job_id = input.jobId || null;
        if (input.notes !== undefined) updates.notes = input.notes || null;

        const { error } = await supabase
            .from('load_notes')
            .update(updates)
            .eq('id', id);

        if (error) {
            console.error('Error updating load note:', error);
            throw error;
        }

        // Update items if provided
        if (input.items !== undefined) {
            // Delete existing items
            await supabase.from('load_note_items').delete().eq('load_note_id', id);

            // Insert new items
            if (input.items.length > 0) {
                const itemsToInsert = input.items.map(item => ({
                    load_note_id: id,
                    inventory_id: item.inventoryId,
                    pieces: item.pieces || null,
                    quantity: item.quantity
                }));

                const { error: itemsError } = await supabase
                    .from('load_note_items')
                    .insert(itemsToInsert);

                if (itemsError) {
                    console.error('Error updating items:', itemsError);
                    throw itemsError;
                }
            }
        }

        const fullNote = await loadNotesService.getById(id);
        return fullNote!;
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('load_notes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting load note:', error);
            throw error;
        }
    },

    toggleStatus: async (id: string, currentStatus: string): Promise<LoadNote> => {
        const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';

        const { error } = await supabase
            .from('load_notes')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) {
            console.error('Error toggling status:', error);
            throw error;
        }

        const fullNote = await loadNotesService.getById(id);
        return fullNote!;
    },

    toggleItemCheck: async (noteId: string, itemId: string, isChecked: boolean): Promise<void> => {
        const { error } = await supabase
            .from('load_note_items')
            .update({ is_checked: isChecked })
            .eq('id', itemId);

        if (error) {
            console.error('Error toggling item check:', error);
            throw error;
        }
    }
};
