import type { SupabaseClient } from '@supabase/supabase-js';

// Giorni lavorativi con presenze da segnare.
// Un giorno e' «da segnare» se almeno un operaio controllato (attivo e con attendance_check) ha, in quel giorno,
// un totale di ore segnate inferiore a 8 (qualsiasi stato conta: presenza, ferie, malattia, permesso...).
// Si guardano i giorni lavorativi (lun-ven, senza festivita' nazionali) degli ultimi `daysBack` giorni; oggi conta solo dalle 17 in poi.

export const REQUIRED_DAILY_HOURS = 8;
export const DEFAULT_DAYS_BACK = 30;
export const TODAY_CUTOFF_HOUR = 17; // dalle 17 (ora italiana) anche la giornata di oggi risulta «da segnare»

export interface MissingDay {
    date: string; // yyyy-MM-dd
    workers: { id: string; name: string; hours: number }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function easterMonday(year: number): string {
    // Algoritmo di Gauss/Meeus per la Pasqua gregoriana
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const monday = new Date(year, month - 1, day + 1);
    return toIso(monday);
}

export function isItalianHoliday(d: Date): boolean {
    const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (['01-01', '01-06', '04-25', '05-01', '06-02', '08-15', '11-01', '12-08', '12-25', '12-26'].includes(md)) return true;
    return toIso(d) === easterMonday(d.getFullYear());
}

export function isWorkingDay(d: Date): boolean {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6 && !isItalianHoliday(d);
}

export async function getMissingDays(client: SupabaseClient, daysBack = DEFAULT_DAYS_BACK): Promise<MissingDay[]> {
    const { data: workers, error: wErr } = await client
        .from('workers')
        .select('id, first_name, last_name')
        .eq('is_active', true)
        .eq('attendance_check', true)
        .is('deleted_at', null);
    if (wErr) throw wErr;
    if (!workers || workers.length === 0) return [];

    // Ora e data in Italia (il server gira in UTC): da CUTOFF_HOUR in poi conta anche oggi
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
    const today = new Date(get('year'), get('month') - 1, get('day'));
    const startOffset = get('hour') >= TODAY_CUTOFF_HOUR ? 0 : 1;
    const days: Date[] = [];
    for (let i = startOffset; i <= daysBack; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (isWorkingDay(d)) days.push(d);
    }
    if (days.length === 0) return [];
    const from = toIso(days[days.length - 1]);
    const to = toIso(days[0]);

    const { data: rows, error } = await client
        .from('attendance')
        .select('worker_id, date, hours')
        .in('worker_id', workers.map(w => w.id))
        .gte('date', from)
        .lte('date', to);
    if (error) throw error;

    const totals = new Map<string, number>(); // workerId|date -> ore
    for (const r of rows ?? []) {
        const k = `${r.worker_id}|${r.date}`;
        totals.set(k, (totals.get(k) ?? 0) + Number(r.hours || 0));
    }

    const result: MissingDay[] = [];
    for (const d of days) {
        const iso = toIso(d);
        const short = workers
            .map(w => ({ id: w.id as string, name: `${w.first_name ?? ''} ${w.last_name ?? ''}`.trim(), hours: totals.get(`${w.id}|${iso}`) ?? 0 }))
            .filter(w => w.hours < REQUIRED_DAILY_HOURS - 0.001);
        if (short.length > 0) result.push({ date: iso, workers: short });
    }
    return result; // dal piu' recente al piu' vecchio
}
