import { supabase } from '@/lib/supabase';
import { Client } from '@/lib/types';
import { fetchWithTimeout, getSoftDeletePayload } from './utils';
import { clientMatchReason, ClientMatchReason, normalizeCompanyName, vatDigits } from '@/lib/utils/client-match';

export interface ClientDuplicate {
    id: string; name: string; vatNumber: string; city: string; reason: ClientMatchReason;
}

const mapDbToClient = (db: any): Client => {
    return {
        id: db.id,
        name: db.name,
        vatNumber: db.vat_number,
        street: db.street || db.address || '',
        streetNumber: db.street_number || '',
        postalCode: db.postal_code || '',
        city: db.city || '',
        province: db.province || '',
        address: db.address,
        email: db.email,
        phone: db.phone,
        notes: db.notes || '',
        createdAt: db.created_at
    };
};

const mapClientToDb = (client: Partial<Client>) => ({
    name: client.name,
    vat_number: client.vatNumber,
    street: client.street,
    street_number: client.streetNumber,
    postal_code: client.postalCode,
    city: client.city,
    province: client.province,
    // Also populate address for backward compatibility if needed
    address: client.address || `${client.street || ''} ${client.streetNumber || ''}, ${client.postalCode || ''} ${client.city || ''} ${client.province ? '(' + client.province + ')' : ''}`.trim().replace(/^,/, '').trim(),
    email: client.email,
    phone: client.phone,
    notes: (client as any).notes ?? undefined,
});

export const clientsApi = {
    // Committenti già presenti con la stessa partita IVA o una ragione sociale uguale/simile (non eliminati)
    findDuplicates: async (name: string, vatNumber?: string): Promise<ClientDuplicate[]> => {
        const normalized = normalizeCompanyName(name);
        const vat = vatDigits(vatNumber);
        const queries: PromiseLike<any>[] = [];
        if (normalized.length >= 3) {
            const firstToken = normalized.split(' ')[0].replace(/[%_,()]/g, '');
            if (firstToken.length >= 3) {
                queries.push(supabase.from('clients').select('id, name, vat_number, city').is('deleted_at', null)
                    .ilike('name', `%${firstToken}%`).limit(50));
            }
        }
        if (vat.length >= 8) {
            queries.push(supabase.from('clients').select('id, name, vat_number, city').is('deleted_at', null)
                .ilike('vat_number', `%${vat}%`).limit(20));
        }
        if (queries.length === 0) return [];
        const results = await Promise.all(queries);
        const rows = new Map<string, any>();
        for (const r of results) {
            if (r.error) throw r.error;
            for (const row of r.data ?? []) rows.set(row.id, row);
        }
        const out: ClientDuplicate[] = [];
        rows.forEach(row => {
            const reason = clientMatchReason({ name: row.name, vatNumber: row.vat_number }, { name, vatNumber });
            if (reason) out.push({ id: row.id, name: row.name, vatNumber: row.vat_number ?? '', city: row.city ?? '', reason });
        });
        const rank: Record<ClientMatchReason, number> = { 'stessa-partita-iva': 0, 'stesso-nome': 1, 'nome-simile': 2 };
        return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
    },

    getAll: async () => {
        const { data, error } = await fetchWithTimeout(
            supabase
                .from('clients')
                .select('*')
                .is('deleted_at', null)
                .order('name')
        );
        if (error) throw error;
        return data.map(mapDbToClient);
    },

    getPaginated: async (options: { page: number; limit: number; search?: string; letter?: string }) => {
        let query = supabase.from('clients').select('*', { count: 'estimated' }).is('deleted_at', null);

        // Multi-word fuzzy search
        if (options.search) {
            const words = options.search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
            // For each word, add an OR condition across searchable fields
            // Then we need ALL words to match (AND between words)
            // Supabase doesn't support AND(OR1, OR2), so we chain filters
            for (const word of words) {
                query = query.or(`name.ilike.%${word}%,vat_number.ilike.%${word}%,email.ilike.%${word}%,city.ilike.%${word}%`);
            }
        }

        // Alphabet filter
        if (options.letter) {
            query = query.ilike('name', `${options.letter}%`);
        }

        // Sort by name
        query = query.order('name');

        // Pagination
        const from = (options.page - 1) * options.limit;
        const to = from + options.limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await fetchWithTimeout(query);
        if (error) throw error;

        return {
            data: data.map(mapDbToClient),
            total: count || 0
        };
    },

    getById: async (id: string) => {
        const { data, error } = await fetchWithTimeout(
            supabase.from('clients').select('*').eq('id', id).single()
        );
        if (error) throw error;
        return mapDbToClient(data);
    },
    create: async (client: Partial<Client>) => {
        const { data, error } = await supabase.from('clients').insert(mapClientToDb(client)).select().single();
        if (error) throw error;
        return mapDbToClient(data);
    },
    update: async (id: string, client: Partial<Client>) => {
        const { data, error } = await supabase.from('clients').update(mapClientToDb(client)).eq('id', id).select().single();
        if (error) throw error;
        return mapDbToClient(data);
    },
    delete: async (id: string) => {
        const payload = await getSoftDeletePayload();
        const { error } = await supabase.from('clients').update(payload).eq('id', id);
        if (error) throw error;
    },

    restore: async (id: string) => {
        const { error } = await supabase
            .from('clients')
            .update({ deleted_at: null, deleted_by: null, deleted_by_name: null })
            .eq('id', id);
        if (error) throw error;
    },

    getDeleted: async () => {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((d: any) => ({
            ...mapDbToClient(d),
            deletedAt: d.deleted_at as string,
            deletedByName: d.deleted_by_name as string | null,
        }));
    },
};
