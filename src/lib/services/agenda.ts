import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type AgendaKind = 'appuntamento' | 'scadenza' | 'consegna' | 'visita' | 'corso' | 'permesso' | 'nota';

export const AGENDA_KINDS: { value: AgendaKind; label: string; badge: string }[] = [
    { value: 'appuntamento', label: 'Appuntamento', badge: 'border-blue-200 bg-blue-50 text-blue-700' },
    { value: 'scadenza', label: 'Scadenza', badge: 'border-red-200 bg-red-50 text-red-700' },
    { value: 'consegna', label: 'Consegna materiale', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { value: 'visita', label: 'Visita medica', badge: 'border-violet-200 bg-violet-50 text-violet-700' },
    { value: 'corso', label: 'Corso', badge: 'border-amber-200 bg-amber-50 text-amber-700' },
    { value: 'permesso', label: 'Ferie / permesso', badge: 'border-slate-200 bg-slate-100 text-slate-700' },
    { value: 'nota', label: 'Nota', badge: 'border-slate-200 bg-white text-slate-600' },
];

export const kindInfo = (kind: AgendaKind) => AGENDA_KINDS.find(k => k.value === kind) ?? AGENDA_KINDS[0];

export interface AgendaItem {
    id: string;
    title: string;
    kind: AgendaKind;
    date: string; // yyyy-MM-dd
    time: string | null; // HH:mm
    endDate: string | null;
    location: string | null;
    notes: string | null;
    workerId: string | null;
    workerName: string | null;
    jobId: string | null;
    jobLabel: string | null;
    remindDaysBefore: number;
    done: boolean;
}

export type AgendaInput = Omit<AgendaItem, 'id' | 'done' | 'workerName' | 'jobLabel'>;

const SELECT = '*, workers(first_name, last_name), jobs(code, name)';

const map = (r: any): AgendaItem => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    date: r.date,
    time: r.time ? String(r.time).slice(0, 5) : null,
    endDate: r.end_date,
    location: r.location,
    notes: r.notes,
    workerId: r.worker_id,
    workerName: r.workers ? `${r.workers.last_name ?? ''} ${r.workers.first_name ?? ''}`.trim() : null,
    jobId: r.job_id,
    jobLabel: r.jobs ? `${r.jobs.code} ${r.jobs.name}` : null,
    remindDaysBefore: r.remind_days_before ?? 1,
    done: !!r.done,
});

const toRow = (i: AgendaInput) => ({
    title: i.title.trim(),
    kind: i.kind,
    date: i.date,
    time: i.time || null,
    end_date: i.endDate || null,
    location: i.location?.trim() || null,
    notes: i.notes?.trim() || null,
    worker_id: i.workerId || null,
    job_id: i.jobId || null,
    remind_days_before: i.remindDaysBefore,
    updated_at: new Date().toISOString(),
});

export const agendaApi = {
    getAll: async (): Promise<AgendaItem[]> => {
        const { data, error } = await supabase.from('agenda_items').select(SELECT).order('date', { ascending: true }).order('time', { ascending: true, nullsFirst: true });
        if (error) throw error;
        return (data ?? []).map(map);
    },
    create: async (input: AgendaInput): Promise<void> => {
        const { error } = await supabase.from('agenda_items').insert(toRow(input));
        if (error) throw error;
    },
    update: async (id: string, input: AgendaInput): Promise<void> => {
        const { error } = await supabase.from('agenda_items').update(toRow(input)).eq('id', id);
        if (error) throw error;
    },
    setDone: async (id: string, done: boolean): Promise<void> => {
        const { error } = await supabase.from('agenda_items').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', id);
        if (error) throw error;
    },
    remove: async (id: string): Promise<void> => {
        const { error } = await supabase.from('agenda_items').delete().eq('id', id);
        if (error) throw error;
    },
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => iso(new Date());

// Voci non fatte da ricordare: scadute, di oggi o dentro la finestra «ricordami N giorni prima»
export async function getAgendaDue(client: SupabaseClient): Promise<{ overdue: number; today: number; reminders: AgendaItem[] }> {
    const { data, error } = await client.from('agenda_items').select(SELECT).eq('done', false).order('date', { ascending: true });
    if (error) throw error;
    const today = todayIso();
    const items = (data ?? []).map(map);
    const reminders = items.filter(i => {
        const from = new Date(`${i.date}T12:00:00`);
        from.setDate(from.getDate() - i.remindDaysBefore);
        return iso(from) <= today;
    });
    return {
        overdue: items.filter(i => (i.endDate ?? i.date) < today).length,
        today: items.filter(i => i.date <= today && (i.endDate ?? i.date) >= today).length,
        reminders,
    };
}
