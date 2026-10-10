import { supabase } from '@/lib/supabase';
import { fetchAllRows } from './utils';

// Stessa regola della scheda "Materiali" della commessa (JobStock): in commessa vanno
// uscite, vendite e acquisti diretti; i rientri (bolle di entrata) si sottraggono.
const SENT_TYPES = ['purchase', 'exit', 'sale'];
const RETURN_TYPES = ['entry'];
export const JOB_MOVEMENT_TYPES = [...SENT_TYPES, ...RETURN_TYPES];

export const MAX_COMPARED_JOBS = 6;

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Riga grezza della vista stock_movements_view
export interface JobMovementRow {
    type: string;
    item_id: string | null;
    item_code: string | null;
    item_name: string | null;
    item_model: string | null;
    item_unit: string | null;
    quantity: number | string;
    pieces: number | string | null;
    coefficient: number | string | null;
    is_fictitious: boolean | null;
    date: string;
}

export interface JobItemSummary {
    key: string;
    code: string;
    name: string;
    model: string;
    unit: string;
    isFictitious: boolean;
    // Quantità andata in commessa e rientrata, e quantità reale rimasta
    sent: number;
    returned: number;
    net: number;
    // Pezzi/confezioni nette, se i movimenti le riportano
    netPieces: number | null;
    movements: number;
}

interface ItemEvent {
    time: number;
    delta: number;
}

export interface JobAnalysis {
    jobId: string;
    items: JobItemSummary[];
    movementCount: number;
    firstDate: Date | null;
    lastDate: Date | null;
    // Numero di movimenti per mese (chiave: anno * 12 + mese)
    monthlyActivity: Record<number, number>;
    // Variazioni di quantità per articolo, usate per l'andamento nel tempo
    itemEvents: Record<string, ItemEvent[]>;
}

const monthNumber = (d: Date): number => d.getFullYear() * 12 + d.getMonth();

const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const monthLabel = (m: number): string => `${MONTH_NAMES[m % 12]} ${String(Math.floor(m / 12)).slice(2)}`;

// Funzione pura (testabile): riepilogo dei movimenti di una commessa
export const analyzeJob = (jobId: string, rows: JobMovementRow[]): JobAnalysis => {
    interface Acc extends JobItemSummary { hasPieces: boolean }
    const items = new Map<string, Acc>();
    const itemEvents: Record<string, ItemEvent[]> = {};
    const monthlyActivity: Record<number, number> = {};
    let movementCount = 0;
    let firstDate: Date | null = null;
    let lastDate: Date | null = null;

    for (const row of rows) {
        // Come in JobStock: i movimenti senza codice articolo non contano
        if (!row.item_code) continue;
        const isSent = SENT_TYPES.includes(row.type);
        const isReturn = RETURN_TYPES.includes(row.type);
        if (!isSent && !isReturn) continue;

        const date = new Date(row.date);
        if (isNaN(date.getTime())) continue;

        const qty = Math.abs(Number(row.quantity) || 0);
        const sign = isSent ? 1 : -1;
        const key = `${row.item_code}|${row.is_fictitious ? 1 : 0}`;

        let pieces: number | null = null;
        if (row.pieces !== null && row.pieces !== undefined) {
            pieces = Math.abs(Number(row.pieces) || 0);
        } else if (row.coefficient && Number(row.coefficient) !== 0) {
            pieces = qty / Math.abs(Number(row.coefficient));
        }

        let acc = items.get(key);
        if (!acc) {
            acc = {
                key,
                code: row.item_code,
                name: row.item_name || 'Articolo senza nome',
                model: row.item_model || '',
                unit: row.item_unit || 'PZ',
                isFictitious: !!row.is_fictitious,
                sent: 0,
                returned: 0,
                net: 0,
                netPieces: null,
                movements: 0,
                hasPieces: false,
            };
            items.set(key, acc);
        }

        if (isSent) acc.sent += qty;
        else acc.returned += qty;
        acc.movements += 1;
        if (pieces !== null) {
            acc.hasPieces = true;
            acc.netPieces = (acc.netPieces ?? 0) + sign * pieces;
        }

        (itemEvents[key] ??= []).push({ time: date.getTime(), delta: sign * qty });

        const m = monthNumber(date);
        monthlyActivity[m] = (monthlyActivity[m] || 0) + 1;
        movementCount += 1;
        if (!firstDate || date < firstDate) firstDate = date;
        if (!lastDate || date > lastDate) lastDate = date;
    }

    const summaries = Array.from(items.values()).map(({ hasPieces, ...item }) => {
        void hasPieces;
        return {
            ...item,
            sent: round2(item.sent),
            returned: round2(item.returned),
            net: round2(item.sent - item.returned),
            netPieces: item.netPieces === null ? null : round2(item.netPieces),
        };
    });

    return { jobId, items: summaries, movementCount, firstDate, lastDate, monthlyActivity, itemEvents };
};

