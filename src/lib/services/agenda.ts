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
    // Voci importate in automatico (sola lettura): permessi richiesti, scadenze di corsi e visite mediche
    auto?: 'leave' | 'course' | 'exam';
    href?: string;
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

const addDaysIso = (isoDate: string, n: number) => {
    const d = new Date(`${isoDate}T12:00:00`);
    d.setDate(d.getDate() + n);
    return iso(d);
};

const AUTO_WARNING_DAYS = 60;

// Voci importate in automatico: permessi/ferie richiesti, ultimo attestato di ogni corso e ultima visita medica in scadenza
export async function getAutoItems(client: SupabaseClient): Promise<AgendaItem[]> {
    const today = todayIso();
    const [wRes, lRes, cRes, eRes] = await Promise.all([
        client.from('workers').select('id, first_name, last_name').eq('is_active', true).is('deleted_at', null),
        client.from('leave_requests').select('id, worker_id, date, end_date, hours, status').neq('status', 'rejected').gte('date', addDaysIso(today, -60)).order('date', { ascending: true }),
        client.from('worker_courses').select('id, worker_id, course_name, completion_date, validity_years'),
        client.from('worker_medical_exams').select('id, worker_id, exam_date, next_exam_date'),
    ]);
    const names = new Map<string, string>();
    (wRes.data ?? []).forEach((w: any) => names.set(w.id, `${w.last_name ?? ''} ${w.first_name ?? ''}`.trim()));
    const limit = addDaysIso(today, AUTO_WARNING_DAYS);
    const blank = { time: null, location: null, notes: null, jobId: null, jobLabel: null, remindDaysBefore: 7 };
    const out: AgendaItem[] = [];

    // Permessi e ferie: una riga per richiesta
    (lRes.data ?? []).forEach((r: any) => {
        if (!names.has(r.worker_id)) return;
        const end = r.end_date ?? r.date;
        const hours = Number(r.hours) || 0;
        out.push({
            ...blank, id: `leave-${r.id}`, kind: 'permesso', auto: 'leave', href: '/attendance/request',
            title: `${names.get(r.worker_id)} · ${hours > 0 && hours < 8 ? `permesso di ${hours} ore` : 'ferie / permesso'}`,
            date: r.date, endDate: r.end_date && r.end_date !== r.date ? r.end_date : null,
            workerId: r.worker_id, workerName: names.get(r.worker_id) ?? null,
            remindDaysBefore: 0, done: end < today,
        });
    });

    // Corsi: solo l'attestato più recente per operaio e corso
    const latestCourse = new Map<string, any>();
    (cRes.data ?? []).forEach((c: any) => {
        if (!names.has(c.worker_id)) return;
        const key = `${c.worker_id}|${c.course_name}`;
        const ex = latestCourse.get(key);
        if (!ex || c.completion_date > ex.completion_date) latestCourse.set(key, c);
    });
    latestCourse.forEach(c => {
        const d = new Date(`${c.completion_date}T12:00:00`);
        d.setFullYear(d.getFullYear() + (Number(c.validity_years) || 0));
        const expiry = iso(d);
        if (expiry > limit) return;
        out.push({
            ...blank, id: `course-${c.id}`, kind: 'corso', auto: 'course', href: `/workers/${c.worker_id}`,
            title: `${names.get(c.worker_id)} · scadenza ${c.course_name}`,
            date: expiry, endDate: null, workerId: c.worker_id, workerName: names.get(c.worker_id) ?? null, done: false,
        });
    });

    // Visite mediche: solo l'ultima di ogni operaio
    const latestExam = new Map<string, any>();
    (eRes.data ?? []).forEach((e: any) => {
        if (!names.has(e.worker_id)) return;
        const ex = latestExam.get(e.worker_id);
        if (!ex || e.exam_date > ex.exam_date) latestExam.set(e.worker_id, e);
    });
    latestExam.forEach(e => {
        if (!e.next_exam_date || e.next_exam_date > limit) return;
        out.push({
            ...blank, id: `exam-${e.id}`, kind: 'visita', auto: 'exam', href: `/workers/${e.worker_id}`,
            title: `${names.get(e.worker_id)} · prossima visita medica`,
            date: e.next_exam_date, endDate: null, workerId: e.worker_id, workerName: names.get(e.worker_id) ?? null, done: false,
        });
    });
    return out;
}

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
