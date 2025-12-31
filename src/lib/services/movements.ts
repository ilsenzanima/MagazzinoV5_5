import { supabase } from '@/lib/supabase';
import { Movement } from '@/lib/types';
import { fetchWithTimeout } from './utils';

export const mapDbToMovement = (db: any): Movement => ({
    id: db.id,
    itemId: db.item_id,
    itemModel: db.item_model,
    userId: db.user_id,
    userName: db.profiles?.full_name || 'Utente',
    type: db.type,
    quantity: db.quantity,
    reference: db.reference,
    notes: db.notes,
    date: db.created_at,
    jobId: db.job_id,
    jobCode: db.jobs?.code,
    jobDescription: db.jobs?.description
});

const mapMovementToDb = (movement: Partial<Movement>) => ({
    item_id: movement.itemId,
    user_id: movement.userId,
    type: movement.type,
    quantity: movement.quantity,
    reference: movement.reference,
    notes: movement.notes,
    job_id: movement.jobId
});

export const movementsApi = {
    getByItemId: async (itemId: string) => {
        // Join with profiles to get user name and jobs to get job info
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('movements')
                .select(`
          *,
          profiles:user_id(full_name),
          jobs:job_id(code, description)
        `)
                .eq('item_id', itemId)
                .order('created_at', { ascending: false })
        );

        if (error) throw error;
        return data.map(mapDbToMovement);
    },

    getByJobId: async (jobId: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('stock_movements_view')
                .select('*')
                .eq('job_id', jobId)
                .order('date', { ascending: false })
        );

        if (error) throw error;

        return data.map((db: any) => ({
            id: db.id,
            itemId: db.item_id,
            userId: db.user_id,
            userName: db.user_name,
            type: db.type,
            quantity: db.quantity,
            reference: db.reference,
            notes: db.notes,
            date: db.date,
            jobId: db.job_id,
            itemName: db.item_name,
            itemModel: db.item_model,
            itemCode: db.item_code,
            itemUnit: db.item_unit,
            itemPrice: db.item_price || 0,
            isFictitious: db.is_fictitious,
            supplierName: db.supplier_name,
            purchaseDate: db.purchase_date,
            purchaseNumber: db.purchase_number,
            purchaseId: db.purchase_id,
            deliveryNoteId: db.delivery_note_id
        }));
    },

    create: async (movement: Partial<Movement>) => {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Utente non autenticato");

        // 2. Prepare movement data
        const dbMovement = mapMovementToDb({
            ...movement,
            userId: user.id
        });

        // 3. Insert movement
        const { data, error } = await supabase
            .from('movements')
            .insert(dbMovement)
            .select()
            .single();

        if (error) throw error;
        return mapDbToMovement(data);
    }
};
