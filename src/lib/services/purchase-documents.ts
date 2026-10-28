import { supabase } from '@/lib/supabase';
import { Invoice, Purchase } from '@/lib/types';
import { fetchWithTimeout } from './utils';
import { mapDbToPurchase } from './purchases';
import { invoicesApi } from './invoices';

export type DocumentKind = 'purchase' | 'order' | 'invoice';

export type PurchaseDocumentSortKey = 'type' | 'number' | 'supplier' | 'date' | 'amount';

const SORT_COLUMNS: Record<PurchaseDocumentSortKey, string> = {
    type: 'doc_type',
    number: 'doc_number',
    supplier: 'supplier_name',
    date: 'doc_date',
    amount: 'total_amount',
};

export type PurchaseDocument =
    | { kind: 'purchase' | 'order'; id: string; purchase: Purchase & { isExhausted?: boolean } }
    | { kind: 'invoice'; id: string; invoice: Invoice };

interface Options {
    page?: number;
    limit?: number;
    search?: string;
    kind?: DocumentKind | 'all';
    supplierId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: PurchaseDocumentSortKey;
    dir?: 'asc' | 'desc';
    includeInvoices?: boolean;
}

// Una parola di ricerca senza i caratteri che spezzano i filtri (virgole e parentesi) o fanno da jolly
const clean = (w: string) => w.replace(/[,()%*\\]/g, '').toLowerCase();

// Virgola = OR tra gruppi, spazio = tutte le parole devono comparire (come nella ricerca acquisti di prima)
function applySearch<T extends { ilike: (c: string, p: string) => T; or: (f: string) => T }>(query: T, search: string): T {
    const groups = search
        .split(',')
        .map(g => g.split(/\s+/).map(clean).filter(Boolean))
        .filter(g => g.length > 0);
    if (groups.length === 0) return query;
    if (groups.length === 1) {
        return groups[0].reduce((q, w) => q.ilike('search_text', `%${w}%`), query);
    }
    const cond = groups
        .map(g => g.length === 1 ? `search_text.ilike.%${g[0]}%` : `and(${g.map(w => `search_text.ilike.%${w}%`).join(',')})`)
        .join(',');
    return query.or(cond);
}

export const purchaseDocumentsApi = {
    getPaginated: async ({
        page = 1, limit = 50, search = '', kind = 'all', supplierId = '',
        dateFrom = '', dateTo = '', sort = 'date', dir = 'desc', includeInvoices = true,
    }: Options) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('purchase_documents')
            .select('id, doc_type', { count: 'exact' });

        if (kind !== 'all') query = query.eq('doc_type', kind);
        else if (!includeInvoices) query = query.neq('doc_type', 'invoice');
        if (kind === 'invoice' && !includeInvoices) return { data: [] as PurchaseDocument[], total: 0 };

        if (supplierId) query = query.eq('supplier_id', supplierId);
        if (dateFrom) query = query.gte('doc_date', dateFrom);
        if (dateTo) query = query.lte('doc_date', dateTo);
        if (search) query = applySearch(query, search);

        const asc = dir === 'asc';
        query = query.order(SORT_COLUMNS[sort], { ascending: asc, nullsFirst: false });
        if (sort !== 'date') query = query.order('doc_date', { ascending: false });
        query = query.order('id').range(from, to);

        const { data: rows, error, count } = await fetchWithTimeout(query);
        if (error) throw error;

        const list = (rows || []) as { id: string; doc_type: DocumentKind }[];
        const purchaseIds = list.filter(r => r.doc_type !== 'invoice').map(r => r.id);
        const invoiceIds = list.filter(r => r.doc_type === 'invoice').map(r => r.id);

        const [purchasesRes, invoicesRes, exhaustedRes] = await Promise.all([
            purchaseIds.length === 0 ? Promise.resolve({ data: [], error: null }) : fetchWithTimeout(
                supabase
                    .from('purchases')
                    .select('*, suppliers(name), jobs(code, name, clients(name)), purchase_items(price, quantity, inventory(name, model), returned_at), invoices(invoice_number), converted_purchase:converted_purchase_id(delivery_note_number)')
                    .in('id', purchaseIds)
            ),
            invoiceIds.length === 0 ? Promise.resolve([] as Invoice[]) : invoicesApi.getByIds(invoiceIds),
            purchaseIds.length === 0 ? Promise.resolve({ data: [] }) : supabase.rpc('get_exhausted_purchase_ids'),
        ]);
        if (purchasesRes.error) throw purchasesRes.error;

        const exhausted = new Set(((exhaustedRes as { data: { purchase_id: string }[] | null }).data || []).map(e => e.purchase_id));
        const purchaseMap = new Map<string, Purchase & { isExhausted?: boolean }>(
            ((purchasesRes.data || []) as any[]).map(d => [d.id, { ...mapDbToPurchase(d), isExhausted: exhausted.has(d.id) }])
        );
        const invoiceMap = new Map((invoicesRes as Invoice[]).map(i => [i.id, i]));

        const data: PurchaseDocument[] = [];
        for (const r of list) {
            if (r.doc_type === 'invoice') {
                const invoice = invoiceMap.get(r.id);
                if (invoice) data.push({ kind: 'invoice', id: r.id, invoice });
            } else {
                const purchase = purchaseMap.get(r.id);
                if (purchase) data.push({ kind: r.doc_type, id: r.id, purchase });
            }
        }
        return { data, total: count ?? 0 };
    },
};
