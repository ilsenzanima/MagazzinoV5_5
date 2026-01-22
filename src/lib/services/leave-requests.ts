
import { supabase } from '@/lib/supabase';
import { attendanceApi } from './attendance';

export interface LeaveRequest {
    id: string;
    worker_id: string;
    date: string;
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
    create: async (request: { workerId: string; date: string; hours: number }) => {
        // 1. Create the leave request record
        const { data: leaveRequest, error: leaveError } = await supabase
            .from('leave_requests')
            .insert({
                worker_id: request.workerId,
                date: request.date,
                hours: request.hours,
                status: 'approved' // Auto-approved as per requirements
            })
            .select()
            .single();

        if (leaveError) throw leaveError;

        // 2. Create the attendance record (Holiday/Permit)
        try {
            await attendanceApi.addAttendance({
                workerId: request.workerId,
                date: request.date,
                hours: request.hours,
                status: 'holiday', // Mapping 'Richiesta Permesso' to 'ferie/permesso' (holiday)
                notes: 'Richiesta Permesso (Auto-generato)'
            });
        } catch (attendanceError) {
            console.error('Failed to create attendance for leave request:', attendanceError);
            // Optional: Rollback leave request? 
            // For now, we'll keep the request but maybe warn. 
            // Ideally should be a transaction but Supabase client doesn't support easy transactions across multiple tables without RPC.
            // We'll assume happy path or manual fix.
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