export interface ComparisonRow {
    key: string;
    code: string;
    name: string;
    model: string;
    unit: string;
    isFictitious: boolean;
    // Riepilogo dell'articolo per ogni commessa in cui compare
    byJob: Record<string, JobItemSummary>;
}

// Unisce gli articoli di più commesse in una tabella di confronto, in ordine alfabetico
export const buildComparisonRows = (analyses: JobAnalysis[]): ComparisonRow[] => {
    const rows = new Map<string, ComparisonRow>();
    for (const analysis of analyses) {
        for (const item of analysis.items) {
            let row = rows.get(item.key);
            if (!row) {
                row = {
                    key: item.key,
                    code: item.code,
                    name: item.name,
                    model: item.model,
                    unit: item.unit,
                    isFictitious: item.isFictitious,
                    byJob: {},
                };
                rows.set(item.key, row);
            }
            row.byJob[analysis.jobId] = item;
        }
    }
    return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name, 'it'));
};

export type TimelineMode = 'calendar' | 'fromStart';
export type TimelinePoint = { label: string } & Record<string, number | string | null>;

// Serie mensili per il grafico, una per commessa (chiave = id commessa).
// - con `itemKey`: quantità reale in commessa di quell'articolo (cumulata, andati meno rientrati)
// - senza `itemKey`: numero di movimenti del mese, utile come panoramica senza mescolare unità di misura
// - 'calendar': mesi reali su un asse comune; 'fromStart': mesi dall'inizio di ogni commessa, per il confronto
export const buildTimeline = (
    analyses: JobAnalysis[],
    itemKey: string | null,
    mode: TimelineMode
): TimelinePoint[] => {
    const active = analyses.filter(a => a.firstDate && a.lastDate);
    if (active.length === 0) return [];

    const ranges = active.map(a => ({
        analysis: a,
        start: monthNumber(a.firstDate as Date),
        end: monthNumber(a.lastDate as Date),
    }));
    const globalMin = Math.min(...ranges.map(r => r.start));
    const globalMax = Math.max(...ranges.map(r => r.end));
    const length = mode === 'calendar'
        ? globalMax - globalMin + 1
        : Math.max(...ranges.map(r => r.end - r.start)) + 1;

    // Variazione di quantità per mese di ogni commessa
    const deltasByJob = new Map<string, Record<number, number>>();
    if (itemKey) {
        for (const { analysis } of ranges) {
            const deltas: Record<number, number> = {};
            for (const ev of analysis.itemEvents[itemKey] || []) {
                const m = monthNumber(new Date(ev.time));
                deltas[m] = (deltas[m] || 0) + ev.delta;
            }
            deltasByJob.set(analysis.jobId, deltas);
        }
    }

    const running = new Map<string, number>();
    const points: TimelinePoint[] = [];
    for (let i = 0; i < length; i++) {
        const point: TimelinePoint = {
            label: mode === 'calendar' ? monthLabel(globalMin + i) : `Mese ${i + 1}`,
        };
        for (const { analysis, start, end } of ranges) {
            const m = mode === 'calendar' ? globalMin + i : start + i;
            if (m < start || m > end) {
                point[analysis.jobId] = null;
                continue;
            }
            if (itemKey) {
                const total = (running.get(analysis.jobId) || 0) + (deltasByJob.get(analysis.jobId)?.[m] || 0);
                running.set(analysis.jobId, total);
                point[analysis.jobId] = round2(total);
            } else {
                point[analysis.jobId] = analysis.monthlyActivity[m] || 0;
            }
        }
        points.push(point);
    }
    return points;
};

export interface JobOption {
    id: string;
    code: string;
    title: string;
    status: string;
    clientName: string;
}

interface JobRow {
    id: string;
    code: string | null;
    name: string | null;
    description: string | null;
    status: string | null;
    clients: { name: string | null } | { name: string | null }[] | null;
}

export const analyticsApi = {
    // Elenco commesse selezionabili per l'analisi
    getJobOptions: async (): Promise<JobOption[]> => {
        const rows = await fetchAllRows<JobRow>((from, to) =>
            supabase
                .from('jobs')
                .select('id, code, name, description, status, clients(name)')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(from, to)
        );
        return rows.map(r => {
            const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
            return {
                id: r.id,
                code: r.code || 'Senza codice',
                title: r.name || r.description || '',
                status: r.status || '',
                clientName: client?.name || '',
            };
        });
    },

    // Movimenti di magazzino di una commessa (tutti, dall'inizio)
    getJobMovements: async (jobId: string): Promise<JobMovementRow[]> => {
        return fetchAllRows<JobMovementRow>((from, to) =>
            supabase
                .from('stock_movements_view')
                .select('type, item_id, item_code, item_name, item_model, item_unit, quantity, pieces, coefficient, is_fictitious, date')
                .eq('job_id', jobId)
                .in('type', JOB_MOVEMENT_TYPES)
                .order('date', { ascending: true })
                .order('id', { ascending: true })
                .range(from, to)
        );
    },
};
