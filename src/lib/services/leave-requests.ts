import { supabase } from '@/lib/supabase';
import { attendanceApi } from './attendance';
import { format, addDays, differenceInDays } from 'date-fns';

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
            const start = new Date(request.startDate);
            const end = new Date(request.endDate);
            const daysDiff = differenceInDays(end, start);

            for (let i = 0; i <= daysDiff; i++) {
                const currentDate = addDays(start, i);
                await attendanceApi.addAttendance({
                    workerId: request.workerId,
                    date: format(currentDate, 'yyyy-MM-dd'),
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
        const { error } = await supabase
            .from('leave_requests')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
