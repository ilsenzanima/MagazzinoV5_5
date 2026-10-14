import { supabase } from '@/lib/supabase';
import type { AuditLot } from '@/lib/utils/purchase-price-audit';

const PAGE_SIZE = 1000;

// Righe di acquisti veri (non ordini, non cancellati) con autore e fornitore, per il controllo prezzi.
export const purchaseAuditApi = {
    getLots: async (): Promise<AuditLot[]> => {
        const lots: AuditLot[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
            const { data, error } = await supabase
                .from('purchase_items')
                .select(
                    'id, item_id, purchase_id, price, inventory(name, unit), ' +
                    'purchases!inner(delivery_note_number, delivery_note_date, created_at, created_by, order_type, deleted_at, suppliers(name), profiles(full_name))'
                )
                .eq('purchases.order_type', 'purchase')
                .is('purchases.deleted_at', null)
                .not('item_id', 'is', null)
                .order('id', { ascending: true })
                .range(from, from + PAGE_SIZE - 1);
            if (error) throw error;

            for (const row of (data ?? []) as any[]) {
                const pu = Array.isArray(row.purchases) ? row.purchases[0] : row.purchases;
                if (!pu) continue;
                const inv = Array.isArray(row.inventory) ? row.inventory[0] : row.inventory;
                const sup = Array.isArray(pu.suppliers) ? pu.suppliers[0] : pu.suppliers;
                const prof = Array.isArray(pu.profiles) ? pu.profiles[0] : pu.profiles;
                lots.push({
                    purchaseId: row.purchase_id,
                    itemId: row.item_id,
                    itemName: inv?.name ?? 'Articolo senza nome',
                    itemUnit: inv?.unit ?? null,
                    price: Number(row.price),
                    date: (pu.delivery_note_date || pu.created_at || '').slice(0, 10) || null,
                    deliveryNoteNumber: pu.delivery_note_number ?? null,
                    supplierName: sup?.name ?? null,
                    createdBy: pu.created_by ?? null,
                    createdByName: prof?.full_name ?? null,
                });
            }
            if (!data || data.length < PAGE_SIZE) break;
        }
        return lots;
    },
};
