import { supabase } from '@/lib/supabase';
import { addYears, differenceInCalendarDays, format } from 'date-fns';
import { NotificationPreferences } from './notification-preferences';

export type AlertKind = 'out_of_stock' | 'low_stock' | 'course' | 'medical_exam';

export interface AppAlert {
    id: string;
    kind: AlertKind;
    title: string;
    detail: string;
    href: string;
    // true = già scaduto / esaurito, false = in arrivo
    critical: boolean;
}

// Quanti giorni prima della scadenza iniziamo ad avvisare
const EXPIRY_WARNING_DAYS = 60;
const MAX_STOCK_ALERTS = 50;

interface CourseRow { id: string; worker_id: string; course_name: string; completion_date: string; validity_years: number }
interface ExamRow { id: string; worker_id: string; exam_date: string; next_exam_date: string }

const formatDays = (days: number): string => {
    if (days < 0) return `scaduto da ${Math.abs(days)} giorni`;
    if (days === 0) return 'scade oggi';
    return `scade tra ${days} giorni`;
};

const getStockAlerts = async (prefs: NotificationPreferences): Promise<AppAlert[]> => {
    if (!prefs.lowStock && !prefs.outOfStock) return [];

    // Solo articoli con una scorta minima impostata: gli altri non sono "tracciati"
    const { data, error } = await supabase
        .from('inventory')
        .select('id, code, name, quantity, min_stock, unit')
        .is('deleted_at', null)
        .gt('min_stock', 0)
        .order('name', { ascending: true })
        .limit(1000);

    if (error) throw error;

    const alerts: AppAlert[] = [];
    for (const item of data || []) {
        const quantity = Number(item.quantity) || 0;
        const minStock = Number(item.min_stock) || 0;
        const label = `${item.code ? item.code + ' · ' : ''}${item.name}`;
        const href = `/inventory/${item.id}`;

        if (quantity <= 0) {
            if (prefs.outOfStock) {
                alerts.push({ id: `out-${item.id}`, kind: 'out_of_stock', title: label, detail: 'Articolo esaurito', href, critical: true });
            }
        } else if (quantity <= minStock && prefs.lowStock) {
            alerts.push({
                id: `low-${item.id}`,
                kind: 'low_stock',
                title: label,
                detail: `Scorta bassa: ${quantity} ${item.unit || ''} (minimo ${minStock})`.replace(/\s+\)/, ')'),
                href,
                critical: false,
            });
        }
    }
    return alerts.slice(0, MAX_STOCK_ALERTS);
};

const getCourseAlerts = async (): Promise<AppAlert[]> => {
    const [{ data: workers, error: wErr }, { data: courses, error: cErr }] = await Promise.all([
        supabase.from('workers').select('id, first_name, last_name, is_active').is('deleted_at', null),
        supabase.from('worker_courses').select('id, worker_id, course_name, completion_date, validity_years'),
    ]);
    if (wErr) throw wErr;
    if (cErr) throw cErr;

    const activeWorkers = new Map<string, string>();
    (workers || []).filter(w => w.is_active).forEach(w => activeWorkers.set(w.id, `${w.last_name} ${w.first_name}`));

    // Per ogni operaio e corso conta solo l'attestato più recente
    const latest = new Map<string, CourseRow>();
    for (const c of courses || []) {
        if (!activeWorkers.has(c.worker_id)) continue;
        const key = `${c.worker_id}|${c.course_name}`;
        const existing = latest.get(key);
        if (!existing || c.completion_date > existing.completion_date) latest.set(key, c);
    }

    const today = new Date();
    const alerts: AppAlert[] = [];
    latest.forEach(c => {
        const expiry = addYears(new Date(c.completion_date), c.validity_years);
        const days = differenceInCalendarDays(expiry, today);
        if (days > EXPIRY_WARNING_DAYS) return;
        alerts.push({
            id: `course-${c.id}`,
            kind: 'course',
            title: `${activeWorkers.get(c.worker_id)} · ${c.course_name}`,
            detail: `Corso ${formatDays(days)} (${format(expiry, 'dd/MM/yyyy')})`,
            href: `/workers/${c.worker_id}`,
            critical: days < 0,
        });
    });
    return alerts.sort((a, b) => Number(b.critical) - Number(a.critical));
};

const getMedicalExamAlerts = async (): Promise<AppAlert[]> => {
    const [{ data: workers, error: wErr }, { data: exams, error: eErr }] = await Promise.all([
        supabase.from('workers').select('id, first_name, last_name, is_active').is('deleted_at', null),
        supabase.from('worker_medical_exams').select('id, worker_id, exam_date, next_exam_date'),
    ]);
    if (wErr) throw wErr;
    if (eErr) throw eErr;

    const activeWorkers = new Map<string, string>();
    (workers || []).filter(w => w.is_active).forEach(w => activeWorkers.set(w.id, `${w.last_name} ${w.first_name}`));

    // Conta solo l'ultima visita di ogni operaio
    const latest = new Map<string, ExamRow>();
    for (const e of exams || []) {
        if (!activeWorkers.has(e.worker_id)) continue;
        const existing = latest.get(e.worker_id);
        if (!existing || e.exam_date > existing.exam_date) latest.set(e.worker_id, e);
    }

    const today = new Date();
    const alerts: AppAlert[] = [];
    latest.forEach(e => {
        const next = new Date(e.next_exam_date);
        const days = differenceInCalendarDays(next, today);
        if (days > EXPIRY_WARNING_DAYS) return;
        alerts.push({
            id: `exam-${e.id}`,
            kind: 'medical_exam',
            title: activeWorkers.get(e.worker_id) || 'Operaio',
            detail: `Visita medica ${formatDays(days)} (${format(next, 'dd/MM/yyyy')})`,
            href: `/workers/${e.worker_id}`,
            critical: days < 0,
        });
    });
    return alerts.sort((a, b) => Number(b.critical) - Number(a.critical));
};

export const notificationsApi = {
    // Calcola gli avvisi attivi in base alle preferenze dell'utente.
    // Se una sorgente fallisce le altre vengono comunque mostrate.
    getAlerts: async (prefs: NotificationPreferences): Promise<AppAlert[]> => {
        const results = await Promise.allSettled([
            getStockAlerts(prefs),
            prefs.expiringCourses ? getCourseAlerts() : Promise.resolve([]),
            prefs.expiringMedicalExams ? getMedicalExamAlerts() : Promise.resolve([]),
        ]);
        return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    },
};
