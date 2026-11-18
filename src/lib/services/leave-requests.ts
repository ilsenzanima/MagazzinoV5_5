import { supabase } from '@/lib/supabase';
import { attendanceApi } from './attendance';
import { format, addDays, differenceInDays } from 'date-fns';
import { isItalianHoliday } from '@/lib/utils';

export interface LeaveRequest {
    id: string;
    worker_id: string;
    date: string;
    end_date: string;
    hours: number;
    requester_id?: string;
    status: string;
    created_at: string;
    // Joined fields
    worker?: {
        first_name: string;
        last_name: string;
    };
}

const toLocalDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Giorni di una richiesta: i sabati, le domeniche e i festivi non si calcolano.
// Se il periodo è fatto solo di giorni non lavorativi (es. un solo sabato) si tengono tutti, come richiesto.
export function leaveDays(startDate: string, endDate: string): { counted: string[]; skipped: string[] } {
    const start = toLocalDate(startDate);
    const total = Math.max(0, differenceInDays(toLocalDate(endDate), start));
    const counted: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i <= total; i++) {
        const day = addDays(start, i);
        const off = day.getDay() === 0 || day.getDay() === 6 || isItalianHoliday(day);
        (off ? skipped : counted).push(format(day, 'yyyy-MM-dd'));
    }
    return counted.length === 0 ? { counted: skipped, skipped: [] } : { counted, skipped };
}

export const leaveRequestsApi = {
    create: async (request: { workerId: string; startDate: string; endDate: string; hours: number }) => {
        // 1. Create the leave request record
        const { data: leaveRequest, error: leaveError } = await supabase
            .from('leave_requests')
            .insert({
                worker_id: request.workerId,
                date: request.startDate,
                end_date: request.endDate,
                hours: request.hours,
                status: 'approved'
            })
            .select()
            .single();

        if (leaveError) throw leaveError;

        // 2. Create attendance records for each day in the range
        try {
            // Si crea una riga di presenza solo per i giorni da calcolare; la richiesta resta una sola (un solo avviso in agenda)
            for (const day of leaveDays(request.startDate, request.endDate).counted) {
                await attendanceApi.addAttendance({
                    workerId: request.workerId,
                    date: day,
                    hours: request.hours,
                    status: 'holiday',
                    notes: 'Richiesta Permesso (Auto-generato)'
                });
            }
        } catch (attendanceError) {
            console.error('Failed to create attendance for leave request:', attendanceError);
            throw attendanceError;
        }

        return leaveRequest;
    },

    getAll: async (): Promise<LeaveRequest[]> => {
        const { data, error } = await supabase
            .from('leave_requests')
            .select('*, workers(first_name, last_name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((item: any) => ({
            ...item,
            worker: item.workers
        }));
    },

    delete: async (id: string): Promise<void> => {
        // Toglie anche le ore inserite in automatico dalla richiesta (non quelle scritte a mano)
        const { data: req } = await supabase.from('leave_requests').select('worker_id, date, end_date').eq('id', id).maybeSingle();
        if (req) {
            const { error: attErr } = await supabase
                .from('attendance')
                .delete()
                .eq('worker_id', req.worker_id)
                .eq('status', 'holiday')
                .eq('notes', 'Richiesta Permesso (Auto-generato)')
                .gte('date', req.date)
                .lte('date', req.end_date || req.date);
            if (attErr) throw attErr;
        }
        const { error } = await supabase
            .from('leave_requests')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
