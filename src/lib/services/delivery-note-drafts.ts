import { supabase } from '@/lib/supabase';
import { DeliveryNote, DeliveryNoteItem } from '@/lib/types';

// Riga di una bozza: istantanea di quanto mostrato nel form (nessun legame col magazzino)
export interface DraftItem {
    inventoryId: string;
    inventoryName?: string;
    inventoryCode?: string;
    inventoryUnit?: string;
    inventoryBrand?: string;
    inventoryCategory?: string;
    inventoryDescription?: string;
    quantity: number;
    pieces?: number;
    kgEccedenza?: number;
    coefficient?: number;
    purchaseItemId?: string;
    purchaseNumber?: string;
    isFictitious?: boolean;
}

export type DraftInput = Omit<DeliveryNote, 'id' | 'items' | 'isDraft'> & { items: DraftItem[] };

const SELECT = '*, jobs(code, description, site_address, job_name:name, client_id, clients(id, name))';

export const mapDbToDraft = (d: any): DeliveryNote => {
    const items: DraftItem[] = d.items ?? [];
    return {
        id: d.id,
        type: d.type,
        number: d.number,
        date: d.date,
        jobId: d.job_id ?? undefined,
        jobCode: d.jobs?.code,
        jobName: d.jobs?.job_name,
        jobClientName: d.jobs?.clients?.name,
        jobDescription: d.jobs?.description,
        jobAddress: d.jobs?.site_address,
        causal: d.causal ?? '',
        pickupLocation: d.pickup_location ?? '',
        deliveryLocation: d.delivery_location ?? '',
        fromWarehouseId: d.from_warehouse_id ?? undefined,
        toWarehouseId: d.to_warehouse_id ?? undefined,
        transportMean: d.transport_mean ?? undefined,
        transportTime: d.transport_time ?? undefined,
        appearance: d.appearance ?? undefined,
        packagesCount: d.packages_count ?? undefined,
        notes: d.notes ?? undefined,
        created_at: d.created_at,
        isDraft: true,
        items: items.map((i, idx) => ({ ...i, id: `${d.id}-${idx}`, deliveryNoteId: d.id } as DeliveryNoteItem)),
        itemCount: items.length,
        totalQuantity: items.reduce((s, i) => s + (i.quantity || 0), 0),
        itemNames: items.map((i) => i.inventoryName).filter(Boolean) as string[],
    };
};

const toDb = (n: DraftInput) => ({
    type: n.type,
    number: n.number,
    date: n.date,
    job_id: n.jobId || null,
    causal: n.causal || null,
    pickup_location: n.pickupLocation || null,
    delivery_location: n.deliveryLocation || null,
    from_warehouse_id: n.fromWarehouseId || null,
    to_warehouse_id: n.toWarehouseId || null,
    transport_mean: n.transportMean || null,
    transport_time: n.transportTime || null,
    appearance: n.appearance || null,
    packages_count: n.packagesCount ?? null,
    notes: n.notes || null,
    items: n.items,
    updated_at: new Date().toISOString(),
});

export const deliveryNoteDraftsApi = {
    getAll: async (): Promise<DeliveryNote[]> => {
        const { data, error } = await supabase.from('delivery_note_drafts').select(SELECT);
        if (error) throw error;
        return (data ?? []).map(mapDbToDraft);
    },

    save: async (input: DraftInput, id?: string): Promise<string> => {
        if (id) {
            const { error } = await supabase.from('delivery_note_drafts').update(toDb(input)).eq('id', id);
            if (error) throw error;
            return id;
        }
        const { data: auth } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('delivery_note_drafts')
            .insert({ ...toDb(input), created_by: auth.user?.id ?? null })
            .select('id')
            .single();
        if (error) throw error;
        return data.id;
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('delivery_note_drafts').delete().eq('id', id);
        if (error) throw error;
    },
};
